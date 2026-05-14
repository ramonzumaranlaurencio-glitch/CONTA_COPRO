CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    sku varchar(80) NOT NULL,
    name text NOT NULL,
    unit_of_measure varchar(20) NOT NULL DEFAULT 'NIU',
    default_cost numeric(18,6) NOT NULL DEFAULT 0,
    default_sales_account varchar(20),
    default_cost_account varchar(20),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS warehouses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    code varchar(80) NOT NULL,
    name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS kardex_movements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    product_id uuid NOT NULL REFERENCES products(id),
    warehouse_id uuid NOT NULL REFERENCES warehouses(id),
    movement_type varchar(10) NOT NULL,
    qty numeric(18,6) NOT NULL,
    unit_cost numeric(18,6) NOT NULL,
    balance_qty numeric(18,6) NOT NULL,
    balance_avg_cost numeric(18,6) NOT NULL,
    movement_reference varchar(120) NOT NULL,
    source_document varchar(120),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, movement_reference)
);

CREATE TABLE IF NOT EXISTS inventory_balances (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    product_id uuid NOT NULL REFERENCES products(id),
    warehouse_id uuid NOT NULL REFERENCES warehouses(id),
    balance_qty numeric(18,6) NOT NULL DEFAULT 0,
    balance_avg_cost numeric(18,6) NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, product_id, warehouse_id)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE kardex_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_products ON products;
DROP POLICY IF EXISTS tenant_warehouses ON warehouses;
DROP POLICY IF EXISTS tenant_kardex_movements ON kardex_movements;
DROP POLICY IF EXISTS tenant_inventory_balances ON inventory_balances;

CREATE POLICY tenant_products ON products
USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_warehouses ON warehouses
USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_kardex_movements ON kardex_movements
USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY tenant_inventory_balances ON inventory_balances
USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE INDEX IF NOT EXISTS idx_products_tenant_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant_code ON warehouses(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_kardex_tenant_product_wh_created ON kardex_movements(tenant_id, product_id, warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_tenant_product_wh ON inventory_balances(tenant_id, product_id, warehouse_id);
