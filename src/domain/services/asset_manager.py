from __future__ import annotations

from datetime import date
from decimal import Decimal


class AssetDepreciator:
    """Calcula la depreciacion lineal mensual oficial."""

    @staticmethod
    def calculate_monthly(cost: Decimal, rate: float, acquisition_date: date):
        monthly_rate = Decimal(str(rate)) / Decimal("12") / Decimal("100")
        monthly_depreciation = cost * monthly_rate

        return {
            "monthly_amount": monthly_depreciation.quantize(Decimal("0.01")),
            "account_debit": "681",
            "account_credit": "391",
        }
