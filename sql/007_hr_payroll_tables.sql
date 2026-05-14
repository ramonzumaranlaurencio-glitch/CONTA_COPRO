ALTER TABLE hr_workers
    ADD COLUMN cuenta_bancaria varchar(20),
    ADD COLUMN cci varchar(20),
    ADD COLUMN tipo_seguro varchar(10) NOT NULL DEFAULT 'ONP',
    ADD COLUMN estado_laboral varchar(20) NOT NULL DEFAULT 'ACTIVO',
    ADD COLUMN ruta_cv_pdf varchar(255);

CREATE TABLE IF NOT EXISTS libro_diario (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    fecha_asiento date NOT NULL,
    glosa text NOT NULL,
    total_debe numeric(18,2) NOT NULL,
    total_haber numeric(18,2) NOT NULL,
    tipo_asiento varchar(50),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detalle_asiento (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    asiento_id uuid NOT NULL REFERENCES libro_diario(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    cuenta_contable varchar(10) NOT NULL,
    denominacion text,
    monto numeric(18,2) NOT NULL,
    tipo_movimiento char(1) NOT NULL CHECK (tipo_movimiento IN ('D', 'H')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provisiones_sociales (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    company_id uuid,
    trabajador_id uuid NOT NULL REFERENCES hr_workers(id),
    periodo_mes varchar(7) NOT NULL,
    monto_cts numeric(18,2) NOT NULL DEFAULT 0,
    monto_gratificacion numeric(18,2) NOT NULL DEFAULT 0,
    monto_vacaciones numeric(18,2) NOT NULL DEFAULT 0,
    estado_pago varchar(20) NOT NULL DEFAULT 'PENDIENTE',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE libro_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE detalle_asiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisiones_sociales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_libro_diario ON libro_diario;
DROP POLICY IF EXISTS tenant_detalle_asiento ON detalle_asiento;
DROP POLICY IF EXISTS tenant_provisiones_sociales ON provisiones_sociales;

CREATE POLICY tenant_libro_diario ON libro_diario
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_detalle_asiento ON detalle_asiento
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_provisiones_sociales ON provisiones_sociales
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_hr_workers_dni ON hr_workers(dni);
CREATE INDEX IF NOT EXISTS idx_fecha_asiento ON libro_diario(fecha_asiento);
CREATE INDEX IF NOT EXISTS idx_provisiones_trabajador_periodo ON provisiones_sociales(trabajador_id, periodo_mes);
