# SUNAT Enterprise

## Flujo

1. Generar UBL 2.1 con `POST /api/v1/tax/ubl/invoice`.
2. Validar XML con `POST /api/v1/tax/ubl/validate`.
3. Postear factura con `POST /api/v1/ledger/invoice`.
4. `ExpertAccountingGuard` valida RUC/CPE en tiempo real si `SUNAT_RUC_LOOKUP_URL` o `SUNAT_CPE_LOOKUP_URL` estan configurados.
5. El outbox crea evento `sunat.invoice.post`.
6. Worker `sunat` firma con PFX y entrega por SOAP.
7. La respuesta CDR se parsea con `POST /api/v1/tax/cdr/parse`.

## Ready adapters

- XSD bundle: configurar `SUNAT_XSD_DIR`.
- PFX: configurar `P12_CERT_PATH` y `P12_CERT_PASSWORD`.
- SUNAT/OSE/PSE: configurar endpoints por ambiente.
- RUC/CPE realtime guard: configurar `SUNAT_RUC_LOOKUP_URL`, `SUNAT_CPE_LOOKUP_URL` y opcionalmente `SUNAT_LOOKUP_TOKEN`.
- SIRE: `POST /api/v1/tax/sire/rvie`.
- PLE: `POST /api/v1/tax/ple/daily-book` y `POST /api/v1/tax/ple/general-ledger`.

## Impuestos

Los comandos contables soportan detracciones, percepciones y retenciones en el asiento de venta y documento financiero.

## Verificacion realtime

- Endpoint manual: `POST /api/v1/tax/sunat/realtime-verify`.
- El guard bloquea RUC no `ACTIVO`, condicion `NO HABIDO` y comprobante `ANULADO`/rechazado.
- Si el servicio externo no esta configurado, el guard deja evidencia `SUNAT_REALTIME_AVAILABLE` y no bloquea, salvo `SUNAT_GUARD_BLOCK_ON_UNAVAILABLE=true`.

## Modificacion / anulacion con proposito

- Lookup de documentos posteados: `GET /api/v1/ledger/documents/lookup?direction=AR&q=F001-8422` para ventas y `direction=AP` para compras.
- Validacion previa: `POST /api/v1/ledger/documents/modification/validate`.
- El validador registra auditoria, exige justificacion suficiente, alerta si cambia RUC/monto y genera borrador de Nota de Credito cuando el periodo esta declarado o el plazo operativo esta vencido.
