from __future__ import annotations

from datetime import datetime, timedelta
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from src.domain.models.accounting import (
    AccountingPeriod,
    AuditLog,
    DeadLetterEvent,
    FinancialDocument,
    IntegrityAlert,
    JournalEntry,
    JournalLine,
    OutboxEvent,
)

class LedgerRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_period_for_update(self, tenant_id, year: int, month: int):
        result = await self.session.execute(
            select(AccountingPeriod)
            .where(AccountingPeriod.tenant_id == tenant_id, AccountingPeriod.year == year, AccountingPeriod.month == month)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_last_entry_for_update(self, tenant_id):
        result = await self.session.execute(
            select(JournalEntry)
            .where(JournalEntry.tenant_id == tenant_id)
            .order_by(JournalEntry.created_at.desc(), JournalEntry.id.desc())
            .limit(1)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def add_entry(self, entry, lines):
        self.session.add(entry)
        for line in lines:
            self.session.add(line)
        await self.session.flush()

    async def add_financial_document(self, document: FinancialDocument):
        self.session.add(document)
        await self.session.flush()

    async def get_entry_with_lines(self, tenant_id, entry_id):
        result = await self.session.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.tenant_id == tenant_id, JournalEntry.id == entry_id)
        )
        return result.scalar_one_or_none()

    async def add_audit(self, audit: AuditLog):
        self.session.add(audit)

    async def add_outbox(self, event: OutboxEvent):
        self.session.add(event)

    async def list_entries_with_lines(self, tenant_id):
        result = await self.session.execute(
            select(JournalEntry)
            .options(selectinload(JournalEntry.lines))
            .where(JournalEntry.tenant_id == tenant_id)
            .order_by(JournalEntry.created_at.asc(), JournalEntry.id.asc())
        )
        return list(result.scalars().all())

    async def list_entries_page(self, tenant_id, *, year: int | None = None, month: int | None = None, limit: int = 100, offset: int = 0):
        filters = [JournalEntry.tenant_id == tenant_id]
        if year is not None:
            filters.append(AccountingPeriod.year == year)
        if month is not None:
            filters.append(AccountingPeriod.month == month)
        result = await self.session.execute(
            select(JournalEntry)
            .join(AccountingPeriod, AccountingPeriod.id == JournalEntry.period_id)
            .options(selectinload(JournalEntry.lines))
            .where(and_(*filters))
            .order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def trial_balance(self, tenant_id, *, year: int, month: int | None = None, company_id: str | None = None):
        filters = [
            JournalEntry.tenant_id == tenant_id,
            AccountingPeriod.tenant_id == tenant_id,
            AccountingPeriod.year == year,
            JournalEntry.status == "POSTED",
        ]
        if month is not None:
            filters.append(AccountingPeriod.month <= month)
        if company_id:
            filters.append(or_(JournalEntry.company_id == company_id, JournalEntry.company_id.is_(None)))

        result = await self.session.execute(
            select(
                JournalLine.account_code,
                func.coalesce(func.max(JournalLine.account_name), "").label("account_name"),
                func.coalesce(func.sum(JournalLine.debit), 0).label("debit"),
                func.coalesce(func.sum(JournalLine.credit), 0).label("credit"),
            )
            .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
            .join(AccountingPeriod, AccountingPeriod.id == JournalEntry.period_id)
            .where(and_(*filters))
            .group_by(JournalLine.account_code)
            .order_by(JournalLine.account_code)
        )
        return [dict(row._mapping) for row in result]

    async def account_ledger(self, tenant_id, *, account_code: str, year: int, month: int | None = None, limit: int = 500):
        filters = [
            JournalEntry.tenant_id == tenant_id,
            AccountingPeriod.year == year,
            JournalLine.account_code == account_code,
        ]
        if month is not None:
            filters.append(AccountingPeriod.month <= month)
        result = await self.session.execute(
            select(JournalEntry, JournalLine)
            .join(JournalLine, JournalLine.entry_id == JournalEntry.id)
            .join(AccountingPeriod, AccountingPeriod.id == JournalEntry.period_id)
            .where(and_(*filters))
            .order_by(JournalEntry.entry_date.asc(), JournalEntry.created_at.asc())
            .limit(limit)
        )
        return [{"entry": entry, "line": line} for entry, line in result.all()]

    async def ar_ap_aging(self, tenant_id, *, direction: str, as_of: datetime):
        result = await self.session.execute(
            select(
                FinancialDocument.partner_id,
                FinancialDocument.document_type,
                FinancialDocument.series,
                FinancialDocument.number,
                FinancialDocument.issue_date,
                FinancialDocument.due_date,
                FinancialDocument.currency,
                FinancialDocument.total_amount,
                FinancialDocument.balance_amount,
            )
            .where(
                FinancialDocument.tenant_id == tenant_id,
                FinancialDocument.direction == direction,
                FinancialDocument.balance_amount > 0,
                FinancialDocument.issue_date <= as_of.date(),
            )
            .order_by(FinancialDocument.due_date.asc().nulls_last(), FinancialDocument.issue_date.asc())
        )
        return [dict(row._mapping) for row in result]

    async def add_integrity_alert(self, alert: IntegrityAlert):
        self.session.add(alert)

    async def get_pending_outbox_for_update(self, tenant_id, limit: int = 50):
        result = await self.session.execute(
            select(OutboxEvent)
            .where(OutboxEvent.tenant_id == tenant_id, OutboxEvent.status.in_(["PENDING", "RETRYING"]))
            .order_by(OutboxEvent.created_at.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return list(result.scalars().all())

    async def mark_outbox_processed(self, event: OutboxEvent):
        event.status = "PROCESSED"
        event.processed_at = datetime.utcnow()

    async def schedule_retry(self, event: OutboxEvent, error: str):
        event.attempts += 1
        event.status = "RETRYING" if event.attempts < event.max_attempts else "FAILED"
        event.last_error = error
        event.next_retry_at = datetime.utcnow() + timedelta(seconds=min(300, 2 ** event.attempts * 10))

    async def move_to_dlq(self, event: OutboxEvent, reason: str, ai_diagnosis: dict | None = None):
        event.status = "DLQ"
        event.last_error = reason
        self.session.add(DeadLetterEvent(
            tenant_id=event.tenant_id,
            source_event_id=event.id,
            topic=event.topic,
            aggregate_id=event.aggregate_id,
            payload=event.payload,
            reason=reason,
            ai_diagnosis=ai_diagnosis,
        ))


# --- COMPATIBILIDAD CONTA_PRO ENTERPRISE: PLAN CONTABLE / CENTROS DE COSTO ---
from uuid import uuid4 as _uuid4
from sqlalchemy import and_ as _and_, select as _select
from sqlalchemy.orm import selectinload as _selectinload
from src.domain.models.accounting import (
    ChartAccount as _ChartAccount,
    CostCenter as _CostCenter,
    JournalEntry as _JournalEntry,
)

async def _repo_upsert_chart_account(
    self,
    tenant_id: str,
    *,
    company_id=None,
    code: str,
    name: str,
    account_class: str,
    statement: str,
    nature: str,
    accepts_cost_center: bool = False,
    accepts_partner: bool = False,
):
    clean_code = str(code or "").strip()
    if not clean_code:
        return None

    conditions = [
        _ChartAccount.tenant_id == tenant_id,
        _ChartAccount.code == clean_code,
    ]

    if hasattr(_ChartAccount, "company_id"):
        if company_id is None:
            conditions.append(_ChartAccount.company_id.is_(None))
        else:
            conditions.append(_ChartAccount.company_id == company_id)

    result = await self.session.execute(
        _select(_ChartAccount).where(_and_(*conditions))
    )
    account = result.scalar_one_or_none()

    if account is None:
        kwargs = {
            "tenant_id": tenant_id,
            "code": clean_code,
            "name": name or f"Cuenta {clean_code}",
            "account_class": str(account_class or clean_code[:1] or "0")[:2],
            "statement": statement or "UNCLASSIFIED",
            "nature": nature or "DEBIT",
            "accepts_cost_center": bool(accepts_cost_center),
            "accepts_partner": bool(accepts_partner),
            "is_active": True,
        }

        if hasattr(_ChartAccount, "id"):
            kwargs["id"] = _uuid4()
        if hasattr(_ChartAccount, "company_id"):
            kwargs["company_id"] = company_id

        account = _ChartAccount(**kwargs)
        self.session.add(account)
    else:
        account.name = name or account.name
        account.account_class = str(account_class or account.account_class or clean_code[:1] or "0")[:2]
        account.statement = statement or account.statement
        account.nature = nature or account.nature
        account.accepts_cost_center = bool(accepts_cost_center)
        account.accepts_partner = bool(accepts_partner)
        account.is_active = True

    return account


async def _repo_upsert_cost_center(
    self,
    tenant_id: str,
    *,
    company_id=None,
    code: str,
    name: str | None = None,
    parent_code: str | None = None,
):
    clean_code = str(code or "").strip().upper()
    if not clean_code or clean_code == "-":
        return None

    conditions = [
        _CostCenter.tenant_id == tenant_id,
        _CostCenter.code == clean_code,
    ]

    if hasattr(_CostCenter, "company_id"):
        if company_id is None:
            conditions.append(_CostCenter.company_id.is_(None))
        else:
            conditions.append(_CostCenter.company_id == company_id)

    result = await self.session.execute(
        _select(_CostCenter).where(_and_(*conditions))
    )
    center = result.scalar_one_or_none()

    if center is None:
        kwargs = {
            "tenant_id": tenant_id,
            "code": clean_code,
            "name": name or clean_code,
            "parent_code": parent_code,
            "is_active": True,
        }

        if hasattr(_CostCenter, "id"):
            kwargs["id"] = _uuid4()
        if hasattr(_CostCenter, "company_id"):
            kwargs["company_id"] = company_id

        center = _CostCenter(**kwargs)
        self.session.add(center)
    else:
        center.name = name or center.name or clean_code
        center.parent_code = parent_code or center.parent_code
        center.is_active = True

    return center


async def _repo_get_entry_with_lines(self, tenant_id: str, entry_id):
    result = await self.session.execute(
        _select(_JournalEntry)
        .options(_selectinload(_JournalEntry.lines))
        .where(
            _and_(
                _JournalEntry.tenant_id == tenant_id,
                _JournalEntry.id == entry_id,
            )
        )
    )
    return result.scalar_one_or_none()


if not hasattr(LedgerRepository, "upsert_chart_account"):
    LedgerRepository.upsert_chart_account = _repo_upsert_chart_account

if not hasattr(LedgerRepository, "upsert_cost_center"):
    LedgerRepository.upsert_cost_center = _repo_upsert_cost_center

if not hasattr(LedgerRepository, "get_entry_with_lines"):
    LedgerRepository.get_entry_with_lines = _repo_get_entry_with_lines

# --- FIN COMPATIBILIDAD CONTA_PRO ENTERPRISE ---

