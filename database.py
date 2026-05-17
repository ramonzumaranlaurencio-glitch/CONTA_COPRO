from __future__ import annotations

from sqlalchemy import text


async def switch_tenant_context(session, tenant_id: str):
    """
    Activa la visibilidad de datos para el tenant actual.
    Si se intenta consultar otro tenant, Postgres devuelve 0 registros via RLS.
    """
    await session.execute(
        text("SELECT set_config('app.current_tenant', :tid, false)"),
        {"tid": tenant_id},
    )
