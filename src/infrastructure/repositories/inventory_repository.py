from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models.inventory import InventoryBalance, KardexMovement, Product, Warehouse


class InventoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # =========================================================================
    # PRODUCTS
    # =========================================================================

    async def create_product(
        self,
        tenant_id: str,
        sku: str,
        name: str,
        unit_of_measure: str,
        default_cost: Decimal,
        default_sales_account: str | None,
        default_cost_account: str | None,
        item_class: str = "MERCADERIA",
        token_type: str = "PERMANENTE",
        token_code: str | None = None,
        area: str = "ALMACEN",
        location: str | None = None,
        min_stock: Decimal = Decimal("0"),
        max_stock: Decimal = Decimal("0"),
        brand: str | None = None,
        specs: str | None = None,
        detail_description: str | None = None,
    ) -> Product:
        product = Product(
            tenant_id=tenant_id,
            sku=sku,
            name=name,
            unit_of_measure=unit_of_measure,
            default_cost=default_cost,
            default_sales_account=default_sales_account,
            default_cost_account=default_cost_account,
            item_class=item_class,
            token_type=token_type,
            token_code=token_code,
            area=area,
            location=location,
            min_stock=min_stock,
            max_stock=max_stock,
            brand=brand,
            specs=specs,
            detail_description=detail_description,
        )
        self.session.add(product)
        await self.session.flush()
        return product

    async def get_product_by_id(self, tenant_id: str, product_id: str) -> Product | None:
        result = await self.session.execute(
            select(Product).where(Product.tenant_id == tenant_id, Product.id == product_id)
        )
        return result.scalar_one_or_none()

    async def update_product(self, tenant_id: str, product_id: str, **fields) -> Product:
        product = await self.get_product_by_id(tenant_id, product_id)
        if not product:
            raise ValueError(f"Artículo {product_id} no encontrado")
        allowed = {
            "name", "unit_of_measure", "default_cost", "default_sales_account",
            "default_cost_account", "item_class", "token_type", "token_code",
            "area", "location", "min_stock", "max_stock", "brand", "specs",
            "detail_description", "is_active",
        }
        for key, value in fields.items():
            if key in allowed:
                setattr(product, key, value)
        await self.session.flush()
        return product

    async def toggle_active_product(self, tenant_id: str, product_id: str) -> Product:
        product = await self.get_product_by_id(tenant_id, product_id)
        if not product:
            raise ValueError(f"Artículo {product_id} no encontrado")
        product.is_active = not product.is_active
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

    async def list_products_filtered(
        self,
        tenant_id: str,
        limit: int = 500,
        item_class: str | None = None,
        area: str | None = None,
        token_type: str | None = None,
        active_only: bool = True,
    ) -> list[Product]:
        filters = [Product.tenant_id == tenant_id]
        if active_only:
            filters.append(Product.is_active.is_(True))
        if item_class:
            filters.append(Product.item_class == item_class)
        if area:
            filters.append(Product.area == area)
        if token_type:
            filters.append(Product.token_type == token_type)
        result = await self.session.execute(
            select(Product)
            .where(*filters)
            .order_by(Product.item_class.asc(), Product.sku.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_products_by_class_area(self, tenant_id: str, item_class: str, area: str) -> int:
        result = await self.session.execute(
            select(func.count(Product.id)).where(
                Product.tenant_id == tenant_id,
                Product.item_class == item_class,
                Product.area == area,
            )
        )
        return result.scalar_one() or 0

    # =========================================================================
    # WAREHOUSES
    # =========================================================================

    async def create_warehouse(
        self,
        tenant_id: str,
        code: str,
        name: str,
        warehouse_type: str = "GENERAL",
        location: str | None = None,
    ) -> Warehouse:
        warehouse = Warehouse(
            tenant_id=tenant_id,
            code=code,
            name=name,
            warehouse_type=warehouse_type,
            location=location,
        )
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

    # =========================================================================
    # BALANCES
    # =========================================================================

    async def get_last_balance(self, tenant_id: str, product_id: str, warehouse_id: str) -> InventoryBalance | None:
        result = await self.session.execute(
            select(InventoryBalance).where(
                InventoryBalance.tenant_id == tenant_id,
                InventoryBalance.product_id == product_id,
                InventoryBalance.warehouse_id == warehouse_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_balance(
        self, tenant_id: str, product_id: str, warehouse_id: str, qty: Decimal, avg_cost: Decimal
    ) -> InventoryBalance:
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

    async def list_balances_with_product(
        self, tenant_id: str, limit: int = 1000
    ) -> list[dict]:
        """
        Retorna balances joinados con producto y almacén para la vista de inventario.
        """
        result = await self.session.execute(
            select(
                InventoryBalance,
                Product,
                Warehouse,
            )
            .join(Product, InventoryBalance.product_id == Product.id)
            .join(Warehouse, InventoryBalance.warehouse_id == Warehouse.id)
            .where(InventoryBalance.tenant_id == tenant_id)
            .order_by(Product.item_class.asc(), Product.sku.asc())
            .limit(limit)
        )
        rows = result.all()
        return [
            {
                "balance": row[0],
                "product": row[1],
                "warehouse": row[2],
            }
            for row in rows
        ]

    # =========================================================================
    # KARDEX MOVEMENTS
    # =========================================================================

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
        area: str | None = None,
        validated_by: str | None = None,
        notes: str | None = None,
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
            area=area,
            validated_by=validated_by,
            notes=notes,
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

    async def list_all_movements(
        self,
        tenant_id: str,
        product_id: str | None = None,
        warehouse_id: str | None = None,
        movement_type: str | None = None,
        area: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        limit: int = 500,
    ) -> list[KardexMovement]:
        filters = [KardexMovement.tenant_id == tenant_id]
        if product_id:
            filters.append(KardexMovement.product_id == product_id)
        if warehouse_id:
            filters.append(KardexMovement.warehouse_id == warehouse_id)
        if movement_type:
            filters.append(KardexMovement.movement_type == movement_type)
        if area:
            filters.append(KardexMovement.area == area)
        if date_from:
            try:
                filters.append(KardexMovement.created_at >= datetime.fromisoformat(date_from))
            except ValueError:
                pass
        if date_to:
            try:
                filters.append(KardexMovement.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))
            except ValueError:
                pass
        result = await self.session.execute(
            select(KardexMovement)
            .where(*filters)
            .order_by(KardexMovement.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
