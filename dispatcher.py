"""Outbox dispatcher with idempotency, exponential backoff, and dead-letter.

Polls `outbox_events` for PENDING rows, processes them via registered handlers,
and on exhaustion moves them to `dead_letter_events`. Designed to run as a
single background task started in FastAPI lifespan.

Topology assumptions:
- One process, one dispatcher loop. (For multi-process, replace polling with
  `FOR UPDATE SKIP LOCKED` and bump the loop's batch size.)
- Handlers are best-effort. Failures count an attempt; success marks SENT.
- Idempotency key = OutboxEvent.id (UUID). Handlers SHOULD echo it to
  external systems so they can dedupe on their side.
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from src.domain.models.accounting import DeadLetterEvent, OutboxEvent
from src.infrastructure.db.session import AsyncSessionLocal


def get_session_factory() -> async_sessionmaker:
    return AsyncSessionLocal

logger = logging.getLogger(__name__)

Handler = Callable[[OutboxEvent], Awaitable[None]]


class EventDispatcher:
    """Polls outbox and invokes per-topic handlers with retry/backoff."""

    def __init__(
        self,
        session_factory: async_sessionmaker | None = None,
        poll_interval_seconds: float = 2.0,
        batch_size: int = 20,
        base_backoff_seconds: float = 5.0,
        max_backoff_seconds: float = 600.0,
    ) -> None:
        self._session_factory = session_factory
        self._poll_interval = poll_interval_seconds
        self._batch_size = batch_size
        self._base_backoff = base_backoff_seconds
        self._max_backoff = max_backoff_seconds
        self._handlers: dict[str, list[Handler]] = {}
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()

    # ---- handler registration -------------------------------------------------
    def register(self, topic: str, handler: Handler) -> None:
        self._handlers.setdefault(topic, []).append(handler)

    # ---- lifecycle ------------------------------------------------------------
    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        if self._session_factory is None:
            self._session_factory = get_session_factory()
        self._stopping.clear()
        self._task = asyncio.create_task(self._run(), name="event-dispatcher")
        logger.info("EventDispatcher started")

    async def stop(self) -> None:
        if not self._task:
            return
        self._stopping.set()
        try:
            await asyncio.wait_for(self._task, timeout=10.0)
        except asyncio.TimeoutError:
            self._task.cancel()
        logger.info("EventDispatcher stopped")

    # ---- core loop ------------------------------------------------------------
    async def _run(self) -> None:
        while not self._stopping.is_set():
            try:
                processed = await self._process_batch()
                if processed == 0:
                    await asyncio.wait_for(self._stopping.wait(), timeout=self._poll_interval)
            except asyncio.TimeoutError:
                continue
            except Exception:
                logger.exception("EventDispatcher loop error")
                await asyncio.sleep(self._poll_interval)

    async def _process_batch(self) -> int:
        now = datetime.now(timezone.utc)
        async with self._session_factory() as session:
            stmt = (
                select(OutboxEvent)
                .where(
                    OutboxEvent.status == "PENDING",
                    (OutboxEvent.next_retry_at.is_(None)) | (OutboxEvent.next_retry_at <= now),
                )
                .order_by(OutboxEvent.created_at)
                .limit(self._batch_size)
            )
            events = (await session.execute(stmt)).scalars().all()
            if not events:
                return 0

            for event in events:
                await self._dispatch_event(session, event)
            await session.commit()
            return len(events)

    async def _dispatch_event(self, session, event: OutboxEvent) -> None:
        handlers = self._handlers.get(event.topic, [])
        try:
            for handler in handlers:
                await handler(event)
            event.status = "SENT"
            event.processed_at = datetime.now(timezone.utc)
            event.last_error = None
        except Exception as exc:  # noqa: BLE001 — handler failure is broad
            event.attempts = (event.attempts or 0) + 1
            event.last_error = f"{type(exc).__name__}: {str(exc)[:480]}"
            if event.attempts >= (event.max_attempts or 3):
                event.status = "FAILED"
                session.add(DeadLetterEvent(
                    tenant_id=event.tenant_id,
                    source_event_id=event.id,
                    topic=event.topic,
                    aggregate_id=event.aggregate_id,
                    payload=event.payload,
                    reason=event.last_error,
                ))
                logger.error("Event %s moved to dead-letter: %s", event.id, event.last_error)
            else:
                # Exponential backoff: base * 2^(attempts-1), capped
                delay = min(self._base_backoff * (2 ** (event.attempts - 1)), self._max_backoff)
                event.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
                logger.warning("Event %s retry %d in %.1fs: %s", event.id, event.attempts, delay, event.last_error)


# ---- module-level singleton (FastAPI lifespan attaches/detaches handlers) ----
_singleton: EventDispatcher | None = None


def get_dispatcher() -> EventDispatcher:
    global _singleton
    if _singleton is None:
        _singleton = EventDispatcher()
    return _singleton


# ---- default handler: no-op that just logs (replace with real connectors) ----
async def _default_log_handler(event: OutboxEvent) -> None:
    logger.info(
        "EventDispatcher dispatched topic=%s aggregate=%s event_id=%s",
        event.topic, event.aggregate_id, event.id,
    )


def register_default_handlers(dispatcher: EventDispatcher) -> None:
    """Wire a no-op log handler for every known topic so events drain to SENT.
    Real handlers (SUNAT, Slack, downstream services) can be registered later
    without changing the dispatcher.
    """
    from src.infrastructure.events.event_types import EventTopic

    for attr in dir(EventTopic):
        if attr.startswith("_"):
            continue
        topic = getattr(EventTopic, attr)
        if isinstance(topic, str):
            dispatcher.register(topic, _default_log_handler)
