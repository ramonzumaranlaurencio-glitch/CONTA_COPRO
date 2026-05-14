# CONTA_PRO Enterprise Foundation

Foundation integrada para convertir CONTA_PRO en un ERP financiero enterprise: ledger inmutable, SUNAT, reportes, workers, IA, seguridad tenant-aware, observabilidad, frontend ERP y despliegue Docker/Kubernetes/Terraform.

## Arquitectura

- Backend FastAPI con DDD/hexagonal: `domain`, `application`, `infrastructure`, `api`.
- Ledger inmutable con HMAC-SHA256, hash encadenado, auditoria y tenant isolation por PostgreSQL RLS.
- Unit of Work, outbox, workers Celery, DLQ y circuit breaker.
- CQRS base: comandos de posting y consultas/reportes separados.
- IA Gemini-ready con pgvector-ready, RAG contable, anomaly detection y copilotos contextuales.
- Frontend React + Fluent UI con layout denso tipo SAP/Dynamics, master-detail, activity center y side panel IA.

## Modulos incluidos

- Core financiero: libro diario, libro mayor, balance, estado de resultados, flujo de caja, CXC/CXP, tesoreria, activos fijos, depreciacion, provisiones, diferencia de cambio, cierre anual, clase 8/9, centros de costo, multiempresa y multi-moneda.
- SUNAT Enterprise: UBL 2.1, validacion XML/XSD-ready, signer PFX-ready, SOAP adapter, OSE/PSE-ready, CDR parser, SIRE, PLE, notas credito/debito ready, detracciones, percepciones y retenciones.
- Seguridad: OAuth2/JWT base, PKCE-ready, refresh rotation model, RBAC/ABAC-ready, tenant isolation, audit logs inmutables y secrets-manager-ready.
- Integraciones: SUNAT, bancos, Gemini, FedEx/DHL, Odoo/SAP, correo, WhatsApp y S3 como puertos configurables.
- DevOps: Docker Compose, Kubernetes manifests, Terraform, Prometheus, Grafana, OpenTelemetry, staging/prod env examples.

## Ejecutar local

```bash
cp .env.example .env
docker compose up --build
alembic upgrade head
psql "$DATABASE_URL" -f scripts/seed_enterprise.sql
```

### Windows sin Docker

Si no tienes Docker disponible, puedes usar PostgreSQL local en Windows y automatizar el alta de base/migraciones/seed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_local_postgres_and_migrate.ps1
```

Parametros utiles:

- `-SuperUser` y `-SuperPassword` para credenciales del usuario administrador de PostgreSQL.
- `-AppUser`, `-AppPassword`, `-AppDatabase` para personalizar la base de la aplicacion.
- `-SkipSeed` si solo quieres crear esquema sin cargar datos iniciales.

API:

- `GET /health`
- `GET /openapi.json`
- `GET /metrics`
- `POST /api/v1/auth/dev-token`

Frontend:

```bash
npm install
npm run dev
```

## Gemini API key desde terminal

Para pegar tu clave directamente en terminal y persistirla en `.env`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set_gemini_api_key.ps1
```

Opcional, validar estado de configuracion contra API local:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set_gemini_api_key.ps1 -CheckApiStatus
```

Luego reinicia la API para que lea la nueva variable.

## Endpoints principales

- `POST /api/v1/ledger/journal`
- `POST /api/v1/ledger/invoice`
- `POST /api/v1/ledger/purchase-invoice`
- `GET /api/v1/ledger/journal`
- `POST /api/v1/ledger/integrity/scan`
- `POST /api/v1/finance/provisions`
- `POST /api/v1/finance/fixed-assets/depreciation`
- `POST /api/v1/finance/currency/fx-difference`
- `POST /api/v1/finance/annual-close`
- `GET /api/v1/reports/trial-balance`
- `GET /api/v1/reports/balance-sheet`
- `GET /api/v1/reports/income-statement`
- `GET /api/v1/reports/cash-flow`
- `GET /api/v1/reports/books/status?year=YYYY&month=MM`
- `POST /api/v1/reports/books/generate`
- `GET /api/v1/reports/books/download/{package_id}`
- `GET /api/v1/reports/general-ledger/{account_code}`
- `GET /api/v1/reports/accounts-receivable/aging`
- `GET /api/v1/reports/accounts-payable/aging`
- `GET /api/v1/tax/capabilities`
- `POST /api/v1/tax/ubl/invoice`
- `POST /api/v1/tax/ubl/credit-note`
- `POST /api/v1/tax/ubl/debit-note`
- `POST /api/v1/tax/ubl/validate`
- `POST /api/v1/tax/cdr/parse`
- `POST /api/v1/tax/sire/rvie`
- `POST /api/v1/tax/ple/daily-book`
- `POST /api/v1/tax/ple/general-ledger`
- `POST /api/v1/ai/audit/pre-closure`
- `POST /api/v1/ai/anomalies`
- `POST /api/v1/ai/copilot`
- `GET /api/v1/ai/config/status`
- `GET /api/v1/integrations/health`
- `GET /api/v1/integrations/connectors`

## Variables

Usa `.env.example` como base. Para ambientes:

- `config/.env.staging.example`
- `config/.env.prod.example`

Las conexiones reales requieren credenciales externas: SUNAT/OSE/PSE, PFX, Gemini, bancos, SAP/Odoo, FedEx/DHL, SMTP/WhatsApp y S3.

## Workers

```bash
celery -A src.infrastructure.workers.celery_app.celery_app worker -Q sunat --loglevel=INFO
celery -A src.infrastructure.workers.celery_app.celery_app worker -Q integrations,ai --loglevel=INFO
```

## Migraciones y seeds

- Base: `alembic/versions/001_enterprise_core.py`
- Expansion enterprise: `alembic/versions/002_enterprise_expansion.py`
- SQL directo: `sql/001_enterprise_core.sql`, `sql/002_enterprise_expansion.sql`
- Seed: `scripts/seed_enterprise.sql`

## Aplicar overlay a otro CONTA_PRO

```bash
python zp.py --target /ruta/a/CONTA_PRO
```

## Validacion

```bash
pytest
python -m compileall src tests
npm run build
```
