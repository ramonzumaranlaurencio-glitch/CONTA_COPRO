"""Event taxonomy for the Enterprise Ledger event bus."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4


class EventTopic:
    """Topics consumed by the LedgerIngestionEngine and downstream services."""
    PURCHASE_INVOICE_VALIDATED = "purchase.invoice.validated"
    PURCHASE_INVOICE_POSTED = "purchase.invoice.posted"
    SALES_INVOICE_ISSUED = "sales.invoice.issued"
    SALES_INVOICE_POSTED = "sales.invoice.posted"
    INVENTORY_KARDEX_COSTED = "inventory.kardex.costed"
    PAYROLL_PERIOD_CALCULATED = "payroll.period.calculated"
    BANK_RECONCILIATION_DONE = "bank.reconciliation.done"
    LEDGER_ENTRY_POSTED = "ledger.entry.posted"
    LEDGER_ENTRY_INTEGRITY_BROKEN = "ledger.integrity.broken"


def build_event_payload(
    *,
    topic: str,
    aggregate_type: str,
    aggregate_id: str | UUID,
    payload: dict[str, Any],
    trace_id: str | None = None,
    max_attempts: int = 5,
) -> dict[str, Any]:
    """Shape consumed by LedgerPostingService.post_journal -> outbox_events.

    The event UUID is the idempotency key. Downstream consumers MUST dedupe
    by `payload['event_uuid']`.
    """
    event_uuid = str(uuid4())
    return {
        "topic": topic,
        "aggregate_type": aggregate_type,
        "max_attempts": max_attempts,
        "payload": {
            "event_uuid": event_uuid,
            "topic": topic,
            "aggregate_type": aggregate_type,
            "aggregate_id": str(aggregate_id),
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "trace_id": trace_id,
            "data": payload,
        },
    }
