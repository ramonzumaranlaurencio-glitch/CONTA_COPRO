from __future__ import annotations

import csv
import io
import zipfile
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, extract, func, select

from src.application.services.financial_reporting_service import FinancialReportingService
from src.domain.models.accounting import FinancialDocument, TreasuryMovement
from src.domain.models.inventory import InventoryBalance, Product, Warehouse


@dataclass
class BookPackage:
    files: dict[str, str]
    zip_bytes: bytes


class BooksService:
    def __init__(self, uow_factory):
        self.uow_factory = uow_factory
        self.reporting = FinancialReportingService(uow_factory)

    async def period_status(self, tenant_id: str, *, year: int, month: int):
        async with self.uow_factory(tenant_id) as uow:
            sales = await self._count_documents(uow.session, tenant_id, year, month, "OUT")
            purchases = await self._count_documents(uow.session, tenant_id, year, month, "IN")
            treasury = await self._count_treasury(uow.session, tenant_id, year, month)
            inventory = await self._count_inventory_balances(uow.session, tenant_id)

        return {
            "period": f"{year}-{month:02d}",
            "sources": {
                "sales_documents": sales,
                "purchase_documents": purchases,
                "treasury_movements": treasury,
                "inventory_balances": inventory,
            },
            "ready": True,
        }

    async def generate_books(self, tenant_id: str, *, year: int, month: int) -> BookPackage:
        async with self.uow_factory(tenant_id) as uow:
            sales_rows = await self._list_documents(uow.session, tenant_id, year, month, "OUT")
            purchase_rows = await self._list_documents(uow.session, tenant_id, year, month, "IN")
            treasury_rows = await self._list_treasury(uow.session, tenant_id, year, month)
            inventory_rows = await self._list_inventory_balances(uow.session, tenant_id)

        trial_balance = await self.reporting.trial_balance(tenant_id, year=year, month=month)

        files = {
            "registro_ventas.csv": self._csv(
                [
                    "issue_date",
                    "document_type",
                    "series",
                    "number",
                    "currency",
                    "taxable_amount",
                    "tax_amount",
                    "total_amount",
                    "sunat_status",
                ],
                sales_rows,
            ),
            "registro_compras.csv": self._csv(
                [
                    "issue_date",
                    "document_type",
                    "series",
                    "number",
                    "currency",
                    "taxable_amount",
                    "tax_amount",
                    "total_amount",
                    "sunat_status",
                ],
                purchase_rows,
            ),
            "libro_caja_bancos.csv": self._csv(
                [
                    "movement_date",
                    "movement_type",
                    "currency",
                    "amount",
                    "reference",
                    "reconciliation_status",
                ],
                treasury_rows,
            ),
            "libro_inventarios_balances.csv": self._csv(
                [
                    "sku",
                    "product_name",
                    "warehouse_code",
                    "warehouse_name",
                    "balance_qty",
                    "balance_avg_cost",
                    "balance_total",
                ],
                inventory_rows,
            ),
            "balance_comprobacion.csv": self._csv(
                ["account_code", "account_name", "debit", "credit", "balance"],
                trial_balance,
            ),
        }

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for filename, content in files.items():
                archive.writestr(filename, content)

        return BookPackage(files=files, zip_bytes=zip_buffer.getvalue())

    @staticmethod
    async def _count_documents(session, tenant_id: str, year: int, month: int, direction: str) -> int:
        result = await session.execute(
            select(func.count(FinancialDocument.id)).where(
                and_(
                    FinancialDocument.tenant_id == tenant_id,
                    FinancialDocument.direction == direction,
                    extract("year", FinancialDocument.issue_date) == year,
                    extract("month", FinancialDocument.issue_date) == month,
                )
            )
        )
        return int(result.scalar_one() or 0)

    @staticmethod
    async def _count_treasury(session, tenant_id: str, year: int, month: int) -> int:
        result = await session.execute(
            select(func.count(TreasuryMovement.id)).where(
                and_(
                    TreasuryMovement.tenant_id == tenant_id,
                    extract("year", TreasuryMovement.movement_date) == year,
                    extract("month", TreasuryMovement.movement_date) == month,
                )
            )
        )
        return int(result.scalar_one() or 0)

    @staticmethod
    async def _count_inventory_balances(session, tenant_id: str) -> int:
        result = await session.execute(
            select(func.count(InventoryBalance.id)).where(InventoryBalance.tenant_id == tenant_id)
        )
        return int(result.scalar_one() or 0)

    @staticmethod
    async def _list_documents(session, tenant_id: str, year: int, month: int, direction: str) -> list[dict]:
        result = await session.execute(
            select(
                FinancialDocument.issue_date,
                FinancialDocument.document_type,
                FinancialDocument.series,
                FinancialDocument.number,
                FinancialDocument.currency,
                FinancialDocument.taxable_amount,
                FinancialDocument.tax_amount,
                FinancialDocument.total_amount,
                FinancialDocument.sunat_status,
            ).where(
                and_(
                    FinancialDocument.tenant_id == tenant_id,
                    FinancialDocument.direction == direction,
                    extract("year", FinancialDocument.issue_date) == year,
                    extract("month", FinancialDocument.issue_date) == month,
                )
            ).order_by(FinancialDocument.issue_date.asc())
        )

        rows = []
        for row in result.all():
            rows.append(
                {
                    "issue_date": BooksService._date(row.issue_date),
                    "document_type": row.document_type,
                    "series": row.series,
                    "number": row.number,
                    "currency": row.currency,
                    "taxable_amount": BooksService._money(row.taxable_amount),
                    "tax_amount": BooksService._money(row.tax_amount),
                    "total_amount": BooksService._money(row.total_amount),
                    "sunat_status": row.sunat_status,
                }
            )
        return rows

    @staticmethod
    async def _list_treasury(session, tenant_id: str, year: int, month: int) -> list[dict]:
        result = await session.execute(
            select(
                TreasuryMovement.movement_date,
                TreasuryMovement.movement_type,
                TreasuryMovement.currency,
                TreasuryMovement.amount,
                TreasuryMovement.reference,
                TreasuryMovement.reconciliation_status,
            ).where(
                and_(
                    TreasuryMovement.tenant_id == tenant_id,
                    extract("year", TreasuryMovement.movement_date) == year,
                    extract("month", TreasuryMovement.movement_date) == month,
                )
            ).order_by(TreasuryMovement.movement_date.asc())
        )

        rows = []
        for row in result.all():
            rows.append(
                {
                    "movement_date": BooksService._date(row.movement_date),
                    "movement_type": row.movement_type,
                    "currency": row.currency,
                    "amount": BooksService._money(row.amount),
                    "reference": row.reference or "",
                    "reconciliation_status": row.reconciliation_status,
                }
            )
        return rows

    @staticmethod
    async def _list_inventory_balances(session, tenant_id: str) -> list[dict]:
        result = await session.execute(
            select(
                Product.sku.label("product_sku"),
                Product.name.label("product_name"),
                Warehouse.code.label("warehouse_code"),
                Warehouse.name.label("warehouse_name"),
                InventoryBalance.balance_qty,
                InventoryBalance.balance_avg_cost,
            )
            .select_from(InventoryBalance)
            .join(Product, Product.id == InventoryBalance.product_id)
            .join(Warehouse, Warehouse.id == InventoryBalance.warehouse_id)
            .where(InventoryBalance.tenant_id == tenant_id)
            .order_by(Product.sku.asc(), Warehouse.code.asc())
        )

        rows = []
        for row in result.all():
            balance_qty = Decimal(str(row.balance_qty or 0))
            balance_avg_cost = Decimal(str(row.balance_avg_cost or 0))
            rows.append(
                {
                    "sku": row.product_sku,
                    "product_name": row.product_name,
                    "warehouse_code": row.warehouse_code,
                    "warehouse_name": row.warehouse_name,
                    "balance_qty": BooksService._money(balance_qty),
                    "balance_avg_cost": BooksService._money(balance_avg_cost),
                    "balance_total": BooksService._money(balance_qty * balance_avg_cost),
                }
            )
        return rows

    @staticmethod
    def _csv(headers: list[str], rows: list[dict]) -> str:
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in headers})
        return out.getvalue()

    @staticmethod
    def _money(value) -> str:
        return format(Decimal(str(value or 0)).quantize(Decimal("0.01")), "f")

    @staticmethod
    def _date(value: date | None) -> str:
        return value.isoformat() if value else ""
