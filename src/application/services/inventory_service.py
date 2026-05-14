from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

from src.infrastructure.repositories.inventory_repository import InventoryRepository


@dataclass
class InventoryMovementResult:
    movement_id: str
    movement_type: str
    qty: str
    unit_cost: str
    balance_qty: str
    balance_avg_cost: str


class InventoryService:
    def __init__(self, inventory_repo: InventoryRepository):
        self.inventory_repo = inventory_repo

    async def register_movement(
        self,
        tenant_id: str,
        product_id: str,
        warehouse_id: str,
        movement_type: str,
        qty: Decimal,
        unit_cost: Decimal | None,
        movement_reference: str | None,
        source_document: str | None,
    ) -> InventoryMovementResult:
        if qty <= 0:
            raise ValueError("La cantidad debe ser mayor a cero")

        movement_type = movement_type.upper()
        if movement_type not in {"ENTRY", "EXIT"}:
            raise ValueError("movement_type debe ser ENTRY o EXIT")

        current_balance = await self.inventory_repo.get_last_balance(tenant_id, product_id, warehouse_id)
        current_qty = Decimal(str(current_balance.balance_qty)) if current_balance else Decimal("0")
        current_avg_cost = Decimal(str(current_balance.balance_avg_cost)) if current_balance else Decimal("0")

        if movement_type == "ENTRY":
            effective_cost = Decimal(str(unit_cost if unit_cost is not None else current_avg_cost))
            new_qty = current_qty + qty
            new_total_value = (current_qty * current_avg_cost) + (qty * effective_cost)
            new_avg_cost = (new_total_value / new_qty) if new_qty > 0 else Decimal("0")
        else:
            if current_qty < qty:
                raise ValueError("Stock insuficiente para salida")
            effective_cost = current_avg_cost
            new_qty = current_qty - qty
            new_avg_cost = current_avg_cost

        movement = await self.inventory_repo.create_movement(
            tenant_id=tenant_id,
            product_id=product_id,
            warehouse_id=warehouse_id,
            movement_type=movement_type,
            qty=qty,
            unit_cost=effective_cost,
            balance_qty=new_qty,
            balance_avg_cost=new_avg_cost,
            movement_reference=movement_reference or f"{movement_type}:{uuid4()}",
            source_document=source_document,
        )
        await self.inventory_repo.upsert_balance(tenant_id, product_id, warehouse_id, new_qty, new_avg_cost)

        return InventoryMovementResult(
            movement_id=str(movement.id),
            movement_type=movement_type,
            qty=str(qty),
            unit_cost=str(effective_cost),
            balance_qty=str(new_qty),
            balance_avg_cost=str(new_avg_cost),
        )
