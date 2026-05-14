from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import uuid4
from src.application.services.expert_accounting_guard import ExpertAccountingGuard
from src.application.services.sunat_realtime_verifier import SunatRealtimeVerifier
from src.config import settings
from src.domain.exceptions import PeriodLockedException, TenantRequiredException, UnbalancedEntryException
from src.domain.models.accounting import AuditLog, FinancialDocument, JournalEntry, JournalLine, OutboxEvent
from src.infrastructure.repositories.ledger_repository import LedgerRepository

class LedgerPostingService:
    def __init__(self, uow_factory, hash_service):
        self.uow_factory = uow_factory
        self.hash_service = hash_service
        self.expert_guard = ExpertAccountingGuard(
            SunatRealtimeVerifier(
                ruc_lookup_url=settings.sunat_ruc_lookup_url,
                cpe_lookup_url=settings.sunat_cpe_lookup_url,
                token=settings.sunat_lookup_token,
                timeout_seconds=settings.sunat_realtime_timeout_seconds,
            ),
            sunat_enabled=settings.sunat_realtime_guard_enabled,
            block_on_unavailable=settings.sunat_guard_block_on_unavailable,
        )

    def _run_expert_guard(self, payload: dict) -> None:
        if not settings.expert_accounting_enabled:
            return
        self.expert_guard.enforce_or_raise(payload)

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
            if not period or period.is_closed:
                raise PeriodLockedException("Periodo contable bloqueado")

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
                entry_date=payload.get("entry_date") or date.today(),
                description=payload["description"],
                source_module=payload.get("source_module", "ACCOUNTING"),
                source_id=payload.get("source_id"),
                currency=payload.get("currency", "PEN"),
                total_debit=total_debit,
                total_credit=total_credit,
                previous_hash=previous_hash,
                row_hash="PENDING",
                created_by=payload["user_id"],
            )
            for line in lines:
                line.entry_id = entry.id

            entry.row_hash = self.hash_service.generate(entry, lines, previous_hash)
            await repo.add_entry(entry, lines)
            if payload.get("financial_document"):
                document_payload = payload["financial_document"]
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
                actor_user_id=payload["user_id"],
                ip_address=payload.get("ip_address"),
                user_agent=payload.get("user_agent"),
            ))

            for event in payload.get("outbox_events", []):
                await repo.add_outbox(OutboxEvent(
                    tenant_id=tenant_id,
                    topic=event["topic"],
                    aggregate_type=event.get("aggregate_type", "JournalEntry"),
                    aggregate_id=str(entry.id),
                    payload=event.get("payload", {"journal_entry_id": str(entry.id), "trace_id": payload["trace_id"]}),
                    status="PENDING",
                    attempts=0,
                    max_attempts=event.get("max_attempts", 3),
                ))

            await uow.commit()
            return entry

    async def post_purchase_invoice(self, purchase_data: dict) -> JournalEntry:
        subtotal = Decimal(str(purchase_data["subtotal"]))
        igv = Decimal(str(purchase_data["igv"]))
        total = Decimal(str(purchase_data["total"]))
        detraccion = Decimal(str(purchase_data.get("detraccion_amount", "0.00")))
        percepcion = Decimal(str(purchase_data.get("percepcion_amount", "0.00")))
        retencion = Decimal(str(purchase_data.get("retencion_amount", "0.00")))
        payable_balance = total + percepcion - retencion - detraccion

        lines = [
            {
                "account_code": purchase_data.get("expense_account", "6011"),
                "account_name": "Compras y gastos",
                "debit": subtotal,
                "credit": Decimal("0.00"),
                "partner_ruc": purchase_data.get("supplier_ruc"),
                "document_type": purchase_data.get("doc_type"),
                "document_series": purchase_data.get("serie"),
                "document_number": purchase_data.get("number"),
                "cost_center": purchase_data.get("cost_center"),
            },
            {
                "account_code": "40111",
                "account_name": "IGV credito fiscal",
                "debit": igv,
                "credit": Decimal("0.00"),
                "partner_ruc": purchase_data.get("supplier_ruc"),
                "document_type": purchase_data.get("doc_type"),
                "document_series": purchase_data.get("serie"),
                "document_number": purchase_data.get("number"),
                "cost_center": purchase_data.get("cost_center"),
            },
            {
                "account_code": "4212",
                "account_name": "Cuentas por pagar comerciales",
                "debit": Decimal("0.00"),
                "credit": payable_balance,
                "partner_ruc": purchase_data.get("supplier_ruc"),
                "document_type": purchase_data.get("doc_type"),
                "document_series": purchase_data.get("serie"),
                "document_number": purchase_data.get("number"),
                "cost_center": purchase_data.get("cost_center"),
            },
        ]

        if detraccion:
            lines.append({
                "account_code": "1041",
                "account_name": "Banco detracciones",
                "debit": Decimal("0.00"),
                "credit": detraccion,
                "partner_ruc": purchase_data.get("supplier_ruc"),
                "document_type": purchase_data.get("doc_type"),
                "document_series": purchase_data.get("serie"),
                "document_number": purchase_data.get("number"),
                "cost_center": purchase_data.get("cost_center"),
            })

        if retencion:
            lines.append({
                "account_code": "40114",
                "account_name": "IGV retenciones",
                "debit": Decimal("0.00"),
                "credit": retencion,
                "partner_ruc": purchase_data.get("supplier_ruc"),
                "document_type": purchase_data.get("doc_type"),
                "document_series": purchase_data.get("serie"),
                "document_number": purchase_data.get("number"),
                "cost_center": purchase_data.get("cost_center"),
            })

        if percepcion:
            lines.append({
                "account_code": "40113",
                "account_name": "IGV percepciones",
                "debit": percepcion,
                "credit": Decimal("0.00"),
                "partner_ruc": purchase_data.get("supplier_ruc"),
                "document_type": purchase_data.get("doc_type"),
                "document_series": purchase_data.get("serie"),
                "document_number": purchase_data.get("number"),
                "cost_center": purchase_data.get("cost_center"),
            })

        return await self.post_journal({
            **purchase_data,
            "company_ruc": purchase_data.get("supplier_ruc"),
            "description": f"Compra {purchase_data.get('serie')}-{purchase_data.get('number')}",
            "source_module": "PURCHASING",
            "source_id": str(purchase_data.get("purchase_id")),
            "lines": lines,
            "financial_document": {
                "direction": "AP",
                "document_type": purchase_data.get("doc_type", "01"),
                "series": purchase_data.get("serie"),
                "number": purchase_data.get("number"),
                "issue_date": purchase_data.get("entry_date") or date.today(),
                "due_date": purchase_data.get("due_date"),
                "currency": purchase_data.get("currency", "PEN"),
                "exchange_rate": purchase_data.get("exchange_rate"),
                "taxable_amount": subtotal,
                "tax_amount": igv,
                "total_amount": total,
                "balance_amount": payable_balance,
                "detraccion_amount": detraccion,
                "percepcion_amount": percepcion,
                "retencion_amount": retencion,
                "metadata_json": {
                    "supplier_ruc": purchase_data.get("supplier_ruc"),
                    "sire_ready": True,
                    "detraccion_amount": str(detraccion),
                    "percepcion_amount": str(percepcion),
                    "line_items": purchase_data.get("line_items", []),
                },
            },
        })

    async def post_invoice(self, invoice_data: dict) -> JournalEntry:
        tenant_id = invoice_data.get("tenant_id")
        if not tenant_id:
            raise TenantRequiredException("tenant_id es obligatorio")

        async with self.uow_factory(tenant_id) as uow:
            repo = LedgerRepository(uow.session)
            period = await repo.get_period_for_update(tenant_id, int(invoice_data["year"]), int(invoice_data["month"]))
            if not period or period.is_closed:
                raise PeriodLockedException("Periodo contable bloqueado")

            subtotal = Decimal(str(invoice_data["subtotal"]))
            igv = Decimal(str(invoice_data["igv"]))
            total = Decimal(str(invoice_data["total"]))
            detraccion = Decimal(str(invoice_data.get("detraccion_amount", "0.00")))
            percepcion = Decimal(str(invoice_data.get("percepcion_amount", "0.00")))
            retencion = Decimal(str(invoice_data.get("retencion_amount", "0.00")))
            company_id = invoice_data.get("company_id")

            lines = [
                JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="1212", account_name="Cuentas por cobrar comerciales", debit=total + percepcion - retencion - detraccion, credit=Decimal("0.00"), partner_ruc=invoice_data.get("customer_ruc"), document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")),
                JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="4011", account_name="IGV por pagar", debit=Decimal("0.00"), credit=igv, partner_ruc=invoice_data.get("customer_ruc"), document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")),
                JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="7011", account_name="Ventas", debit=Decimal("0.00"), credit=subtotal, partner_ruc=invoice_data.get("customer_ruc"), document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")),
            ]
            if detraccion:
                lines.append(JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="1041", account_name="Banco detracciones", debit=detraccion, credit=Decimal("0.00"), partner_ruc=invoice_data.get("customer_ruc"), document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")))
            if retencion:
                lines.append(JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="40114", account_name="IGV retenciones", debit=retencion, credit=Decimal("0.00"), partner_ruc=invoice_data.get("customer_ruc"), document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")))
            if percepcion:
                lines.append(JournalLine(id=uuid4(), tenant_id=tenant_id, company_id=company_id, account_code="40113", account_name="IGV percepciones", debit=Decimal("0.00"), credit=percepcion, partner_ruc=invoice_data.get("customer_ruc"), document_type=invoice_data.get("doc_type"), document_series=invoice_data.get("serie"), document_number=invoice_data.get("number"), cost_center=invoice_data.get("cost_center")))

            self._run_expert_guard({
                "source_module": "BILLING",
                "supplier_ruc": None,
                "customer_ruc": invoice_data.get("customer_ruc"),
                "doc_type": invoice_data.get("doc_type"),
                "serie": invoice_data.get("serie"),
                "number": invoice_data.get("number"),
                "entry_date": invoice_data.get("entry_date"),
                "total": total,
                "company_ruc": invoice_data.get("company_ruc") or settings.sunat_ruc,
                "sunat_validation": invoice_data.get("sunat_validation"),
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
                entry_date=invoice_data.get("entry_date") or date.today(),
                description=f"Venta {invoice_data.get('serie')}-{invoice_data.get('number')}",
                source_module="BILLING",
                source_id=str(invoice_data.get("invoice_id")),
                currency=invoice_data.get("currency", "PEN"),
                total_debit=total_debit,
                total_credit=total_credit,
                previous_hash=previous_hash,
                row_hash="PENDING",
                created_by=invoice_data["user_id"],
            )
            for line in lines:
                line.entry_id = entry.id

            entry.row_hash = self.hash_service.generate(entry, lines, previous_hash)
            await repo.add_entry(entry, lines)
            document = FinancialDocument(
                tenant_id=tenant_id,
                company_id=company_id,
                direction="AR",
                document_type=invoice_data.get("doc_type", "01"),
                series=invoice_data.get("serie"),
                number=invoice_data.get("number"),
                issue_date=invoice_data.get("entry_date") or date.today(),
                due_date=invoice_data.get("due_date"),
                currency=invoice_data.get("currency", "PEN"),
                exchange_rate=invoice_data.get("exchange_rate"),
                taxable_amount=subtotal,
                tax_amount=igv,
                total_amount=total,
                balance_amount=total + percepcion - retencion - detraccion,
                detraccion_amount=detraccion,
                percepcion_amount=percepcion,
                retencion_amount=retencion,
                journal_entry_id=entry.id,
                sunat_status="PENDING",
                xml_hash=invoice_data.get("xml_hash"),
                metadata_json={
                    "customer_ruc": invoice_data.get("customer_ruc"),
                    "ubl_version": "2.1",
                    "xml_ready": bool(invoice_data.get("xml_raw")),
                    "line_items": invoice_data.get("line_items", []),
                },
            )
            await repo.add_financial_document(document)
            await repo.add_audit(AuditLog(
                tenant_id=tenant_id, trace_id=invoice_data["trace_id"], entity_type="JournalEntry",
                entity_id=str(entry.id), action="CREATE_POSTED", before_state=None,
                after_state={"entry_id": str(entry.id), "row_hash": entry.row_hash, "total": str(total_debit)},
                actor_user_id=invoice_data["user_id"], ip_address=invoice_data.get("ip_address"), user_agent=invoice_data.get("user_agent")
            ))
            await repo.add_outbox(OutboxEvent(
                tenant_id=tenant_id, topic="sunat.invoice.post", aggregate_type="JournalEntry", aggregate_id=str(entry.id),
                payload={"invoice": invoice_data, "journal_entry_id": str(entry.id), "financial_document_id": str(document.id), "trace_id": invoice_data["trace_id"]},
                status="PENDING", attempts=0, max_attempts=3
            ))
            await uow.commit()
            return entry
