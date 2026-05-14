from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CONTA_PRO Enterprise"
    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://contapro:contapro@localhost:5432/contapro"
    redis_url: str = "redis://localhost:6379/0"
    ledger_hmac_secret: str = "change-this-secret-min-32-chars"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-pro"
    expert_accounting_enabled: bool = True
    document_ai_provider: str = "layoutlmv3"
    rag_vector_provider: str = "pgvector"
    rag_corpus_sources: str = "TUO_LIR,CODIGO_TRIBUTARIO,MANUAL_SUNAT,GUIA_INFRACCIONES,DL_728,DL_1057"
    rag_embedding_dimensions: int = 768
    chroma_persist_directory: str = "./.chroma"
    chroma_collection_name: str = "contapro_legal_docs"
    sunat_endpoint: str | None = None
    sunat_ose_endpoint: str | None = None
    sunat_pse_endpoint: str | None = None
    sunat_ruc_lookup_url: str | None = None
    sunat_cpe_lookup_url: str | None = None
    sunat_lookup_token: str | None = None
    sunat_realtime_guard_enabled: bool = True
    sunat_guard_block_on_unavailable: bool = False
    sunat_realtime_timeout_seconds: float = 3.0
    sunat_ruc: str | None = None
    sunat_sol_user: str | None = None
    sunat_sol_password: str | None = None
    sunat_xsd_dir: str | None = None
    p12_cert_path: str | None = None
    p12_cert_password: str | None = None
    bank_api_base_url: str | None = None
    odoo_api_base_url: str | None = None
    sap_api_base_url: str | None = None
    fedex_api_base_url: str | None = None
    dhl_api_base_url: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_use_tls: bool = True
    whatsapp_api_base_url: str | None = None
    s3_bucket: str | None = None
    secrets_manager_uri: str | None = None
    otel_exporter_otlp_endpoint: str | None = None

settings = Settings()
