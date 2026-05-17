import asyncio
from src.config import settings
from src.infrastructure.db.session import AsyncSessionLocal
from src.infrastructure.unit_of_work import UnitOfWork
from src.infrastructure.workers.celery_app import celery_app
from src.infrastructure.workers.sunat_worker import CircuitBreaker, SunatOutboxWorker
from src.infrastructure.adapters.sunat.client import SunatClient
from src.infrastructure.adapters.sunat.xml_signer import XmlSigner
from src.ai.reasoning_engine import AuditCopilot
from src.application.services.integration_registry import IntegrationRegistry

class NullLedgerReader:
    async def get_month_summary(self, *args, **kwargs): return {}

class NullVectorStore:
    async def get_context(self, *args, **kwargs): return []

class NullGemini:
    async def analyze(self, prompt): return {"analysis": "gemini_not_configured", "prompt_keys": list(prompt.keys())}

@celery_app.task(name="src.infrastructure.workers.tasks.process_sunat_outbox")
def process_sunat_outbox(tenant_id: str):
    async def run():
        uow_factory = lambda tid: UnitOfWork(AsyncSessionLocal, tid)
        worker = SunatOutboxWorker(
            uow_factory=uow_factory,
            sunat_client=SunatClient(settings.sunat_endpoint, settings.sunat_ruc, settings.sunat_sol_user, settings.sunat_sol_password),
            xml_signer=XmlSigner(settings.p12_cert_path, settings.p12_cert_password),
            audit_copilot=AuditCopilot(NullLedgerReader(), NullVectorStore(), NullGemini()),
            breaker=CircuitBreaker(),
        )
        return await worker.process_pending(tenant_id)
    return asyncio.run(run())

@celery_app.task(name="src.infrastructure.workers.tasks.process_integration_outbox")
def process_integration_outbox(tenant_id: str):
    return {
        "tenant_id": tenant_id,
        "connectors": IntegrationRegistry().health(),
        "status": "ready_for_provider_adapters",
    }

@celery_app.task(name="src.infrastructure.workers.tasks.run_pre_closure_audit")
def run_pre_closure_audit(tenant_id: str, year: int, month: int):
    async def run():
        copilot = AuditCopilot(NullLedgerReader(), NullVectorStore(), NullGemini())
        return await copilot.perform_pre_closure_audit(tenant_id, month, year)
    return asyncio.run(run())
