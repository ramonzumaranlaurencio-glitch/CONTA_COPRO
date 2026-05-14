from __future__ import annotations

import hashlib
from typing import Any


class PeriodManager:
    def __init__(self, ledger: Any, db: Any):
        self.ledger = ledger
        self.db = db

    async def close_monthly_period(self, tenant_id: str, month: int, year: int):
        is_balanced = await self.ledger.verify_total_balance(tenant_id, month, year)
        if not is_balanced:
            raise Exception("No se puede cerrar: el mes tiene asientos descuadrados.")

        all_hashes = await self.ledger.get_all_hashes_of_period(tenant_id, month, year)
        master_hash = hashlib.sha256("".join(all_hashes).encode()).hexdigest()

        await self.db.execute(
            "UPDATE monthly_periods SET status = 'CLOSED', master_hash = :hash "
            "WHERE tenant_id = :tid AND month = :m AND year = :y",
            {"hash": master_hash, "tid": tenant_id, "m": month, "y": year},
        )
        return master_hash
