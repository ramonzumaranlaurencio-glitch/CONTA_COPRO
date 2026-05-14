CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_name text NOT NULL,
    ruc varchar(11) NOT NULL UNIQUE,
    status varchar(20) NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    email text NOT NULL,
    password_hash text,
    role varchar(50) NOT NULL DEFAULT 'ACCOUNTANT',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_clients (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    client_id text NOT NULL UNIQUE,
    redirect_uri text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    user_id uuid NOT NULL REFERENCES users(id),
    token_hash text NOT NULL UNIQUE,
    revoked_at timestamptz,
    replaced_by_token_hash text,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_periods (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    year integer NOT NULL,
    month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
    status varchar(20) NOT NULL DEFAULT 'OPEN',
    is_closed boolean NOT NULL DEFAULT false,
    closed_at timestamptz,
    closed_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, year, month)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    period_id uuid NOT NULL REFERENCES accounting_periods(id),
    entry_date date NOT NULL,
    description text NOT NULL,
    source_module varchar(40) NOT NULL DEFAULT 'ACCOUNTING',
    source_id text,
    currency char(3) NOT NULL DEFAULT 'PEN',
    total_debit numeric(18,2) NOT NULL,
    total_credit numeric(18,2) NOT NULL,
    previous_hash text NOT NULL,
    row_hash text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'POSTED',
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (total_debit = total_credit)
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    account_code varchar(20) NOT NULL,
    account_name text,
    debit numeric(18,2) NOT NULL DEFAULT 0,
    credit numeric(18,2) NOT NULL DEFAULT 0,
    cost_center varchar(80),
    project_code varchar(80),
    partner_ruc varchar(11),
    document_type varchar(4),
    document_series varchar(10),
    document_number varchar(30),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (debit >= 0),
    CHECK (credit >= 0),
    CHECK (NOT (debit > 0 AND credit > 0)),
    CHECK (debit > 0 OR credit > 0)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    trace_id text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    before_state jsonb,
    after_state jsonb,
    actor_user_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    topic text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    payload jsonb NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    next_retry_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS dead_letter_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    source_event_id uuid,
    topic text NOT NULL,
    aggregate_id text,
    payload jsonb NOT NULL,
    reason text NOT NULL,
    ai_diagnosis jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS integrity_alerts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    entry_id uuid,
    severity varchar(20) NOT NULL,
    message text NOT NULL,
    expected_hash text,
    actual_hash text,
    trace_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_embeddings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    content text NOT NULL,
    metadata_json jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_users ON users;
DROP POLICY IF EXISTS tenant_oauth_clients ON oauth_clients;
DROP POLICY IF EXISTS tenant_refresh_tokens ON refresh_tokens;
DROP POLICY IF EXISTS tenant_periods ON accounting_periods;
DROP POLICY IF EXISTS tenant_entries ON journal_entries;
DROP POLICY IF EXISTS tenant_lines ON journal_lines;
DROP POLICY IF EXISTS tenant_audit ON audit_logs;
DROP POLICY IF EXISTS tenant_outbox ON outbox_events;
DROP POLICY IF EXISTS tenant_dlq ON dead_letter_events;
DROP POLICY IF EXISTS tenant_integrity ON integrity_alerts;
DROP POLICY IF EXISTS tenant_embeddings ON accounting_embeddings;

CREATE POLICY tenant_users ON users USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_oauth_clients ON oauth_clients USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_refresh_tokens ON refresh_tokens USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_periods ON accounting_periods USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_entries ON journal_entries USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_lines ON journal_lines USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_audit ON audit_logs USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_outbox ON outbox_events USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_dlq ON dead_letter_events USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_integrity ON integrity_alerts USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_embeddings ON accounting_embeddings USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_periods_tenant_year_month ON accounting_periods(tenant_id, year, month);
CREATE INDEX IF NOT EXISTS idx_entries_tenant_created ON journal_entries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_source ON journal_entries(tenant_id, source_module, source_id);
CREATE INDEX IF NOT EXISTS idx_lines_entry ON journal_lines(tenant_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(tenant_id, status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_logs(tenant_id, trace_id);
