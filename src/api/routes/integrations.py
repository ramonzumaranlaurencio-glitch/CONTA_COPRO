from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from src.api.dependencies import get_current_context
from src.application.services.integration_registry import IntegrationRegistry
from src.domain.models.accounting import DeadLetterEvent, OutboxEvent
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/integrations", tags=["Integrations"])


@router.get("/health")
async def integration_health(ctx=Depends(get_current_context)):
    return {"tenant_id": ctx["tenant_id"], **IntegrationRegistry().health()}


@router.get("/connectors")
async def connectors(ctx=Depends(get_current_context)):
    return {"tenant_id": ctx["tenant_id"], "connectors": [item.__dict__ for item in IntegrationRegistry().list_connectors()]}


@router.get("/ops/status")
async def ops_status(ctx=Depends(get_current_context)):
    async with UnitOfWork(AsyncSessionLocal, ctx["tenant_id"]) as uow:
        outbox = await uow.session.execute(
            select(OutboxEvent.status, func.count(OutboxEvent.id))
            .where(OutboxEvent.tenant_id == ctx["tenant_id"])
            .group_by(OutboxEvent.status)
        )
        dlq = await uow.session.execute(
            select(func.count(DeadLetterEvent.id)).where(DeadLetterEvent.tenant_id == ctx["tenant_id"])
        )

    return {
        "tenant_id": ctx["tenant_id"],
        "connectors": IntegrationRegistry().health(),
        "outbox": {row[0]: row[1] for row in outbox.all()},
        "dlq_total": int(dlq.scalar_one() or 0),
        "status": "ready",
    }
