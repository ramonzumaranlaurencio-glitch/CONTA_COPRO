from __future__ import annotations

import hashlib
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Protocol
from uuid import uuid4

from src.application.services.ledger_posting_service import LedgerPostingService
from src.domain.exceptions import PeriodLockedException
from src.domain.models.accounting import AccountingPeriod, JournalEntry
from src.domain.models.inventory import InventoryBalance, KardexMovement, Product, Warehouse
from src.infrastructure.repositories.ledger_repository import LedgerRepository


class InventoryRepositoryPort(Protocol):
    async def get_last_balance(self, tenant_id: str, product_id: str, warehouse_id: str) -> dict[str, Any] | None: ...
    async def upsert_balance(self, tenant_id: str, product_id: str, warehouse_id: str, qty: Decimal, avg_cost: Decimal) -> None: ...
    async def create_movement(self, movement: dict[str, Any]) -> dict[str, Any]: ...


class InventoryEngine:
    """Gestiona el movimiento de existencias y el costo de ventas por promedio ponderado."""

    async def register_movement(self, db, tenant_id: str, data: Dict[str, Any]):
        last_balance = await db.inventory.get_last_balance(tenant_id, data["product_id"], data["warehouse_id"])

        current_qty = Decimal(str(last_balance["balance_qty"])) if last_balance else Decimal("0")
        current_avg_cost = Decimal(str(last_balance["balance_avg_cost"])) if last_balance else Decimal("0")
        qty = Decimal(str(data["qty"]))
        unit_cost = Decimal(str(data.get("unit_cost", current_avg_cost)))

        if data["type"] == "ENTRY":
            new_qty = current_qty + qty
            new_total_value = (current_qty * current_avg_cost) + (qty * unit_cost)
            new_avg_cost = (new_total_value / new_qty) if new_qty > 0 else Decimal("0")
        else:
            new_qty = current_qty - qty
            new_avg_cost = current_avg_cost
            unit_cost = current_avg_cost

        movement = {
            "tenant_id": tenant_id,
            "product_id": data["product_id"],
            "warehouse_id": data["warehouse_id"],
            "movement_type": data["type"],
            "qty": qty,
            "unit_cost": unit_cost,
            "balance_qty": new_qty,
            "balance_avg_cost": new_avg_cost,
            "movement_reference": data.get("movement_reference") or f"{data['type']}:{uuid4()}",
            "source_document": data.get("source_document"),
            "created_at": datetime.utcnow(),
        }

        await db.inventory.create_movement(movement)
        await db.inventory.upsert_balance(tenant_id, data["product_id"], data["warehouse_id"], new_qty, new_avg_cost)
        return movement


class SalesOrchestrator:
    """Une la IA Vision, el Inventario y la Contabilidad en un solo flujo."""

    def __init__(self, inventory_engine: InventoryEngine):
        self.inventory = inventory_engine

    async def process_sale_ia(self, db, tenant_id: str, vision_data: Dict[str, Any]):
        asiento = await db.journal_entries.create({
            "tenant_id": tenant_id,
            "date": vision_data["fecha"],
            "glosa": f"VENTA IA: {vision_data['serie_numero']}",
            "items": [
                {"account": "130505", "debit": vision_data["total"], "credit": 0},
                {"account": "240805", "debit": 0, "credit": vision_data["total"] - vision_data["total"] / Decimal("1.19")},
                {"account": "413505", "debit": 0, "credit": vision_data["total"] / Decimal("1.19")},
            ],
        })

        for item in vision_data.get("items", []):
            await self.inventory.register_movement(db, tenant_id, {
                "product_id": item["id"],
                "type": "EXIT",
                "qty": item["qty"],
                "warehouse_id": item.get("warehouse_id") or "ALMACEN_PRINCIPAL",
                "movement_reference": vision_data["serie_numero"],
                "source_document": vision_data.get("serie_numero"),
            })

        return {"status": "SUCCESS", "entry_id": asiento["id"]}


class PeriodSecurity:
    """Garantiza la inmutabilidad de los libros contables."""

    @staticmethod
    def generate_hash(previous_hash: str, entry_data: str) -> str:
        block_content = f"{previous_hash}{entry_data}{datetime.now()}"
        return hashlib.sha256(block_content.encode()).hexdigest()

    async def close_month(self, db, tenant_id: str, month: int, year: int):
        balance = await db.journal_items.aggregate(
            sum={"debit": True, "credit": True},
            where={"tenant_id": tenant_id, "month": month, "year": year},
        )

        if balance["sum"]["debit"] != balance["sum"]["credit"]:
            raise ValueError("Error: Descuadre detectado. No se puede cerrar.")

        await db.monthly_periods.update(
            where={"tenant_id_period": {"tenant_id": tenant_id, "month": month, "year": year}},
            data={"status": "CLOSED", "closed_at": datetime.now()},
        )
        return True


class ChartOfAccountsManager:
    """Gestion del PUC Colombia editable por empresa."""

    async def upsert_account(self, db, tenant_id: str, account_code: str, name: str):
        return await db.chart_of_accounts.upsert(
            where={"tenant_id_code": {"tenant_id": tenant_id, "code": account_code}},
            update={"name": name},
            create={"tenant_id": tenant_id, "code": account_code, "name": name},
        )


class SimpleInventoryRepository:
    def __init__(self, session):
        self.session = session

    async def get_last_balance(self, tenant_id: str, product_id: str, warehouse_id: str):
        from sqlalchemy import select
        from src.domain.models.inventory import KardexMovement

        result = await self.session.execute(
            select(KardexMovement)
            .where(
                KardexMovement.tenant_id == tenant_id,
                KardexMovement.product_id == product_id,
                KardexMovement.warehouse_id == warehouse_id,
            )
            .order_by(KardexMovement.created_at.desc(), KardexMovement.id.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return {"balance_qty": row.balance_qty, "balance_avg_cost": row.balance_avg_cost}

    async def upsert_balance(self, tenant_id: str, product_id: str, warehouse_id: str, qty: Decimal, avg_cost: Decimal) -> None:
        from sqlalchemy import select

        result = await self.session.execute(
            select(InventoryBalance).where(
                InventoryBalance.tenant_id == tenant_id,
                InventoryBalance.product_id == product_id,
                InventoryBalance.warehouse_id == warehouse_id,
            )
        )
        balance = result.scalar_one_or_none()
        if balance is None:
            balance = InventoryBalance(
                tenant_id=tenant_id,
                product_id=product_id,
                warehouse_id=warehouse_id,
                balance_qty=qty,
                balance_avg_cost=avg_cost,
            )
            self.session.add(balance)
        else:
            balance.balance_qty = qty
            balance.balance_avg_cost = avg_cost
        await self.session.flush()

    async def create_movement(self, movement: dict[str, Any]) -> dict[str, Any]:
        self.session.add(KardexMovement(**movement))
        await self.session.flush()
        return movement


class CoreTransactionalEngine:
    def __init__(self, ledger_service: LedgerPostingService, inventory_repo: SimpleInventoryRepository):
        self.ledger_service = ledger_service
        self.inventory_engine = InventoryEngine()
        self.inventory_repo = inventory_repo

    async def process_sale_ia(self, db, tenant_id: str, vision_data: Dict[str, Any]):
        return await SalesOrchestrator(self.inventory_engine).process_sale_ia(db, tenant_id, vision_data)

    async def close_month(self, db, tenant_id: str, month: int, year: int):
        return await PeriodSecurity().close_month(db, tenant_id, month, year)
