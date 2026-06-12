from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select

from src.api.dependencies import get_current_context
from src.domain.models.accounting import FixedAsset
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("/list")
async def list_assets(limit: int = 200, ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        result = await uow.session.execute(
            select(FixedAsset)
            .where(FixedAsset.tenant_id == ctx["tenant_id"])
            .order_by(FixedAsset.code.asc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        return [
            {
                "id":                      str(a.id),
                "asset_code":              a.code,
                "description":             a.name,
                "acquisition_date":        str(a.acquisition_date) if a.acquisition_date else None,
                "acquisition_cost":        float(a.acquisition_cost),
                "accumulated_depreciation":float(a.accumulated_depreciation),
                "net_book_value":          float(a.acquisition_cost - a.accumulated_depreciation),
                "status":                  a.status,
                "location":                None,
                "asset_class":             a.asset_class,
                "useful_life_months":      a.useful_life_months,
                "ledger_asset_account":    a.ledger_asset_account,
            }
            for a in rows
        ]
