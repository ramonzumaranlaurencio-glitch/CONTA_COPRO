# Arquitectura CONTA_PRO Enterprise

## Capas

- `domain`: entidades, invariantes contables y modelos persistentes.
- `application`: casos de uso, DTOs, reportes, SUNAT, IA e integraciones.
- `infrastructure`: SQLAlchemy, workers, adapters externos, seguridad, observabilidad.
- `api`: routers FastAPI versionados.
- `frontend`: React/Vite + Fluent UI.

## Flujo contable

1. Un comando crea asiento o documento.
2. `LedgerPostingService` valida periodo, balance debe/haber y tenant.
3. Se calcula `previous_hash` + `row_hash`.
4. Se persisten entry, lines, audit log y outbox en una Unit of Work.
5. Workers procesan SUNAT, integraciones o auditoria IA.
6. DLQ conserva fallos con diagnostico para reproceso.

## Tesoreria

- `POST /api/v1/finance/accounts-receivable/apply-payment` genera cobranza automatica con debe 104 y haber 1212.
- `POST /api/v1/finance/accounts-payable/apply-payment` genera pago automatico con debe 4212 y haber 104.
- `POST /api/v1/finance/treasury/auto-match` puede reconciliar extractos y crear asientos si hay cuenta bancaria y periodo abierto.
- Los flujos devuelven alertas cuando el documento tiene retencion o detraccion pendiente de sustento.

## Tenant isolation

PostgreSQL RLS usa `app.current_tenant`, seteado por `UnitOfWork`. Las tablas financieras, fiscales, IA e integraciones tienen politicas por `tenant_id`.

## Puertos externos

Los conectores externos viven detras de adapters:

- SUNAT SOAP + UBL + CDR.
- Gemini.
- RAG legal con pgvector o ChromaDB (`/api/v1/ai/rag/legal-documents/batch`, `/api/v1/ai/rag/query`).
- Bancos.
- Odoo/SAP.
- FedEx/DHL.
- Email/WhatsApp.
- S3.

Las credenciales no se codifican en el repo; se leen desde `.env`, secretos de Kubernetes o secrets manager.
