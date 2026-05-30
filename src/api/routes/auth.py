from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.config import settings
from src.infrastructure.security.auth import TokenService

router = APIRouter(prefix="/auth", tags=["Security"])


class DevTokenRequest(BaseModel):
    tenant_id: str
    user_id: str
    role: str = "ADMIN"
    plan: str = "PREMIUM"


class RefreshRequest(BaseModel):
    tenant_id: str
    user_id: str
    role: str = "ADMIN"
    refresh_token: str


@router.get("/well-known")
async def well_known():
    return {
        "issuer": settings.app_name,
        "authorization_endpoint": "/api/v1/auth/authorize",
        "token_endpoint": "/api/v1/auth/token",
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "rbac_roles": ["ADMIN", "CONTROLLER", "ACCOUNTANT", "AUDITOR", "TREASURY", "TAX"],
        "abac_context": ["tenant_id", "company_id", "cost_center", "role", "scope"],
    }


@router.post("/dev-token")
async def dev_token(payload: DevTokenRequest):
    if settings.app_env == "production":
        raise HTTPException(status_code=403, detail="dev-token disabled in production")
    service = TokenService()
    return {
        "token_type": "bearer",
        "access_token": service.create_access_token(tenant_id=payload.tenant_id, user_id=payload.user_id, role=payload.role, plan=payload.plan),
        "refresh_token": service.new_refresh_token(),
        "expires_in_minutes": settings.access_token_minutes,
    }


@router.post("/refresh")
async def refresh(payload: RefreshRequest):
    service = TokenService()
    new_refresh = service.new_refresh_token()
    return {
        "token_type": "bearer",
        "access_token": service.create_access_token(tenant_id=payload.tenant_id, user_id=payload.user_id, role=payload.role),
        "refresh_token": new_refresh,
        "previous_refresh_hash": service.hash_refresh_token(payload.refresh_token),
        "refresh_hash": service.hash_refresh_token(new_refresh),
        "rotation": "caller_must_persist_hash_in_refresh_tokens",
    }
