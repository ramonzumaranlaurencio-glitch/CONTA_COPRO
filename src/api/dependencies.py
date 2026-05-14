from __future__ import annotations

from uuid import uuid4
from fastapi import Depends, Header, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.db.session import get_session
from src.infrastructure.security.auth import TokenService
from src.infrastructure.security.tenant_context import set_request_context

bearer = HTTPBearer(auto_error=False)

async def get_current_context(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-Id"),
    x_trace_id: str | None = Header(default=None, alias="X-Trace-Id"),
):
    trace_id = x_trace_id or str(uuid4())
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        payload = TokenService().verify_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    tenant_id = x_tenant_id or payload.get("tenant_id")
    if not tenant_id or tenant_id != payload.get("tenant_id"):
        raise HTTPException(status_code=403, detail="Tenant mismatch")

    set_request_context(tenant_id, payload.get("sub"), trace_id)
    return {"tenant_id": tenant_id, "user_id": payload.get("sub"), "role": payload.get("role"), "trace_id": trace_id}

async def get_db(session: AsyncSession = Depends(get_session)):
    return session

def require_roles(*allowed_roles: str):
    async def checker(ctx=Depends(get_current_context)):
        role = ctx.get("role")
        if allowed_roles and role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return ctx
    return checker

def require_company_access(company_id: str | None, ctx: dict) -> None:
    # ABAC hook: company scopes can be enforced from token claims or policy service.
    if company_id and ctx.get("company_id") and company_id != ctx["company_id"]:
        raise HTTPException(status_code=403, detail="Company scope mismatch")
