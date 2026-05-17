from __future__ import annotations

import os

from src.config import settings


class SecretProvider:
    def get(self, name: str) -> str | None:
        if settings.secrets_manager_uri:
            return self._external_secret(name)
        return os.getenv(name)

    def _external_secret(self, name: str) -> str | None:
        # Adapter hook for AWS Secrets Manager, GCP Secret Manager, Azure Key Vault or Vault.
        return os.getenv(name)
