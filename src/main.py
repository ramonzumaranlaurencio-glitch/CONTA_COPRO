import os

# Python 3.14 on Windows puede colgarse importando extensiones C de SQLAlchemy.
os.environ.setdefault("DISABLE_SQLALCHEMY_CEXT_RUNTIME", "1")

# ── OTEL: deshabilitar el SDK si no hay colector configurado ──────────────
# Estas variables DEBEN estar en os.environ ANTES de cualquier import de
# opentelemetry, porque el SDK las lee en el momento de la importación.
# Los valores vienen del .env; si no están, se fuerzan a "none"/"true".
from src.config import settings as _settings  # importación mínima y segura
os.environ.setdefault("OTEL_SDK_DISABLED",        _settings.otel_sdk_disabled)
os.environ.setdefault("OTEL_TRACES_EXPORTER",     _settings.otel_traces_exporter)
os.environ.setdefault("OTEL_METRICS_EXPORTER",    _settings.otel_metrics_exporter)
os.environ.setdefault("OTEL_LOGS_EXPORTER",       _settings.otel_logs_exporter)
# Si hay endpoint configurado, reactivar el SDK automáticamente
if _settings.otel_exporter_otlp_endpoint:
    os.environ["OTEL_SDK_DISABLED"]     = "false"
    os.environ["OTEL_TRACES_EXPORTER"]  = "otlp"
    os.environ["OTEL_METRICS_EXPORTER"] = "otlp"
    os.environ["OTEL_LOGS_EXPORTER"]    = "otlp"
# ─────────────────────────────────────────────────────────────────────────

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor as _FastAPIInstrumentor
    _otel_available = True
except ImportError:
    _otel_available = False
from src.api.routes.ai import router as ai_router
from src.api.routes.auth import router as auth_router
from src.api.routes.business_intelligence import router as bi_router
from src.api.routes.events import router as events_router
from src.api.routes.finance import router as finance_router
from src.api.routes.health import router as health_router
from src.api.routes.hr import router as hr_router
from src.api.routes.integrations import router as integrations_router
from src.api.routes.inventory import router as inventory_router
from src.api.routes.ledger import router as ledger_router
from src.api.routes.ledger_engine_endpoint import router as ledger_engine_router
from src.api.routes.master_data import router as master_data_router
from src.api.routes.core_engine import router as core_engine_router
from src.api.routes.orchestrator import router as orchestrator_router
from src.api.routes.periods import router as periods_router
from src.api.routes.reports import router as reports_router
from src.api.routes.sales import router as sales_router
from src.api.routes.purchases import router as purchases_router
from src.api.routes.tax import router as tax_router
from src.api.routes.catalog import router as catalog_router
from src.config import settings
from src.infrastructure.events.dispatcher import get_dispatcher, register_default_handlers
from src.infrastructure.observability.tracing import configure_tracing


async def _apply_schema_patches() -> None:
    """Aplica columnas faltantes sin requerir migraciones Alembic completas."""
    from src.infrastructure.db.session import AsyncSessionLocal
    patches = [
        # kardex_movements: columnas añadidas al modelo pero aún no en BD
        "ALTER TABLE kardex_movements ADD COLUMN IF NOT EXISTS area VARCHAR(50)",
        "ALTER TABLE kardex_movements ADD COLUMN IF NOT EXISTS validated_by VARCHAR(100)",
        "ALTER TABLE kardex_movements ADD COLUMN IF NOT EXISTS notes TEXT",
        # warehouses: columnas adicionales del modelo
        "ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_type VARCHAR(30) DEFAULT 'GENERAL'",
        "ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
        "ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS capacity NUMERIC(18,6)",
        # products: columnas de catalogación
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS item_class VARCHAR(30) DEFAULT 'MERCADERIA'",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS token_type VARCHAR(20) DEFAULT 'PERMANENTE'",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS token_code VARCHAR(50)",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS area VARCHAR(50) DEFAULT 'ALMACEN'",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock NUMERIC(18,6) DEFAULT 0",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock NUMERIC(18,6) DEFAULT 0",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100)",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS specs TEXT",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_description TEXT",
    ]
    from sqlalchemy import text
    try:
        async with AsyncSessionLocal() as session:
            for sql in patches:
                try:
                    await session.execute(text(sql))
                except Exception:
                    pass  # columna ya existe u otro error no crítico
            await session.commit()
    except Exception:
        pass  # BD no disponible en arranque — ignorar


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Patches de esquema en background — no bloquea el arranque ni la health check
    asyncio.create_task(_apply_schema_patches())
    dispatcher = get_dispatcher()
    register_default_handlers(dispatcher)
    await dispatcher.start()
    try:
        yield
    finally:
        await dispatcher.stop()


def create_app() -> FastAPI:
    configure_tracing()
    app = FastAPI(
        title=settings.app_name,
        version="1.1.0",
        description="CONTA_PRO Enterprise Foundation API: ledger inmutable, SUNAT, reportes, IA, integraciones y workers.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(ledger_router, prefix="/api/v1")
    app.include_router(ledger_engine_router, prefix="/api/v1")
    app.include_router(bi_router, prefix="/api/v1")
    app.include_router(inventory_router, prefix="/api/v1")
    app.include_router(catalog_router,   prefix="/api/v1")
    app.include_router(master_data_router, prefix="/api/v1")
    app.include_router(periods_router, prefix="/api/v1")
    app.include_router(core_engine_router, prefix="/api/v1")
    app.include_router(orchestrator_router, prefix="/api/v1")
    app.include_router(sales_router, prefix="/api/v1")
    app.include_router(purchases_router, prefix="/api/v1")
    app.include_router(finance_router, prefix="/api/v1")
    app.include_router(reports_router, prefix="/api/v1")
    app.include_router(tax_router, prefix="/api/v1")
    app.include_router(ai_router, prefix="/api/v1")
    app.include_router(hr_router, prefix="/api/v1")
    app.include_router(integrations_router, prefix="/api/v1")
    app.include_router(events_router, prefix="/api/v1")
    # Instrumentar FastAPI con OTEL solo si hay un colector configurado
    # Sin endpoint configurado, el instrumentador intenta exportar a localhost:4317
    # y genera "StatusCode.UNAVAILABLE" en los logs sin parar.
    if _otel_available and settings.otel_exporter_otlp_endpoint:
        _FastAPIInstrumentor.instrument_app(app)
    return app

app = create_app()
