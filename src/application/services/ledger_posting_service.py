from __future__ import annotations

import logging
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID, uuid4
from src.application.services.expert_accounting_guard import ExpertAccountingGuard
from src.application.services.dian_realtime_verifier import DianRealtimeVerifier
from src.config import settings
from src.domain.exceptions import PeriodLockedException, TenantRequiredException, UnbalancedEntryException
from src.domain.models.accounting import AccountingPeriod, AuditLog, FinancialDocument, JournalEntry, JournalLine, OutboxEvent
from sqlalchemy import and_, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import selectinload
from src.infrastructure.repositories.ledger_repository import LedgerRepository
from src.infrastructure.events.event_types import EventTopic, build_event_payload

logger = logging.getLogger(__name__)


def _masked_database_url() -> str:
    try:
        return make_url(settings.database_url).render_as_string(hide_password=True)
    except Exception:
        return settings.database_url


class LedgerPostingService:
    def __init__(self, uow_factory, hash_service):
        self.uow_factory = uow_factory
        self.hash_service = hash_service
        self.expert_guard = ExpertAccountingGuard(
            DianRealtimeVerifier(
                nit_lookup_url=settings.dian_nit_lookup_url,
                cufe_validation_url=settings.dian_cufe_validation_url,
                token=settings.dian_lookup_token or settings.sunat_lookup_token,
                timeout_seconds=settings.dian_realtime_timeout_seconds,
            ),
            dian_enabled=settings.dian_realtime_guard_enabled,
            block_on_unavailable=settings.dian_guard_block_on_unavailable,
        )

    def _run_expert_guard(self, payload: dict) -> None:
        if not settings.expert_accounting_enabled:
            return
        self.expert_guard.enforce_or_raise(payload)


    SYSTEM_USER_UUID = UUID("00000000-0000-0000-0000-000000000001")

    def _actor_uuid(self, value: str | None):
        """Dev tokens can send user_id='erp.operator'. DB columns are UUID with FK to users.
        Use the fixed system user UUID that must exist in users.
        """
        if not value:
            return self.SYSTEM_USER_UUID
        try:
            return UUID(str(value))
        except Exception:
            return self.SYSTEM_USER_UUID

    def _json_safe(self, value):
        """Convert Decimal/date/datetime/UUID recursively before writing JSONB."""
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, (date, datetime)):
            return value.isoformat()
        if isinstance(value, UUID):
            return str(value)
        if isinstance(value, dict):
            return {str(k): self._json_safe(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._json_safe(v) for v in value]
        if isinstance(value, tuple):
            return [self._json_safe(v) for v in value]
        return value

    def _text(self, value) -> str:
        return str(value or "").strip()

    def _money_text(self, value) -> str:
        return str(self._as_decimal(value))

    def _existing_purchase_differences(
        self,
        document: FinancialDocument,
        purchase_data: dict,
        subtotal: Decimal,
        iva: Decimal,
        total: Decimal,
        issue_date,
    ) -> dict:
        metadata = document.metadata_json or {}
        checks = {
            "supplier_ruc": (metadata.get("supplier_ruc"), purchase_data.get("supplier_ruc")),
            "supplier_name": (metadata.get("supplier_name"), purchase_data.get("supplier_name")),
            "taxable_amount": (str(document.taxable_amount), str(subtotal)),
            "tax_amount": (str(document.tax_amount), str(iva)),
            "total_amount": (str(document.total_amount), str(total)),
            "issue_date": (document.issue_date.isoformat() if document.issue_date else None, issue_date.isoformat() if isinstance(issue_date, date) else str(issue_date)),
        }
        differences = {}
        for key, (old, new) in checks.items():
            if self._text(old) != self._text(new):
                differences[key] = {"registrado": old, "nuevo": new}
        return differences

    def _as_decimal(self, value, default="0.00") -> Decimal:
        amount = Decimal(str(default if value is None or value == "" else value)).quantize(Decimal("0.01"))
        return amount

    def _as_date(self, value) -> date:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str) and value.strip():
            return date.fromisoformat(value.strip()[:10])
        return date.today()

    def _prepare_entry_lines(self, entry: JournalEntry, lines: list[JournalLine]) -> None:
        """Populate reinforced Diario fields before flush.

        Migration 010 made periodo_fiscal/modulo_origen/linea_idx mandatory on
        journal_lines. Some callers only set entry_id, so the ORM relationship
        event cannot reliably infer those values. Fill them here in the
        canonical posting service.
        """
        entry_date = self._as_date(entry.entry_date)
        entry.entry_date = entry_date
        module = str(entry.source_module or "ACCOUNTING")[:20]
        entry.lines = lines
        for idx, line in enumerate(lines, start=1):
            line.entry_id = entry.id
            line.tenant_id = line.tenant_id or entry.tenant_id
            if not line.company_id and entry.company_id:
                line.company_id = entry.company_id
            line.periodo_fiscal = entry_date.strftime("%Y-%m")
            line.modulo_origen = module
            line.linea_idx = idx
            if line.tipo_cambio is None:
                line.tipo_cambio = Decimal("1.0000")
            if line.document_type and not line.comp_tipo:
                line.comp_tipo = str(line.document_type)[:2]
            if line.partner_ruc and not line.tercero_num:
                line.tercero_num = line.partner_ruc
                if not line.tercero_tipo_doc:
                    # Map partner identifier length to document type
                    #  - 5-8 digits -> cedula (tipo 1)
                    #  - >=9 digits -> NIT-like (tipo 6)
                    pr_len = len(line.partner_ruc or "")
                    if 5 <= pr_len <= 8:
                        line.tercero_tipo_doc = "1"
                    elif pr_len >= 9:
                        line.tercero_tipo_doc = "6"
                    else:
                        line.tercero_tipo_doc = None

    def _normalize_code(self, value: str | None, fallback: str | None = None) -> str:
        # Use tenant/global default expense account when fallback not provided
        fallback = fallback or settings.default_expense_account
        cleaned = "".join(ch for ch in str(value or "") if ch.isdigit())
        return cleaned or fallback

    def _account_class(self, code: str) -> str:
        return (self._normalize_code(code, "0")[:1] or "0")[:2]

    def _statement_for_account(self, code: str) -> str:
        first = self._normalize_code(code, "0")[:1]
        if first in {"1", "2", "3"}:
            return "BALANCE"
        if first in {"4", "5", "6", "7"}:
            return "PROFIT_LOSS"
        return "UNCLASSIFIED"

    def _nature_for_account(self, code: str) -> str:
        first = self._normalize_code(code, "0")[:1]
        return "CREDIT" if first in {"2", "3", "4", "5", "7"} else "DEBIT"

    def _requires_cost_center(self, code: str) -> bool:
        # En Colombia (PUC), los Gastos (5) y Costos (6) requieren Centro de Costo
        return self._normalize_code(code, "0")[:1] in {"5", "6"}

    async def post_journal(self, payload: dict) -> JournalEntry:
        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            raise TenantRequiredException("tenant_id es obligatorio")

        lines_payload = payload.get("lines") or []
        if len(lines_payload) < 2:
            raise UnbalancedEntryException("Un asiento requiere al menos dos lineas")

        self._run_expert_guard(payload)

        async with self.uow_factory(tenant_id) as uow:
            repo = LedgerRepository(uow.session)
            period = await repo.get_period_for_update(tenant_id, int(payload["year"]), int(payload["month"]))
            if period and period.is_closed:
                raise PeriodLockedException("Periodo contable cerrado")
            if not period:
                period = AccountingPeriod(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    year=int(payload["year"]),
                    month=int(payload["month"]),
                    status="OPEN",
                    is_closed=False,
                )
                uow.session.add(period)
                await uow.session.flush()

            company_id = payload.get("company_id")
            lines = [
                JournalLine(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    company_id=company_id,
                    account_code=line["account_code"],
                    account_name=line.get("account_name"),
                    debit=Decimal(str(line.get("debit", "0.00"))),
                    credit=Decimal(str(line.get("credit", "0.00"))),
                    cost_center=line.get("cost_center"),
                    project_code=line.get("project_code"),
                    partner_ruc=line.get("partner_ruc"),
                    document_type=line.get("document_type"),
                    document_series=line.get("document_series"),
                    document_number=line.get("document_number"),
                )
                for line in lines_payload
            ]

            total_debit = sum(x.debit for x in lines)
            total_credit = sum(x.credit for x in lines)
            if total_debit != total_credit:
                raise UnbalancedEntryException(f"Debe {total_debit} != Haber {total_credit}")

            last_entry = await repo.get_last_entry_for_update(tenant_id)
            previous_hash = last_entry.row_hash if last_entry else "GENESIS"
            entry = JournalEntry(
                id=uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                period_id=period.id,
                entry_date=self._as_date(payload.get("entry_date")),
                description=payload["description"],
                source_module=payload.get("source_module", "ACCOUNTING"),
                source_id=payload.get("source_id"),
                currency=payload.get("currency", "COP"),
                total_debit=total_debit,
                total_credit=total_credit,
                previous_hash=previous_hash,
                row_hash="PENDING",
                created_by=self._actor_uuid(payload.get("user_id")),
            )
            self._prepare_entry_lines(entry, lines)

            entry.row_hash = self.hash_service.generate(entry, lines, previous_hash)
            await repo.add_entry(entry, lines)
            if payload.get("financial_document"):
                document_payload = dict(payload["financial_document"])
                if "metadata_json" in document_payload:
                    document_payload["metadata_json"] = self._json_safe(document_payload["metadata_json"])
                document = FinancialDocument(
                    tenant_id=tenant_id,
                    company_id=company_id,
                    journal_entry_id=entry.id,
                    **document_payload,
                )
                await repo.add_financial_document(document)
            await repo.add_audit(AuditLog(
                tenant_id=tenant_id,
                trace_id=payload["trace_id"],
                entity_type="JournalEntry",
                entity_id=str(entry.id),
                action="CREATE_POSTED",
                before_state=None,
                after_state={
                    "entry_id": str(entry.id),
                    "row_hash": entry.row_hash,
                    "source_module": entry.source_module,
                    "total": str(total_debit),
                },
                actor_user_id=self._actor_uuid(payload.get("user_id")),
                ip_address=payload.get("ip_address"),
                user_agent=payload.get("user_agent"),
            ))

            for event in payload.get("outbox_events", []):
                await repo.add_outbox(OutboxEvent(
                    tenant_id=tenant_id,
                    topic=event["topic"],
                    aggregate_type=event.get("aggregate_type", "JournalEntry"),
                    aggregate_id=str(entry.id),
                    payload=self._json_safe(event.get("payload", {"journal_entry_id": str(entry.id), "trace_id": payload["trace_id"]})),
                    status="PENDING",
                    attempts=0,
                    max_attempts=event.get("max_attempts", 3),
                ))

            await uow.commit()
            return entry

    async def post_purchase_invoice(self, purchase_data: dict) -> JournalEntry:
        tenant_id = purchase_data.get("tenant_id")
        if not tenant_id:
            raise TenantRequiredException("tenant_id es obligatorio")

        subtotal = self._as_decimal(purchase_data["subtotal"])
        iva = self._as_decimal(purchase_data.get("iva") or "0.00")
        total = self._as_decimal(purchase_data["total"])
        retefuente = self._as_decimal(purchase_data.get("retefuente_amount", purchase_data.get("detraccion_amount", "0.00")))
        reteiva = self._as_decimal(purchase_data.get("reteiva_amount", purchase_data.get("percepcion_amount", "0.00")))
        retencion = self._as_decimal(purchase_data.get("retencion_amount", "0.00"))
        payable_balance = (total - reteiva - retencion - retefuente).quantize(Decimal("0.01"))
        company_id = purchase_data.get("company_id")
        supplier_ruc = purchase_data.get("supplier_nit") or purchase_data.get("supplier_ruc")
        doc_type = purchase_data.get("doc_type", "01")  # Default document type
        serie = str(purchase_data.get("serie") or "").strip().upper()
        number = str(purchase_data.get("number") or "").strip()
        # Fecha de registro = entry_date (hoy, cuando se ingresa el documento)
        document_date = purchase_data.get("entry_date") or date.today()
        if isinstance(document_date, str):
            document_date = date.fromisoformat(document_date[:10])
        # Fecha de emisión del comprobante = issue_date (puede ser de períodos anteriores)
        invoice_issue_date_raw = purchase_data.get("issue_date") or document_date
        if isinstance(invoice_issue_date_raw, str):
            invoice_issue_date_raw = date.fromisoformat(invoice_issue_date_raw[:10])
        invoice_issue_date: date = invoice_issue_date_raw
        # El período contable usa la fecha de REGISTRO (entry_date = hoy)
        purchase_data["year"] = document_date.year
        purchase_data["month"] = document_date.month

        # Regla profesional de duplicados:
        # Un comprobante de compras AP no puede registrarse dos veces.
        # Si existe con diferencias críticas, se genera nota de auditoría/corrección
        # y se devuelve el asiento existente sin pisar ni duplicar información.
        async with self.uow_factory(tenant_id) as uow:
            existing_result = await uow.session.execute(
                select(FinancialDocument)
                .where(
                    and_(
                        FinancialDocument.tenant_id == tenant_id,
                        FinancialDocument.direction == "AP",
                        FinancialDocument.document_type == doc_type,
                        FinancialDocument.series == serie,
                        FinancialDocument.number == number,
                    )
                )
            )
            existing_document = existing_result.scalar_one_or_none()

            if existing_document:
                differences = self._existing_purchase_differences(
                    existing_document,
                    purchase_data,
                    subtotal,
                    iva,
                    total,
                    document_date,
                )

                if differences:
                    await uow.session.merge(AuditLog(
                        tenant_id=tenant_id,
                        trace_id=purchase_data.get("trace_id") or str(uuid4()),
                        entity_type="FinancialDocument",
                        entity_id=str(existing_document.id),
                        action="PURCHASE_CORRECTION_NOTE_REQUIRED",
                        before_state=self._json_safe({
                            "document_id": str(existing_document.id),
                            "series": existing_document.series,
                            "number": existing_document.number,
                            "metadata_json": existing_document.metadata_json or {},
                            "taxable_amount": existing_document.taxable_amount,
                            "tax_amount": existing_document.tax_amount,
                            "total_amount": existing_document.total_amount,
                            "issue_date": existing_document.issue_date,
                        }),
                        after_state=self._json_safe({
                            "message": "Intento de registrar comprobante de compra ya existente con diferencias. Se requiere nota/corrección controlada.",
                            "document": f"{serie}-{number}",
                            "direction": "AP",
                            "document_type": doc_type,
                            "differences": differences,
                            "incoming_supplier_ruc": supplier_ruc,
                            "incoming_supplier_name": purchase_data.get("supplier_name"),
                            "incoming_total": total,
                            "required_action": "CREATE_CORRECTION_NOTE_OR_REVERSAL",
                        }),
                        actor_user_id=self._actor_uuid(purchase_data.get("user_id")),
                        ip_address=purchase_data.get("ip_address"),
                        user_agent=purchase_data.get("user_agent"),
                    ))
                    await uow.session.merge(OutboxEvent(
                        tenant_id=tenant_id,
                        topic="accounting.purchase.correction_required",
                        aggregate_type="FinancialDocument",
                        aggregate_id=str(existing_document.id),
                        payload=self._json_safe({
                            "document_id": str(existing_document.id),
                            "document": f"{serie}-{number}",
                            "differences": differences,
                            "trace_id": purchase_data.get("trace_id"),
                        }),
                        status="PENDING",
                        attempts=0,
                        max_attempts=3,
                    ))
                    await uow.commit()

                if existing_document.journal_entry_id:
                    existing_entry_result = await uow.session.execute(
                        select(JournalEntry)
                        .options(selectinload(JournalEntry.lines))
                        .where(
                            and_(
                                JournalEntry.tenant_id == tenant_id,
                                JournalEntry.id == existing_document.journal_entry_id,
                            )
                        )
                    )
                    existing_entry = existing_entry_result.scalar_one_or_none()
                    if existing_entry:
                        return existing_entry

                raise UnbalancedEntryException(
                    f"El documento de compra {serie}-{number} ya existe sin asiento contable vinculado. "
                    "Revise financial_documents antes de postear nuevamente."
                )

        incoming_account_lines = purchase_data.get("account_lines") or []
        lines: list[dict] = []

        if incoming_account_lines:
            for raw in incoming_account_lines:
                debit = self._as_decimal(raw.get("debit", "0.00"))
                credit = self._as_decimal(raw.get("credit", "0.00"))
                # Flip negative values to the opposite side to satisfy journal_lines_check1 (debit >= 0, credit >= 0)
                if debit < 0:
                    credit = credit + abs(debit)
                    debit = Decimal("0.00")
                if credit < 0:
                    debit = debit + abs(credit)
                    credit = Decimal("0.00")
                if debit == 0 and credit == 0:
                    continue
                account_code = self._normalize_code(raw.get("account_code"), purchase_data.get("expense_account") or settings.default_expense_account)
                cost_center = raw.get("cost_center")
                if cost_center == "-":
                    cost_center = None
                lines.append({
                    "account_code": account_code,
                    "account_name": raw.get("account_name") or f"Cuenta {account_code}",
                    "debit": debit,
                    "credit": credit,
                    "partner_ruc": raw.get("partner_ruc") or supplier_ruc,
                    "document_type": raw.get("document_type") or doc_type,
                    "document_series": raw.get("document_series") or serie,
                    "document_number": raw.get("document_number") or number,
                    "cost_center": cost_center,
                    "project_code": raw.get("project_code"),
                })
        else:
            lines = [
                {
                    "account_code": self._normalize_code(purchase_data.get("expense_account") or settings.default_expense_account),
                    "account_name": "Compras y gastos",
                    "debit": subtotal,
                    "credit": Decimal("0.00"),
                    "partner_ruc": supplier_ruc,
                    "document_type": doc_type,
                    "document_series": serie,
                    "document_number": number,
                    "cost_center": purchase_data.get("cost_center"),
                },
                {
                    "account_code": "2408",
                    "account_name": "IVA descontable",
                    "debit": iva,
                    "credit": Decimal("0.00"),
                    "partner_ruc": supplier_ruc,
                    "document_type": doc_type,
                    "document_series": serie,
                    "document_number": number,
                    "cost_center": None,
                },
                {
                    "account_code": "2208",
                    "account_name": "Obligaciones comerciales",
                    "account_code": "220505",
                    "account_name": "Proveedores nacionales",
                    "debit": Decimal("0.00"),
                    "credit": payable_balance,
                    "partner_ruc": supplier_ruc,
                    "document_type": doc_type,
                    "document_series": serie,
                    "document_number": number,
                    "cost_center": None,
                },
            ]
            if retefuente:
                lines.append({"account_code": "236505", "account_name": "ReteFuente por pagar", "debit": Decimal("0.00"), "credit": retefuente, "partner_ruc": supplier_ruc, "document_type": doc_type, "document_series": serie, "document_number": number, "cost_center": None})
            if retencion:
                lines.append({"account_code": "236505", "account_name": "ReteFuente por pagar", "debit": Decimal("0.00"), "credit": retencion, "partner_ruc": supplier_ruc, "document_type": doc_type, "document_series": serie, "document_number": number, "cost_center": None})
            if reteiva:
                lines.append({"account_code": "236515", "account_name": "ReteIVA por pagar", "debit": Decimal("0.00"), "credit": reteiva, "partner_ruc": supplier_ruc, "document_type": doc_type, "document_series": serie, "document_number": number, "cost_center": None})

        total_debit = sum(self._as_decimal(line.get("debit")) for line in lines)
        total_credit = sum(self._as_decimal(line.get("credit")) for line in lines)
        if total_debit != total_credit:
            raise UnbalancedEntryException(f"Compra descuadrada: Debe {total_debit} != Haber {total_credit}")

        # Enforce cost center for expense/analytic accounts.
        for line in lines:
            if self._requires_cost_center(line["account_code"]) and not line.get("cost_center"):
                raise UnbalancedEntryException(f"La cuenta {line['account_code']} requiere centro de costo")

        account_upserts = list(purchase_data.get("accounts_to_upsert") or [])
        existing_codes = {str(item.get("account_code") or "") for item in account_upserts}
        for line in lines:
            code = line["account_code"]
            if code and code not in existing_codes:
                account_upserts.append({
                    "account_code": code,
                    "account_name": line.get("account_name") or f"Cuenta {code}",
                    "account_class": self._account_class(code),
                    "statement": self._statement_for_account(code),
                    "nature": self._nature_for_account(code),
                    "accepts_cost_center": self._requires_cost_center(code),
                    "accepts_partner": bool(line.get("partner_ruc")),
                })

        cost_center_upserts = list(purchase_data.get("cost_centers_to_upsert") or [])
        known_centers = {str(item.get("code") or "").upper() for item in cost_center_upserts}
        for line in lines:
            center = str(line.get("cost_center") or "").upper()
            if center and center not in known_centers:
                cost_center_upserts.append({"code": center, "name": center})
                known_centers.add(center)

        async with self.uow_factory(tenant_id) as uow:
            repo = LedgerRepository(uow.session)
            for account in account_upserts:
                code = self._normalize_code(account.get("account_code"))
                await repo.upsert_chart_account(
                    tenant_id,
                    company_id=company_id,
                    code=code,
                    name=account.get("account_name") or f"Cuenta {code}",
                    account_class=str(account.get("account_class") or self._account_class(code))[:2],
                    statement=account.get("statement") or self._statement_for_account(code),
                    nature=account.get("nature") or self._nature_for_account(code),
                    accepts_cost_center=account.get("accepts_cost_center") if account.get("accepts_cost_center") is not None else self._requires_cost_center(code),
                    accepts_partner=account.get("accepts_partner") if account.get("accepts_partner") is not None else False,
                )
            for center in cost_center_upserts:
                await repo.upsert_cost_center(
                    tenant_id,
                    company_id=company_id,
                    code=center.get("code"),
                    name=center.get("name") or center.get("code"),
                    parent_code=center.get("parent_code"),
                )
            await uow.commit()

        # Alerta de anotación tardía: comprobante de período anterior registrado hoy
        late_registration_alert: str | None = None
        months_diff = 0
        if invoice_issue_date and document_date:
            months_diff = (document_date.year - invoice_issue_date.year) * 12 + (document_date.month - invoice_issue_date.month)
            if months_diff > 0:
                late_registration_alert = True
                logger.warning(
                    "CONTA_PRO late_registration tenant=%s serie=%s-%s issue=%s entry=%s diff_months=%d",
                    tenant_id,
                    serie,
                    number,
                    invoice_issue_date,
                    document_date,
                    months_diff,
                )

        # Build concise financial metadata (short, machine-friendly) to avoid
        # storing large human-readable texts coming from OCR/AI.
        items = purchase_data.get("line_items") or purchase_data.get("items") or []
        processed_items = []
        for it in items:
            desc = str(it.get("description") or "")
            req_support = any(k in desc.lower() for k in ("requiere sustento", "requiere sustento adicional", "requiere sustento"))
            processed_items.append({
                "id": it.get("id") or it.get("code"),
                "code": it.get("code"),
                "is_inventory": bool(it.get("is_inventory")),
                "requires_support": req_support,
            })

        rounding_difference = (total - (subtotal + iva)).quantize(Decimal("0.01"))
        reconciliation_status = "OK" if abs(rounding_difference) <= Decimal("0.50") else "REQUIRES_REVIEW"

        nit_valid = None
        try:
            nit_str = str(supplier_ruc or "").strip()
            nit_valid = True if (nit_str.isdigit() and 9 <= len(nit_str) <= 12) else False
        except Exception:
            nit_valid = None

        financial_metadata = self._json_safe({
            "supplier_nit": supplier_ruc if nit_valid else None,
            "supplier_name": purchase_data.get("supplier_name"),
            "nit_validation": ("VALID" if nit_valid else ("INVALID" if nit_valid is False else "UNKNOWN")),
            "late_registration": bool(late_registration_alert),
            "late_registration_months": months_diff,
            "retefuente_amount": str(retefuente),
            "reteiva_amount": str(reteiva),
            "retencion_amount": str(retencion),
            "items": processed_items,
            "accounts_to_upsert": account_upserts,
            "cost_centers_to_upsert": cost_center_upserts,
            "rounding_difference": str(rounding_difference),
            "reconciliation_status": reconciliation_status,
            "audit_metadata": purchase_data.get("audit_metadata") or {},
        })

        return await self.post_journal({
            **purchase_data,
            "company_ruc": purchase_data.get("supplier_ruc"),
            "description": f"Compra {serie}-{number}",
            "source_module": "PURCHASING",
            "source_id": str(purchase_data.get("purchase_id")),
            "lines": lines,
            "financial_document": {
                "direction": "AP",
                "document_type": doc_type,
                "series": serie,
                "number": number,
                "issue_date": invoice_issue_date,
                "due_date": purchase_data.get("due_date"),
                "currency": purchase_data.get("currency", "COP"),
                "exchange_rate": purchase_data.get("exchange_rate"),
                "taxable_amount": subtotal,
                "tax_amount": iva,
                "total_amount": total,
                "balance_amount": payable_balance,
                "retefuente_amount": retefuente,
                "reteiva_amount": reteiva,
                "retencion_amount": retencion,
                "dian_status": "PENDING",
                "metadata_json": financial_metadata,
            },
            "outbox_events": [
                build_event_payload(
                    topic=EventTopic.PURCHASE_INVOICE_POSTED,
                    aggregate_type="FinancialDocument",
                    aggregate_id=purchase_data.get("purchase_id") or f"{serie}-{number}",
                    payload={
                        "purchase_id": str(purchase_data.get("purchase_id")),
                        "serie": serie,
                        "number": number,
                        "supplier_ruc": supplier_ruc,
                        "total": str(total),
                        "trace_id": purchase_data.get("trace_id"),
                        "line_items": purchase_data.get("line_items") or purchase_data.get("items") or [],
                    },
                )
            ],
        })

    async def post_invoice(self, invoice_data: dict) -> JournalEntry:
        tenant_id = invoice_data.get("tenant_id")
        if not tenant_id:
            raise TenantRequiredException("tenant_id es obligatorio")

        async with self.uow_factory(tenant_id) as uow:
            repo = LedgerRepository(uow.session)
            # Derivar período de la fecha real de la factura
            invoice_date = self._as_date(invoice_data.get("entry_date"))
            invoice_data["year"] = invoice_date.year
            invoice_data["month"] = invoice_date.month
            period = await repo.get_period_for_update(tenant_id, invoice_date.year, invoice_date.month)
            if period and period.is_closed:
                raise PeriodLockedException("Periodo contable cerrado")
            if not period:
                period = AccountingPeriod(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    year=invoice_date.year,
                    month=invoice_date.month,
                    status="OPEN",
                    is_closed=False,
                )
                uow.session.add(period)
                await uow.session.flush()

            subtotal = Decimal(str(invoice_data["subtotal"]))
            iva = Decimal(str(invoice_data.get("iva") or "0.00"))
            total = Decimal(str(invoice_data["total"]))
            retefuente = Decimal(str(invoice_data.get("retefuente_amount", invoice_data.get("detraccion_amount", "0.00"))))
            reteiva = Decimal(str(invoice_data.get("reteiva_amount", invoice_data.get("percepcion_amount", "0.00"))))
            retencion = Decimal(str(invoice_data.get("retencion_amount", "0.00")))
            company_id = invoice_data.get("company_id")
            revenue_account = self._normalize_code(invoice_data.get("revenue_account"), "413505")
            revenue_account_name = "Ingresos operacionales"
            customer_nit = invoice_data.get("customer_nit") or invoice_data.get("customer_ruc")

            lines = [
                JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="130505", account_name="Clientes nacionales", debit=total - retencion, credit=Decimal("0.00"), partner_ruc=customer_nit, document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")),
                JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="240805", account_name="IVA generado", debit=Decimal("0.00"), credit=iva, partner_ruc=customer_nit, document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")),
                JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code=revenue_account, account_name=revenue_account_name, debit=Decimal("0.00"), credit=subtotal, partner_ruc=customer_nit, document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")),
            ]
            if retencion:
                lines.append(JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="2365", account_name="Retenciones en la fuente por pagar", debit=retencion, credit=Decimal("0.00"), partner_ruc=customer_nit, document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")))

            self._run_expert_guard({
                "source_module": "BILLING",
                "supplier_nit": None,
                "customer_nit": customer_nit,
                "doc_type": invoice_data.get("doc_type"),
                "serie": invoice_data.get("serie"),
                "number": invoice_data.get("number"),
                "entry_date": invoice_data.get("entry_date"),
                "total": total,
                "company_nit": invoice_data.get("company_nit") or settings.dian_nit,
                "dian_validation": invoice_data.get("dian_validation"),
                "lines": [
                    {
                        "account_code": line.account_code,
                        "debit": line.debit,
                        "credit": line.credit,
                        "cost_center": line.cost_center,
                    }
                    for line in lines
                ],
            })

            total_debit = sum(x.debit for x in lines)
            total_credit = sum(x.credit for x in lines)
            if total_debit != total_credit:
                raise UnbalancedEntryException(f"Debe {total_debit} != Haber {total_credit}")

            last_entry = await repo.get_last_entry_for_update(tenant_id)
            previous_hash = last_entry.row_hash if last_entry else "GENESIS"

            entry = JournalEntry(
                id=uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                period_id=period.id,
                entry_date=self._as_date(invoice_data.get("entry_date")),
                description=f"Venta {invoice_data.get('serie')}-{invoice_data.get('number')}",
                source_module="BILLING",
                source_id=str(invoice_data.get("invoice_id")),
                currency=invoice_data.get("currency", "COP"),
                total_debit=total_debit,
                total_credit=total_credit,
                previous_hash=previous_hash,
                row_hash="PENDING",
                created_by=self._actor_uuid(invoice_data.get("user_id")),
            )
            self._prepare_entry_lines(entry, lines)

            entry.row_hash = self.hash_service.generate(entry, lines, previous_hash)
            await repo.add_entry(entry, lines)
            document = FinancialDocument(
                tenant_id=tenant_id,
                company_id=company_id,
                direction="AR",
                document_type=invoice_data.get("doc_type", "01"),
                series=invoice_data.get("serie"),
                number=invoice_data.get("number"),
                issue_date=self._as_date(invoice_data.get("entry_date")),
                due_date=invoice_data.get("due_date"),
                currency=invoice_data.get("currency", "COP"),
                exchange_rate=invoice_data.get("exchange_rate"),
                taxable_amount=subtotal,
                tax_amount=iva,
                total_amount=total,
                balance_amount=total + reteiva - retencion - retefuente,
                retefuente_amount=retefuente,
                reteiva_amount=reteiva,
                retencion_amount=retencion,
                journal_entry_id=entry.id,
                dian_status="PENDING",
                xml_hash=invoice_data.get("xml_hash"),
                metadata_json=self._json_safe({
                    "customer_ruc": invoice_data.get("customer_ruc"),
                    "customer_name": invoice_data.get("customer_name"),
                    "revenue_account": revenue_account,
                    "ubl_version": "2.1",
                    "xml_ready": bool(invoice_data.get("xml_raw")),
                    "line_items": invoice_data.get("line_items", []),
                    "audit_metadata": invoice_data.get("audit_metadata") or {},
                }),
            )
            await repo.add_financial_document(document)
            await repo.add_audit(AuditLog(
                tenant_id=tenant_id, trace_id=invoice_data["trace_id"], entity_type="JournalEntry",
                entity_id=str(entry.id), action="CREATE_POSTED", before_state=None,
                after_state={"entry_id": str(entry.id), "row_hash": entry.row_hash, "total": str(total_debit)},
                actor_user_id=self._actor_uuid(invoice_data.get("user_id")), ip_address=invoice_data.get("ip_address"), user_agent=invoice_data.get("user_agent")
            ))
            await repo.add_outbox(OutboxEvent(
                tenant_id=tenant_id, topic=EventTopic.SALES_INVOICE_POSTED, aggregate_type="JournalEntry", aggregate_id=str(entry.id),
                payload=self._json_safe({"invoice": invoice_data, "journal_entry_id": str(entry.id), "financial_document_id": str(document.id), "trace_id": invoice_data["trace_id"]}),
                status="PENDING", attempts=0, max_attempts=3
            ))
            logger.info(
                "CONTA_PRO sale INSERT prepared database=%s tenant_id=%s entry_id=%s document_id=%s invoice=%s-%s",
                _masked_database_url(),
                tenant_id,
                entry.id,
                document.id,
                invoice_data.get("serie"),
                invoice_data.get("number"),
            )
            await uow.commit()
            logger.info(
                "CONTA_PRO sale COMMIT completed tenant_id=%s entry_id=%s document_id=%s invoice=%s-%s",
                tenant_id,
                entry.id,
                document.id,
                invoice_data.get("serie"),
                invoice_data.get("number"),
            )
            return entry
