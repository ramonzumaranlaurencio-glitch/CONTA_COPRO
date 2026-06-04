from __future__ import annotations

from decimal import Decimal
from typing import Any


class FinancialReportService:
    """Calcula saldos estructurados para reportes oficiales de estados financieros."""

    def __init__(self, ledger_repo: Any):
        self.ledger_repo = ledger_repo

    async def get_balance_sheet(self, tenant_id: str, period_end: str) -> dict[str, Any]:
        saldos = await self.ledger_repo.get_balances_by_class(tenant_id, period_end)

        report = {
            "activo": {
                "corriente": self._filter(saldos, "10", "19"),
                "no_corriente": self._filter(saldos, "30", "39"),
            },
            "pasivo": {
                "corriente": self._filter(saldos, "40", "47"),
                "no_corriente": self._filter(saldos, "48", "49"),
            },
            "patrimonio": self._filter(saldos, "50", "59"),
        }
        return report

    def _filter(self, saldos: list[Any], start: str, end: str) -> Decimal:
        """Suma saldos de cuentas dentro de un rango de clase contable."""
        return sum((s.total for s in saldos if start <= s.account[:2] <= end), Decimal("0.00"))
