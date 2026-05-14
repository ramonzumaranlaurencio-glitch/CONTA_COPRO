from __future__ import annotations

import hashlib, hmac, json
from decimal import Decimal
from typing import Iterable
from src.domain.models.accounting import JournalEntry, JournalLine

def money(value) -> str:
    return format(Decimal(str(value)).quantize(Decimal("0.01")), "f")

class LedgerHashService:
    def __init__(self, secret_key: bytes):
        if len(secret_key) < 16:
            raise ValueError("LEDGER_HMAC_SECRET debe tener al menos 16 bytes")
        self.secret_key = secret_key

    def payload(self, entry: JournalEntry, lines: Iterable[JournalLine], previous_hash: str) -> str:
        data = {
            "tenant_id": str(entry.tenant_id),
            "company_id": str(entry.company_id) if getattr(entry, "company_id", None) else None,
            "entry_id": str(entry.id),
            "period_id": str(entry.period_id),
            "entry_date": entry.entry_date.isoformat(),
            "description": entry.description,
            "source_module": entry.source_module,
            "source_id": entry.source_id,
            "currency": entry.currency,
            "total_debit": money(entry.total_debit),
            "total_credit": money(entry.total_credit),
            "created_by": str(entry.created_by),
            "previous_hash": previous_hash,
            "lines": [{
                "account_code": line.account_code,
                "account_name": line.account_name,
                "company_id": str(line.company_id) if getattr(line, "company_id", None) else None,
                "debit": money(line.debit),
                "credit": money(line.credit),
                "cost_center": line.cost_center,
                "project_code": line.project_code,
                "partner_ruc": line.partner_ruc,
                "document_type": line.document_type,
                "document_series": line.document_series,
                "document_number": line.document_number,
            } for line in sorted(lines, key=lambda x: (x.account_code, money(x.debit), money(x.credit), x.document_series or "", x.document_number or ""))]
        }
        return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

    def generate(self, entry: JournalEntry, lines: Iterable[JournalLine], previous_hash: str) -> str:
        canonical = self.payload(entry, lines, previous_hash)
        return hmac.new(self.secret_key, canonical.encode(), hashlib.sha256).hexdigest()
