from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models.inventory import InventoryBalance, KardexMovement, Product, Warehouse


class InventoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_product(
        self,
        tenant_id: str,
        sku: str,
        name: str,
        unit_of_measure: str,
        default_cost: Decimal,
        default_sales_account: str | None,
        default_cost_account: str | None,
    ) -> Product:
        product = Product(
            tenant_id=tenant_id,
            sku=sku,
            name=name,
            unit_of_measure=unit_of_measure,
            default_cost=default_cost,
            default_sales_account=default_sales_account,
            default_cost_account=default_cost_account,
        )
        self.session.add(product)
        await self.session.flush()
        return product

    async def list_products(self, tenant_id: str, limit: int = 200) -> list[Product]:
        result = await self.session.execute(
            select(Product)
            .where(Product.tenant_id == tenant_id, Product.is_active.is_(True))
            .order_by(Product.sku.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create_warehouse(self, tenant_id: str, code: str, name: str) -> Warehouse:
        warehouse = Warehouse(tenant_id=tenant_id, code=code, name=name)
        self.session.add(warehouse)
        await self.session.flush()
        return warehouse

    async def list_warehouses(self, tenant_id: str, limit: int = 100) -> list[Warehouse]:
        result = await self.session.execute(
            select(Warehouse)
            .where(Warehouse.tenant_id == tenant_id, Warehouse.is_active.is_(True))
            .order_by(Warehouse.code.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_last_balance(self, tenant_id: str, product_id: str, warehouse_id: str) -> InventoryBalance | None:
        result = await self.session.execute(
            select(InventoryBalance).where(
                InventoryBalance.tenant_id == tenant_id,
                InventoryBalance.product_id == product_id,
                InventoryBalance.warehouse_id == warehouse_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_balance(self, tenant_id: str, product_id: str, warehouse_id: str, qty: Decimal, avg_cost: Decimal) -> InventoryBalance:
        balance = await self.get_last_balance(tenant_id, product_id, warehouse_id)
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
        return balance

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
    ) -> KardexMovement:
        movement = KardexMovement(
            id=uuid4(),
            tenant_id=tenant_id,
            product_id=product_id,
            warehouse_id=warehouse_id,
            movement_type=movement_type,
            qty=qty,
            unit_cost=unit_cost,
            balance_qty=balance_qty,
            balance_avg_cost=balance_avg_cost,
            movement_reference=movement_reference,
            source_document=source_document,
        )
        self.session.add(movement)
        await self.session.flush()
        return movement

    async def list_kardex(
        self,
        tenant_id: str,
        product_id: str,
        warehouse_id: str | None = None,
        limit: int = 500,
    ) -> list[KardexMovement]:
        filters = [KardexMovement.tenant_id == tenant_id, KardexMovement.product_id == product_id]
        if warehouse_id:
            filters.append(KardexMovement.warehouse_id == warehouse_id)

        result = await self.session.execute(
            select(KardexMovement)
            .where(*filters)
            .order_by(KardexMovement.created_at.desc(), KardexMovement.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
