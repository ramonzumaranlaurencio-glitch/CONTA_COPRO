"""
Modelo de catálogo maestro de artículos de almacén.
Multi-empresa · Multi-rubro · Alineado PCGE Perú + NIC 2.
"""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class CatalogBase(DeclarativeBase):
    pass


class CatalogItem(CatalogBase):
    """
    Catálogo maestro de artículos de almacén.
    Cada ítem tiene una cuenta PCGE de inventario (al comprar)
    y una cuenta PCGE de gasto (al consumir).
    """
    __tablename__ = "catalog_items"
    __table_args__ = (UniqueConstraint("code", name="uq_catalog_item_code"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # ── Código único CTA-NAT-RUB-SEQQ-TK ──────────────────────
    code: Mapped[str] = mapped_column(String(30), nullable=False)

    # ── Identificación ─────────────────────────────────────────
    name: Mapped[str] = mapped_column(Text, nullable=False)
    aliases: Mapped[str | None] = mapped_column(Text)        # JSON array como texto
    ai_keywords: Mapped[str | None] = mapped_column(Text)   # JSON array como texto
    description: Mapped[str | None] = mapped_column(Text)

    # ── Clasificación PCGE ────────────────────────────────────
    # Cuenta inventario (Dr al comprar, Cr al consumir)
    cta: Mapped[str] = mapped_column(String(10), nullable=False)
    cta_name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Cuenta gasto (Dr al consumir)
    gasto: Mapped[str] = mapped_column(String(10), nullable=False)
    gasto_name: Mapped[str] = mapped_column(String(120), nullable=False)

    # ── Naturaleza y rubro ────────────────────────────────────
    nat: Mapped[str] = mapped_column(String(4),  nullable=False)   # SU, MP, ME, HE…
    nat_name: Mapped[str] = mapped_column(String(60), nullable=False)
    rub: Mapped[str] = mapped_column(String(4),  nullable=False)   # GE, MI, CO, FA…
    rubros: Mapped[str] = mapped_column(Text, nullable=False)       # JSON: ["GE","MI","CO"]
    class_name: Mapped[str] = mapped_column(String(60), nullable=False)

    # ── Token tipo ────────────────────────────────────────────
    # P=Permanente T=Temporal F=Fungible
    tk: Mapped[str] = mapped_column(String(1), nullable=False, default='F')

    # ── Unidad de medida ─────────────────────────────────────
    unit: Mapped[str] = mapped_column(String(10), nullable=False, default='UND')

    # ── Control ──────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RubroConfig(CatalogBase):
    """
    Configuración de rubros por empresa/tenant.
    Al seleccionar su rubro, la empresa carga el subconjunto de catálogo correspondiente.
    """
    __tablename__ = "rubro_configs"
    __table_args__ = (UniqueConstraint("tenant_id", "rubro_code", name="uq_rubro_tenant"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id: Mapped[str] = mapped_column(UUID(as_uuid=True), nullable=False)
    rubro_code: Mapped[str] = mapped_column(String(4), nullable=False)   # GE, MI, CO…
    rubro_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)       # Rubro principal
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
