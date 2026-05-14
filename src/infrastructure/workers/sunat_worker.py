from __future__ import annotations
import time
from dataclasses import dataclass
from src.infrastructure.repositories.ledger_repository import LedgerRepository

@dataclass
class CircuitBreaker:
    failure_threshold: int = 3
    reset_seconds: int = 120
    failures: int = 0
    opened_at: float | None = None

    def allow(self) -> bool:
        if self.opened_at is None:
            return True
        if time.time() - self.opened_at >= self.reset_seconds:
            self.failures = 0
            self.opened_at = None
            return True
        return False

    def success(self):
        self.failures = 0
        self.opened_at = None

    def failure(self):
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.opened_at = time.time()

class SunatOutboxWorker:
    def __init__(self, uow_factory, sunat_client, xml_signer, audit_copilot, breaker: CircuitBreaker):
        self.uow_factory = uow_factory
        self.sunat_client = sunat_client
        self.xml_signer = xml_signer
        self.audit_copilot = audit_copilot
        self.breaker = breaker

    async def process_pending(self, tenant_id: str, limit: int = 20):
        result = {"processed": 0, "retrying": 0, "dlq": 0}
        async with self.uow_factory(tenant_id) as uow:
            repo = LedgerRepository(uow.session)
            events = await repo.get_pending_outbox_for_update(tenant_id, limit)
            for event in events:
                if not self.breaker.allow():
                    diagnosis = await self.audit_copilot.diagnose_sunat_failure(event.payload, "Circuit breaker abierto")
                    await repo.move_to_dlq(event, "SUNAT circuit breaker abierto", diagnosis)
                    result["dlq"] += 1
                    continue
                try:
                    signed = await self.xml_signer.sign(event.payload["invoice"])
                    response = await self.sunat_client.send_bill(signed)
                    if not response.get("success"):
                        raise RuntimeError(response.get("error", "SUNAT rechazó comprobante"))
                    self.breaker.success()
                    await repo.mark_outbox_processed(event)
                    result["processed"] += 1
                except Exception as exc:
                    self.breaker.failure()
                    if event.attempts + 1 >= event.max_attempts:
                        diagnosis = await self.audit_copilot.diagnose_sunat_failure(event.payload, str(exc))
                        await repo.move_to_dlq(event, str(exc), diagnosis)
                        result["dlq"] += 1
                    else:
                        await repo.schedule_retry(event, str(exc))
                        result["retrying"] += 1
            await uow.commit()
            return result
