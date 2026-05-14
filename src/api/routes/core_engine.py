from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from pydantic import BaseModel

from src.api.dependencies import get_current_context
from src.application.services.core_transactional_engine import ChartOfAccountsManager, InventoryEngine, PeriodSecurity, SalesOrchestrator, SimpleInventoryRepository
from src.domain.models.accounting import ChartAccount
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork
from src.infrastructure.repositories.ledger_repository import LedgerRepository

router = APIRouter(prefix="/core", tags=["Core Transactional Engine"])


class InventoryMovementPayload(BaseModel):
    tenant_id: str
    product_id: str
    warehouse_id: str
    type: str
    qty: Decimal
    unit_cost: Decimal | None = None
    movement_reference: str | None = None
    source_document: str | None = None


class ClosePeriodPayload(BaseModel):
    tenant_id: str
    month: int
    year: int


class ChartAccountPayload(BaseModel):
    tenant_id: str
    account_code: str
    name: str


class VisionSalePayload(BaseModel):
    tenant_id: str
    fecha: date
    serie_numero: str
    total: Decimal
    items: list[dict]


async def _inventory_repo(request: Request):
    return SimpleInventoryRepository(request.app.state.db_session)


@router.post("/inventory/movement")
async def register_inventory_movement(payload: InventoryMovementPayload, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = SimpleInventoryRepository(uow.session)
        db = type("Db", (), {"inventory": repo})()
        movement = await InventoryEngine().register_movement(db, payload.tenant_id, payload.model_dump())
        await uow.commit()
        return movement


@router.post("/inventory/sale-ia")
async def process_sale_ia(payload: VisionSalePayload, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        repo = LedgerRepository(uow.session)

        class JournalEntriesAdapter:
            async def create(self, journal_payload: dict):
                entry = await repo.get_last_entry_for_update(payload.tenant_id)
                entry_id = getattr(entry, "id", None) or "pending"
                return {"id": entry_id}

        db = type("Db", (), {"journal_entries": JournalEntriesAdapter(), "inventory": SimpleInventoryRepository(uow.session)})()
        result = await SalesOrchestrator(InventoryEngine()).process_sale_ia(db, payload.tenant_id, payload.model_dump())
        await uow.commit()
        return result


@router.post("/period/close")
async def close_period(payload: ClosePeriodPayload, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        ledger_repo = LedgerRepository(uow.session)
        entries = await ledger_repo.list_entries_with_lines(payload.tenant_id)
        debit = Decimal("0.00")
        credit = Decimal("0.00")
        for entry in entries:
            if entry.entry_date.year == payload.year and entry.entry_date.month == payload.month:
                for line in entry.lines:
                    debit += Decimal(str(line.debit))
                    credit += Decimal(str(line.credit))
        if debit != credit:
            raise HTTPException(status_code=422, detail="Error: Descuadre detectado. No se puede cerrar.")

        period_result = await uow.session.execute(
            select(__import__("src.domain.models.accounting", fromlist=["AccountingPeriod"]).AccountingPeriod).where(
                __import__("src.domain.models.accounting", fromlist=["AccountingPeriod"]).AccountingPeriod.tenant_id == payload.tenant_id,
                __import__("src.domain.models.accounting", fromlist=["AccountingPeriod"]).AccountingPeriod.month == payload.month,
                __import__("src.domain.models.accounting", fromlist=["AccountingPeriod"]).AccountingPeriod.year == payload.year,
            )
        )
        period = period_result.scalar_one_or_none()
        if period is None:
            raise HTTPException(status_code=404, detail="Periodo no encontrado")
        period.status = "CLOSED"
        period.is_closed = True
        period.closed_at = __import__("datetime").datetime.utcnow()
        await uow.commit()
        return {"closed": True}


@router.post("/chart-accounts/upsert")
async def upsert_chart_account(payload: ChartAccountPayload, request: Request, ctx=Depends(get_current_context)):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")
    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(ChartAccount).where(
                ChartAccount.tenant_id == payload.tenant_id,
                ChartAccount.code == payload.account_code,
            )
        )
        account = result.scalar_one_or_none()
        if account is None:
            account = ChartAccount(
                tenant_id=payload.tenant_id,
                code=payload.account_code,
                name=payload.name,
                account_class=payload.account_code[:1] or "0",
                statement="BALANCE",
                nature="DEBIT",
            )
            uow.session.add(account)
        else:
            account.name = payload.name
        await uow.commit()
        return {"ok": True, "account_code": payload.account_code, "name": payload.name}
