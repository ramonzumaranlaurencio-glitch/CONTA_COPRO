from __future__ import annotations

from typing import Any


class AuditEngineIA:
    """Motor de auditoria preventiva para contadores."""

    def __init__(self, data_source: Any):
        self.data_source = data_source

    async def check_non_habidos(self, tenant_id: str) -> list[dict]:
        return await self.data_source.check_non_habidos(tenant_id)

    async def check_duplicate_patterns(self, tenant_id: str) -> list[dict]:
        return await self.data_source.check_duplicate_patterns(tenant_id)

    async def check_detractions_pending(self, tenant_id: str) -> list[dict]:
        return await self.data_source.check_detractions_pending(tenant_id)

    async def ai_business_relevance_check(self, tenant_id: str) -> list[dict]:
        return await self.data_source.ai_business_relevance_check(tenant_id)

    async def run_full_audit(self, tenant_id: str, period: str):
        findings: list[dict] = []

        findings += await self.check_non_habidos(tenant_id)
        findings += await self.check_duplicate_patterns(tenant_id)
        findings += await self.check_detractions_pending(tenant_id)
        findings += await self.ai_business_relevance_check(tenant_id)

        return findings
