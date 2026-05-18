import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Field, Input } from '@fluentui/react-components';

type Product = {
  id: string;
  sku: string;
  name: string;
  unit_of_measure: string;
  default_cost?: string;
};

type Warehouse = {
  id: string;
  code: string;
  name: string;
};

type KardexRow = {
  id: string;
  movement_type: string;
  qty: string;
  unit_cost: string;
  balance_qty: string;
  balance_avg_cost: string;
  movement_reference: string;
  source_document?: string;
  created_at?: string;
};

type Props = {
  apiBase: string;
  token: string;
  tenantId: string;
  onStatus: (message: string) => void;
  onJournalPosted?: () => void | Promise<void>;
};

type MovementForm = {
  product_id: string;
  warehouse_id: string;
  movement_type: 'ENTRY' | 'EXIT';
  qty: string;
  unit_cost: string;
  movement_reference: string;
  source_document: string;
};

const defaultMovement: MovementForm = {
  product_id: '',
  warehouse_id: '',
  movement_type: 'ENTRY',
  qty: '1',
  unit_cost: '0',
  movement_reference: `MOV-${Date.now()}`,
  source_document: '',
};

export const InventoryDashboard = ({ apiBase, token, tenantId, onStatus, onJournalPosted }: Props) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [kardex, setKardex] = useState<KardexRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [newProduct, setNewProduct] = useState({ sku: '', name: '', unit_of_measure: 'NIU', default_cost: '0' });
  const [newWarehouse, setNewWarehouse] = useState({ code: '', name: '' });
  const [movement, setMovement] = useState<MovementForm>(defaultMovement);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
    'Content-Type': 'application/json',
  }), [tenantId, token]);

  const loadProducts = async () => {
    const response = await fetch(`${apiBase}/inventory/products?limit=300`, { headers });
    if (!response.ok) {
      throw new Error('No se pudo cargar productos');
    }
    const data = await response.json() as Product[];
    setProducts(data);
  };

  const loadWarehouses = async () => {
    const response = await fetch(`${apiBase}/inventory/warehouses?limit=100`, { headers });
    if (!response.ok) {
      throw new Error('No se pudo cargar almacenes');
    }
    const data = await response.json() as Warehouse[];
    setWarehouses(data);
  };

  const loadKardex = async (productId: string, warehouseId?: string) => {
    if (!productId) {
      setKardex([]);
      return;
    }
    const query = new URLSearchParams({ limit: '200' });
    if (warehouseId) {
      query.set('warehouse_id', warehouseId);
    }
    const response = await fetch(`${apiBase}/inventory/kardex/${productId}?${query.toString()}`, { headers });
    if (!response.ok) {
      throw new Error('No se pudo cargar kardex');
    }
    const data = await response.json() as KardexRow[];
    setKardex(data);
  };

  const reloadAll = async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      await Promise.all([loadProducts(), loadWarehouses()]);
      onStatus('Inventario sincronizado con API.');
    } catch {
      onStatus('No se pudo sincronizar modulo de inventario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, [token]);

  useEffect(() => {
    if (movement.product_id) {
      loadKardex(movement.product_id, movement.warehouse_id || undefined).catch(() => {
        onStatus('No se pudo cargar kardex del producto seleccionado.');
      });
    }
  }, [movement.product_id, movement.warehouse_id]);

  const createProduct = async () => {
    if (!newProduct.sku || !newProduct.name) {
      onStatus('SKU y nombre son obligatorios para crear producto.');
      return;
    }
    const response = await fetch(`${apiBase}/inventory/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        sku: newProduct.sku,
        name: newProduct.name,
        unit_of_measure: newProduct.unit_of_measure || 'NIU',
        default_cost: Number.parseFloat(newProduct.default_cost || '0'),
      }),
    });

    if (!response.ok) {
      onStatus('No se pudo crear producto.');
      return;
    }

    setNewProduct({ sku: '', name: '', unit_of_measure: 'NIU', default_cost: '0' });
    await loadProducts();
    onStatus('Producto creado correctamente.');
  };

  const createWarehouse = async () => {
    if (!newWarehouse.code || !newWarehouse.name) {
      onStatus('Codigo y nombre son obligatorios para crear almacen.');
      return;
    }

    const response = await fetch(`${apiBase}/inventory/warehouses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        code: newWarehouse.code,
        name: newWarehouse.name,
      }),
    });

    if (!response.ok) {
      onStatus('No se pudo crear almacen.');
      return;
    }

    setNewWarehouse({ code: '', name: '' });
    await loadWarehouses();
    onStatus('Almacen creado correctamente.');
  };

  const registerMovement = async () => {
    if (!movement.product_id || !movement.warehouse_id) {
      onStatus('Selecciona producto y almacen para registrar movimiento.');
      return;
    }

    const response = await fetch(`${apiBase}/inventory/movements`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        product_id: movement.product_id,
        warehouse_id: movement.warehouse_id,
        movement_type: movement.movement_type,
        qty: Number.parseFloat(movement.qty || '0'),
        unit_cost: Number.parseFloat(movement.unit_cost || '0'),
        movement_reference: movement.movement_reference,
        source_document: movement.source_document || null,
        post_cost_entry: true,
        cost_center: 'INV-OPS',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      onStatus(`No se pudo registrar movimiento: ${errorText.slice(0, 120)}`);
      return;
    }

    setMovement((prev) => ({
      ...prev,
      qty: '1',
      movement_reference: `MOV-${Date.now()}`,
      source_document: '',
    }));
    const payload = await response.json();
    await loadKardex(movement.product_id, movement.warehouse_id);
    if (payload?.cost_entry?.entry_id) {
      await onJournalPosted?.();
      onStatus(`Movimiento registrado, kardex actualizado y asiento ${String(payload.cost_entry.entry_id).slice(0, 8)} grabado en Libro Diario.`);
    } else {
      onStatus('Movimiento registrado y kardex actualizado.');
    }
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <strong>Inventario productivo</strong>
        <Badge appearance="filled">Productos: {products.length}</Badge>
        <Badge appearance="filled">Almacenes: {warehouses.length}</Badge>
        <Button appearance="secondary" onClick={reloadAll} disabled={loading || !token}>Refrescar</Button>
      </div>

      <section className="glass-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <strong>Crear producto</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 120px 120px 120px', gap: 8 }}>
          <Field label="SKU"><Input value={newProduct.sku} onChange={(_, d) => setNewProduct((p) => ({ ...p, sku: d.value }))} /></Field>
          <Field label="Nombre"><Input value={newProduct.name} onChange={(_, d) => setNewProduct((p) => ({ ...p, name: d.value }))} /></Field>
          <Field label="Unidad"><Input value={newProduct.unit_of_measure} onChange={(_, d) => setNewProduct((p) => ({ ...p, unit_of_measure: d.value }))} /></Field>
          <Field label="Costo"><Input value={newProduct.default_cost} onChange={(_, d) => setNewProduct((p) => ({ ...p, default_cost: d.value }))} /></Field>
          <Button appearance="primary" onClick={createProduct}>Crear</Button>
        </div>
      </section>

      <section className="glass-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <strong>Crear almacen</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 120px', gap: 8 }}>
          <Field label="Codigo"><Input value={newWarehouse.code} onChange={(_, d) => setNewWarehouse((w) => ({ ...w, code: d.value }))} /></Field>
          <Field label="Nombre"><Input value={newWarehouse.name} onChange={(_, d) => setNewWarehouse((w) => ({ ...w, name: d.value }))} /></Field>
          <Button appearance="primary" onClick={createWarehouse}>Crear</Button>
        </div>
      </section>

      <section className="glass-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
        <strong>Registrar movimiento</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 120px 120px 1fr 140px', gap: 8 }}>
          <Field label="Producto">
            <select value={movement.product_id} onChange={(e) => setMovement((m) => ({ ...m, product_id: e.target.value }))}>
              <option value="">Seleccionar</option>
              {products.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}
            </select>
          </Field>

          <Field label="Almacen">
            <select value={movement.warehouse_id} onChange={(e) => setMovement((m) => ({ ...m, warehouse_id: e.target.value }))}>
              <option value="">Seleccionar</option>
              {warehouses.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
            </select>
          </Field>

          <Field label="Tipo">
            <select value={movement.movement_type} onChange={(e) => setMovement((m) => ({ ...m, movement_type: e.target.value as 'ENTRY' | 'EXIT' }))}>
              <option value="ENTRY">ENTRY</option>
              <option value="EXIT">EXIT</option>
            </select>
          </Field>

          <Field label="Cantidad"><Input value={movement.qty} onChange={(_, d) => setMovement((m) => ({ ...m, qty: d.value }))} /></Field>
          <Field label="Costo"><Input value={movement.unit_cost} onChange={(_, d) => setMovement((m) => ({ ...m, unit_cost: d.value }))} /></Field>
          <Field label="Referencia"><Input value={movement.movement_reference} onChange={(_, d) => setMovement((m) => ({ ...m, movement_reference: d.value }))} /></Field>
          <Button appearance="primary" onClick={registerMovement}>Registrar</Button>
        </div>
      </section>

      <section className="glass-card" style={{ padding: 12 }}>
        <strong>Kardex</strong>
        <div style={{ marginTop: 8, overflow: 'auto', maxHeight: 340 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Fecha</th>
                <th style={{ textAlign: 'left' }}>Tipo</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th style={{ textAlign: 'right' }}>Costo</th>
                <th style={{ textAlign: 'right' }}>Saldo Cant</th>
                <th style={{ textAlign: 'right' }}>Saldo Costo</th>
                <th style={{ textAlign: 'left' }}>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {kardex.map((row) => (
                <tr key={row.id}>
                  <td>{row.created_at?.slice(0, 10) || '-'}</td>
                  <td>{row.movement_type}</td>
                  <td style={{ textAlign: 'right' }}>{row.qty}</td>
                  <td style={{ textAlign: 'right' }}>{row.unit_cost}</td>
                  <td style={{ textAlign: 'right' }}>{row.balance_qty}</td>
                  <td style={{ textAlign: 'right' }}>{row.balance_avg_cost}</td>
                  <td>{row.movement_reference}</td>
                </tr>
              ))}
              {!kardex.length && (
                <tr>
                  <td colSpan={7}>Sin movimientos para el filtro actual.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
