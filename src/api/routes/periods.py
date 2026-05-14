from __future__ import annotations

import hashlib
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from src.api.dependencies import require_roles
from src.domain.models.accounting import AccountingPeriod, AuditLog
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.repositories.ledger_repository import LedgerRepository
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/periods", tags=["Period Security"])


class ClosePeriodRequest(BaseModel):
    tenant_id: str
    year: int
    month: int


class ReopenPeriodRequest(BaseModel):
    tenant_id: str
    year: int
    month: int
    reason: str = Field(min_length=8)


@router.post("/close")
async def close_period(payload: ClosePeriodRequest, ctx=Depends(require_roles("ADMIN", "CONTROLLER"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        period_result = await uow.session.execute(
            select(AccountingPeriod).where(
                AccountingPeriod.tenant_id == payload.tenant_id,
                AccountingPeriod.year == payload.year,
                AccountingPeriod.month == payload.month,
            )
        )
        period = period_result.scalar_one_or_none()
        if period is None:
            raise HTTPException(status_code=404, detail="Periodo no encontrado")
        if period.is_closed:
            raise HTTPException(status_code=409, detail="Periodo ya cerrado")

        entries = await LedgerRepository(uow.session).list_entries_with_lines(payload.tenant_id)
        debit = 0
        credit = 0
        period_hashes: list[str] = []
        for entry in entries:
            if entry.entry_date.year == payload.year and entry.entry_date.month == payload.month:
                for line in entry.lines:
                    debit += float(line.debit)
                    credit += float(line.credit)
                period_hashes.append(entry.row_hash)

        if round(debit, 2) != round(credit, 2):
            raise HTTPException(status_code=422, detail="Descuadre detectado. No se puede cerrar.")

        master_hash = hashlib.sha256("".join(sorted(period_hashes)).encode()).hexdigest() if period_hashes else "EMPTY"
        period.status = "CLOSED"
        period.is_closed = True
        period.closed_at = datetime.utcnow()

        uow.session.add(
            AuditLog(
                tenant_id=payload.tenant_id,
                trace_id=ctx["trace_id"],
                entity_type="AccountingPeriod",
                entity_id=str(period.id),
                action="PERIOD_HARD_CLOSE",
                before_state={"status": "OPEN", "is_closed": False},
                after_state={
                    "status": period.status,
                    "is_closed": period.is_closed,
                    "master_hash": master_hash,
                    "debit": debit,
                    "credit": credit,
                },
                actor_user_id=None,
                ip_address=None,
                user_agent="period-close-endpoint",
            )
        )
        await uow.commit()

        return {
            "closed": True,
            "year": payload.year,
            "month": payload.month,
            "master_hash": master_hash,
            "debit": f"{debit:.2f}",
            "credit": f"{credit:.2f}",
        }


@router.post("/reopen")
async def reopen_period(payload: ReopenPeriodRequest, ctx=Depends(require_roles("ADMIN"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        period_result = await uow.session.execute(
            select(AccountingPeriod).where(
                AccountingPeriod.tenant_id == payload.tenant_id,
                AccountingPeriod.year == payload.year,
                AccountingPeriod.month == payload.month,
            )
        )
        period = period_result.scalar_one_or_none()
        if period is None:
            raise HTTPException(status_code=404, detail="Periodo no encontrado")
        if not period.is_closed:
            raise HTTPException(status_code=409, detail="Periodo ya se encuentra abierto")

        period.status = "OPEN"
        period.is_closed = False
        period.closed_at = None

        uow.session.add(
            AuditLog(
                tenant_id=payload.tenant_id,
                trace_id=ctx["trace_id"],
                entity_type="AccountingPeriod",
                entity_id=str(period.id),
                action="PERIOD_REOPEN",
                before_state={"status": "CLOSED", "is_closed": True},
                after_state={"status": "OPEN", "is_closed": False, "reason": payload.reason},
                actor_user_id=None,
                ip_address=None,
                user_agent="period-reopen-endpoint",
            )
        )
        await uow.commit()
        return {"reopened": True, "year": payload.year, "month": payload.month, "reason": payload.reason}


@router.get("/status")
async def period_status(year: int, month: int, ctx=Depends(require_roles("ADMIN", "CONTROLLER", "ACCOUNTANT", "AUDITOR"))):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(AccountingPeriod).where(
                AccountingPeriod.tenant_id == ctx["tenant_id"],
                AccountingPeriod.year == year,
                AccountingPeriod.month == month,
            )
        )
        period = result.scalar_one_or_none()
        if period is None:
            raise HTTPException(status_code=404, detail="Periodo no encontrado")
        return {
            "year": period.year,
            "month": period.month,
            "status": period.status,
            "is_closed": period.is_closed,
            "closed_at": period.closed_at.isoformat() if period.closed_at else None,
        }
