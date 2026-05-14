from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from src.infrastructure.repositories.ledger_repository import LedgerRepository


def money(value) -> str:
    return format(Decimal(str(value)).quantize(Decimal("0.01")), "f")


class FinancialReportingService:
    def __init__(self, uow_factory):
        self.uow_factory = uow_factory

    async def trial_balance(self, tenant_id: str, *, year: int, month: int | None = None, company_id: str | None = None):
        async with self.uow_factory(tenant_id) as uow:
            rows = await LedgerRepository(uow.session).trial_balance(
                tenant_id,
                year=year,
                month=month,
                company_id=company_id,
            )
        return [self._row(row) for row in rows]

    async def balance_sheet(self, tenant_id: str, *, year: int, month: int | None = None, company_id: str | None = None):
        rows = await self.trial_balance(tenant_id, year=year, month=month, company_id=company_id)
        sections = {
            "assets": Decimal("0.00"),
            "liabilities": Decimal("0.00"),
            "equity": Decimal("0.00"),
            "memorandum_8_9": Decimal("0.00"),
        }
        detail = []
        for row in rows:
            code = row["account_code"]
            balance = Decimal(row["debit"]) - Decimal(row["credit"])
            if code.startswith(("1", "2", "3")):
                sections["assets"] += balance
                section = "assets"
            elif code.startswith("4"):
                sections["liabilities"] += -balance
                section = "liabilities"
            elif code.startswith("5"):
                sections["equity"] += -balance
                section = "equity"
            elif code.startswith(("8", "9")):
                sections["memorandum_8_9"] += abs(balance)
                section = "memorandum_8_9"
            else:
                continue
            detail.append({**row, "section": section, "balance": money(balance)})
        return {
            "period": self._period_label(year, month),
            "assets": money(sections["assets"]),
            "liabilities": money(sections["liabilities"]),
            "equity": money(sections["equity"]),
            "memorandum_8_9": money(sections["memorandum_8_9"]),
            "check": money(sections["assets"] - sections["liabilities"] - sections["equity"]),
            "detail": detail,
        }

    async def income_statement(self, tenant_id: str, *, year: int, month: int | None = None, company_id: str | None = None):
        rows = await self.trial_balance(tenant_id, year=year, month=month, company_id=company_id)
        revenue = Decimal("0.00")
        cost = Decimal("0.00")
        expenses = Decimal("0.00")
        detail = []
        for row in rows:
            code = row["account_code"]
            debit = Decimal(row["debit"])
            credit = Decimal(row["credit"])
            if code.startswith("70"):
                amount = credit - debit
                revenue += amount
                bucket = "revenue"
            elif code.startswith(("69", "60", "61")):
                amount = debit - credit
                cost += amount
                bucket = "cost"
            elif code.startswith(("62", "63", "64", "65", "66", "67", "68", "9")):
                amount = debit - credit
                expenses += amount
                bucket = "expenses"
            else:
                continue
            detail.append({**row, "bucket": bucket, "amount": money(amount)})
        return {
            "period": self._period_label(year, month),
            "revenue": money(revenue),
            "cost": money(cost),
            "gross_profit": money(revenue - cost),
            "expenses": money(expenses),
            "operating_profit": money(revenue - cost - expenses),
            "detail": detail,
        }

    async def cash_flow(self, tenant_id: str, *, year: int, month: int | None = None, company_id: str | None = None):
        rows = await self.trial_balance(tenant_id, year=year, month=month, company_id=company_id)
        cash_accounts = [row for row in rows if row["account_code"].startswith("10")]
        net_cash = sum(Decimal(row["debit"]) - Decimal(row["credit"]) for row in cash_accounts)
        return {
            "period": self._period_label(year, month),
            "method": "direct_ledger",
            "opening_cash": "0.00",
            "net_cash_movement": money(net_cash),
            "ending_cash": money(net_cash),
            "detail": [{**row, "balance": money(Decimal(row["debit"]) - Decimal(row["credit"]))} for row in cash_accounts],
        }

    async def general_ledger(self, tenant_id: str, *, account_code: str, year: int, month: int | None = None, limit: int = 500):
        async with self.uow_factory(tenant_id) as uow:
            rows = await LedgerRepository(uow.session).account_ledger(
                tenant_id,
                account_code=account_code,
                year=year,
                month=month,
                limit=limit,
            )
        running = Decimal("0.00")
        detail = []
        for row in rows:
            entry = row["entry"]
            line = row["line"]
            running += Decimal(str(line.debit)) - Decimal(str(line.credit))
            detail.append({
                "entry_id": str(entry.id),
                "entry_date": entry.entry_date.isoformat(),
                "description": entry.description,
                "debit": money(line.debit),
                "credit": money(line.credit),
                "running_balance": money(running),
                "row_hash": entry.row_hash,
            })
        return {"account_code": account_code, "period": self._period_label(year, month), "lines": detail}

    async def aging(self, tenant_id: str, *, direction: str, as_of: datetime | None = None):
        as_of = as_of or datetime.utcnow()
        async with self.uow_factory(tenant_id) as uow:
            rows = await LedgerRepository(uow.session).ar_ap_aging(tenant_id, direction=direction, as_of=as_of)
        buckets = {"current": Decimal("0.00"), "1_30": Decimal("0.00"), "31_60": Decimal("0.00"), "61_90": Decimal("0.00"), "90_plus": Decimal("0.00")}
        documents = []
        for row in rows:
            due_date = row["due_date"] or row["issue_date"]
            days = max(0, (as_of.date() - due_date).days)
            amount = Decimal(str(row["balance_amount"]))
            if days == 0:
                bucket = "current"
            elif days <= 30:
                bucket = "1_30"
            elif days <= 60:
                bucket = "31_60"
            elif days <= 90:
                bucket = "61_90"
            else:
                bucket = "90_plus"
            buckets[bucket] += amount
            documents.append({**row, "days_overdue": days, "bucket": bucket, "balance_amount": money(amount)})
        return {
            "direction": direction,
            "as_of": as_of.date().isoformat(),
            "buckets": {key: money(value) for key, value in buckets.items()},
            "documents": documents,
        }

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
        current_balance = await self.balance_sheet(tenant_id, year=year, month=month, company_id=company_id)
        current_income = await self.income_statement(tenant_id, year=year, month=month, company_id=company_id)
        current_cash = await self.cash_flow(tenant_id, year=year, month=month, company_id=company_id)
        current_trial = await self.trial_balance(tenant_id, year=year, month=month, company_id=company_id)

        compare_block = None
        if compare_year is not None:
            compare_block = {
                "balance_sheet": await self.balance_sheet(tenant_id, year=compare_year, month=compare_month, company_id=company_id),
                "income_statement": await self.income_statement(tenant_id, year=compare_year, month=compare_month, company_id=company_id),
                "cash_flow": await self.cash_flow(tenant_id, year=compare_year, month=compare_month, company_id=company_id),
            }

        ratios = self._financial_ratios(current_balance, current_income)

        return {
            "period": self._period_label(year, month),
            "trial_balance": current_trial,
            "balance_sheet": current_balance,
            "income_statement": current_income,
            "cash_flow": current_cash,
            "ratios": ratios,
            "comparison": compare_block,
        }

    @staticmethod
    def _financial_ratios(balance_sheet: dict, income_statement: dict) -> dict:
        assets = Decimal(balance_sheet.get("assets", "0"))
        liabilities = Decimal(balance_sheet.get("liabilities", "0"))
        equity = Decimal(balance_sheet.get("equity", "0"))
        revenue = Decimal(income_statement.get("revenue", "0"))
        operating_profit = Decimal(income_statement.get("operating_profit", "0"))

        debt_to_equity = (liabilities / equity) if equity != 0 else Decimal("0")
        margin = (operating_profit / revenue) if revenue != 0 else Decimal("0")
        leverage = (assets / equity) if equity != 0 else Decimal("0")

        return {
            "debt_to_equity": money(debt_to_equity),
            "operating_margin": money(margin),
            "financial_leverage": money(leverage),
        }

    @staticmethod
    def _row(row: dict) -> dict:
        debit = Decimal(str(row["debit"]))
        credit = Decimal(str(row["credit"]))
        return {
            "account_code": row["account_code"],
            "account_name": row.get("account_name") or "",
            "debit": money(debit),
            "credit": money(credit),
            "balance": money(debit - credit),
        }

    @staticmethod
    def _period_label(year: int, month: int | None) -> str:
        return f"{year}-{month:02d}" if month else str(year)
