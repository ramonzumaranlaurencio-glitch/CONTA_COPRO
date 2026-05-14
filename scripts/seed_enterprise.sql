INSERT INTO tenants (id, legal_name, ruc, status)
VALUES ('11111111-1111-1111-1111-111111111111', 'CONTA PRO DEMO SAC', '20600000001', 'ACTIVE')
ON CONFLICT (ruc) DO NOTHING;

SELECT set_config('app.current_tenant', '11111111-1111-1111-1111-111111111111', true);

INSERT INTO companies (id, tenant_id, legal_name, trade_name, ruc, base_currency, sunat_environment)
VALUES ('21111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'CONTA PRO DEMO SAC', 'CONTA_PRO', '20600000001', 'PEN', 'BETA')
ON CONFLICT (tenant_id, ruc) DO NOTHING;

INSERT INTO users (id, tenant_id, email, role, is_active)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'admin@contapro.local', 'ADMIN', true)
ON CONFLICT DO NOTHING;

INSERT INTO accounting_periods (tenant_id, year, month, status, is_closed)
SELECT '11111111-1111-1111-1111-111111111111', 2026, month, 'OPEN', false
FROM generate_series(1, 12) AS month
ON CONFLICT (tenant_id, year, month) DO NOTHING;

INSERT INTO chart_accounts (tenant_id, company_id, code, name, account_class, statement, nature, accepts_cost_center, accepts_partner)
VALUES
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '1011', 'Caja', '1', 'BALANCE', 'DEBIT', false, false),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '1041', 'Cuentas corrientes operativas', '1', 'BALANCE', 'DEBIT', false, false),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '1212', 'Cuentas por cobrar comerciales', '1', 'BALANCE', 'DEBIT', true, true),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '4011', 'IGV por pagar', '4', 'BALANCE', 'CREDIT', false, true),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '4212', 'Cuentas por pagar comerciales', '4', 'BALANCE', 'CREDIT', true, true),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '591', 'Resultados acumulados', '5', 'BALANCE', 'CREDIT', false, false),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '676', 'Diferencia de cambio perdida', '6', 'RESULTS', 'DEBIT', true, true),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '681', 'Depreciacion', '6', 'RESULTS', 'DEBIT', true, false),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '7011', 'Ventas gravadas', '7', 'RESULTS', 'CREDIT', true, true),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '891', 'Determinacion del resultado', '8', 'CLOSING', 'DEBIT', false, false),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', '901', 'Centro de costos operativo', '9', 'ANALYTICS', 'DEBIT', true, false)
ON CONFLICT (tenant_id, company_id, code) DO NOTHING;

INSERT INTO cost_centers (tenant_id, company_id, code, name)
VALUES
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'LIM-COM', 'Comercial Lima'),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'FIN-TES', 'Tesoreria'),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'TI-CORE', 'Plataforma Core')
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO business_partners (tenant_id, company_id, partner_type, document_type, document_number, legal_name, email)
VALUES
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'CUSTOMER', '6', '20555555555', 'Cliente Enterprise SAC', 'compras@cliente.test'),
('11111111-1111-1111-1111-111111111111', '21111111-1111-1111-1111-111111111111', 'SUPPLIER', '6', '20444444444', 'Proveedor Estrategico SAC', 'facturas@proveedor.test')
ON CONFLICT (tenant_id, document_type, document_number) DO NOTHING;
