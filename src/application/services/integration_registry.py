from __future__ import annotations

from dataclasses import dataclass

from src.config import settings


@dataclass(frozen=True)
class ConnectorDefinition:
    provider: str
    connector_type: str
    ready: bool
    required_settings: list[str]
    capabilities: list[str]


class IntegrationRegistry:
    def list_connectors(self) -> list[ConnectorDefinition]:
        return [
            ConnectorDefinition("SUNAT", "tax_authority", bool(settings.sunat_endpoint), ["SUNAT_ENDPOINT", "SUNAT_RUC", "SUNAT_SOL_USER", "SUNAT_SOL_PASSWORD", "P12_CERT_PATH"], ["UBL_2_1", "SOAP", "CDR", "SIRE", "PLE"]),
            ConnectorDefinition("SUNAT_LOOKUP", "tax_authority", bool(settings.sunat_ruc_lookup_url or settings.sunat_cpe_lookup_url), ["SUNAT_RUC_LOOKUP_URL", "SUNAT_CPE_LOOKUP_URL"], ["ruc_status", "cpe_status", "guard_realtime"]),
            ConnectorDefinition("BANKS", "treasury", bool(settings.bank_api_base_url), ["BANK_API_BASE_URL"], ["statements", "payments", "reconciliation"]),
            ConnectorDefinition("GEMINI", "ai", bool(settings.gemini_api_key), ["GEMINI_API_KEY"], ["embeddings", "rag", "audit_reasoning", "copilots"]),
            ConnectorDefinition("RAG_VECTOR", "ai_vector_store", settings.rag_vector_provider.lower() in {"pgvector", "chroma", "chromadb"}, ["RAG_VECTOR_PROVIDER"], ["legal_batch_ingest", "pgvector", "chromadb"]),
            ConnectorDefinition("FEDEX", "logistics", bool(settings.fedex_api_base_url), ["FEDEX_API_BASE_URL"], ["shipments", "tracking", "labels"]),
            ConnectorDefinition("DHL", "logistics", bool(settings.dhl_api_base_url), ["DHL_API_BASE_URL"], ["shipments", "tracking", "labels"]),
            ConnectorDefinition("ODOO", "erp", bool(settings.odoo_api_base_url), ["ODOO_API_BASE_URL"], ["customers", "invoices", "inventory"]),
            ConnectorDefinition("SAP", "erp", bool(settings.sap_api_base_url), ["SAP_API_BASE_URL"], ["business_partner", "journal", "documents"]),
            ConnectorDefinition("EMAIL", "messaging", bool(settings.smtp_host), ["SMTP_HOST"], ["invoices", "alerts", "collections"]),
            ConnectorDefinition("WHATSAPP", "messaging", bool(settings.whatsapp_api_base_url), ["WHATSAPP_API_BASE_URL"], ["collections", "notifications"]),
            ConnectorDefinition("S3", "object_storage", bool(settings.s3_bucket), ["S3_BUCKET"], ["xml", "cdr", "pdf", "audit_evidence"]),
        ]

    def health(self) -> dict:
        connectors = self.list_connectors()
        return {
            "ready": [item.__dict__ for item in connectors if item.ready],
            "configuration_required": [item.__dict__ for item in connectors if not item.ready],
            "architecture": {
                "pattern": "ports_adapters_outbox",
                "delivery": ["retry", "dead_letter_queue", "circuit_breaker", "otel_tracing"],
                "secrets": settings.secrets_manager_uri or "env_or_platform_secret",
            },
        }
