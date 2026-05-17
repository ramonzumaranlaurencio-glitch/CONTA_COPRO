from __future__ import annotations

from typing import Callable
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

class UnitOfWork:
    def __init__(self, session_factory: Callable[[], AsyncSession], tenant_id: str):
        if not tenant_id:
            raise ValueError("tenant_id obligatorio")
        self.session_factory = session_factory
        self.tenant_id = tenant_id
        self.session: AsyncSession | None = None

    async def __aenter__(self) -> "UnitOfWork":
        self.session = self.session_factory()
        await self.session.execute(
            text("SELECT set_config('app.current_tenant', :tenant_id, true)"),
            {"tenant_id": str(self.tenant_id)},
        )
        return self

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        try:
            if exc_type:
                await self.rollback()
        finally:
            await self.session.close()
