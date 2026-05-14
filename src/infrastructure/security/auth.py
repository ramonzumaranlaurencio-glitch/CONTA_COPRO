from __future__ import annotations

from datetime import datetime, timedelta
from hashlib import sha256
from uuid import uuid4
from jose import jwt
from passlib.context import CryptContext

from src.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "RS256"

class TokenService:
    def __init__(self, private_key: str | None = None, public_key: str | None = None):
        self.private_key = private_key
        self.public_key = public_key

    def create_access_token(self, *, tenant_id: str, user_id: str, role: str) -> str:
        now = datetime.utcnow()
        payload = {
            "sub": user_id,
            "tenant_id": tenant_id,
            "role": role,
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_minutes),
            "jti": str(uuid4()),
        }
        # In producción usar RSA desde secrets. HS fallback permite desarrollo controlado.
        if self.private_key:
            return jwt.encode(payload, self.private_key, algorithm=ALGORITHM)
        return jwt.encode(payload, settings.ledger_hmac_secret, algorithm="HS256")

    def verify_access_token(self, token: str) -> dict:
        if self.public_key:
            return jwt.decode(token, self.public_key, algorithms=[ALGORITHM])
        return jwt.decode(token, settings.ledger_hmac_secret, algorithms=["HS256"])

    @staticmethod
    def hash_refresh_token(token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def new_refresh_token() -> str:
        return str(uuid4()) + "." + str(uuid4())

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)
