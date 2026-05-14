from decimal import Decimal
from datetime import date

from src.application.services.expert_accounting_guard import ExpertAccountingGuard
from src.application.services.sunat_realtime_verifier import SunatRealtimeResult


class FakeSunatVerifier:
    def __init__(self, result: SunatRealtimeResult):
        self.result = result

    def verify(self, ruc, document=None):
        return self.result


def _billing_payload():
    return {
        "source_module": "BILLING",
        "customer_ruc": "20555555555",
        "doc_type": "01",
        "serie": "F001",
        "number": "1",
        "total": Decimal("118.00"),
        "lines": [
            {"account_code": "1212", "debit": Decimal("118.00"), "credit": Decimal("0.00")},
            {"account_code": "4011", "debit": Decimal("0.00"), "credit": Decimal("18.00")},
            {"account_code": "7011", "debit": Decimal("0.00"), "credit": Decimal("100.00")},
        ],
    }


def test_guard_accepts_active_habido_sunat_result():
    guard = ExpertAccountingGuard(
        FakeSunatVerifier(
            SunatRealtimeResult(
                ruc="20555555555",
                taxpayer_status="ACTIVO",
                taxpayer_condition="HABIDO",
                document_status="ACTIVO",
                source="sunat_ruc_cpe_lookup",
            )
        )
    )

    report = guard.validate_before_save(_billing_payload())

    assert report.accepted


def test_guard_blocks_no_habido_taxpayer():
    guard = ExpertAccountingGuard(
        FakeSunatVerifier(
            SunatRealtimeResult(
                ruc="20555555555",
                taxpayer_status="ACTIVO",
                taxpayer_condition="NO HABIDO",
                source="sunat_ruc_lookup",
            )
        )
    )

    report = guard.validate_before_save(_billing_payload())

    assert not report.accepted
    assert any(check.code == "SUNAT_RUC_HABIDO" and not check.passed for check in report.checks)


def test_guard_blocks_cancelled_document():
    guard = ExpertAccountingGuard(
        FakeSunatVerifier(
            SunatRealtimeResult(
                ruc="20555555555",
                taxpayer_status="ACTIVO",
                taxpayer_condition="HABIDO",
                document_status="ANULADO",
                source="sunat_ruc_cpe_lookup",
            )
        )
    )

    report = guard.validate_before_save(_billing_payload())

    assert not report.accepted
    assert any(check.code == "SUNAT_DOCUMENT_ACTIVE" and not check.passed for check in report.checks)


def test_modification_validator_rejects_weak_justification():
    guard = ExpertAccountingGuard(sunat_enabled=False)

    result = guard.validar_modificacion_asiento(
        {
            "issue_date": date.today().isoformat(),
            "series": "F001",
            "number": "8422",
            "total_amount": "118.00",
            "partner_ruc": "20555555555",
        },
        {"total_amount": "118.00", "partner_ruc": "20555555555"},
        "error",
        motivo="ERROR_RUC",
    )

    assert not result["accepted"]
    assert any("Justificacion insuficiente" in item for item in result["blocking_reasons"])


def test_modification_validator_generates_credit_note_for_declared_period():
    guard = ExpertAccountingGuard(sunat_enabled=False)

    result = guard.validar_modificacion_asiento(
        {
            "issue_date": date.today().isoformat(),
            "document_type": "01",
            "series": "F001",
            "number": "8422",
            "currency": "PEN",
            "total_amount": "118.00",
            "partner_ruc": "20555555555",
        },
        {"total_amount": "118.00", "partner_ruc": "20555555555"},
        "Error de RUC detectado despues de cierre tributario mensual.",
        motivo="ERROR_RUC",
        periodo_declarado=True,
    )

    assert not result["accepted"]
    assert result["credit_note_draft"]["document_type"] == "07"
    assert result["credit_note_draft"]["affected_number"] == "8422"
