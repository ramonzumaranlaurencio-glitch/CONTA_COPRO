# Smoke Matrix Report

- Timestamp UTC: 2026-05-11T03:05:46.119620+00:00
- Base URL: http://127.0.0.1:8000/api/v1
- Tenant: 11111111-1111-1111-1111-111111111111
- Total checks: 15
- Passed: 15
- Failed: 0

| Module | Check | Result | HTTP | Detail |
|---|---|---|---:|---|
| Auth | dev-token | PASS | 200 | Token generado |
| Reports | financial-pack comparative | PASS | 200 | comparison block completo |
| Reports | financial-pack xlsx | PASS | 200 | XLSX valido |
| Reports | financial-pack pdf | PASS | 200 | PDF valido |
| Books | status | PASS | 200 | Estado de fuentes |
| Books | generate | PASS | 200 | package_id=eb455c85-c051-4d0d-820b-eefe78fdd00f |
| Books | history | PASS | 200 | Historial consultado |
| Books | submit-sunat | PASS | 200 | 73aa6c6d-a50a-47b1-95af-eba2397b235e |
| Inventory | exit with cogs | PASS | 200 | cost_entry generado |
| Treasury | import statement | PASS | 200 | Importado |
| Treasury | auto-match | PASS | 200 | Auto-match ejecutado |
| SUNAT | queue-status | PASS | 200 | Estado de cola |
| SUNAT | dlq | PASS | 200 | DLQ consultada |
| Integrations | ops-status | PASS | 200 | Integraciones consultadas |
| AI | config-status | PASS | 200 | gemini_configured=True |
