-- 1. Extensiones para seguridad y UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de empresas (tenants)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruc VARCHAR(11) UNIQUE NOT NULL,
    razon_social TEXT NOT NULL,
    regimen_tributario VARCHAR(50),
    config_json JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Plan de cuentas (PCGE)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    code VARCHAR(20) NOT NULL,
    name TEXT NOT NULL,
    level INTEGER,
    type VARCHAR(20),
    UNIQUE(tenant_id, code)
);

-- 4. Ledger inmutable
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    date DATE NOT NULL,
    glosa TEXT NOT NULL,
    previous_hash TEXT,
    current_hash TEXT,
    sunat_state VARCHAR(20) DEFAULT 'PENDIENTE',
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Detalle de asientos
CREATE TABLE IF NOT EXISTS journal_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL,
    debit DECIMAL(18, 2) DEFAULT 0,
    credit DECIMAL(18, 2) DEFAULT 0,
    cost_center VARCHAR(50),
    document_ref TEXT
);

-- 6. Activos fijos
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    description TEXT,
    purchase_date DATE,
    cost DECIMAL(18, 2),
    depreciation_rate DECIMAL(5, 2),
    accumulated_depreciation DECIMAL(18, 2) DEFAULT 0
);

-- 7. Tabla de periodos para cierre
CREATE TABLE IF NOT EXISTS monthly_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    master_hash TEXT,
    closed_at TIMESTAMP,
    UNIQUE (tenant_id, month, year)
);

-- 8. Politica de seguridad para cliente (rol CLIENT)
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_read_only ON journal_entries;
CREATE POLICY client_read_only ON journal_entries
FOR SELECT
USING (
  tenant_id::text = current_setting('app.current_tenant', true)
  AND current_setting('app.user_role', true) = 'CLIENT'
);

-- 9. Trigger que impide cambios en periodos cerrados
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM monthly_periods
        WHERE tenant_id = NEW.tenant_id
          AND month = EXTRACT(MONTH FROM NEW.date)
          AND year = EXTRACT(YEAR FROM NEW.date)
          AND status = 'CLOSED'
    ) THEN
        RAISE EXCEPTION 'ERROR CRITICO: El periodo contable ya esta CERRADO y firmado.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_journal_entries ON journal_entries;
CREATE TRIGGER trg_lock_journal_entries
BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION check_period_lock();
