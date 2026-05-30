from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class InventoryBase(DeclarativeBase):
    pass


class Product(InventoryBase):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("tenant_id", "sku", name="uq_product_tenant_sku"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    sku: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(20), nullable=False, default="NIU")
    default_cost: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    default_sales_account: Mapped[str | None] = mapped_column(String(20))
    default_cost_account: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # === CLASIFICACIÓN Y CODIFICACIÓN DE ALMACÉN ===
    # Clase: MATERIA_PRIMA | MERCADERIA | HERRAMIENTAS | INSUMOS | CONSUMIBLE | ACTIVO_FIJO
    item_class: Mapped[str] = mapped_column(String(30), nullable=False, default="MERCADERIA")
    # Tipo de código: PERMANENTE (no cambia) | TEMPORAL (puede reasignarse)
    token_type: Mapped[str] = mapped_column(String(20), nullable=False, default="PERMANENTE")
    # Código interno generado: [CLASE]-[AREA]-[SEQ] ej. MP-ALM-0001
    token_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Área de almacén: ALMACEN | PRODUCCION | OBRA | ADMINISTRACION | MANTENIMIENTO
    area: Mapped[str] = mapped_column(String(50), nullable=False, default="ALMACEN")
    # Ubicación física dentro del área (ej. "Estante A, Pasillo 3, Nivel 2")
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Niveles de stock
    min_stock: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    max_stock: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    # Datos adicionales del artículo
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    specs: Mapped[str | None] = mapped_column(Text, nullable=True)
    detail_description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Warehouse(InventoryBase):
    __tablename__ = "warehouses"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_warehouse_tenant_code"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    # Tipo de almacén: GENERAL | PRODUCCION | OBRA | TRANSITO | DEVOLUCION
    warehouse_type: Mapped[str] = mapped_column(String(30), nullable=False, default="GENERAL")
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    capacity: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)


class KardexMovement(InventoryBase):
    __tablename__ = "kardex_movements"
    __table_args__ = (UniqueConstraint("tenant_id", "movement_reference", name="uq_kardex_movement_ref"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    product_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False)
    # ENTRY | EXIT | TRANSFER | ADJUST
    movement_type: Mapped[str] = mapped_column(String(10), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    balance_qty: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    balance_avg_cost: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    movement_reference: Mapped[str] = mapped_column(String(120), nullable=False)
    source_document: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    # Área desde donde se originó el movimiento
    area: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Usuario que validó (solo para movimientos de compra validados)
    validated_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Descripción del motivo del movimiento
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class InventoryBalance(InventoryBase):
    __tablename__ = "inventory_balances"
    __table_args__ = (UniqueConstraint("tenant_id", "product_id", "warehouse_id", name="uq_inventory_balance"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    product_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False)
    balance_qty: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    balance_avg_cost: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
