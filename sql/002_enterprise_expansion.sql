ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS company_id uuid;

CREATE TABLE IF NOT EXISTS companies (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    legal_name text NOT NULL,
    trade_name text,
    ruc varchar(11) NOT NULL,
    base_currency char(3) NOT NULL DEFAULT 'PEN',
    sunat_environment varchar(20) NOT NULL DEFAULT 'BETA',
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, ruc)
);

CREATE TABLE IF NOT EXISTS chart_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    code varchar(20) NOT NULL,
    name text NOT NULL,
    account_class varchar(2) NOT NULL,
    statement varchar(40) NOT NULL,
    nature varchar(10) NOT NULL,
    accepts_cost_center boolean NOT NULL DEFAULT false,
    accepts_partner boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, company_id, code)
);

CREATE TABLE IF NOT EXISTS cost_centers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    code varchar(80) NOT NULL,
    name text NOT NULL,
    parent_code varchar(80),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS currency_rates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    rate_date date NOT NULL,
    from_currency char(3) NOT NULL,
    to_currency char(3) NOT NULL DEFAULT 'PEN',
    buy_rate numeric(18,6) NOT NULL,
    sell_rate numeric(18,6) NOT NULL,
    source varchar(40) NOT NULL DEFAULT 'SUNAT',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, rate_date, from_currency, to_currency)
);

CREATE TABLE IF NOT EXISTS business_partners (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    partner_type varchar(20) NOT NULL,
    document_type varchar(4) NOT NULL DEFAULT '6',
    document_number varchar(20) NOT NULL,
    legal_name text NOT NULL,
    email text,
    phone text,
    address text,
    risk_score numeric(5,2),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, document_type, document_number)
);

CREATE TABLE IF NOT EXISTS financial_documents (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    partner_id uuid,
    direction varchar(10) NOT NULL,
    document_type varchar(4) NOT NULL,
    series varchar(10) NOT NULL,
    number varchar(30) NOT NULL,
    issue_date date NOT NULL,
    due_date date,
    currency char(3) NOT NULL DEFAULT 'PEN',
    exchange_rate numeric(18,6),
    taxable_amount numeric(18,2) NOT NULL DEFAULT 0,
    tax_amount numeric(18,2) NOT NULL DEFAULT 0,
    exempt_amount numeric(18,2) NOT NULL DEFAULT 0,
    total_amount numeric(18,2) NOT NULL DEFAULT 0,
    balance_amount numeric(18,2) NOT NULL DEFAULT 0,
    detraccion_amount numeric(18,2) NOT NULL DEFAULT 0,
    percepcion_amount numeric(18,2) NOT NULL DEFAULT 0,
    retencion_amount numeric(18,2) NOT NULL DEFAULT 0,
    journal_entry_id uuid,
    sunat_status varchar(20) NOT NULL DEFAULT 'PENDING',
    cdr_status varchar(20),
    cdr_description text,
    xml_hash text,
    metadata_json jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, document_type, series, number, direction)
);

CREATE TABLE IF NOT EXISTS treasury_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    bank_code varchar(20) NOT NULL,
    account_number varchar(40) NOT NULL,
    currency char(3) NOT NULL DEFAULT 'PEN',
    ledger_account_code varchar(20) NOT NULL,
    current_balance numeric(18,2) NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS treasury_movements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    treasury_account_id uuid NOT NULL,
    movement_date date NOT NULL,
    movement_type varchar(20) NOT NULL,
    amount numeric(18,2) NOT NULL,
    currency char(3) NOT NULL DEFAULT 'PEN',
    reference text,
    partner_id uuid,
    financial_document_id uuid,
    journal_entry_id uuid,
    reconciliation_status varchar(20) NOT NULL DEFAULT 'OPEN',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fixed_assets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    code varchar(40) NOT NULL,
    name text NOT NULL,
    asset_class varchar(40) NOT NULL,
    acquisition_date date NOT NULL,
    acquisition_cost numeric(18,2) NOT NULL,
    residual_value numeric(18,2) NOT NULL DEFAULT 0,
    useful_life_months integer NOT NULL,
    depreciation_method varchar(30) NOT NULL DEFAULT 'STRAIGHT_LINE',
    accumulated_depreciation numeric(18,2) NOT NULL DEFAULT 0,
    ledger_asset_account varchar(20) NOT NULL DEFAULT '33',
    ledger_depreciation_account varchar(20) NOT NULL DEFAULT '391',
    ledger_expense_account varchar(20) NOT NULL DEFAULT '681',
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS depreciation_runs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    year integer NOT NULL,
    month integer NOT NULL,
    total_amount numeric(18,2) NOT NULL DEFAULT 0,
    journal_entry_id uuid,
    status varchar(20) NOT NULL DEFAULT 'POSTED',
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provisions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    provision_type varchar(40) NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    amount numeric(18,2) NOT NULL,
    debit_account varchar(20) NOT NULL,
    credit_account varchar(20) NOT NULL,
    journal_entry_id uuid,
    status varchar(20) NOT NULL DEFAULT 'POSTED',
    metadata_json jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS annual_closing_runs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    fiscal_year integer NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'DRAFT',
    class_8_9_result jsonb NOT NULL DEFAULT '{}',
    generated_entries jsonb NOT NULL DEFAULT '{}',
    audit_summary jsonb NOT NULL DEFAULT '{}',
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tax_determinations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    year integer NOT NULL,
    month integer NOT NULL,
    sales_base numeric(18,2) NOT NULL DEFAULT 0,
    purchase_base numeric(18,2) NOT NULL DEFAULT 0,
    output_igv numeric(18,2) NOT NULL DEFAULT 0,
    input_igv numeric(18,2) NOT NULL DEFAULT 0,
    igv_payable numeric(18,2) NOT NULL DEFAULT 0,
    detracciones numeric(18,2) NOT NULL DEFAULT 0,
    percepciones numeric(18,2) NOT NULL DEFAULT 0,
    retenciones numeric(18,2) NOT NULL DEFAULT 0,
    status varchar(20) NOT NULL DEFAULT 'CALCULATED',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sunat_submissions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    financial_document_id uuid,
    submission_type varchar(30) NOT NULL,
    endpoint_type varchar(20) NOT NULL DEFAULT 'SUNAT',
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    ticket text,
    xml_hash text,
    cdr_code text,
    cdr_description text,
    raw_response jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_connectors (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    provider varchar(40) NOT NULL,
    connector_type varchar(40) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'CONFIG_REQUIRED',
    base_url text,
    secret_ref text,
    capabilities jsonb NOT NULL DEFAULT '{}',
    last_healthcheck_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integration_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    connector_provider varchar(40) NOT NULL,
    topic text NOT NULL,
    payload jsonb NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_closing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_determinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sunat_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_companies ON companies;
DROP POLICY IF EXISTS tenant_chart_accounts ON chart_accounts;
DROP POLICY IF EXISTS tenant_cost_centers ON cost_centers;
DROP POLICY IF EXISTS tenant_currency_rates ON currency_rates;
DROP POLICY IF EXISTS tenant_business_partners ON business_partners;
DROP POLICY IF EXISTS tenant_financial_documents ON financial_documents;
DROP POLICY IF EXISTS tenant_treasury_accounts ON treasury_accounts;
DROP POLICY IF EXISTS tenant_treasury_movements ON treasury_movements;
DROP POLICY IF EXISTS tenant_fixed_assets ON fixed_assets;
DROP POLICY IF EXISTS tenant_depreciation_runs ON depreciation_runs;
DROP POLICY IF EXISTS tenant_provisions ON provisions;
DROP POLICY IF EXISTS tenant_annual_closing_runs ON annual_closing_runs;
DROP POLICY IF EXISTS tenant_tax_determinations ON tax_determinations;
DROP POLICY IF EXISTS tenant_sunat_submissions ON sunat_submissions;
DROP POLICY IF EXISTS tenant_integration_connectors ON integration_connectors;
DROP POLICY IF EXISTS tenant_integration_messages ON integration_messages;

CREATE POLICY tenant_companies ON companies USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_chart_accounts ON chart_accounts USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_cost_centers ON cost_centers USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_currency_rates ON currency_rates USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_business_partners ON business_partners USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_financial_documents ON financial_documents USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_treasury_accounts ON treasury_accounts USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_treasury_movements ON treasury_movements USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_fixed_assets ON fixed_assets USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_depreciation_runs ON depreciation_runs USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_provisions ON provisions USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_annual_closing_runs ON annual_closing_runs USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_tax_determinations ON tax_determinations USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_sunat_submissions ON sunat_submissions USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_integration_connectors ON integration_connectors USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_integration_messages ON integration_messages USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id, ruc);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_tenant_code ON chart_accounts(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant_code ON cost_centers(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_currency_rates_lookup ON currency_rates(tenant_id, rate_date, from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_partners_tenant_doc ON business_partners(tenant_id, document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_status ON financial_documents(tenant_id, direction, sunat_status, issue_date);
CREATE INDEX IF NOT EXISTS idx_documents_aging ON financial_documents(tenant_id, direction, balance_amount, due_date);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_account ON treasury_movements(tenant_id, treasury_account_id, movement_date);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_tenant_code ON fixed_assets(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_sunat_submissions_status ON sunat_submissions(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_integration_messages_status ON integration_messages(tenant_id, status, created_at);

CREATE OR REPLACE FUNCTION prevent_immutable_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Immutable ledger/audit table cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_update_journal_entries ON journal_entries;
DROP TRIGGER IF EXISTS trg_no_delete_journal_entries ON journal_entries;
DROP TRIGGER IF EXISTS trg_no_update_journal_lines ON journal_lines;
DROP TRIGGER IF EXISTS trg_no_delete_journal_lines ON journal_lines;
DROP TRIGGER IF EXISTS trg_no_update_audit_logs ON audit_logs;
DROP TRIGGER IF EXISTS trg_no_delete_audit_logs ON audit_logs;

CREATE TRIGGER trg_no_update_journal_entries BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER trg_no_delete_journal_entries BEFORE DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER trg_no_update_journal_lines BEFORE UPDATE ON journal_lines FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER trg_no_delete_journal_lines BEFORE DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER trg_no_update_audit_logs BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
CREATE TRIGGER trg_no_delete_audit_logs BEFORE DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();
