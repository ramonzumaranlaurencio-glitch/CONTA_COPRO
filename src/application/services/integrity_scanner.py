from src.domain.models.accounting import IntegrityAlert
from src.infrastructure.repositories.ledger_repository import LedgerRepository

class LedgerIntegrityScanner:
    def __init__(self, uow_factory, hash_service):
        self.uow_factory = uow_factory
        self.hash_service = hash_service

    async def scan_tenant(self, tenant_id: str, trace_id: str | None = None):
        alerts = []
        async with self.uow_factory(tenant_id) as uow:
            repo = LedgerRepository(uow.session)
            previous_hash = "GENESIS"
            entries = await repo.list_entries_with_lines(tenant_id)
            for entry in entries:
                expected = self.hash_service.generate(entry, entry.lines, previous_hash)
                if entry.previous_hash != previous_hash or entry.row_hash != expected:
                    alert = IntegrityAlert(
                        tenant_id=tenant_id, entry_id=entry.id, severity="CRITICAL",
                        message="Cadena de ledger alterada. Posible manipulación manual en DB.",
                        expected_hash=expected, actual_hash=entry.row_hash, trace_id=trace_id
                    )
                    await repo.add_integrity_alert(alert)
                    alerts.append(alert)
                previous_hash = entry.row_hash
            await uow.commit()
            return alerts
