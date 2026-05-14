from src.application.services.financial_reporting_service import FinancialReportingService


class StubReportingService(FinancialReportingService):
    def __init__(self):
        super().__init__(uow_factory=None)

    async def trial_balance(self, tenant_id: str, *, year: int, month: int | None = None, company_id: str | None = None):
        return [{"account_code": "101", "debit": "100.00", "credit": "20.00", "balance": "80.00", "account_name": "Caja"}]

    async def balance_sheet(self, tenant_id: str, *, year: int, month: int | None = None, company_id: str | None = None):
        return {
            "period": "2026-05",
            "assets": "1000.00",
            "liabilities": "400.00",
            "equity": "600.00",
            "memorandum_8_9": "0.00",
            "check": "0.00",
            "detail": [],
        }

    async def income_statement(self, tenant_id: str, *, year: int, month: int | None = None, company_id: str | None = None):
        return {
            "period": "2026-05",
            "revenue": "1200.00",
            "cost": "300.00",
            "gross_profit": "900.00",
            "expenses": "500.00",
            "operating_profit": "400.00",
            "detail": [],
        }

    async def cash_flow(self, tenant_id: str, *, year: int, month: int | None = None, company_id: str | None = None):
        return {
            "period": "2026-05",
            "method": "direct_ledger",
            "opening_cash": "0.00",
            "net_cash_movement": "80.00",
            "ending_cash": "80.00",
            "detail": [],
        }


async def test_financial_pack_includes_ratios_and_comparison():
    service = StubReportingService()

    payload = await service.financial_pack(
        "tenant-demo",
        year=2026,
        month=5,
        compare_year=2025,
        compare_month=5,
    )

    assert "trial_balance" in payload
    assert "balance_sheet" in payload
    assert "income_statement" in payload
    assert "cash_flow" in payload
    assert "comparison" in payload
    assert payload["ratios"]["debt_to_equity"] == "0.67"
    assert payload["ratios"]["operating_margin"] == "0.33"
    assert payload["ratios"]["financial_leverage"] == "1.67"
