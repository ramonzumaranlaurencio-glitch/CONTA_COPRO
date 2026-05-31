from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from src.api.dependencies import get_current_context
from src.api.routes.ledger import build_hash_service, build_uow_factory
from src.application.services.inventory_service import InventoryService
from src.application.services.ledger_posting_service import LedgerPostingService
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.repositories.inventory_repository import InventoryRepository
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# Prefijos por clase de artículo
CLASS_CODES: dict[str, str] = {
    "MATERIA_PRIMA": "MP",
    "MERCADERIA":    "ME",
    "HERRAMIENTAS":  "HE",
    "INSUMOS":       "IN",
    "CONSUMIBLE":    "CO",
    "ACTIVO_FIJO":   "AF",
}

AREA_CODES: dict[str, str] = {
    "ALMACEN":       "ALM",
    "PRODUCCION":    "PRO",
    "OBRA":          "OBR",
    "ADMINISTRACION":"ADM",
    "MANTENIMIENTO": "MAN",
}


def _safe_user_uuid(user_id: str | None) -> str:
    if user_id:
        try:
            return str(UUID(user_id))
        except Exception:
            pass
    return "22222222-2222-2222-2222-222222222222"


def _product_to_dict(product) -> dict:
    return {
        "id": str(product.id),
        "sku": product.sku,
        "name": product.name,
        "unit_of_measure": product.unit_of_measure,
        "default_cost": str(product.default_cost),
        "default_sales_account": product.default_sales_account,
        "default_cost_account": product.default_cost_account,
        "is_active": product.is_active,
        "item_class": product.item_class,
        "token_type": product.token_type,
        "token_code": product.token_code,
        "area": product.area,
        "location": product.location,
        "min_stock": str(product.min_stock),
        "max_stock": str(product.max_stock),
        "brand": product.brand,
        "specs": product.specs,
        "detail_description": product.detail_description,
        "created_at": product.created_at.isoformat() if product.created_at else None,
    }


def _movement_to_dict(m) -> dict:
    return {
        "id": str(m.id),
        "product_id": str(m.product_id),
        "warehouse_id": str(m.warehouse_id),
        "movement_type": m.movement_type,
        "qty": str(m.qty),
        "unit_cost": str(m.unit_cost),
        "balance_qty": str(m.balance_qty),
        "balance_avg_cost": str(m.balance_avg_cost),
        "movement_reference": m.movement_reference,
        "source_document": m.source_document,
        "area": m.area,
        "validated_by": m.validated_by,
        "notes": m.notes,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


# =========================================================================
# PAYLOAD MODELS
# =========================================================================

class ProductCreatePayload(BaseModel):
    tenant_id: str
    sku: str
    name: str
    unit_of_measure: str = "NIU"
    default_cost: Decimal = Decimal("0")
    default_sales_account: str | None = None
    default_cost_account: str | None = None
    item_class: str = "MERCADERIA"
    token_type: str = "PERMANENTE"
    token_code: str | None = None
    area: str = "ALMACEN"
    location: str | None = None
    min_stock: Decimal = Decimal("0")
    max_stock: Decimal = Decimal("0")
    brand: str | None = None
    specs: str | None = None
    detail_description: str | None = None


class ProductUpdatePayload(BaseModel):
    name: str | None = None
    unit_of_measure: str | None = None
    default_cost: Decimal | None = None
    default_sales_account: str | None = None
    default_cost_account: str | None = None
    item_class: str | None = None
    token_type: str | None = None
    token_code: str | None = None
    area: str | None = None
    location: str | None = None
    min_stock: Decimal | None = None
    max_stock: Decimal | None = None
    brand: str | None = None
    specs: str | None = None
    detail_description: str | None = None
    is_active: bool | None = None


class WarehouseCreatePayload(BaseModel):
    tenant_id: str
    code: str
    name: str
    warehouse_type: str = "GENERAL"
    location: str | None = None


class MovementCreatePayload(BaseModel):
    tenant_id: str
    product_id: str
    warehouse_id: str
    movement_type: str = Field(description="ENTRY o EXIT")
    qty: Decimal
    unit_cost: Decimal | None = None
    movement_reference: str | None = None
    source_document: str | None = None
    area: str | None = None
    validated_by: str | None = None
    notes: str | None = None
    post_cost_entry: bool = True
    year: int | None = None
    month: int | None = None
    cogs_account: str = "6911"
    inventory_account: str = "2011"
    adjustment_account: str = "7599"
    cost_center: str = "INV-OPS"


class GenerateCodePayload(BaseModel):
    tenant_id: str
    item_class: str
    area: str
    token_type: str = "PERMANENTE"


class ValidatePurchasesPayload(BaseModel):
    tenant_id: str
    warehouse_id: str
    items: list[dict]
    year: int | None = None
    month: int | None = None
    post_cost_entry: bool = True
    cogs_account: str = "6911"
    inventory_account: str = "2011"
    adjustment_account: str = "7599"
    cost_center: str = "INV-OPS"


# =========================================================================
# PRODUCTS ENDPOINTS
# =========================================================================

@router.post("/products")
async def create_product(payload: ProductCreatePayload, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = InventoryRepository(uow.session)

        # Auto-generar token_code si no fue provisto
        token_code = payload.token_code
        if not token_code:
            prefix_cls = CLASS_CODES.get(payload.item_class, "XX")
            prefix_area = AREA_CODES.get(payload.area, "GEN")
            seq = await repo.count_products_by_class_area(payload.tenant_id, payload.item_class, payload.area) + 1
            suffix = "-T" if payload.token_type == "TEMPORAL" else ""
            token_code = f"{prefix_cls}-{prefix_area}-{seq:04d}{suffix}"

        product = await repo.create_product(
            tenant_id=payload.tenant_id,
            sku=payload.sku,
            name=payload.name,
            unit_of_measure=payload.unit_of_measure,
            default_cost=payload.default_cost,
            default_sales_account=payload.default_sales_account,
            default_cost_account=payload.default_cost_account,
            item_class=payload.item_class,
            token_type=payload.token_type,
            token_code=token_code,
            area=payload.area,
            location=payload.location,
            min_stock=payload.min_stock,
            max_stock=payload.max_stock,
            brand=payload.brand,
            specs=payload.specs,
            detail_description=payload.detail_description,
        )
        await uow.commit()
        return _product_to_dict(product)


@router.get("/products")
async def list_products(
    limit: int = 500,
    item_class: str | None = None,
    area: str | None = None,
    token_type: str | None = None,
    active_only: bool = True,
    ctx=Depends(get_current_context),
):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        repo = InventoryRepository(uow.session)
        rows = await repo.list_products_filtered(
            tenant_id=ctx["tenant_id"],
            limit=limit,
            item_class=item_class,
            area=area,
            token_type=token_type,
            active_only=active_only,
        )
        return [_product_to_dict(r) for r in rows]


@router.put("/products/{product_id}")
async def update_product(product_id: str, payload: ProductUpdatePayload, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        repo = InventoryRepository(uow.session)
        fields = {k: v for k, v in payload.model_dump().items() if v is not None}
        try:
            product = await repo.update_product(ctx["tenant_id"], product_id, **fields)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        await uow.commit()
        return _product_to_dict(product)


@router.patch("/products/{product_id}/toggle-active")
async def toggle_product_active(product_id: str, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        repo = InventoryRepository(uow.session)
        try:
            product = await repo.toggle_active_product(ctx["tenant_id"], product_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        await uow.commit()
        return {"id": str(product.id), "is_active": product.is_active, "name": product.name}


@router.post("/generate-code")
async def generate_item_code(payload: GenerateCodePayload, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        repo = InventoryRepository(uow.session)
        prefix_cls = CLASS_CODES.get(payload.item_class, "XX")
        prefix_area = AREA_CODES.get(payload.area, "GEN")
        seq = await repo.count_products_by_class_area(payload.tenant_id, payload.item_class, payload.area) + 1
        suffix = "-T" if payload.token_type == "TEMPORAL" else ""
        code = f"{prefix_cls}-{prefix_area}-{seq:04d}{suffix}"
        return {"token_code": code, "sequence": seq}


# =========================================================================
# WAREHOUSES ENDPOINTS
# =========================================================================

@router.post("/warehouses")
async def create_warehouse(payload: WarehouseCreatePayload, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = InventoryRepository(uow.session)
        warehouse = await repo.create_warehouse(
            payload.tenant_id, payload.code, payload.name,
            warehouse_type=payload.warehouse_type, location=payload.location,
        )
        await uow.commit()
        return {
            "id": str(warehouse.id),
            "code": warehouse.code,
            "name": warehouse.name,
            "warehouse_type": warehouse.warehouse_type,
            "location": warehouse.location,
        }


@router.get("/warehouses")
async def list_warehouses(limit: int = 100, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        rows = await InventoryRepository(uow.session).list_warehouses(ctx["tenant_id"], limit=limit)
        return [
            {
                "id": str(row.id),
                "code": row.code,
                "name": row.name,
                "warehouse_type": getattr(row, "warehouse_type", "GENERAL"),
                "location": getattr(row, "location", None),
            }
            for row in rows
        ]


# =========================================================================
# BALANCES ENDPOINT
# =========================================================================

@router.get("/balances")
async def list_balances(ctx=Depends(get_current_context)):
    """
    Retorna todos los saldos actuales de inventario con información del producto y almacén.
    Usado por la vista principal del almacén.
    """
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        repo = InventoryRepository(uow.session)
        rows = await repo.list_balances_with_product(ctx["tenant_id"])
        result = []
        for row in rows:
            b = row["balance"]
            p = row["product"]
            w = row["warehouse"]
            balance_qty = float(b.balance_qty)
            avg_cost = float(b.balance_avg_cost)
            result.append({
                "balance_id": str(b.id),
                "id": str(p.id),
                "product_id": str(p.id),
                "warehouse_id": str(w.id),
                "warehouse_code": w.code,
                "warehouse_name": w.name,
                "sku": p.sku,
                "token_code": p.token_code,
                "name": p.name,
                "item_class": p.item_class,
                "token_type": p.token_type,
                "area": p.area,
                "unit_of_measure": p.unit_of_measure,
                "default_cost": str(p.default_cost),
                "min_stock": str(p.min_stock),
                "max_stock": str(p.max_stock),
                "brand": p.brand,
                "specs": p.specs,
                "location": p.location,
                "is_active": p.is_active,
                "balance_qty": balance_qty,
                "balance_avg_cost": avg_cost,
                "balance_value": round(balance_qty * avg_cost, 2),
                "updated_at": b.updated_at.isoformat() if b.updated_at else None,
            })
        return result


# =========================================================================
# MOVEMENTS ENDPOINTS
# =========================================================================

@router.post("/movements")
async def register_movement(payload: MovementCreatePayload, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        service = InventoryService(InventoryRepository(uow.session))
        try:
            result = await service.register_movement(
                tenant_id=payload.tenant_id,
                product_id=payload.product_id,
                warehouse_id=payload.warehouse_id,
                movement_type=payload.movement_type,
                qty=payload.qty,
                unit_cost=payload.unit_cost,
                movement_reference=payload.movement_reference,
                source_document=payload.source_document,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        await uow.commit()

    response = {**result.__dict__}
    if payload.post_cost_entry:
        movement_type = payload.movement_type.upper()
        effective_qty = Decimal(str(result.qty))
        effective_cost = Decimal(str(result.unit_cost))
        total_cost = (effective_qty * effective_cost).quantize(Decimal("0.01"))
        current_date = date.today()
        if movement_type == "EXIT":
            description = f"Costo de ventas por salida inventario {payload.movement_reference or result.movement_id}"
            lines = [
                {"account_code": payload.cogs_account, "account_name": "Costo de ventas", "debit": total_cost, "credit": Decimal("0.00"), "cost_center": payload.cost_center, "document_number": payload.source_document},
                {"account_code": payload.inventory_account, "account_name": "Inventarios", "debit": Decimal("0.00"), "credit": total_cost, "document_number": payload.source_document},
            ]
        elif movement_type == "ENTRY":
            description = f"Ingreso inventario {payload.movement_reference or result.movement_id}"
            lines = [
                {"account_code": payload.inventory_account, "account_name": "Inventarios", "debit": total_cost, "credit": Decimal("0.00"), "document_number": payload.source_document},
                {"account_code": payload.adjustment_account, "account_name": "Ajuste positivo de inventario", "debit": Decimal("0.00"), "credit": total_cost, "document_number": payload.source_document},
            ]
        else:
            raise HTTPException(status_code=422, detail="movement_type debe ser ENTRY o EXIT")

        posting_payload = {
            "tenant_id": payload.tenant_id,
            "year": payload.year or current_date.year,
            "month": payload.month or current_date.month,
            "entry_date": current_date,
            "description": description,
            "source_module": "INVENTORY",
            "source_id": result.movement_id,
            "currency": "PEN",
            "user_id": _safe_user_uuid(ctx.get("user_id")),
            "trace_id": ctx["trace_id"],
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "lines": lines,
        }
        entry = await LedgerPostingService(build_uow_factory(), build_hash_service()).post_journal(posting_payload)
        response["cost_entry"] = {
            "entry_id": str(entry.id),
            "row_hash": entry.row_hash,
            "amount": str(total_cost),
            "movement_type": movement_type,
            "cogs_account": payload.cogs_account,
            "inventory_account": payload.inventory_account,
        }
    return response


@router.get("/movements")
async def list_movements(
    product_id: str | None = None,
    warehouse_id: str | None = None,
    movement_type: str | None = None,
    area: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 500,
    ctx=Depends(get_current_context),
):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        repo = InventoryRepository(uow.session)
        rows = await repo.list_all_movements(
            tenant_id=ctx["tenant_id"],
            product_id=product_id,
            warehouse_id=warehouse_id,
            movement_type=movement_type,
            area=area,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
        return [_movement_to_dict(r) for r in rows]


@router.get("/kardex/{product_id}")
async def get_kardex(product_id: str, warehouse_id: str | None = None, limit: int = 500, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        rows = await InventoryRepository(uow.session).list_kardex(
            tenant_id=ctx["tenant_id"],
            product_id=product_id,
            warehouse_id=warehouse_id,
            limit=limit,
        )
        return [_movement_to_dict(r) for r in rows]


# =========================================================================
# EXIT REASONS — SALIDAS CON MOTIVO + ASIENTO CONTABLE AUTOMÁTICO
# =========================================================================

# Motivos de salida → cuenta débito y nombre del asiento
EXIT_REASON_CONFIG: dict[str, dict] = {
    # Consumo operativo / producción
    "CONSUMO":          {"debit_account": "6569", "debit_name": "Suministros consumidos en operación",      "label": "Consumo / Uso operativo"},
    "PRODUCCION":       {"debit_account": "9110", "debit_name": "Costo de producción - materiales",          "label": "Uso en producción"},
    "VENTA":            {"debit_account": "6912", "debit_name": "Costo de ventas",                           "label": "Salida por venta"},
    # Bajas
    "BAJA_DESGASTE":    {"debit_account": "65491","debit_name": "Baja por desgaste / deterioro",             "label": "Baja por desgaste"},
    "BAJA_ANTIGUEDAD":  {"debit_account": "65491","debit_name": "Baja por obsolescencia / antigüedad",       "label": "Baja por antigüedad"},
    "BAJA_VENCIMIENTO": {"debit_account": "65491","debit_name": "Baja por vencimiento / caducidad",          "label": "Baja por vencimiento"},
    "BAJA_PERDIDA":     {"debit_account": "65921","debit_name": "Pérdida extraordinaria - extravío",         "label": "Baja por pérdida/extravío"},
    "BAJA_ROBO":        {"debit_account": "65921","debit_name": "Pérdida extraordinaria - robo/sustracción", "label": "Baja por robo"},
    "BAJA_SINIESTRO":   {"debit_account": "65921","debit_name": "Pérdida por siniestro / desastre",          "label": "Baja por siniestro"},
    # Otros
    "DEVOLUCION":       {"debit_account": "4212", "debit_name": "Devolución a proveedor",                    "label": "Devolución a proveedor"},
    "TRANSFERENCIA":    {"debit_account": "2011", "debit_name": "Transferencia entre almacenes",              "label": "Transferencia entre almacenes"},
    "AJUSTE":           {"debit_account": "65491","debit_name": "Ajuste de inventario - diferencia",          "label": "Ajuste de inventario"},
    "OTRO":             {"debit_account": "65491","debit_name": "Baja / salida - otros conceptos",            "label": "Otro motivo"},
}


class ExitPayload(BaseModel):
    tenant_id: str
    product_id: str
    warehouse_id: str
    qty: Decimal
    exit_reason: str = "CONSUMO"        # Ver EXIT_REASON_CONFIG
    notes: str = ""
    movement_reference: str | None = None
    source_document: str | None = None
    area: str = "ALMACEN"
    validated_by: str | None = None
    post_journal: bool = True
    year: int | None = None
    month: int | None = None
    cost_center: str = "LOG-ALM"


@router.post("/exit")
async def register_exit(payload: ExitPayload, request: Request, ctx=Depends(get_current_context)):
    """
    Registra una SALIDA de inventario con motivo contable.
    Genera asiento automático según el motivo: desgaste, antigüedad,
    pérdida, consumo, venta, devolución, etc.
    El crédito siempre va a la cuenta de inventario del producto.
    """
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    reason_cfg = EXIT_REASON_CONFIG.get(payload.exit_reason.upper(), EXIT_REASON_CONFIG["OTRO"])
    label = reason_cfg["label"]

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = InventoryRepository(uow.session)

        product = await repo.get_product_by_id(payload.tenant_id, payload.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        # Obtener costo promedio actual del kardex
        from src.infrastructure.repositories.inventory_repository import InventoryRepository as IR
        from sqlalchemy import select, func
        from src.domain.models.inventory import KardexMovement

        bal_result = await uow.session.execute(
            select(KardexMovement.balance_avg_cost)
            .where(
                KardexMovement.tenant_id == payload.tenant_id,
                KardexMovement.product_id == payload.product_id,
                KardexMovement.warehouse_id == payload.warehouse_id,
            )
            .order_by(KardexMovement.created_at.desc())
            .limit(1)
        )
        last_row = bal_result.scalar_one_or_none()
        unit_cost = Decimal(str(last_row)) if last_row else (product.default_cost or Decimal("0"))
        total_cost = (payload.qty * unit_cost).quantize(Decimal("0.01"))

        # Cuenta de inventario del producto (crédito al sacar del almacén)
        inventory_account = product.default_cost_account or "252"

        # Registrar movimiento kardex
        service = InventoryService(repo)
        ref = payload.movement_reference or f"SAL-{payload.exit_reason[:3]}-{payload.product_id[:8]}"
        try:
            result = await service.register_movement(
                tenant_id=payload.tenant_id,
                product_id=payload.product_id,
                warehouse_id=payload.warehouse_id,
                movement_type="EXIT",
                qty=payload.qty,
                unit_cost=unit_cost,
                movement_reference=ref,
                source_document=payload.source_document,
                area=payload.area,
                validated_by=payload.validated_by or ctx.get("user_id"),
                notes=f"[{payload.exit_reason}] {label}. {payload.notes}".strip(". "),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        await uow.commit()

        journal_entry_id = None
        if payload.post_journal and total_cost > 0:
            from datetime import date
            from src.api.routes.ledger import build_hash_service, build_uow_factory
            from src.application.services.ledger_posting_service import LedgerPostingService
            import uuid as _uuid

            entry_date = date.today()
            year  = payload.year  or entry_date.year
            month = payload.month or entry_date.month

            posting_service = LedgerPostingService(
                uow_factory=build_uow_factory(),
                hash_service=build_hash_service(),
            )
            try:
                entry = await posting_service.post_journal({
                    "tenant_id":     payload.tenant_id,
                    "year":          year,
                    "month":         month,
                    "entry_date":    entry_date.isoformat(),
                    "description":   f"Salida inventario [{payload.exit_reason}] {product.name} - {label}",
                    "source_module": "INVENTORY_EXIT",
                    "source_id":     ref,
                    "currency":      "PEN",
                    "trace_id":      str(_uuid.uuid4()),
                    "lines": [
                        {
                            "account_code": reason_cfg["debit_account"],
                            "account_name":  reason_cfg["debit_name"],
                            "debit":         total_cost,
                            "credit":        Decimal("0.00"),
                            "cost_center":   payload.cost_center,
                        },
                        {
                            "account_code": inventory_account,
                            "account_name":  f"Inventario - {product.name}",
                            "debit":         Decimal("0.00"),
                            "credit":        total_cost,
                            "cost_center":   "-",
                        },
                    ],
                })
                journal_entry_id = str(entry.id)
            except Exception as exc:
                journal_entry_id = f"ERROR: {exc}"

        return {
            "ok":              True,
            "movement_id":     str(result.movement_id),
            "product_id":      payload.product_id,
            "product_name":    product.name,
            "token_code":      product.token_code,
            "exit_reason":     payload.exit_reason,
            "exit_label":      label,
            "qty":             str(payload.qty),
            "unit_cost":       str(unit_cost),
            "total_cost":      str(total_cost),
            "debit_account":   reason_cfg["debit_account"],
            "credit_account":  inventory_account,
            "journal_entry_id": journal_entry_id,
            "new_balance_qty": str(result.balance_qty),
            "new_balance_avg": str(result.balance_avg_cost),
            "new_balance_val": str((Decimal(result.balance_qty) * Decimal(result.balance_avg_cost)).quantize(Decimal("0.01"))),
        }


@router.get("/exit-reasons")
async def list_exit_reasons():
    """Retorna todos los motivos de salida disponibles."""
    return [
        {"code": code, "label": cfg["label"], "debit_account": cfg["debit_account"], "debit_name": cfg["debit_name"]}
        for code, cfg in EXIT_REASON_CONFIG.items()
    ]


# =========================================================================
# DIAGNÓSTICO — qué hay en los JournalEntries de compras
# =========================================================================

@router.get("/debug-pending")
async def debug_pending(ctx=Depends(get_current_context)):
    """Diagnóstico: muestra qué JournalEntries de compras existen y sus items."""
    from sqlalchemy import select
    from src.domain.models.accounting import JournalEntry, FinancialDocument

    PURCHASE_MODULES = ["PURCHASING", "GUIA_REMISION", "COMPRAS", "PURCHASES"]
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        q = (
            select(JournalEntry, FinancialDocument)
            .outerjoin(
                FinancialDocument,
                (FinancialDocument.journal_entry_id == JournalEntry.id) &
                (FinancialDocument.tenant_id == ctx["tenant_id"]),
            )
            .where(
                JournalEntry.tenant_id == ctx["tenant_id"],
                JournalEntry.source_module.in_(PURCHASE_MODULES),
            )
            .order_by(JournalEntry.entry_date.desc())
            .limit(20)
        )
        rows = list((await uow.session.execute(q)).all())
        result = []
        for entry, fin_doc in rows:
            meta = (fin_doc.metadata_json or {}) if fin_doc else {}
            raw_items = meta.get("line_items") or meta.get("items") or []
            result.append({
                "journal_entry_id": str(entry.id),
                "source_module":    entry.source_module,
                "entry_date":       str(entry.entry_date),
                "has_fin_doc":      fin_doc is not None,
                "fin_doc_id":       str(fin_doc.id) if fin_doc else None,
                "meta_keys":        list(meta.keys()),
                "items_count":      len(raw_items),
                "items_preview":    [
                    {
                        "description":  i.get("description","")[:40],
                        "account_code": i.get("account_code",""),
                        "line_type":    i.get("line_type",""),
                        "is_inventory": i.get("is_inventory","N/A"),
                        "line_subtotal":i.get("line_subtotal",""),
                    }
                    for i in raw_items[:5]
                ],
            })
        return {"tenant_id": ctx["tenant_id"], "purchase_entries": result}


# =========================================================================
# LIMPIEZA DE DATOS DE PRUEBA (solo para desarrollo)
# =========================================================================

@router.delete("/reset-test-data")
async def reset_test_data(ctx=Depends(get_current_context)):
    """
    Elimina movimientos y saldos de inventario del tenant.
    Los productos NO se tocan. Solo para desarrollo.
    """
    from sqlalchemy import delete
    from src.domain.models.inventory import KardexMovement, InventoryBalance

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        deleted_mov = await uow.session.execute(
            delete(KardexMovement).where(KardexMovement.tenant_id == ctx["tenant_id"])
        )
        deleted_bal = await uow.session.execute(
            delete(InventoryBalance).where(InventoryBalance.tenant_id == ctx["tenant_id"])
        )
        await uow.commit()
        return {
            "ok": True,
            "deleted_movements": deleted_mov.rowcount,
            "deleted_balances": deleted_bal.rowcount,
            "deleted_products": 0,
            "message": "Movimientos y saldos eliminados. Productos conservados.",
        }


@router.delete("/reset-products")
async def reset_products(ctx=Depends(get_current_context)):
    """
    Elimina todos los productos del tenant.
    Requiere que no haya movimientos (ejecutar reset-test-data primero).
    Solo para desarrollo.
    """
    from sqlalchemy import delete
    from src.domain.models.inventory import KardexMovement, InventoryBalance, Product

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        # Primero limpiar movimientos y saldos (FK constraint)
        await uow.session.execute(
            delete(KardexMovement).where(KardexMovement.tenant_id == ctx["tenant_id"])
        )
        await uow.session.execute(
            delete(InventoryBalance).where(InventoryBalance.tenant_id == ctx["tenant_id"])
        )
        deleted_prod = await uow.session.execute(
            delete(Product).where(Product.tenant_id == ctx["tenant_id"])
        )
        await uow.commit()
        return {
            "ok": True,
            "deleted_products": deleted_prod.rowcount,
            "message": "Productos y sus movimientos eliminados.",
        }


# =========================================================================
# REPORTE POR CUENTA PCGE — ROTACIÓN Y VALOR
# =========================================================================

@router.get("/report/by-account")
async def report_by_account(ctx=Depends(get_current_context)):
    """
    Reporte de inventario agrupado por cuenta PCGE.
    Muestra: valor total, qty, entradas, salidas, rotación, costo promedio.
    Permite ver exactamente cuánto hay en 252, 201, 241, etc.
    """
    from sqlalchemy import select, func
    from src.domain.models.inventory import Product, KardexMovement, InventoryBalance, Warehouse

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        # Traer todos los productos activos con sus saldos
        bal_q = (
            select(
                Product.default_cost_account.label("account_code"),
                Product.token_code,
                Product.sku,
                Product.name,
                Product.item_class,
                Product.unit_of_measure,
                Product.id.label("product_id"),
                InventoryBalance.balance_qty,
                InventoryBalance.balance_avg_cost,
                Warehouse.code.label("warehouse_code"),
                Warehouse.name.label("warehouse_name"),
            )
            .join(InventoryBalance, InventoryBalance.product_id == Product.id, isouter=True)
            .join(Warehouse, Warehouse.id == InventoryBalance.warehouse_id, isouter=True)
            .where(
                Product.tenant_id == ctx["tenant_id"],
                Product.is_active.is_(True),
            )
            .order_by(Product.default_cost_account, Product.sku)
        )
        rows = list((await uow.session.execute(bal_q)).all())

        # Totales de movimientos por producto (entradas y salidas)
        mov_q = (
            select(
                KardexMovement.product_id,
                KardexMovement.movement_type,
                func.sum(KardexMovement.qty).label("total_qty"),
                func.count(KardexMovement.id).label("count"),
            )
            .where(KardexMovement.tenant_id == ctx["tenant_id"])
            .group_by(KardexMovement.product_id, KardexMovement.movement_type)
        )
        mov_rows = list((await uow.session.execute(mov_q)).all())
        entries_by_product: dict[str, float] = {}
        exits_by_product:   dict[str, float] = {}
        for m in mov_rows:
            pid = str(m.product_id)
            if m.movement_type == "ENTRY":
                entries_by_product[pid] = float(m.total_qty or 0)
            elif m.movement_type == "EXIT":
                exits_by_product[pid]   = float(m.total_qty or 0)

        # Agrupar por cuenta
        accounts: dict[str, dict] = {}
        for r in rows:
            cta = str(r.account_code or "SIN_CUENTA")
            if cta not in accounts:
                accounts[cta] = {
                    "account_code":      cta,
                    "account_name":      _pcge_account_name(cta),
                    "products_count":    0,
                    "total_qty":         0.0,
                    "total_value":       0.0,
                    "total_entries_qty": 0.0,
                    "total_exits_qty":   0.0,
                    "items":             [],
                }
            acc = accounts[cta]
            pid = str(r.product_id)
            qty      = float(r.balance_qty or 0)
            avg_cost = float(r.balance_avg_cost or 0)
            value    = round(qty * avg_cost, 2)
            entries  = entries_by_product.get(pid, 0)
            exits    = exits_by_product.get(pid, 0)
            rotation = round(exits / entries * 100, 1) if entries > 0 else 0.0

            acc["products_count"]    += 1
            acc["total_qty"]         += qty
            acc["total_value"]       = round(acc["total_value"] + value, 2)
            acc["total_entries_qty"] += entries
            acc["total_exits_qty"]   += exits
            acc["items"].append({
                "product_id":    pid,
                "token_code":    r.token_code or r.sku,
                "sku":           r.sku,
                "name":          r.name,
                "item_class":    r.item_class,
                "unit":          r.unit_of_measure,
                "warehouse":     r.warehouse_code or "-",
                "balance_qty":   round(qty, 4),
                "avg_cost":      round(avg_cost, 4),
                "balance_value": value,
                "entries_qty":   entries,
                "exits_qty":     exits,
                "rotation_pct":  rotation,
                "stock_status":  "OK" if qty > 0 else ("AGOTADO" if entries > 0 else "NUEVO"),
            })

        # Calcular rotación por cuenta y ordenar por valor desc
        result = []
        for cta, acc in sorted(accounts.items(), key=lambda x: x[1]["total_value"], reverse=True):
            ent = acc["total_entries_qty"]
            ext = acc["total_exits_qty"]
            acc["rotation_pct"] = round(ext / ent * 100, 1) if ent > 0 else 0.0
            result.append(acc)

        grand_total = sum(a["total_value"] for a in result)
        return {
            "grand_total_value": round(grand_total, 2),
            "accounts_count":    len(result),
            "by_account":        result,
        }


def _pcge_account_name(code: str) -> str:
    _MAP = {
        "201":"Mercaderías manufact.", "202":"Mercaderías no manufact.",
        "211":"Productos terminados",  "231":"Productos en proceso",
        "241":"Mat. primas manufact.", "242":"Mat. primas no manufact.",
        "251":"Materiales auxiliares", "252":"Suministros",
        "253":"Repuestos",             "261":"Envases", "262":"Embalajes",
        "333":"Maquinaria y equipo",   "334":"Unidades de transporte",
        "335":"Muebles y enseres",     "336":"Equipos diversos",
        "337":"Herramientas y utensilios",
        "2011":"Mercaderías manufact.","2012":"Mercaderías no manufact.",
        "2411":"Mat. primas manufact.","2412":"Mat. primas no manufact.",
        "2522":"Suministros",          "2523":"Repuestos",
        "3336":"Equipos diversos",     "3337":"Herramientas",
    }
    c = str(code or "")
    return _MAP.get(c, _MAP.get(c[:3], f"Cuenta {c}"))


# =========================================================================
# PENDING PURCHASES — facturas y guías pendientes de ingreso al almacén
# =========================================================================

def _infer_item_class(item: dict) -> str:
    # La IA ya puede venir con item_class resuelto
    ai_class = str(item.get("item_class") or "").upper()
    if ai_class in {"MERCADERIA", "MATERIA_PRIMA", "INSUMOS", "HERRAMIENTAS", "ACTIVO_FIJO", "CONSUMIBLE"}:
        return ai_class

    code = str(item.get("account_code") or "")
    desc = str(item.get("description") or "").lower()

    # Por cuenta PCGE
    if code.startswith("33") or code.startswith("34"):
        return "ACTIVO_FIJO"
    if code.startswith("2523") or code.startswith("253"):
        return "INSUMOS"
    if code.startswith("2522") or code.startswith("252") or code.startswith("2521") or code.startswith("251"):
        return "INSUMOS"
    if code.startswith("2411") or code.startswith("2412") or code.startswith("241") or code.startswith("242"):
        return "MATERIA_PRIMA"
    if code.startswith("20") or code.startswith("21") or code.startswith("22"):
        return "MERCADERIA"
    if code.startswith("60") or code.startswith("61"):
        return "MERCADERIA"

    # Por descripcion
    if any(k in desc for k in ["herramienta", "taladro", "amoladora", "soldadora", "compresor", "mezcladora", "andamio"]):
        return "HERRAMIENTAS"
    if any(k in desc for k in ["laptop", "computadora", "servidor", "equipo electronico", "impresora", "monitor"]):
        return "ACTIVO_FIJO"
    if any(k in desc for k in ["cemento", "arena", "piedra", "acero", "fierro", "ladrillo", "madera", "triplay", "hormigon"]):
        return "MATERIA_PRIMA"
    if any(k in desc for k in ["insumo", "combustible", "gasolina", "diesel", "lubricante", "aceite", "grasa",
                                 "epp", "guante", "casco", "chaleco", "lentes seguridad", "mascarilla",
                                 "papel bond", "toner", "utiles", "detergente", "jabon", "repuesto", "filtro"]):
        return "INSUMOS"
    return "MERCADERIA"


def _infer_area(cost_center: str) -> str:
    cc = str(cost_center or "").upper()
    if "ALM" in cc or "LOG" in cc:           return "ALMACEN"
    if "PRO" in cc or "OPS" in cc:           return "PRODUCCION"
    if "OBR" in cc:                          return "OBRA"
    if "MAN" in cc:                          return "MANTENIMIENTO"
    if "ADM" in cc or "TI" in cc:            return "ADMINISTRACION"
    return "ALMACEN"


@router.get("/pending-purchases")
async def get_pending_purchases(
    limit: int = 200,
    source_module: str | None = None,
    ctx=Depends(get_current_context),
):
    """
    Retorna ítems de facturas y guías de compra que aún no tienen
    movimiento de ingreso en el kardex.

    Conecta: JournalEntry (source_module PURCHASING/GUIA_REMISION)
    con KardexMovement (source_document) para detectar los pendientes.
    """
    from sqlalchemy import select, outerjoin
    from src.domain.models.accounting import JournalEntry, FinancialDocument
    from src.domain.models.inventory import KardexMovement

    PURCHASE_MODULES = ["PURCHASING", "GUIA_REMISION", "COMPRAS", "PURCHASES"]
    if source_module:
        PURCHASE_MODULES = [source_module.upper()]

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        # 1. Obtener asientos de compra junto con su FinancialDocument (donde viven los items)
        q = (
            select(JournalEntry, FinancialDocument)
            .outerjoin(
                FinancialDocument,
                (FinancialDocument.journal_entry_id == JournalEntry.id) &
                (FinancialDocument.tenant_id == ctx["tenant_id"]),
            )
            .where(
                JournalEntry.tenant_id == ctx["tenant_id"],
                JournalEntry.source_module.in_(PURCHASE_MODULES),
            )
            .order_by(JournalEntry.entry_date.desc())
            .limit(limit)
        )
        result = await uow.session.execute(q)
        rows = result.all()

        # 2. Obtener source_documents ya recibidos en kardex
        km_q = select(KardexMovement.source_document).where(
            KardexMovement.tenant_id == ctx["tenant_id"]
        )
        km_result = await uow.session.execute(km_q)
        received_docs: set[str] = {r[0] for r in km_result.all() if r[0]}

        # 3. Construir lista de ítems pendientes
        pending: list[dict] = []
        for entry, fin_doc in rows:
            # Los datos del comprobante viven en FinancialDocument
            meta: dict = (fin_doc.metadata_json or {}) if fin_doc else {}
            serie  = str(fin_doc.series  if fin_doc and fin_doc.series  else meta.get("serie")  or "")
            number = str(fin_doc.number  if fin_doc and fin_doc.number  else meta.get("number") or "")
            doc_ref = f"{serie}-{number}" if serie and number else (entry.source_id or str(entry.id))
            source_doc = str(entry.source_id or doc_ref)

            # Si el documento entero ya fue recibido (compatibilidad con movimientos sin índice), omitir
            if source_doc in received_docs or doc_ref in received_docs:
                continue

            supplier_name = str(meta.get("supplier_name") or "")
            supplier_ruc  = str(meta.get("supplier_ruc") or "")
            issue_date    = str(fin_doc.issue_date if fin_doc and fin_doc.issue_date else meta.get("issue_date") or str(entry.entry_date))
            doc_type      = str(fin_doc.document_type if fin_doc and fin_doc.document_type else meta.get("document_type") or "01")
            currency      = str(fin_doc.currency if fin_doc and fin_doc.currency else meta.get("currency") or "PEN")
            total_doc     = float(fin_doc.total_amount if fin_doc and fin_doc.total_amount else meta.get("total") or 0)

            # Los ítems se guardan bajo "line_items" en financial_documents.metadata_json
            raw_items: list[dict] = (
                meta.get("line_items")
                or meta.get("items")
                or (meta.get("audit_metadata") or {}).get("items")
                or []
            )

            for idx, item in enumerate(raw_items):
                # Referencia única por línea — permite validar ítem a ítem sin que
                # todo el documento desaparezca al validar solo la primera línea
                line_source_doc = f"{source_doc}-L{idx}"

                # Omitir si esta línea específica ya fue ingresada al kardex
                if line_source_doc in received_docs:
                    continue

                line_type_raw = item.get("line_type")  # None si la IA no clasificó
                line_type     = str(line_type_raw or "EXPENSE_OR_ASSET")
                acc_code_raw  = str(item.get("account_code") or item.get("product_code") or "")
                # Tomar solo el prefijo numérico (252-HE-... → "25")
                acc_prefix_raw = acc_code_raw.split("-")[0] if "-" in acc_code_raw else acc_code_raw
                acc_prefix     = acc_prefix_raw[:2] if len(acc_prefix_raw) >= 2 else ""

                # Detectar si es bien físico de inventario por cuenta PCGE:
                # 20-26 = existencias, 33-35 = activo fijo capitalizable
                _INVENTORY_PREFIXES = {"20","21","22","23","24","25","26","33","34","35"}
                is_inventory_by_account = acc_prefix in _INVENTORY_PREFIXES
                is_inventory_flag = bool(item.get("is_inventory", False))
                is_inv = is_inventory_flag or is_inventory_by_account or line_type == "INVENTORY_PURCHASE"

                # Excluir solo líneas explícitamente contables/no físicas
                if line_type in {"PAYABLE", "TAX", "ROUNDING", "PRIOR_BALANCE",
                                  "ADVANCE_PAYMENT", "LATE_FEE", "INFO_ONLY"}:
                    continue
                # Solo excluir como gasto puro si la IA lo clasificó explícitamente así
                # (line_type_raw is None = sin clasificar → el almacenero decide)
                if line_type == "EXPENSE_OR_ASSET" and not is_inv and line_type_raw is not None:
                    continue

                description = str(item.get("description") or "Sin descripción")
                code        = str(item.get("code") or "")
                unit        = str(item.get("unit") or "UND")
                qty         = float(item.get("quantity") or 1)
                unit_price  = float(item.get("unit_price") or item.get("line_subtotal") or 0)
                line_total  = float(item.get("line_subtotal") or item.get("total_line") or qty * unit_price)
                acc_code    = str(item.get("account_code") or "")
                acc_name    = str(item.get("account_name") or "")
                cost_center = str(item.get("cost_center") or meta.get("cost_center") or "LOG-ALM")
                ai_reason   = str(item.get("ai_reason") or "")

                # La estructura del almacén manda: usar item_class de la IA si viene, si no inferir
                inferred_class = str(item.get("item_class") or "") or _infer_item_class(item)
                inferred_area  = _infer_area(cost_center)

                pending.append({
                    "id":            f"{str(entry.id)}-{idx}",
                    "entry_id":      str(entry.id),
                    "purchase_ref":  str(entry.source_id or doc_ref),
                    "doc_type":      doc_type,
                    "doc_series":    serie,
                    "doc_number":    number,
                    "doc_date":      issue_date,
                    "source_doc":    line_source_doc,
                    "source_module": entry.source_module,
                    "supplier_name": supplier_name,
                    "supplier_ruc":  supplier_ruc,
                    "product_name":  description,
                    "sku":           code,
                    "token_code":    "",
                    "unit":          unit,
                    "qty":           qty,
                    "unit_cost":     unit_price,
                    "total":         line_total,
                    "currency":      currency,
                    "total_doc":     total_doc,
                    "account_code":  acc_code,
                    "account_name":  acc_name,
                    "cost_center":   cost_center,
                    "item_class":    inferred_class,
                    "area":          inferred_area,
                    "is_inventory":  is_inv,
                    "line_type":     line_type,
                    "catalog_code":  str(item.get("catalog_code") or ""),
                    "catalog_nat":   str(item.get("catalog_nat") or ""),
                    "catalog_rub":   str(item.get("catalog_rub") or "GE"),
                    "catalog_tk":    str(item.get("catalog_tk") or "F"),
                    "catalog_match": bool(item.get("catalog_match", False)),
                    "gasto_account": str(item.get("gasto_account") or ""),
                    "ai_reason":     ai_reason,
                    "ai_confidence": float(item.get("ai_confidence") or 0),
                })

        return pending


class ValidatePurchaseItemPayload(BaseModel):
    tenant_id: str
    company_id: str | None = None        # Multi-empresa: empresa específica
    warehouse_id: str
    entry_id: str
    source_doc: str
    source_module: str = "PURCHASING"    # Módulo origen: PURCHASING, COMPRAS, MANUAL, etc.
    product_id: str | None = None
    product_name: str
    sku: str = ""
    unit: str = "NIU"
    qty: float
    unit_cost: float
    item_class: str = "MERCADERIA"
    area: str = "ALMACEN"
    account_code: str = "2011"
    cost_center: str = "LOG-ALM"
    # Catálogo estructurado — vienen del lookup del catálogo de almacén
    catalog_code: str | None = None      # Ej: 252-EP-GE-0001-F
    catalog_nat: str | None = None       # Ej: EP
    catalog_rub: str | None = None       # Ej: GE
    catalog_tk: str | None = None        # P | T | F
    catalog_match: bool = False          # True = encontrado en catálogo
    gasto_account: str | None = None     # Cuenta de gasto (6xxx)
    post_journal: bool = True
    year: int | None = None
    month: int | None = None


@router.post("/validate-purchase-items")
async def validate_purchase_items(
    payload: ValidatePurchaseItemPayload,
    request: Request,
    ctx=Depends(get_current_context),
):
    """
    Valida un ítem de compra e ingresa al inventario (kardex) — multi-empresa.
    Busca el producto por catalog_code + company_id. Si no existe, lo crea
    con el código estructurado CTA-NAT-RUB-SEQQ-TK del catálogo del almacén.
    """
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    from decimal import Decimal as D
    from src.domain.item_catalog import (
        build_structured_code, infer_nat_from_description,
        infer_tk_from_description, item_class_from_nat,
    )
    qty  = D(str(payload.qty))
    cost = D(str(payload.unit_cost))

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = InventoryRepository(uow.session)

        # ── Buscar o crear producto (por empresa + catalog_code) ─────────────
        product_id = payload.product_id
        if not product_id:
            # 1. Intentar encontrar por catalog_code y company_id (multi-empresa)
            existing = None
            if payload.catalog_code:
                existing = await repo.find_product_by_token_code(
                    payload.tenant_id, payload.catalog_code, payload.company_id
                )
            if existing:
                product_id = str(existing.id)
            else:
                # 2. No existe → crear con código estructurado del catálogo
                # account_code es la subcuenta PCGE completa (ej: "2522")
                # cta es solo los primeros 3 dígitos para el token del almacén (ej: "252")
                cta   = (payload.account_code or "252")[:3]   # base para token almacén
                nat   = payload.catalog_nat or infer_nat_from_description(payload.product_name, cta)
                rub   = payload.catalog_rub or "GE"
                tk    = payload.catalog_tk  or infer_tk_from_description(payload.product_name, nat)
                item_cls = payload.item_class or item_class_from_nat(nat)

                if payload.catalog_code and "9999" not in payload.catalog_code:
                    # Código definitivo del catálogo — usarlo directamente
                    token_code = payload.catalog_code
                else:
                    # Código provisional → asignar secuencia real por empresa
                    seq = await repo.count_products_by_class_area(
                        payload.tenant_id, item_cls, payload.area,
                        company_id=payload.company_id,
                    ) + 1
                    token_code = build_structured_code(cta, nat, rub, seq, tk)

                token_type_map = {"P": "PERMANENTE", "T": "TEMPORAL", "F": "FUNGIBLE"}
                token_type = token_type_map.get(tk, "PERMANENTE")

                product = await repo.create_product(
                    tenant_id=payload.tenant_id,
                    company_id=payload.company_id,
                    sku=token_code,   # SKU = token_code con secuencia real — único por producto
                    name=payload.product_name,
                    unit_of_measure=payload.unit,
                    default_cost=cost,
                    default_sales_account="704101",
                    default_cost_account=payload.account_code or "2522",  # subcuenta PCGE completa
                    item_class=item_cls,
                    token_type=token_type,
                    token_code=token_code,
                    area=payload.area,
                )
                product_id = str(product.id)

        # Registrar movimiento
        service = InventoryService(repo)
        ref = f"ENT-VAL-{payload.source_doc}-{payload.entry_id[:8]}"
        try:
            result = await service.register_movement(
                tenant_id=payload.tenant_id,
                product_id=product_id,
                warehouse_id=payload.warehouse_id,
                movement_type="ENTRY",
                qty=qty,
                unit_cost=cost,
                movement_reference=ref,
                source_document=payload.source_doc,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        await uow.commit()

    response: dict = {**result.__dict__, "product_id": product_id}

    # Asiento contable — solo cuando NO viene de COMPRAS
    # Bajo NIC 2 Sistema Permanente: COMPRAS ya debitó la cuenta de inventario (252x/251x)
    # al registrar la factura. Validar en almacén es solo control físico (kardex).
    # Crear un asiento adicional aquí duplicaría la deuda con el proveedor (4212).
    _PURCHASING_MODULES = {"PURCHASING", "COMPRAS", "PURCHASES", "GUIA_REMISION"}
    _from_purchase = payload.source_module.upper() in _PURCHASING_MODULES

    if payload.post_journal and not _from_purchase:
        from sqlalchemy import select as _sel, func as _func
        from src.domain.models.accounting import JournalEntry as _JE
        total_cost = (qty * cost).quantize(D("0.01"))
        cur_date   = date.today()
        # source_id único por línea de compra → misma factura+línea = mismo asiento
        journal_source_id = f"INV-{payload.source_doc}"
        # Verificar si ya existe asiento para esta línea (idempotencia)
        async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as _uow:
            exists = (await _uow.session.execute(
                _sel(_func.count()).where(
                    _JE.tenant_id == payload.tenant_id,
                    _JE.source_module == "INVENTORY",
                    _JE.source_id == journal_source_id,
                )
            )).scalar()
        if not exists:
            posting = {
                "tenant_id": payload.tenant_id,
                "year":  payload.year  or cur_date.year,
                "month": payload.month or cur_date.month,
                "entry_date": cur_date,
                "description": f"Ingreso inventario desde compra {payload.source_doc}",
                "source_module": "INVENTORY",
                "source_id": journal_source_id,
                "currency": "PEN",
                "user_id": _safe_user_uuid(ctx.get("user_id")),
                "trace_id": ctx["trace_id"],
                "ip_address": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
                "lines": [
                    {"account_code": payload.account_code or "2011", "account_name": "Inventarios",
                     "debit": total_cost, "credit": D("0.00"), "cost_center": payload.cost_center},
                    {"account_code": "4212", "account_name": "Cuentas por pagar comerciales",
                     "debit": D("0.00"), "credit": total_cost},
                ],
            }
            try:
                entry = await LedgerPostingService(build_uow_factory(), build_hash_service()).post_journal(posting)
                response["journal_entry_id"] = str(entry.id)
            except Exception:
                pass

    return response
