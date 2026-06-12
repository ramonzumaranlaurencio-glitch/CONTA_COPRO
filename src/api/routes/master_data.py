from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text

from src.api.dependencies import get_current_context, require_roles
from src.domain.models.accounting import ChartAccount, CostCenter
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/master", tags=["Master Data"])


@router.get("/company-info")
async def company_info(ctx=Depends(get_current_context)):
    """Devuelve datos de la empresa registrada para el tenant activo."""
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            text("SELECT legal_name, ruc, trade_name, sunat_environment AS dian_environment FROM companies WHERE tenant_id = :tid LIMIT 1"),
            {"tid": ctx["tenant_id"]},
        )
        row = result.fetchone()
    if row:
        return {
            "legal_name": row[0] or "",
            "nit":        row[1] or "",
            "trade_name": row[2] or row[0] or "",
            "dian_env":   row[3] or "HABILITACION",
        }
    # Fallback: leer desde tabla tenants
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        r2 = await uow.session.execute(
            text("SELECT legal_name, ruc FROM tenants WHERE id = :tid LIMIT 1"),
            {"tid": ctx["tenant_id"]},
        )
        row2 = r2.fetchone()
    if row2:
        return {"legal_name": row2[0] or "", "nit": row2[1] or "", "trade_name": row2[0] or "", "dian_env": "HABILITACION"}
    return {"legal_name": "", "nit": "", "trade_name": "", "dian_env": "HABILITACION"}


class ChartAccountUpsertRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    code: str
    name: str
    statement: str = "BALANCE"
    nature: str = "DEBIT"
    accepts_cost_center: bool = False
    accepts_partner: bool = False


class CostCenterUpsertRequest(BaseModel):
    tenant_id: str
    company_id: str | None = None
    code: str
    name: str
    parent_code: str | None = None


@router.get("/chart-accounts")
async def list_chart_accounts(limit: int = 500, ctx=Depends(require_roles("ADMIN", "CONTROLLER", "ACCOUNTANT", "AUDITOR"))):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(ChartAccount)
            .where(ChartAccount.tenant_id == ctx["tenant_id"], ChartAccount.is_active.is_(True))
            .order_by(ChartAccount.code.asc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        return [
            {
                "id": str(row.id),
                "code": row.code,
                "name": row.name,
                "account_class": row.account_class,
                "statement": row.statement,
                "nature": row.nature,
                "accepts_cost_center": row.accepts_cost_center,
                "accepts_partner": row.accepts_partner,
            }
            for row in rows
        ]


@router.post("/chart-accounts/upsert")
async def upsert_chart_account(payload: ChartAccountUpsertRequest, ctx=Depends(require_roles("ADMIN", "CONTROLLER", "ACCOUNTANT"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(ChartAccount).where(
                ChartAccount.tenant_id == payload.tenant_id,
                ChartAccount.company_id == payload.company_id,
                ChartAccount.code == payload.code,
            )
        )
        account = result.scalar_one_or_none()
        if account is None:
            account = ChartAccount(
                tenant_id=payload.tenant_id,
                company_id=payload.company_id,
                code=payload.code,
                name=payload.name,
                account_class=payload.code[:2] if len(payload.code) >= 2 else payload.code,
                statement=payload.statement,
                nature=payload.nature,
                accepts_cost_center=payload.accepts_cost_center,
                accepts_partner=payload.accepts_partner,
                is_active=True,
            )
            uow.session.add(account)
        else:
            account.name = payload.name
            account.statement = payload.statement
            account.nature = payload.nature
            account.accepts_cost_center = payload.accepts_cost_center
            account.accepts_partner = payload.accepts_partner
            account.is_active = True
        await uow.commit()
        return {"ok": True, "code": payload.code, "name": payload.name}


@router.post("/chart-accounts/{code}/deactivate")
async def deactivate_chart_account(code: str, tenant_id: str, ctx=Depends(require_roles("ADMIN", "CONTROLLER"))):
    if tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, tenant_id) as uow:
        result = await uow.session.execute(
            select(ChartAccount).where(ChartAccount.tenant_id == tenant_id, ChartAccount.code == code)
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        account.is_active = False
        await uow.commit()
        return {"ok": True, "code": code, "is_active": False}


@router.get("/cost-centers")
async def list_cost_centers(limit: int = 500, ctx=Depends(require_roles("ADMIN", "CONTROLLER", "ACCOUNTANT", "AUDITOR"))):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(CostCenter)
            .where(CostCenter.tenant_id == ctx["tenant_id"], CostCenter.is_active.is_(True))
            .order_by(CostCenter.code.asc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        return [
            {
                "id": str(row.id),
                "code": row.code,
                "name": row.name,
                "parent_code": row.parent_code,
            }
            for row in rows
        ]


@router.post("/cost-centers/upsert")
async def upsert_cost_center(payload: CostCenterUpsertRequest, ctx=Depends(require_roles("ADMIN", "CONTROLLER", "ACCOUNTANT"))):
    if payload.tenant_id != ctx["tenant_id"]:
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    async with UnitOfWork(AsyncSessionLocal, payload.tenant_id) as uow:
        result = await uow.session.execute(
            select(CostCenter).where(CostCenter.tenant_id == payload.tenant_id, CostCenter.code == payload.code)
        )
        center = result.scalar_one_or_none()
        if center is None:
            center = CostCenter(
                tenant_id=payload.tenant_id,
                company_id=payload.company_id,
                code=payload.code,
                name=payload.name,
                parent_code=payload.parent_code,
                is_active=True,
            )
            uow.session.add(center)
        else:
            center.name = payload.name
            center.parent_code = payload.parent_code
            center.is_active = True
        await uow.commit()
        return {"ok": True, "code": payload.code, "name": payload.name}
