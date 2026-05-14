CREATE TABLE IF NOT EXISTS hr_workers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    worker_code varchar(40) NOT NULL,
    nombres text NOT NULL,
    apellidos text NOT NULL,
    dni varchar(8) NOT NULL,
    fecha_nacimiento date,
    fecha_inicio_contrato date,
    fecha_fin_contrato date,
    direccion_domicilio text,
    direccion_reniec text,
    telefono varchar(30),
    email text,
    profesion text,
    experiencia text,
    estudios_realizados text,
    cargo_postulado text NOT NULL,
    sueldo_pactado numeric(18,2) NOT NULL DEFAULT 0,
    habilidades_clave jsonb NOT NULL DEFAULT '[]',
    cv_metadata jsonb NOT NULL DEFAULT '{}',
    compliance_status varchar(20) NOT NULL DEFAULT 'REVIEW',
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, dni)
);

CREATE TABLE IF NOT EXISTS hr_contracts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    worker_id uuid NOT NULL,
    contract_type varchar(80) NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'DRAFT',
    legal_basis jsonb NOT NULL DEFAULT '{}',
    contract_text text NOT NULL,
    pdf_base64 text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hr_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_hr_workers ON hr_workers;
DROP POLICY IF EXISTS tenant_hr_contracts ON hr_contracts;

CREATE POLICY tenant_hr_workers ON hr_workers USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY tenant_hr_contracts ON hr_contracts USING (tenant_id = current_setting('app.current_tenant', true)::uuid) WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_hr_workers_tenant_dni ON hr_workers(tenant_id, dni);
CREATE INDEX IF NOT EXISTS idx_hr_workers_tenant_cargo ON hr_workers(tenant_id, cargo_postulado);
CREATE INDEX IF NOT EXISTS idx_hr_contracts_worker ON hr_contracts(tenant_id, worker_id, created_at DESC);
