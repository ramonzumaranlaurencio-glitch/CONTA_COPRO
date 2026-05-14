from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from datetime import date
from decimal import Decimal
from uuid import uuid4
from src.domain.models.accounting import JournalEntry, JournalLine
from src.infrastructure.hash_chain import LedgerHashService

def build_entry():
    tenant_id = uuid4()
    entry = JournalEntry(
        id=uuid4(), tenant_id=tenant_id, period_id=uuid4(), entry_date=date(2026, 5, 10),
        description="Venta F001-1", source_module="BILLING", source_id="inv-1",
        currency="PEN", total_debit=Decimal("118.00"), total_credit=Decimal("118.00"),
        previous_hash="GENESIS", row_hash="PENDING", created_by=uuid4()
    )
    lines = [
        JournalLine(id=uuid4(), tenant_id=tenant_id, entry_id=entry.id, account_code="1212", debit=Decimal("118.00"), credit=Decimal("0.00")),
        JournalLine(id=uuid4(), tenant_id=tenant_id, entry_id=entry.id, account_code="4011", debit=Decimal("0.00"), credit=Decimal("18.00")),
        JournalLine(id=uuid4(), tenant_id=tenant_id, entry_id=entry.id, account_code="7011", debit=Decimal("0.00"), credit=Decimal("100.00")),
    ]
    return entry, lines

def test_hash_changes_when_line_changes():
    service = LedgerHashService(b"super-secret-ledger-key-32-bytes")
    entry, lines = build_entry()
    h1 = service.generate(entry, lines, "GENESIS")
    lines[0].debit = Decimal("119.00")
    h2 = service.generate(entry, lines, "GENESIS")
    assert h1 != h2

if __name__ == "__main__":
    test_hash_changes_when_line_changes()
    print("OK: hash chain profesional detecta alteraciones.")
