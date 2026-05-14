from __future__ import annotations

from decimal import Decimal

from datetime import date
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


def _safe_user_uuid(user_id: str | None) -> str:
    if user_id:
        try:
            return str(UUID(user_id))
        except Exception:
            pass
    return "22222222-2222-2222-2222-222222222222"


class ProductCreatePayload(BaseModel):
    tenant_id: str
    sku: str
    name: str
    unit_of_measure: str = "NIU"
    default_cost: Decimal = Decimal("0")
    default_sales_account: str | None = None
    default_cost_account: str | None = None


class WarehouseCreatePayload(BaseModel):
    tenant_id: str
    code: str
    name: str


class MovementCreatePayload(BaseModel):
    tenant_id: str
    product_id: str
    warehouse_id: str
    movement_type: str = Field(description="ENTRY o EXIT")
    qty: Decimal
    unit_cost: Decimal | None = None
    movement_reference: str | None = None
    source_document: str | None = None
    post_cost_entry: bool = False
    year: int | None = None
    month: int | None = None
    cogs_account: str = "6911"
    inventory_account: str = "2011"


@router.post("/products")
async def create_product(payload: ProductCreatePayload, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = InventoryRepository(uow.session)
        product = await repo.create_product(
            tenant_id=payload.tenant_id,
            sku=payload.sku,
            name=payload.name,
            unit_of_measure=payload.unit_of_measure,
            default_cost=payload.default_cost,
            default_sales_account=payload.default_sales_account,
            default_cost_account=payload.default_cost_account,
        )
        await uow.commit()
        return {
            "id": str(product.id),
            "sku": product.sku,
            "name": product.name,
            "unit_of_measure": product.unit_of_measure,
        }


@router.get("/products")
async def list_products(limit: int = 200, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        rows = await InventoryRepository(uow.session).list_products(ctx["tenant_id"], limit=limit)
        return [
            {
                "id": str(row.id),
                "sku": row.sku,
                "name": row.name,
                "unit_of_measure": row.unit_of_measure,
                "default_cost": str(row.default_cost),
            }
            for row in rows
        ]


@router.post("/warehouses")
async def create_warehouse(payload: WarehouseCreatePayload, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = InventoryRepository(uow.session)
        warehouse = await repo.create_warehouse(payload.tenant_id, payload.code, payload.name)
        await uow.commit()
        return {"id": str(warehouse.id), "code": warehouse.code, "name": warehouse.name}


@router.get("/warehouses")
async def list_warehouses(limit: int = 100, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        rows = await InventoryRepository(uow.session).list_warehouses(ctx["tenant_id"], limit=limit)
        return [{"id": str(row.id), "code": row.code, "name": row.name} for row in rows]


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
    if payload.post_cost_entry and payload.movement_type.upper() == "EXIT":
        effective_qty = Decimal(str(result.qty))
        effective_cost = Decimal(str(result.unit_cost))
        total_cost = (effective_qty * effective_cost).quantize(Decimal("0.01"))
        current_date = date.today()
        posting_payload = {
            "tenant_id": payload.tenant_id,
            "year": payload.year or current_date.year,
            "month": payload.month or current_date.month,
            "entry_date": current_date,
            "description": f"Costo de ventas por salida inventario {payload.movement_reference or result.movement_id}",
            "source_module": "INVENTORY_COGS",
            "source_id": result.movement_id,
            "currency": "PEN",
            "user_id": _safe_user_uuid(ctx.get("user_id")),
            "trace_id": ctx["trace_id"],
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
            "lines": [
                {
                    "account_code": payload.cogs_account,
                    "account_name": "Costo de ventas",
                    "debit": total_cost,
                    "credit": Decimal("0.00"),
                    "document_number": payload.source_document,
                },
                {
                    "account_code": payload.inventory_account,
                    "account_name": "Inventarios",
                    "debit": Decimal("0.00"),
                    "credit": total_cost,
                    "document_number": payload.source_document,
                },
            ],
        }
        entry = await LedgerPostingService(build_uow_factory(), build_hash_service()).post_journal(posting_payload)
        response["cost_entry"] = {
            "entry_id": str(entry.id),
            "row_hash": entry.row_hash,
            "amount": str(total_cost),
            "cogs_account": payload.cogs_account,
            "inventory_account": payload.inventory_account,
        }

    return response


@router.get("/kardex/{product_id}")
async def get_kardex(product_id: str, warehouse_id: str | None = None, limit: int = 500, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        rows = await InventoryRepository(uow.session).list_kardex(
            tenant_id=ctx["tenant_id"],
            product_id=product_id,
            warehouse_id=warehouse_id,
            limit=limit,
        )
        return [
            {
                "id": str(row.id),
                "movement_type": row.movement_type,
                "qty": str(row.qty),
                "unit_cost": str(row.unit_cost),
                "balance_qty": str(row.balance_qty),
                "balance_avg_cost": str(row.balance_avg_cost),
                "movement_reference": row.movement_reference,
                "source_document": row.source_document,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
