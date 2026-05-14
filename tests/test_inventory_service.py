from decimal import Decimal

import pytest

from src.application.services.inventory_service import InventoryService


class FakeInventoryRepo:
    def __init__(self):
        self.balance = None
        self.movements = []

    async def get_last_balance(self, tenant_id: str, product_id: str, warehouse_id: str):
        return self.balance

    async def create_movement(
        self,
        tenant_id: str,
        product_id: str,
        warehouse_id: str,
        movement_type: str,
        qty: Decimal,
        unit_cost: Decimal,
        balance_qty: Decimal,
        balance_avg_cost: Decimal,
        movement_reference: str,
        source_document: str | None,
    ):
        movement = type("Movement", (), {"id": "mov-1"})()
        self.movements.append(
            {
                "movement_type": movement_type,
                "qty": qty,
                "unit_cost": unit_cost,
                "balance_qty": balance_qty,
                "balance_avg_cost": balance_avg_cost,
            }
        )
        return movement

    async def upsert_balance(self, tenant_id: str, product_id: str, warehouse_id: str, qty: Decimal, avg_cost: Decimal):
        self.balance = type("Balance", (), {"balance_qty": qty, "balance_avg_cost": avg_cost})()
        return self.balance


@pytest.mark.asyncio
async def test_register_entry_recalculates_weighted_average():
    repo = FakeInventoryRepo()
    repo.balance = type("Balance", (), {"balance_qty": Decimal("10"), "balance_avg_cost": Decimal("5")})()
    service = InventoryService(repo)

    result = await service.register_movement(
        tenant_id="tenant-demo",
        product_id="prod-1",
        warehouse_id="wh-1",
        movement_type="ENTRY",
        qty=Decimal("5"),
        unit_cost=Decimal("7"),
        movement_reference="ENTRY-001",
        source_document="PO-1",
    )

    assert result.movement_type == "ENTRY"
    assert Decimal(result.balance_qty) == Decimal("15")
    assert Decimal(result.balance_avg_cost).quantize(Decimal("0.000001")) == Decimal("5.666667")


@pytest.mark.asyncio
async def test_register_exit_uses_current_average_cost():
    repo = FakeInventoryRepo()
    repo.balance = type("Balance", (), {"balance_qty": Decimal("12"), "balance_avg_cost": Decimal("6.25")})()
    service = InventoryService(repo)

    result = await service.register_movement(
        tenant_id="tenant-demo",
        product_id="prod-1",
        warehouse_id="wh-1",
        movement_type="EXIT",
        qty=Decimal("2"),
        unit_cost=None,
        movement_reference="EXIT-001",
        source_document="INV-1",
    )

    assert result.movement_type == "EXIT"
    assert Decimal(result.unit_cost) == Decimal("6.25")
    assert Decimal(result.balance_qty) == Decimal("10")
    assert Decimal(result.balance_avg_cost) == Decimal("6.25")


@pytest.mark.asyncio
async def test_register_exit_with_insufficient_stock_raises_value_error():
    repo = FakeInventoryRepo()
    repo.balance = type("Balance", (), {"balance_qty": Decimal("1"), "balance_avg_cost": Decimal("9")})()
    service = InventoryService(repo)

    with pytest.raises(ValueError, match="Stock insuficiente"):
        await service.register_movement(
            tenant_id="tenant-demo",
            product_id="prod-1",
            warehouse_id="wh-1",
            movement_type="EXIT",
            qty=Decimal("2"),
            unit_cost=None,
            movement_reference="EXIT-002",
            source_document="INV-2",
        )
