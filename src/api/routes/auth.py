import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.config import settings
from src.infrastructure.security.auth import TokenService

router = APIRouter(prefix="/auth", tags=["Security"])

TENANT_ID_DEFAULT = "11111111-1111-1111-1111-111111111111"


class GoogleAuthRequest(BaseModel):
    credential: str  # JWT firmado por Google


class GoogleTokenRequest(BaseModel):
    access_token: str
    email: str = ""
    name: str = ""


@router.post("/google-token")
async def google_sign_in_token(payload: GoogleTokenRequest):
    """
    Recibe el access_token de Google OAuth2, verifica con userinfo y devuelve JWT CONTA_PRO.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {payload.access_token}"},
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error verificando token Google: {exc}") from exc

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Access token de Google inválido.")

    info = r.json()
    email: str = info.get("email", payload.email)
    name: str = info.get("name", payload.name or email.split("@")[0])

    service = TokenService()
    access_token = service.create_access_token(
        tenant_id=TENANT_ID_DEFAULT,
        user_id=email,
        role="ACCOUNTANT",
        plan="TRIAL_CONTADOR",
    )

    return {
        "token_type": "bearer",
        "access_token": access_token,
        "expires_in_minutes": settings.access_token_minutes,
        "plan": "TRIAL_CONTADOR",
        "user": {"email": email, "name": name},
    }


@router.post("/google")
async def google_sign_in(payload: GoogleAuthRequest):
    """
    Verifica el token de Google, extrae email/nombre y devuelve un JWT CONTA_PRO.
    Requiere GOOGLE_CLIENT_ID en .env.
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In no configurado. Añade GOOGLE_CLIENT_ID en .env.",
        )

    # Verificar token con Google
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": payload.credential},
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error verificando token Google: {exc}") from exc

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Token Google inválido o expirado.")

    info = r.json()

    # Validar que el token fue emitido para ESTA app
    if info.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Token Google no corresponde a esta aplicación.")

    email: str = info.get("email", "")
    name: str = info.get("name", email.split("@")[0])
    picture: str = info.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="No se pudo obtener email de la cuenta Google.")

    # Generar JWT CONTA_PRO para el usuario Google
    service = TokenService()
    access_token = service.create_access_token(
        tenant_id=TENANT_ID_DEFAULT,
        user_id=email,
        role="ACCOUNTANT",
        plan="TRIAL_CONTADOR",
    )

    return {
        "token_type": "bearer",
        "access_token": access_token,
        "expires_in_minutes": settings.access_token_minutes,
        "plan": "TRIAL_CONTADOR",
        "user": {
            "email": email,
            "name": name,
            "picture": picture,
            "google_sub": info.get("sub"),
        },
    }


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
