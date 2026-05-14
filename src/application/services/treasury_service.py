from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import and_, select

from src.domain.models.accounting import FinancialDocument, TreasuryMovement


@dataclass
class ImportResult:
    imported: int
    rejected: int


@dataclass
class MatchResult:
    matched: int
    reviewed: int


class TreasuryService:
    def __init__(self, uow_factory):
        self.uow_factory = uow_factory

    async def import_statement_csv(
        self,
        tenant_id: str,
        *,
        treasury_account_id: str,
        csv_content: str,
        default_currency: str = "PEN",
    ) -> ImportResult:
        imported = 0
        rejected = 0

        rows = csv.DictReader(io.StringIO(csv_content))
        async with self.uow_factory(tenant_id) as uow:
            for row in rows:
                try:
                    movement_date = datetime.fromisoformat((row.get("date") or "").strip()).date()
                    amount = Decimal(str(row.get("amount") or "0")).quantize(Decimal("0.01"))
                    reference = (row.get("reference") or "").strip() or None
                    movement_type = (row.get("type") or "STATEMENT").strip().upper()
                    currency = (row.get("currency") or default_currency).strip().upper() or default_currency
                    if amount <= 0:
                        raise ValueError("amount<=0")
                except Exception:
                    rejected += 1
                    continue

                uow.session.add(
                    TreasuryMovement(
                        id=uuid4(),
                        tenant_id=tenant_id,
                        treasury_account_id=treasury_account_id,
                        movement_date=movement_date,
                        movement_type=movement_type,
                        amount=amount,
                        currency=currency,
                        reference=reference,
                        reconciliation_status="OPEN",
                    )
                )
                imported += 1

            await uow.commit()

        return ImportResult(imported=imported, rejected=rejected)

    async def auto_match_open_items(self, tenant_id: str, *, limit: int = 200) -> MatchResult:
        reviewed = 0
        matched = 0

        async with self.uow_factory(tenant_id) as uow:
            movement_result = await uow.session.execute(
                select(TreasuryMovement)
                .where(
                    and_(
                        TreasuryMovement.tenant_id == tenant_id,
                        TreasuryMovement.reconciliation_status == "OPEN",
                        TreasuryMovement.financial_document_id.is_(None),
                    )
                )
                .order_by(TreasuryMovement.movement_date.asc())
                .limit(limit)
            )
            movements = list(movement_result.scalars().all())

            docs_result = await uow.session.execute(
                select(FinancialDocument)
                .where(
                    and_(
                        FinancialDocument.tenant_id == tenant_id,
                        FinancialDocument.balance_amount > 0,
                        FinancialDocument.direction.in_(["AR", "AP"]),
                    )
                )
            )
            docs = list(docs_result.scalars().all())
            docs_by_key = {f"{doc.series}-{doc.number}".upper(): doc for doc in docs}

            for movement in movements:
                reviewed += 1
                reference = (movement.reference or "").upper()
                target = None
                for key, doc in docs_by_key.items():
                    if key in reference:
                        target = doc
                        break

                if target is None:
                    continue

                amount = Decimal(str(movement.amount))
                balance = Decimal(str(target.balance_amount))
                if amount > balance:
                    movement.reconciliation_status = "REVIEW"
                    continue

                target.balance_amount = balance - amount
                movement.financial_document_id = target.id
                movement.reconciliation_status = "RECONCILED" if target.balance_amount == 0 else "MATCHED"
                matched += 1

            await uow.commit()

        return MatchResult(matched=matched, reviewed=reviewed)
