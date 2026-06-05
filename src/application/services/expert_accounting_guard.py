from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

from src.ai.expert_system_prompt import SYSTEM_ROLE_PROMPT, VALIDATION_FILTER_PROMPT
from src.application.dto.expert_accounting import ValidationCheck, ValidationReport
from src.application.services.sunat_realtime_verifier import (
    SunatDocumentReference,
    SunatRealtimeResult,
    normalize_document_status,
    normalize_sunat_text,
)
from src.domain.exceptions import ExpertValidationException
from src.config import settings


INSUFFICIENT_JUSTIFICATIONS = {"ERROR", "ERRROR", "CAMBIO", "MODIFICAR", "ANULAR", "MAL", "CORREGIR"}


class ExpertAccountingGuard:
    """Pre-save validation guard for automatic accounting entries."""

    def __init__(self, sunat_verifier=None, *, sunat_enabled: bool = True, block_on_unavailable: bool = False) -> None:
        self.system_prompt = SYSTEM_ROLE_PROMPT
        self.validation_prompt = VALIDATION_FILTER_PROMPT
        self.sunat_verifier = sunat_verifier
        self.sunat_enabled = sunat_enabled
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
        supplier_ruc = payload.get("supplier_ruc")
        customer_ruc = payload.get("customer_ruc")
        partner_ruc = supplier_ruc or customer_ruc or self._first_line_partner_ruc(lines)
        has_partner_doc = bool(partner_ruc)

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
                detail="Documento con contraparte identificada" if deductible_or_supported else "Falta RUC de contraparte para sustento tributario",
            ),
        ]
        checks.extend(self._sunat_checks(payload, is_purchase_or_sale=is_purchase_or_sale, partner_ruc=partner_ruc))

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
        """Evalua si una modificacion/anulacion es viable antes de enviarla a SUNAT."""
        issue_date = self._coerce_date(datos_viejos.get("issue_date") or datos_viejos.get("fecha"))
        old_total = self._coerce_money(datos_viejos.get("total") or datos_viejos.get("total_amount"))
        new_total = self._coerce_money(datos_nuevos.get("total") or datos_nuevos.get("total_amount") or old_total)
        old_ruc = str(datos_viejos.get("partner_ruc") or datos_viejos.get("customer_ruc") or datos_viejos.get("supplier_ruc") or "")
        new_ruc = str(datos_nuevos.get("partner_ruc") or datos_nuevos.get("customer_ruc") or datos_nuevos.get("supplier_ruc") or old_ruc)

        alerts: list[str] = []
        blocking_reasons: list[str] = []
        checks: list[ValidationCheck] = []

        deadline = self._third_calendar_day_next_month(issue_date)
        in_direct_annulment_window = date.today() <= deadline
        checks.append(
            ValidationCheck(
                code="SUNAT_ANNULMENT_WINDOW",
                passed=in_direct_annulment_window,
                detail=f"Plazo de anulacion directa hasta {deadline.isoformat()}: {'EN_PLAZO' if in_direct_annulment_window else 'VENCIDO'}",
            )
        )
        if not in_direct_annulment_window:
            alerts.append("Documento fuera del plazo operativo configurado para anulacion directa. Se requiere Nota de Credito.")

        direct_sunat_deadline = issue_date + timedelta(days=7)
        if date.today() > direct_sunat_deadline:
            alerts.append("Documento fuera de 7 dias calendario desde emision/CDR; validar comunicacion de baja o Nota de Credito segun SEE/OSE.")

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
            alerts.append("El cambio de monto afecta el IGV declarado. Se registrara en el Record de Modificaciones.")

        old_taxable = self._coerce_money(datos_viejos.get("taxable_amount") or "0.00")
        new_taxable = self._coerce_money(datos_nuevos.get("taxable_amount") or old_taxable)
        old_tax = self._coerce_money(datos_viejos.get("tax_amount") or "0.00")
        new_tax = self._coerce_money(datos_nuevos.get("tax_amount") or old_tax)

        motivo_upper = (motivo or "").upper()

        if motivo_upper.startswith("ERROR_RUC") and old_ruc == new_ruc:
            blocking_reasons.append("El motivo seleccionado es ERROR_RUC, pero no se detecta cambio de RUC.")

        if motivo_upper.startswith("ERROR_DESCRIPCION_MONTOS") and old_total == new_total and old_taxable == new_taxable and old_tax == new_tax:
            blocking_reasons.append("El motivo indica error en descripcion o montos, pero no se detectan cambios economicos.")

        if motivo_upper.startswith("DEVOLUCION") and new_total >= old_total:
            blocking_reasons.append("Para devolucion total/parcial, el monto nuevo debe ser menor al monto original.")

        if old_ruc and new_ruc and old_ruc != new_ruc:
            validation_payload = {"source_module": "BILLING", "customer_ruc": new_ruc}
            sunat_checks = self._sunat_checks(validation_payload, is_purchase_or_sale=True, partner_ruc=new_ruc)
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

    def _sunat_checks(self, payload: dict, *, is_purchase_or_sale: bool, partner_ruc: str | None) -> list[ValidationCheck]:
        if not self.sunat_enabled or not is_purchase_or_sale:
            return []

        if not partner_ruc:
            return [
                ValidationCheck(
                    code="SUNAT_RUC_PRESENT",
                    passed=False,
                    detail="Falta RUC para verificacion SUNAT en tiempo real",
                )
            ]

        # Accept different taxpayer identifier lengths depending on configured country
        ruc_digits = str(partner_ruc).isdigit() and str(partner_ruc).isdigit()
        ruc_len = len(str(partner_ruc))
        if settings.country_code == 'CO':
            # Colombian NITs commonly range 9-12 digits (including DV), be permissive here
            if not (str(partner_ruc).isdigit() and 9 <= ruc_len <= 12):
                return [
                    ValidationCheck(
                        code="DIAN_NIT_FORMAT",
                        passed=False,
                        detail="NIT invalido para verificacion DIAN: debe tener entre 9 y 12 digitos",
                    )
                ]
        else:
            # Default: SUNAT RUC (Peru) expects exactly 11 digits
            if not (str(partner_ruc).isdigit() and ruc_len == 11):
                return [
                    ValidationCheck(
                        code="SUNAT_RUC_FORMAT",
                        passed=False,
                        detail="RUC invalido para verificacion SUNAT: debe tener 11 digitos",
                    )
                ]

        validation = self._get_sunat_validation(payload, partner_ruc)
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
                code="SUNAT_REALTIME_AVAILABLE",
                passed=unavailable_passed,
                detail=(
                    f"Verificacion SUNAT fuente={source}"
                    if unavailable_passed
                    else "SUNAT no disponible/configurado para verificacion obligatoria"
                ),
            )
        ]

        if status:
            checks.append(
                ValidationCheck(
                    code="SUNAT_RUC_ACTIVE",
                    passed=status == "ACTIVO",
                    detail=f"RUC {partner_ruc} estado SUNAT={status}",
                )
            )

        if condition:
            checks.append(
                ValidationCheck(
                    code="SUNAT_RUC_HABIDO",
                    passed=condition != "NO HABIDO",
                    detail=f"RUC {partner_ruc} condicion SUNAT={condition}",
                )
            )

        if document_status:
            invalid_document_statuses = {"ANULADO", "ANULADA", "BAJA", "RECHAZADO", "NO EXISTE", "NO AUTORIZADO"}
            checks.append(
                ValidationCheck(
                    code="SUNAT_DOCUMENT_ACTIVE",
                    passed=document_status not in invalid_document_statuses,
                    detail=f"Comprobante estado SUNAT={document_status}",
                )
            )

        return checks

    def _get_sunat_validation(self, payload: dict, partner_ruc: str) -> dict:
        provided = payload.get("sunat_validation")
        if provided:
            if isinstance(provided, SunatRealtimeResult):
                return provided.as_dict()
            if isinstance(provided, dict):
                return provided

        if not self.sunat_verifier:
            return {"ruc": partner_ruc, "source": "not_configured", "warnings": ["Verificador SUNAT no configurado."]}

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
