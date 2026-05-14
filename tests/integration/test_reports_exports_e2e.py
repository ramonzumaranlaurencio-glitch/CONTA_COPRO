from __future__ import annotations

from base64 import b64decode

from fastapi.testclient import TestClient

from src.api.dependencies import get_current_context
from src.api.routes import reports as reports_routes
from src.main import create_app


class StubReportingService:
    async def financial_pack(
        self,
        tenant_id: str,
        *,
        year: int,
        month: int | None = None,
        compare_year: int | None = None,
        compare_month: int | None = None,
        company_id: str | None = None,
    ):
        return {
            "period": "2026-05",
            "trial_balance": [{"account_code": "101", "account_name": "Caja", "debit": "1200.00", "credit": "300.00", "balance": "900.00"}],
            "balance_sheet": {
                "period": "2026-05",
                "assets": "1500.00",
                "liabilities": "500.00",
                "equity": "1000.00",
                "check": "0.00",
            },
            "income_statement": {
                "period": "2026-05",
                "revenue": "2800.00",
                "cost": "1000.00",
                "gross_profit": "1800.00",
                "expenses": "700.00",
                "operating_profit": "1100.00",
            },
            "cash_flow": {
                "period": "2026-05",
                "opening_cash": "200.00",
                "net_cash_movement": "700.00",
                "ending_cash": "900.00",
            },
            "ratios": {
                "operating_margin": "0.39",
                "debt_to_equity": "0.50",
                "financial_leverage": "1.50",
            },
            "comparison": {
                "balance_sheet": {
                    "period": "2025-05",
                    "assets": "1300.00",
                    "liabilities": "600.00",
                    "equity": "700.00",
                    "check": "0.00",
                },
                "income_statement": {
                    "period": "2025-05",
                    "revenue": "2400.00",
                    "cost": "950.00",
                    "gross_profit": "1450.00",
                    "expenses": "650.00",
                    "operating_profit": "800.00",
                },
                "cash_flow": {
                    "period": "2025-05",
                    "opening_cash": "120.00",
                    "net_cash_movement": "480.00",
                    "ending_cash": "600.00",
                },
            },
        }


def _build_client() -> TestClient:
    app = create_app()
    app.dependency_overrides[get_current_context] = lambda: {
        "tenant_id": "11111111-1111-1111-1111-111111111111",
        "role": "ADMIN",
        "user_id": "erp.operator",
        "trace_id": "test-trace",
    }
    return TestClient(app)


def test_financial_pack_comparison_block_complete(monkeypatch):
    monkeypatch.setattr(reports_routes, "reporting_service", lambda: StubReportingService())
    client = _build_client()

    response = client.get("/api/v1/reports/financial-pack?year=2026&month=5&compare_year=2025&compare_month=5")
    assert response.status_code == 200

    payload = response.json()
    assert "comparison" in payload
    assert payload["comparison"]["balance_sheet"]["assets"] == "1300.00"
    assert payload["comparison"]["income_statement"]["operating_profit"] == "800.00"
    assert payload["comparison"]["cash_flow"]["ending_cash"] == "600.00"


def test_financial_pack_xlsx_export(monkeypatch):
    monkeypatch.setattr(reports_routes, "reporting_service", lambda: StubReportingService())
    client = _build_client()

    response = client.get("/api/v1/reports/financial-pack/xlsx?year=2026&month=5&compare_year=2025&compare_month=5")
    assert response.status_code == 200

    payload = response.json()
    assert payload["filename"].endswith(".xlsx")
    assert payload["mime_type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    content = b64decode(payload["content_base64"])
    assert content[:2] == b"PK"


def test_financial_pack_pdf_export(monkeypatch):
    monkeypatch.setattr(reports_routes, "reporting_service", lambda: StubReportingService())
    client = _build_client()

    response = client.get("/api/v1/reports/financial-pack/pdf?year=2026&month=5&compare_year=2025&compare_month=5")
    assert response.status_code == 200

    payload = response.json()
    assert payload["filename"].endswith(".pdf")
    assert payload["mime_type"] == "application/pdf"
    content = b64decode(payload["content_base64"])
    assert content[:4] == b"%PDF"
