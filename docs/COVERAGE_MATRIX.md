# Coverage Matrix and E2E Flows

## Scope
This matrix tracks module coverage, interconnection status, and end-to-end flow validation for operational readiness.

Legend:
- COMPLETE: implemented and validated by tests or runtime smoke.
- PARTIAL: implemented, but missing full E2E coverage.
- PENDING: not implemented or not validated.

## Module Matrix

| Module | Core Tables / Services | API Routes | Frontend | Automated E2E | Status |
|---|---|---|---|---|---|
| Authentication and Context | tenant context, dev token | auth routes | tenant bootstrap | contract + runtime smoke | COMPLETE |
| Ledger Core | journal entries, journal lines, hash chain | ledger routes | accounting workspace | tests for hash/integration registry + runtime smoke | COMPLETE |
| Financial Reports | trial balance, balance sheet, income statement, cash flow, financial pack | reports routes | FinancialDashboard | E2E export + pack tests | COMPLETE |
| Books Package | sales, purchases, treasury, inventory balances | reports books routes | BooksCenter | runtime smoke + contract tests | COMPLETE |
| Inventory with COGS posting | products, warehouses, movements, balances | inventory routes | InventoryDashboard | runtime smoke for ENTRY/EXIT+COGS | COMPLETE |
| Treasury Reconciliation | treasury movements import/match | finance routes | integrated via workspace panels | runtime smoke + contract tests | COMPLETE |
| SUNAT Monitoring and Retry | submissions queue, retry/reprocess, DLQ | tax routes | SunatMonitor | runtime smoke + contract tests | COMPLETE |
| Integrations Ops | connector status and queue stats | integrations routes | monitoring panels | runtime smoke | COMPLETE |
| Payroll / Audit UI utilities | UI controls and placeholders | n/a | payroll and audit views | button interaction checks | PARTIAL |

## E2E Flow Checklist

1. Financial comparative pack API
- Endpoint: GET /api/v1/reports/financial-pack
- Covers: trial balance, balance, income, cash flow, ratios, comparison block.
- Validation: test_reports_exports_e2e.py

2. XLSX professional export
- Endpoint: GET /api/v1/reports/financial-pack/xlsx
- Covers: multi-sheet workbook (Resumen, Balance, Resultados, Flujo, Ratios), table styles, chart.
- Validation: test_reports_exports_e2e.py

3. PDF backend export
- Endpoint: GET /api/v1/reports/financial-pack/pdf
- Covers: backend-generated PDF document with financial comparative tables.
- Validation: test_reports_exports_e2e.py

4. Books generation and package submit
- Endpoints: /reports/books/status, /reports/books/generate, /reports/books/download/{id}, /reports/books/packages/{id}/submit-sunat
- Validation: runtime smoke and contract tests.

5. Inventory EXIT with automatic COGS journal entry
- Endpoint: POST /api/v1/inventory/movements with post_cost_entry=true
- Validation: runtime smoke with 200 response and cost_entry payload.

6. SUNAT queue operations
- Endpoints: queue-status, retry, reprocess, dlq
- Validation: runtime smoke and contract tests.

## Current Conclusion
Core accounting/reporting flows are complete for controlled production rollout, including backend XLSX/PDF exports and full comparative dashboard data consistency. Remaining PARTIAL areas are non-critical UI utility modules not part of legal accounting closing pipeline.
