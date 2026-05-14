from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.ai.reasoning_engine import AuditCopilot
from src.ai.vector_store import PgVectorAccountingStore
from src.api.dependencies import get_current_context
from src.application.services.financial_reporting_service import FinancialReportingService
from src.config import settings
from src.infrastructure.adapters.ai.gemini import GeminiClient
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork

router = APIRouter(prefix="/ai", tags=["AI Copilots"])


class CopilotQuestion(BaseModel):
    question: str


class LedgerReader:
    async def get_month_summary(self, tenant_id: str, month: int | None, year: int):
        service = FinancialReportingService(lambda tid: UnitOfWork(AsyncSessionLocal, tid))
        return {
            "trial_balance": await service.trial_balance(tenant_id, year=year, month=month),
            "income_statement": await service.income_statement(tenant_id, year=year, month=month),
            "balance_sheet": await service.balance_sheet(tenant_id, year=year, month=month),
        }


async def build_copilot(tenant_id: str) -> AuditCopilot:
    session = AsyncSessionLocal()
    await session.execute(__import__("sqlalchemy").text("SELECT set_config('app.current_tenant', :tenant_id, true)"), {"tenant_id": tenant_id})
    return AuditCopilot(LedgerReader(), PgVectorAccountingStore(session), GeminiClient(settings.gemini_api_key, settings.gemini_model))


@router.post("/audit/pre-closure")
async def pre_closure_audit(year: int, month: int, ctx=Depends(get_current_context)):
    copilot = await build_copilot(ctx["tenant_id"])
    try:
        return await copilot.perform_pre_closure_audit(ctx["tenant_id"], month, year)
    finally:
        await copilot.vector_store.session.close()


@router.post("/anomalies")
async def anomalies(year: int, month: int | None = None, ctx=Depends(get_current_context)):
    copilot = await build_copilot(ctx["tenant_id"])
    try:
        return await copilot.detect_anomalies(ctx["tenant_id"], year, month)
    finally:
        await copilot.vector_store.session.close()


@router.post("/copilot")
async def copilot_question(payload: CopilotQuestion, ctx=Depends(get_current_context)):
    copilot = await build_copilot(ctx["tenant_id"])
    try:
        return await copilot.answer_contextual_question(ctx["tenant_id"], payload.question)
    finally:
        await copilot.vector_store.session.close()


@router.get("/config/status")
async def ai_config_status():
    return {
        "gemini_configured": bool(settings.gemini_api_key),
        "model": settings.gemini_model,
    }
