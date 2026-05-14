import os

# Python 3.14 on Windows can hang while importing SQLAlchemy C extensions in some environments.
os.environ.setdefault("DISABLE_SQLALCHEMY_CEXT_RUNTIME", "1")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from src.api.routes.ai import router as ai_router
from src.api.routes.auth import router as auth_router
from src.api.routes.business_intelligence import router as bi_router
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
from src.config import settings
from src.infrastructure.observability.tracing import configure_tracing

def create_app() -> FastAPI:
    configure_tracing()
    app = FastAPI(
        title=settings.app_name,
        version="1.1.0",
        description="CONTA_PRO Enterprise Foundation API: ledger inmutable, SUNAT, reportes, IA, integraciones y workers.",
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
    FastAPIInstrumentor.instrument_app(app)
    return app

app = create_app()
