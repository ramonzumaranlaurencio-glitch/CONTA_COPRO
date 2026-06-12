from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

from src.ai.expert_system_prompt import SYSTEM_ROLE_PROMPT, VALIDATION_FILTER_PROMPT
from src.application.dto.expert_accounting import ValidationCheck, ValidationReport
from src.application.services.dian_realtime_verifier import (
    DianRealtimeVerifier,
)
from src.domain.exceptions import ExpertValidationException
from src.config import settings


INSUFFICIENT_JUSTIFICATIONS = {"ERROR", "ERRROR", "CAMBIO", "MODIFICAR", "ANULAR", "MAL", "CORREGIR"}


class ExpertAccountingGuard:
    """Pre-save validation guard for automatic accounting entries."""

    def __init__(self, dian_verifier=None, *, dian_enabled: bool = True, block_on_unavailable: bool = False) -> None:
        self.system_prompt = SYSTEM_ROLE_PROMPT
        self.validation_prompt = VALIDATION_FILTER_PROMPT
        self.dian_verifier = dian_verifier
        self.dian_enabled = dian_enabled
        self.block_on_unavailable = block_on_unavailable

    def validate_before_save(self, payload: dict) -> ValidationReport:
        lines = payload.get("lines") or []

        total_debit = sum(Decimal(str(line.get("debit", "0"))) for line in lines)
        total_credit = sum(Decimal(str(line.get("credit", "0"))) for line in lines)
        is_double_entry_ok = total_debit == total_credit

        expense_lines = [
            line for line in lines
            if str(line.get("account_code", "")).startswith(("6", "9"))
            and Decimal(str(line.get("debit", "0"))) > 0
        ]
        has_cost_center_for_expenses = all(bool(line.get("cost_center")) for line in expense_lines)

        source_module = str(payload.get("source_module", "")).upper()
        supplier_nit = payload.get("supplier_nit") or payload.get("supplier_ruc")
        customer_nit = payload.get("customer_nit") or payload.get("customer_ruc")
        partner_nit = supplier_nit or customer_nit or self._first_line_partner_ruc(lines)
        has_partner_doc = bool(partner_nit)

        is_purchase_or_sale = source_module in {"PURCHASING", "BILLING", "SALES_IA", "SALES"}
        deductible_or_supported = (not is_purchase_or_sale) or has_partner_doc

        checks = [
            ValidationCheck(
                code="DOUBLE_ENTRY",
                passed=is_double_entry_ok,
                detail=f"Debe={total_debit} Haber={total_credit}",
            ),
            ValidationCheck(
                code="EXPENSE_COST_CENTER",
                passed=has_cost_center_for_expenses,
                detail="Lineas de gasto/costo con centro de costos" if has_cost_center_for_expenses else "Falta centro de costos en lineas de gasto/costo",
            ),
            ValidationCheck(
                code="CAUSALITY_SUPPORT",
                passed=deductible_or_supported,
                detail="Documento con contraparte identificada" if deductible_or_supported else "Falta NIT de contraparte para sustento tributario DIAN",
            ),
        ]
        checks.extend(self._dian_checks(payload, is_purchase_or_sale=is_purchase_or_sale, partner_ruc=partner_nit))

        blocking = [check.detail for check in checks if not check.passed]
        return ValidationReport(accepted=not blocking, checks=checks, blocking_reasons=blocking)

    def enforce_or_raise(self, payload: dict) -> None:
        report = self.validate_before_save(payload)
        if report.accepted:
            return

        message = "Validacion experta bloqueada: " + " | ".join(report.blocking_reasons)
        raise ExpertValidationException(message=message, checks=[check.model_dump() for check in report.checks])

    def validar_modificacion_asiento(
        self,
        datos_viejos: dict,
        datos_nuevos: dict,
        justificacion: str,
        *,
        motivo: str | None = None,
        periodo_declarado: bool = False,
        usuario: str | None = None,
    ) -> dict:
        """Evalua si una modificacion/anulacion es viable antes de enviarla a DIAN."""
        issue_date = self._coerce_date(datos_viejos.get("issue_date") or datos_viejos.get("fecha"))
        old_total = self._coerce_money(datos_viejos.get("total") or datos_viejos.get("total_amount"))
        new_total = self._coerce_money(datos_nuevos.get("total") or datos_nuevos.get("total_amount") or old_total)
        old_ruc = str(datos_viejos.get("partner_nit") or datos_viejos.get("customer_nit") or datos_viejos.get("supplier_nit") or datos_viejos.get("partner_ruc") or "")
        new_ruc = str(datos_nuevos.get("partner_nit") or datos_nuevos.get("customer_nit") or datos_nuevos.get("supplier_nit") or datos_nuevos.get("partner_ruc") or old_ruc)

        alerts: list[str] = []
        blocking_reasons: list[str] = []
        checks: list[ValidationCheck] = []

        deadline = self._third_calendar_day_next_month(issue_date)
        in_direct_annulment_window = date.today() <= deadline
        checks.append(
            ValidationCheck(
                code="DIAN_ANNULMENT_WINDOW",
                passed=in_direct_annulment_window,
                detail=f"Plazo de anulacion directa hasta {deadline.isoformat()}: {'EN_PLAZO' if in_direct_annulment_window else 'VENCIDO'}",
            )
        )
        if not in_direct_annulment_window:
            alerts.append("Documento fuera del plazo operativo configurado para anulacion directa. Se requiere Nota de Credito DIAN.")

        direct_dian_deadline = issue_date + timedelta(days=7)
        if date.today() > direct_dian_deadline:
            alerts.append("Documento fuera de 7 dias calendario desde emision; validar comunicacion de anulacion o Nota de Credito segun normativa DIAN.")

        justification_ok = self._is_justification_sufficient(justificacion, motivo)
        checks.append(
            ValidationCheck(
                code="JUSTIFICATION_SUFFICIENT",
                passed=justification_ok,
                detail="Justificacion suficiente para auditoria" if justification_ok else "Justificacion insuficiente para auditoria. Especifique el motivo legal.",
            )
        )
        if not justification_ok:
            blocking_reasons.append("Justificacion insuficiente para auditoria. Especifique el motivo legal.")

        if old_total != new_total:
            alerts.append("El cambio de monto afecta el IVA declarado. Se registrara en el Record de Modificaciones DIAN.")

        old_taxable = self._coerce_money(datos_viejos.get("taxable_amount") or "0.00")
        new_taxable = self._coerce_money(datos_nuevos.get("taxable_amount") or old_taxable)
        old_tax = self._coerce_money(datos_viejos.get("tax_amount") or "0.00")
        new_tax = self._coerce_money(datos_nuevos.get("tax_amount") or old_tax)

        motivo_upper = (motivo or "").upper()

        if motivo_upper.startswith("ERROR_NIT") and old_ruc == new_ruc:
            blocking_reasons.append("El motivo seleccionado es ERROR_NIT, pero no se detecta cambio de NIT.")

        if motivo_upper.startswith("ERROR_DESCRIPCION_MONTOS") and old_total == new_total and old_taxable == new_taxable and old_tax == new_tax:
            blocking_reasons.append("El motivo indica error en descripcion o montos, pero no se detectan cambios economicos.")

        if motivo_upper.startswith("DEVOLUCION") and new_total >= old_total:
            blocking_reasons.append("Para devolucion total/parcial, el monto nuevo debe ser menor al monto original.")

        if old_ruc and new_ruc and old_ruc != new_ruc:
            validation_payload = {"source_module": "BILLING", "customer_nit": new_ruc}
            sunat_checks = self._dian_checks(validation_payload, is_purchase_or_sale=True, partner_ruc=new_ruc)
            checks.extend(sunat_checks)
            for check in sunat_checks:
                if not check.passed:
                    blocking_reasons.append(check.detail)

        credit_note_draft = None
        if periodo_declarado or not in_direct_annulment_window:
            blocking_reasons.append("Periodo tributario declarado o plazo vencido: se bloquea modificacion directa.")
            credit_note_draft = self._build_credit_note_draft(datos_viejos, datos_nuevos, motivo, justificacion)

        accepted = not blocking_reasons
        return {
            "accepted": accepted,
            "usuario": usuario,
            "motivo": motivo,
            "annulment_deadline": deadline.isoformat(),
            "annulment_status": "EN_PLAZO" if in_direct_annulment_window else "VENCIDO",
            "alerts": alerts,
            "checks": [check.model_dump() for check in checks],
            "blocking_reasons": blocking_reasons,
            "credit_note_draft": credit_note_draft,
        }

    def _dian_checks(self, payload: dict, *, is_purchase_or_sale: bool, partner_ruc: str | None) -> list[ValidationCheck]:
        if not self.dian_enabled or not is_purchase_or_sale:
            return []

        if not partner_ruc:
            return [
                ValidationCheck(
                    code="DIAN_NIT_PRESENT",
                    passed=False,
                    detail="Falta NIT para verificacion DIAN en tiempo real",
                )
            ]

        # Accept different taxpayer identifier lengths depending on configured country
        ruc_digits = str(partner_ruc).isdigit() and str(partner_ruc).isdigit()
        ruc_len = len(str(partner_ruc))
        # Colombian NITs: 9-12 digits (including DV digit)
        if not (str(partner_ruc).isdigit() and 9 <= ruc_len <= 12):
            return [
                ValidationCheck(
                    code="DIAN_NIT_FORMAT",
                    passed=False,
                    detail="NIT invalido para verificacion DIAN: debe tener entre 9 y 12 digitos",
                )
            ]

        validation = self._get_dian_validation(payload, partner_ruc)
        status = normalize_sunat_text(validation.get("taxpayer_status") or validation.get("estado"))
        condition = normalize_sunat_text(validation.get("taxpayer_condition") or validation.get("condicion"))
        document_status = normalize_document_status(
            validation.get("document_status") or validation.get("estado_cp") or validation.get("estadoCp")
        )
        source = str(validation.get("source") or "payload")
        unavailable = source in {"not_configured", "unavailable"} and not status and not condition and not document_status

        unavailable_passed = not unavailable or not self.block_on_unavailable
        checks = [
            ValidationCheck(
                code="DIAN_REALTIME_AVAILABLE",
                passed=unavailable_passed,
                detail=(
                    f"Verificacion DIAN fuente={source}"
                    if unavailable_passed
                    else "DIAN no disponible/configurado para verificacion obligatoria"
                ),
            )
        ]

        if status:
            checks.append(
                ValidationCheck(
                    code="DIAN_NIT_ACTIVE",
                    passed=status == "ACTIVO",
                    detail=f"NIT {partner_ruc} estado DIAN={status}",
                )
            )

        if condition:
            checks.append(
                ValidationCheck(
                    code="DIAN_NIT_STATUS",
                    passed=condition != "NO HABIDO",
                    detail=f"NIT {partner_ruc} condicion DIAN={condition}",
                )
            )

        if document_status:
            invalid_document_statuses = {"ANULADO", "ANULADA", "BAJA", "RECHAZADO", "NO EXISTE", "NO AUTORIZADO"}
            checks.append(
                ValidationCheck(
                    code="DIAN_DOCUMENT_ACTIVE",
                    passed=document_status not in invalid_document_statuses,
                    detail=f"Comprobante estado DIAN={document_status}",
                )
            )

        return checks

    def _get_dian_validation(self, payload: dict, partner_ruc: str) -> dict:
        provided = payload.get("dian_validation")
        if provided:
            if isinstance(provided, dict):
                return provided

        if not self.dian_verifier:
            return {"nit": partner_ruc, "source": "not_configured", "warnings": ["Verificador DIAN no configurado."]}

        document = SunatDocumentReference.from_payload(payload)
        result = self.sunat_verifier.verify(partner_ruc, document)
        return result.as_dict() if isinstance(result, SunatRealtimeResult) else dict(result)

    @staticmethod
    def _first_line_partner_ruc(lines: list[dict]) -> str | None:
        for line in lines:
            partner_ruc = line.get("partner_ruc")
            if partner_ruc:
                return partner_ruc
        return None

    @staticmethod
    def _coerce_date(value) -> date:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if value:
            return date.fromisoformat(str(value)[:10])
        return date.today()

    @staticmethod
    def _coerce_money(value) -> Decimal:
        return Decimal(str(value or "0.00")).quantize(Decimal("0.01"))

    @staticmethod
    def _third_calendar_day_next_month(issue_date: date) -> date:
        year = issue_date.year + (1 if issue_date.month == 12 else 0)
        month = 1 if issue_date.month == 12 else issue_date.month + 1
        return date(year, month, 3)

    @staticmethod
    def _is_justification_sufficient(justificacion: str, motivo: str | None) -> bool:
        normalized = normalize_sunat_text(justificacion) or ""
        if len(normalized) < 20:
            return False
        if normalized in INSUFFICIENT_JUSTIFICATIONS:
            return False
        if motivo and (normalize_sunat_text(motivo) or "") not in normalized and len(normalized.split()) < 8:
            return False
        return True

    @staticmethod
    def _build_credit_note_draft(datos_viejos: dict, datos_nuevos: dict, motivo: str | None, justificacion: str) -> dict:
        series = datos_viejos.get("series") or datos_viejos.get("serie") or "F001"
        number = datos_viejos.get("number") or datos_viejos.get("numero")
        total = datos_nuevos.get("total") or datos_nuevos.get("total_amount") or datos_viejos.get("total") or datos_viejos.get("total_amount")
        return {
            "document_type": "07",
            "affected_document_type": datos_viejos.get("document_type", "01"),
            "affected_series": series,
            "affected_number": number,
            "reason_code": "01" if (motivo or "").upper().startswith("ERROR_RUC") else "07",
            "reason": motivo or "Modificacion/anulacion con periodo declarado o plazo vencido",
            "total_amount": str(total or "0.00"),
            "currency": datos_viejos.get("currency", "COP"),
            "justification": justificacion,
            "status": "DRAFT_PENDING_SIGNATURE",
        }


def validar_modificacion_asiento(datos_viejos, datos_nuevos, justificacion):
    return ExpertAccountingGuard().validar_modificacion_asiento(datos_viejos, datos_nuevos, justificacion)
