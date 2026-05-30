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
# PENDING PURCHASES — facturas y guías pendientes de ingreso al almacén
# =========================================================================

def _infer_item_class(item: dict) -> str:
    code  = str(item.get("account_code") or "")
    desc  = str(item.get("description") or "").lower()
    if "herramienta" in desc or "equipo" in desc or "maquina" in desc or "maquinaria" in desc:
        return "HERRAMIENTAS"
    if "insumo" in desc or "combustible" in desc or "gasolina" in desc or "lubricante" in desc:
        return "INSUMOS"
    if "epp" in desc or "guante" in desc or "casco" in desc or "chaleco" in desc or "bota" in desc:
        return "INSUMOS"
    if code.startswith("33") or "activo" in desc:
        return "ACTIVO_FIJO"
    if code.startswith("20") or code.startswith("60") or code.startswith("61"):
        return "MERCADERIA"
    if "cemento" in desc or "arena" in desc or "piedra" in desc or "acero" in desc or "ladrillo" in desc:
        return "MATERIA_PRIMA"
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
    from sqlalchemy import select
    from src.domain.models.accounting import JournalEntry
    from src.domain.models.inventory import KardexMovement

    PURCHASE_MODULES = ["PURCHASING", "GUIA_REMISION", "COMPRAS", "PURCHASES"]
    if source_module:
        PURCHASE_MODULES = [source_module.upper()]

    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        # 1. Obtener asientos de compra
        q = (
            select(JournalEntry)
            .where(
                JournalEntry.tenant_id == ctx["tenant_id"],
                JournalEntry.source_module.in_(PURCHASE_MODULES),
            )
            .order_by(JournalEntry.entry_date.desc())
            .limit(limit)
        )
        result = await uow.session.execute(q)
        entries = list(result.scalars().all())

        # 2. Obtener source_documents ya recibidos en kardex
        km_q = select(KardexMovement.source_document).where(
            KardexMovement.tenant_id == ctx["tenant_id"]
        )
        km_result = await uow.session.execute(km_q)
        received_docs: set[str] = {r[0] for r in km_result.all() if r[0]}

        # 3. Construir lista de ítems pendientes
        pending: list[dict] = []
        for entry in entries:
            meta: dict = entry.metadata_json or {}
            serie  = str(meta.get("serie") or "")
            number = str(meta.get("number") or "")
            doc_ref = f"{serie}-{number}" if serie and number else (entry.source_id or str(entry.id))
            source_doc = str(meta.get("purchase_id") or doc_ref)

            # Si ya existe movimiento para este documento, omitir
            if source_doc in received_docs or doc_ref in received_docs:
                continue

            supplier_name = str(meta.get("supplier_name") or "")
            supplier_ruc  = str(meta.get("supplier_ruc") or "")
            issue_date    = str(meta.get("issue_date") or str(entry.entry_date))
            doc_type      = str(meta.get("document_type") or "01")
            currency      = str(meta.get("currency") or "PEN")
            total_doc     = float(meta.get("total") or 0)

            # Extraer items: puede venir en "items", "line_items" o "audit_metadata.items"
            raw_items: list[dict] = (
                meta.get("items")
                or meta.get("line_items")
                or (meta.get("audit_metadata") or {}).get("items")
                or []
            )

            for idx, item in enumerate(raw_items):
                line_type = str(item.get("line_type") or "EXPENSE_OR_ASSET")
                # Excluir líneas que no son inventariables
                if line_type in {"PAYABLE", "TAX", "ROUNDING", "PRIOR_BALANCE",
                                  "ADVANCE_PAYMENT", "LATE_FEE", "INFO_ONLY"}:
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

                inferred_class = _infer_item_class(item)
                inferred_area  = _infer_area(cost_center)

                pending.append({
                    "id":            f"{str(entry.id)}-{idx}",
                    "entry_id":      str(entry.id),
                    "purchase_ref":  str(entry.source_id or doc_ref),
                    "doc_type":      doc_type,
                    "doc_series":    serie,
                    "doc_number":    number,
                    "doc_date":      issue_date,
                    "source_doc":    source_doc,
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
                    "ai_reason":     ai_reason,
                })

        return pending


class ValidatePurchaseItemPayload(BaseModel):
    tenant_id: str
    warehouse_id: str
    entry_id: str
    source_doc: str
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
    Valida un ítem de compra e ingresa al inventario (kardex).
    Si product_id no viene, crea el producto automáticamente.
    """
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    from decimal import Decimal as D
    qty   = D(str(payload.qty))
    cost  = D(str(payload.unit_cost))

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = InventoryRepository(uow.session)

        # Buscar o crear producto
        product_id = payload.product_id
        if not product_id:
            seq = await repo.count_products_by_class_area(payload.tenant_id, payload.item_class, payload.area) + 1
            prefix_cls  = CLASS_CODES.get(payload.item_class, "ME")
            prefix_area = AREA_CODES.get(payload.area, "ALM")
            token_code  = f"{prefix_cls}-{prefix_area}-{seq:04d}"
            product = await repo.create_product(
                tenant_id=payload.tenant_id,
                sku=payload.sku or token_code,
                name=payload.product_name,
                unit_of_measure=payload.unit,
                default_cost=cost,
                default_sales_account="704101",
                default_cost_account=payload.account_code or "2011",
                item_class=payload.item_class,
                token_type="PERMANENTE",
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

    # Asiento contable
    if payload.post_journal:
        total_cost = (qty * cost).quantize(D("0.01"))
        cur_date   = date.today()
        posting = {
            "tenant_id": payload.tenant_id,
            "year":  payload.year  or cur_date.year,
            "month": payload.month or cur_date.month,
            "entry_date": cur_date,
            "description": f"Ingreso inventario desde compra {payload.source_doc}",
            "source_module": "INVENTORY",
            "source_id": result.movement_id,
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
            pass  # movimiento ya creado, asiento falla silenciosamente

    return response
