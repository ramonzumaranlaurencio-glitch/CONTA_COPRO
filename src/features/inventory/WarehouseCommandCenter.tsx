/**
 * WarehouseCommandCenter — Sistema experto de gestión de almacén
 * Multi-empresa · Multi-rubro · PCGE Perú · NIC 2
 * Clasificación basada en catálogo maestro con cuentas contables
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALOG, RUBROS_DEF, PCGE_INVENTARIO, PCGE_GASTO,
  getCatalogByRubro, matchCatalogItem, generateNextCode, getCtasForRubro,
  type Rubro, type CatalogItem,
} from '../../config/itemCatalog';
import { useTenantStore } from '../../hooks/useTenantStore';

// ============================================================
// TIPOS
// ============================================================
type ItemClass =
  | 'MATERIA_PRIMA'
  | 'MERCADERIA'
  | 'HERRAMIENTAS'
  | 'INSUMOS'
  | 'CONSUMIBLE'
  | 'ACTIVO_FIJO';

type TokenType = 'PERMANENTE' | 'TEMPORAL';
type Area = 'ALMACEN' | 'PRODUCCION' | 'OBRA' | 'ADMINISTRACION' | 'MANTENIMIENTO';
type MovType = 'ENTRY' | 'EXIT' | 'ADJUST' | 'TRANSFER';

interface WarehouseItem {
  id: string;
  sku: string;
  token_code: string;
  name: string;
  detail_description?: string;
  item_class: ItemClass;
  token_type: TokenType;
  area: Area;
  unit_of_measure: string;
  default_cost: number;
  default_sales_account?: string;
  default_cost_account?: string;
  min_stock: number;
  max_stock: number;
  brand?: string;
  specs?: string;
  location?: string;
  is_active: boolean;
  warehouse_id?: string;
  warehouse_code?: string;
  warehouse_name?: string;
  balance_qty: number;
  balance_avg_cost: number;
  balance_value: number;
  created_at?: string;
}

interface Movement {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: MovType;
  qty: number;
  unit_cost: number;
  balance_qty: number;
  balance_avg_cost: number;
  movement_reference: string;
  source_document?: string;
  area?: string;
  validated_by?: string;
  notes?: string;
  created_at: string;
}

interface PendingPurchase {
  id: string;
  purchase_ref: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  token_code?: string;
  item_class: ItemClass;
  area: Area;
  qty: number;
  unit_cost: number;
  total: number;
  supplier_name: string;
  supplier_ruc?: string;
  doc_date: string;
  doc_series: string;
  doc_number: string;
  doc_type?: string;          // '01' factura, '09' guía remisión
  unit?: string;
  account_code?: string;
  cost_center?: string;
  entry_id?: string;
  source_doc?: string;
  source_module?: string;
  ai_reason?: string;
  catalog_code?: string;
  catalog_nat?: string;
  catalog_rub?: string;
  catalog_tk?: string;
  catalog_match?: boolean;
  gasto_account?: string;
  checked: boolean;
}

type AssignStatus = 'ASIGNADO' | 'DEVUELTO' | 'VENCIDO';

interface ToolAssignment {
  id: string;
  tool_id: string;
  tool_code: string;
  tool_name: string;
  worker_name: string;
  worker_doc: string;       // DNI / código trabajador
  project: string;
  area: Area;
  assigned_date: string;
  expected_return: string;
  actual_return?: string;
  status: AssignStatus;
  condition_out: string;    // 'BUENO' | 'REGULAR' | 'MALO'
  condition_in?: string;
  notes?: string;
  // Token temporal de asignación — único por asignación activa
  asg_token: string;        // ASG-{tool_code}-{worker_doc}-{YYYYMMDD}
  hours_assigned?: number;  // Horas totales de uso (calculado al devolver)
  started_at?: string;      // ISO timestamp de entrega
  returned_at?: string;     // ISO timestamp de devolución
}

interface DispatchItem {
  id: string;
  product_id: string;
  token_code: string;
  product_name: string;
  item_class: ItemClass;
  area: Area;
  qty_available: number;
  qty_to_dispatch: number;
  unit: string;
  unit_cost: number;
  destination: string;      // cliente / proyecto / área destino
  reference: string;        // OT / pedido / guía
  checked: boolean;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
  warehouse_type: string;
}

interface ItemFormData {
  id?: string;
  sku: string;
  token_code: string;
  name: string;
  detail_description: string;
  item_class: ItemClass;
  token_type: TokenType;
  area: Area;
  unit_of_measure: string;
  default_cost: string;
  default_sales_account: string;
  default_cost_account: string;
  min_stock: string;
  max_stock: string;
  brand: string;
  specs: string;
  location: string;
  is_active: boolean;
}

interface Filters {
  search: string;
  item_class: string;
  area: string;
  token_type: string;
  warehouse: string;
  active_only: boolean;
  date_from: string;
  date_to: string;
}

// ============================================================
// CONSTANTES
// ============================================================
const CLASS_LABEL: Record<ItemClass, string> = {
  MATERIA_PRIMA: 'Materia Prima',
  MERCADERIA:    'Mercadería',
  HERRAMIENTAS:  'Herramientas',
  INSUMOS:       'Insumos',
  CONSUMIBLE:    'Consumible',
  ACTIVO_FIJO:   'Activo Fijo',
};

const CLASS_COLOR: Record<ItemClass, string> = {
  MATERIA_PRIMA: '#3b82f6',
  MERCADERIA:    '#22c55e',
  HERRAMIENTAS:  '#f97316',
  INSUMOS:       '#a855f7',
  CONSUMIBLE:    '#eab308',
  ACTIVO_FIJO:   '#ef4444',
};

const CLASS_PREFIX: Record<ItemClass, string> = {
  MATERIA_PRIMA: 'MP',
  MERCADERIA:    'ME',
  HERRAMIENTAS:  'HE',
  INSUMOS:       'IN',
  CONSUMIBLE:    'CO',
  ACTIVO_FIJO:   'AF',
};

const AREA_PREFIX: Record<Area, string> = {
  ALMACEN:       'ALM',
  PRODUCCION:    'PRO',
  OBRA:          'OBR',
  ADMINISTRACION:'ADM',
  MANTENIMIENTO: 'MAN',
};

const AREA_LABEL: Record<Area, string> = {
  ALMACEN:       'Almacén General',
  PRODUCCION:    'Producción',
  OBRA:          'Obra',
  ADMINISTRACION:'Administración',
  MANTENIMIENTO: 'Mantenimiento',
};

const UNITS = ['NIU', 'KGM', 'MTR', 'LTR', 'BOL', 'UND', 'CAJ', 'PAR', 'JGO', 'TON', 'M2', 'M3', 'GLN', 'BAR', 'PZA'];

const CLASSES: ItemClass[] = ['MATERIA_PRIMA', 'MERCADERIA', 'HERRAMIENTAS', 'INSUMOS', 'CONSUMIBLE', 'ACTIVO_FIJO'];
const AREAS: Area[] = ['ALMACEN', 'PRODUCCION', 'OBRA', 'ADMINISTRACION', 'MANTENIMIENTO'];

// ============================================================
// DATOS DEMO (construcción / industria)
// ============================================================
// Motivos de salida — constante a nivel módulo (no dentro del componente)
const EXIT_REASONS = [
  { code: 'CONSUMO',          label: 'Consumo / Uso operativo',            icon: '🔄', color: '#58a6ff' },
  { code: 'PRODUCCION',       label: 'Uso en producción',                  icon: '🏭', color: '#3fb950' },
  { code: 'VENTA',            label: 'Salida por venta',                   icon: '💰', color: '#a371f7' },
  { code: 'BAJA_DESGASTE',    label: 'Baja por desgaste',                  icon: '🔨', color: '#d29922' },
  { code: 'BAJA_ANTIGUEDAD',  label: 'Baja por antigüedad/obsolescencia',  icon: '🗓', color: '#d29922' },
  { code: 'BAJA_VENCIMIENTO', label: 'Baja por vencimiento/caducidad',     icon: '⏰', color: '#d29922' },
  { code: 'BAJA_PERDIDA',     label: 'Baja por pérdida/extravío',          icon: '🔍', color: '#f85149' },
  { code: 'BAJA_ROBO',        label: 'Baja por robo/sustracción',          icon: '🚨', color: '#f85149' },
  { code: 'BAJA_SINIESTRO',   label: 'Baja por siniestro/desastre',        icon: '⚡', color: '#f85149' },
  { code: 'DEVOLUCION',       label: 'Devolución a proveedor',             icon: '↩', color: '#58a6ff'  },
  { code: 'AJUSTE',           label: 'Ajuste de inventario',               icon: '⚖', color: '#8b949e'  },
  { code: 'OTRO',             label: 'Otro motivo',                        icon: '📝', color: '#8b949e'  },
] as const;

// Tablas vacías — el usuario ingresa sus propios datos
const DEMO_ITEMS: WarehouseItem[] = [];
const DEMO_MOVEMENTS: Movement[] = [];
const DEMO_PENDING: PendingPurchase[] = [];
const DEMO_WAREHOUSES: Warehouse[] = [];
const DEMO_TOOL_ASSIGNMENTS: ToolAssignment[] = [];
const DEMO_DISPATCH: DispatchItem[] = [];

// ============================================================
// HELPERS
// ============================================================
const fmt = (n: number, dec = 2) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('es-PE'); } catch { return iso; }
};

const fmtDateTime = (iso: string) => {
  try { return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
};

function generateCode(cls: ItemClass, area: Area, seq: number, tokenType: TokenType): string {
  const c = CLASS_PREFIX[cls];
  const a = AREA_PREFIX[area];
  const suffix = tokenType === 'TEMPORAL' ? '-T' : '';
  return `${c}-${a}-${String(seq).padStart(4, '0')}${suffix}`;
}

function stockStatus(qty: number, min: number, max: number): 'critical' | 'low' | 'ok' | 'high' {
  if (min === 0 && max === 0) return 'ok';
  if (qty <= 0) return 'critical';
  if (qty < min) return 'low';
  if (max > 0 && qty > max) return 'high';
  return 'ok';
}

// ============================================================
// ESTILOS INLINE (tema oscuro enterprise)
// ============================================================
const C = {
  bg:       '#0d1117',
  bgCard:   '#161b22',
  bgRow:    '#1c2128',
  bgRowAlt: '#1a1f27',
  bgHover:  '#21262d',
  bgSel:    '#1f3a5f',
  border:   '#30363d',
  borderFoc:'#388bfd',
  text:     '#e6edf3',
  textMut:  '#8b949e',
  textDim:  '#6e7681',
  accent:   '#58a6ff',
  accentG:  '#3fb950',
  accentR:  '#f85149',
  accentY:  '#d29922',
  accentO:  '#db6d28',
  header:   '#010409',
  topbar:   '#161b22',
};

const MODAL_OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const btn = (variant: 'primary' | 'danger' | 'ghost' | 'warning' | 'success'): React.CSSProperties => {
  const base: React.CSSProperties = {
    border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5,
    transition: 'opacity .15s', fontFamily: "'Segoe UI', sans-serif",
  };
  if (variant === 'primary')  return { ...base, background: '#1f6feb', color: '#fff' };
  if (variant === 'danger')   return { ...base, background: '#da3633', color: '#fff' };
  if (variant === 'warning')  return { ...base, background: '#d29922', color: '#000' };
  if (variant === 'success')  return { ...base, background: '#238636', color: '#fff' };
  return { ...base, background: 'transparent', color: C.accent, border: `1px solid ${C.border}` };
};

const inputStyle: React.CSSProperties = {
  background: C.bgRow, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text,
  padding: '6px 10px', fontSize: 13, width: '100%', fontFamily: "'Segoe UI', sans-serif",
  outline: 'none',
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: C.textMut, textTransform: 'uppercase',
  letterSpacing: '0.06em', display: 'block', marginBottom: 4,
};

// ============================================================
// SUB-COMPONENTES
// ============================================================

function ClassBadge({ cls }: { cls: ItemClass }) {
  return (
    <span style={{
      background: CLASS_COLOR[cls] + '22', color: CLASS_COLOR[cls],
      border: `1px solid ${CLASS_COLOR[cls]}55`, borderRadius: 4,
      padding: '2px 7px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {CLASS_PREFIX[cls]} · {CLASS_LABEL[cls]}
    </span>
  );
}

function TokenBadge({ type }: { type: TokenType }) {
  const perm = type === 'PERMANENTE';
  return (
    <span style={{
      border: `1px solid ${perm ? '#3fb950' : '#d29922'}`,
      borderStyle: perm ? 'solid' : 'dashed',
      color: perm ? '#3fb950' : '#d29922',
      borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700,
    }}>
      {perm ? '● PERM' : '◌ TEMP'}
    </span>
  );
}

function StockBar({ qty, min, max }: { qty: number; min: number; max: number }) {
  const st = stockStatus(qty, min, max);
  const color = st === 'critical' ? C.accentR : st === 'low' ? C.accentO : st === 'high' ? C.accentY : C.accentG;
  const pct = max > 0 ? Math.min(100, (qty / max) * 100) : 50;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 60 }}>
      <span style={{ color, fontWeight: 700, fontSize: 13 }}>{fmt(qty, 0)}</span>
      {(min > 0 || max > 0) && (
        <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
        </div>
      )}
    </div>
  );
}

function MovTypeIcon({ type }: { type: MovType }) {
  if (type === 'ENTRY')    return <span style={{ color: '#3fb950', fontWeight: 700 }}>▲ ENT</span>;
  if (type === 'EXIT')     return <span style={{ color: '#f85149', fontWeight: 700 }}>▼ SAL</span>;
  if (type === 'ADJUST')   return <span style={{ color: '#d29922', fontWeight: 700 }}>≈ AJU</span>;
  return                          <span style={{ color: '#58a6ff', fontWeight: 700 }}>⇄ TRF</span>;
}

// ============================================================
// MODAL CRUD
// ============================================================
function ItemModal({
  mode, form, onFormChange, onSave, onDelete, onToggleActive, onClose, warehouses, nextSeq,
}: {
  mode: 'CREATE' | 'EDIT';
  form: ItemFormData;
  onFormChange: (f: ItemFormData) => void;
  onSave: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onClose: () => void;
  warehouses: Warehouse[];
  nextSeq: number;
}) {
  const set = (k: keyof ItemFormData, v: unknown) => onFormChange({ ...form, [k as string]: v });

  const handleClassOrAreaChange = (k: 'item_class' | 'area' | 'token_type', v: string) => {
    const updated = { ...form, [k]: v };
    // Auto-regenerar token_code solo en CREATE
    if (mode === 'CREATE') {
      const code = generateCode(updated.item_class as ItemClass, updated.area as Area, nextSeq, updated.token_type as TokenType);
      updated.token_code = code;
      updated.sku = code;
    }
    onFormChange(updated);
  };

  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 };
  const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 };

  return (
    <div style={MODAL_OVERLAY} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
        width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto',
        padding: 28, color: C.text, fontFamily: "'Segoe UI', sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.accent }}>
              {mode === 'CREATE' ? '+ Nuevo Artículo de Almacén' : '✏ Modificar Artículo'}
            </h2>
            {form.token_code && (
              <span style={{ fontSize: 13, color: C.textMut, fontFamily: 'monospace' }}>
                Código: <strong style={{ color: C.text }}>{form.token_code}</strong>
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ ...btn('ghost'), padding: '4px 10px' }}>✕ Cerrar</button>
        </div>

        {/* Sección 1: Clasificación */}
        <div style={{ marginBottom: 20, padding: 16, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '0.08em' }}>
            ① CLASIFICACIÓN Y CÓDIGO DE ALMACÉN
          </p>
          <div style={row3}>
            <div>
              <label style={labelStyle}>Clase *</label>
              <select style={selectStyle} value={form.item_class} onChange={e => handleClassOrAreaChange('item_class', e.target.value)}>
                {CLASSES.map(c => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Área *</label>
              <select style={selectStyle} value={form.area} onChange={e => handleClassOrAreaChange('area', e.target.value)}>
                {AREAS.map(a => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo de Token</label>
              <select style={selectStyle} value={form.token_type} onChange={e => handleClassOrAreaChange('token_type', e.target.value)}>
                <option value="PERMANENTE">● Permanente</option>
                <option value="TEMPORAL">◌ Temporal</option>
              </select>
            </div>
          </div>
          <div style={{ ...row2, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Código Token (auto-generado)</label>
              <input style={{ ...inputStyle, fontFamily: 'monospace', background: '#0d1117', color: C.accent, fontWeight: 700 }}
                value={form.token_code} onChange={e => set('token_code', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>SKU / Código Interno</label>
              <input style={inputStyle} value={form.sku} onChange={e => set('sku', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Sección 2: Datos del artículo */}
        <div style={{ marginBottom: 20, padding: 16, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '0.08em' }}>
            ② DATOS DEL ARTÍCULO
          </p>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nombre / Descripción Corta *</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Cemento Portland Tipo I x 42.5 kg" />
          </div>
          <div style={row3}>
            <div>
              <label style={labelStyle}>Unidad de Medida</label>
              <select style={selectStyle} value={form.unit_of_measure} onChange={e => set('unit_of_measure', e.target.value)}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Marca / Fabricante</label>
              <input style={inputStyle} value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Ej: PACASMAYO" />
            </div>
            <div>
              <label style={labelStyle}>Ubicación Física</label>
              <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Rack A / Pasillo 2 / Nivel 3" />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Especificaciones Técnicas</label>
            <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' as const }}
              value={form.specs} onChange={e => set('specs', e.target.value)}
              placeholder="Medidas, capacidad, norma técnica, características..." />
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Descripción Detallada</label>
            <textarea style={{ ...inputStyle, height: 50, resize: 'vertical' as const }}
              value={form.detail_description} onChange={e => set('detail_description', e.target.value)}
              placeholder="Notas adicionales para el almacenero..." />
          </div>
        </div>

        {/* Sección 3: Stock y Costos */}
        <div style={{ marginBottom: 20, padding: 16, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '0.08em' }}>
            ③ STOCK Y COSTOS
          </p>
          <div style={row3}>
            <div>
              <label style={labelStyle}>Costo Unitario (S/)</label>
              <input style={inputStyle} type="number" step="0.01" value={form.default_cost}
                onChange={e => set('default_cost', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Stock Mínimo (alerta)</label>
              <input style={inputStyle} type="number" step="1" value={form.min_stock}
                onChange={e => set('min_stock', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Stock Máximo (capacidad)</label>
              <input style={inputStyle} type="number" step="1" value={form.max_stock}
                onChange={e => set('max_stock', e.target.value)} />
            </div>
          </div>
          <div style={{ ...row3, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Cta. Inventario (Haber)</label>
              <input style={inputStyle} value={form.default_cost_account} onChange={e => set('default_cost_account', e.target.value)} placeholder="2011" />
            </div>
            <div>
              <label style={labelStyle}>Cta. Costo de Ventas</label>
              <input style={inputStyle} value={form.default_sales_account} onChange={e => set('default_sales_account', e.target.value)} placeholder="6911" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label style={{ ...labelStyle, marginBottom: 10 }}>Estado del Artículo</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <span style={{ fontSize: 13, color: form.is_active ? C.accentG : C.accentR, fontWeight: 600 }}>
                  {form.is_active ? '● Activo' : '○ Inactivo'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {mode === 'EDIT' && (
              <>
                <button style={btn('danger')} onClick={onDelete}>🗑 Eliminar</button>
                <button style={btn('warning')} onClick={onToggleActive}>
                  {form.is_active ? '⊘ Desactivar' : '✓ Activar'}
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn('ghost')} onClick={onClose}>Cancelar</button>
            <button style={btn('success')} onClick={onSave}>
              {mode === 'CREATE' ? '✓ Crear Artículo' : '✓ Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
interface Props {
  apiBase?: string;
  token?: string;
  tenantId?: string;
  onStatus?: (msg: string) => void;
  onJournalPosted?: () => void;
}

const EMPTY_FORM: ItemFormData = {
  sku: '', token_code: '', name: '', detail_description: '', item_class: 'MERCADERIA',
  token_type: 'PERMANENTE', area: 'ALMACEN', unit_of_measure: 'NIU', default_cost: '0',
  default_sales_account: '6911', default_cost_account: '2011',
  min_stock: '0', max_stock: '0', brand: '', specs: '', location: '', is_active: true,
};

export default function WarehouseCommandCenter({ apiBase = '/api/v1', token = '', tenantId = '', onStatus, onJournalPosted }: Props) {
  const [items, setItems] = useState<WarehouseItem[]>(DEMO_ITEMS);
  const [movements, setMovements] = useState<Movement[]>(DEMO_MOVEMENTS);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(DEMO_WAREHOUSES);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>(DEMO_PENDING);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [movTab, setMovTab] = useState<'ALL' | 'ENTRY' | 'EXIT'>('ALL');
  const [purchaseOpen, setPurchaseOpen] = useState(true);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [form, setForm] = useState<ItemFormData>(EMPTY_FORM);
  const [filters, setFilters] = useState<Filters>({
    search: '', item_class: '', area: '', token_type: '', warehouse: '', active_only: true, date_from: '', date_to: '',
  });
  const [subView, setSubView] = useState<string>('stock');
  const [toolAssignments, setToolAssignments] = useState<ToolAssignment[]>(DEMO_TOOL_ASSIGNMENTS);
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>(DEMO_DISPATCH);
  const [toolForm, setToolForm] = useState(() => {
    const ret = new Date(); ret.setHours(ret.getHours() + 8);
    return { tool_id: '', worker_name: '', worker_doc: '', project: '', area: 'OBRA' as Area, expected_return: ret.toISOString(), hours: '8', condition_out: 'BUENO', notes: '' };
  });
  // Estados para Devolución de Herramientas (deben ser top-level — Rules of Hooks)
  const [selectedWorkerKey, setSelectedWorkerKey] = useState<string | null>(null);
  // Catálogo PCGE / Rubro
  const tenantStore = useTenantStore();
  const [activeRubro, setActiveRubro] = useState<Rubro>(tenantStore.currentCompany.rubro ?? 'GE');
  const [catalogFilter, setCatalogFilter] = useState({ cta: '', nat: '', tk: '', search: '' });
  const [catalogRubroSetup, setCatalogRubroSetup] = useState(false);
  const [returnCondition, setReturnCondition] = useState<Record<string, string>>({});
  const [returnChecked, setReturnChecked] = useState<Set<string>>(new Set());
  const [dispatchRef, setDispatchRef] = useState({ reference: '', destination: '', notes: '' });
  const tableRef = useRef<HTMLDivElement>(null);

  // ── Estados para vista Salidas/Bajas (hoisted — Rules of Hooks) ──────────
  const [exitForm, setExitForm] = useState({
    product_id: '', qty: '1', exit_reason: 'CONSUMO', notes: '', doc_ref: '',
  });
  const [exitLoading, setExitLoading] = useState(false);
  const [exitMsg, setExitMsg]     = useState('');

  // ── Estados para reporte Por Cuenta PCGE ─────────────────────────────────
  const [acctData, setAcctData]       = useState<any>(null);
  const [acctLoading, setAcctLoading] = useState(false);
  const [acctExpanded, setAcctExpanded] = useState<Set<string>>(new Set());

  const say = (msg: string) => onStatus?.(msg);

  // ── fetch data ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!token || !tenantId) return;
    setLoading(true);
    try {
      const hdrs = { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId };
      const [balRes, movRes, whRes, pendingRes] = await Promise.all([
        fetch(`${apiBase}/inventory/balances`, { headers: hdrs }),
        fetch(`${apiBase}/inventory/movements?limit=300`, { headers: hdrs }),
        fetch(`${apiBase}/inventory/warehouses`, { headers: hdrs }),
        fetch(`${apiBase}/inventory/pending-purchases?limit=100`, { headers: hdrs }),
      ]);
      // Siempre reemplazar con datos reales del backend (limpia estado local sucio)
      if (balRes.ok)  { const d = await balRes.json();  if (Array.isArray(d)) setItems(d); }
      if (movRes.ok)  { const d = await movRes.json();  if (Array.isArray(d)) setMovements(d); }
      if (whRes.ok)   { const d = await whRes.json();   if (Array.isArray(d) && d.length) setWarehouses(d); }
      if (pendingRes.ok) {
        const d = await pendingRes.json();
        if (Array.isArray(d) && d.length) {
          // Mapear el formato del backend al formato del frontend
          const mapped: PendingPurchase[] = d.map((p: any) => ({
            id:            p.id,
            purchase_ref:  p.purchase_ref,
            product_id:    p.product_id,
            product_name:  p.product_name,
            sku:           p.sku || '',
            token_code:    p.token_code || '',
            item_class:    (p.item_class as ItemClass) || 'MERCADERIA',
            area:          (p.area as Area) || 'ALMACEN',
            qty:           parseFloat(p.qty) || 0,
            unit_cost:     parseFloat(p.unit_cost) || 0,
            total:         parseFloat(p.total) || 0,
            supplier_name: p.supplier_name || '',
            supplier_ruc:  p.supplier_ruc || '',
            doc_date:      p.doc_date || '',
            doc_series:    p.doc_series || '',
            doc_number:    p.doc_number || '',
            doc_type:      p.doc_type || '01',
            unit:          p.unit || 'UND',
            account_code:  p.account_code || '2011',
            cost_center:   p.cost_center || 'LOG-ALM',
            entry_id:      p.entry_id || '',
            source_doc:    p.source_doc || '',
            source_module:  p.source_module  || 'PURCHASING',
            ai_reason:      p.ai_reason      || '',
            catalog_code:   p.catalog_code   || '',
            catalog_nat:    p.catalog_nat    || '',
            catalog_rub:    p.catalog_rub    || 'GE',
            catalog_tk:     p.catalog_tk     || 'F',
            catalog_match:  !!p.catalog_match,
            gasto_account:  p.gasto_account  || '',
            checked:        false,
          }));
          setPendingPurchases(mapped);
        }
      }
      say('Almacén: datos cargados desde API.');
    } catch {
      say('Almacén: usando datos demo (API no disponible).');
    } finally {
      setLoading(false);
    }
  }, [apiBase, token, tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── TIEMPO REAL: recargar cuando el tab vuelve a ser visible o la ventana obtiene foco ──
  useEffect(() => {
    if (!token || !tenantId) return;
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(); };
    const onFocus   = () => loadData();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    // Polling cada 60 segundos para reflejar cambios de otros usuarios/módulos
    const poll = setInterval(loadData, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      clearInterval(poll);
    };
  }, [loadData, token, tenantId]);

  // Auto-reclasificar herramientas al entrar a la vista de entrega si no hay ninguna
  useEffect(() => {
    if (subView !== 'tool_delivery' || !token || !tenantId) return;
    if (items.filter(i => i.item_class === 'HERRAMIENTAS').length > 0) return;
    fetch(`${apiBase}/inventory/reclassify-tools`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId },
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (d && d.reclassified > 0) loadData();
    }).catch(() => {});
  }, [subView, token, tenantId, apiBase, items, loadData]);

  // Cargar reporte por cuenta cuando el usuario abre esa vista
  useEffect(() => {
    if (subView !== 'by_account' || !token || !tenantId) return;
    setAcctLoading(true);
    fetch(`${apiBase}/inventory/report/by-account`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAcctData(d); })
      .catch(() => {})
      .finally(() => setAcctLoading(false));
  }, [subView, token, tenantId, apiBase]);

  // ── filtros aplicados ────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = filters.search.toLowerCase();
    return items.filter(it => {
      if (filters.active_only && !it.is_active) return false;
      if (filters.item_class && it.item_class !== filters.item_class) return false;
      if (filters.area && it.area !== filters.area) return false;
      if (filters.token_type && it.token_type !== filters.token_type) return false;
      if (filters.warehouse && it.warehouse_code !== filters.warehouse) return false;
      if (q && !it.name.toLowerCase().includes(q) && !it.token_code.toLowerCase().includes(q) && !it.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filters]);

  const selectedItem = useMemo(() => items.find(i => i.id === selectedId) ?? null, [items, selectedId]);

  const itemMovements = useMemo(() => {
    const base = selectedId ? movements.filter(m => m.product_id === selectedId) : movements;
    const byTab = movTab === 'ALL' ? base : base.filter(m => m.movement_type === movTab);
    // filter by date range
    return byTab.filter(m => {
      if (filters.date_from && m.created_at < filters.date_from) return false;
      if (filters.date_to   && m.created_at.slice(0, 10) > filters.date_to) return false;
      return true;
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [movements, selectedId, movTab, filters.date_from, filters.date_to]);

  // ── estadísticas ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalValue = filteredItems.reduce((s, i) => s + i.balance_value, 0);
    const byClass: Record<string, number> = {};
    filteredItems.forEach(i => { byClass[i.item_class] = (byClass[i.item_class] || 0) + 1; });
    const alerts = filteredItems.filter(i => i.min_stock > 0 && i.balance_qty < i.min_stock).length;
    return { total: filteredItems.length, totalValue, byClass, alerts };
  }, [filteredItems]);

  // ── pending totals ───────────────────────────────────────────
  const pendingChecked = pendingPurchases.filter(p => p.checked);
  const pendingTotal   = pendingChecked.reduce((s, p) => s + p.total, 0);

  // ── next seq for code generation ─────────────────────────────
  const nextSeq = useMemo(() => {
    const existing = items.filter(i => i.item_class === form.item_class && i.area === form.area).length;
    return existing + 1;
  }, [items, form.item_class, form.area]);

  // ── CRUD actions ─────────────────────────────────────────────
  const openCreate = () => {
    const code = generateCode(EMPTY_FORM.item_class, EMPTY_FORM.area, nextSeq, EMPTY_FORM.token_type);
    setForm({ ...EMPTY_FORM, token_code: code, sku: code });
    setModalMode('CREATE');
  };

  const openEdit = (item: WarehouseItem) => {
    setForm({
      id: item.id, sku: item.sku, token_code: item.token_code,
      name: item.name, detail_description: item.detail_description || '',
      item_class: item.item_class, token_type: item.token_type, area: item.area,
      unit_of_measure: item.unit_of_measure, default_cost: String(item.default_cost),
      default_sales_account: item.default_sales_account || '6911',
      default_cost_account: item.default_cost_account || '2011',
      min_stock: String(item.min_stock), max_stock: String(item.max_stock),
      brand: item.brand || '', specs: item.specs || '',
      location: item.location || '', is_active: item.is_active,
    });
    setModalMode('EDIT');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('El nombre es obligatorio'); return; }
    if (modalMode === 'CREATE') {
      const newItem: WarehouseItem = {
        id: `local-${Date.now()}`, sku: form.sku, token_code: form.token_code, name: form.name,
        detail_description: form.detail_description, item_class: form.item_class as ItemClass,
        token_type: form.token_type as TokenType, area: form.area as Area,
        unit_of_measure: form.unit_of_measure, default_cost: parseFloat(form.default_cost) || 0,
        default_sales_account: form.default_sales_account, default_cost_account: form.default_cost_account,
        min_stock: parseFloat(form.min_stock) || 0, max_stock: parseFloat(form.max_stock) || 0,
        brand: form.brand, specs: form.specs, location: form.location, is_active: form.is_active,
        balance_qty: 0, balance_avg_cost: 0, balance_value: 0,
      };
      // Try API
      if (token) {
        try {
          const res = await fetch(`${apiBase}/inventory/products`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_id: tenantId, ...newItem, default_cost: newItem.default_cost }),
          });
          if (res.ok) {
            const d = await res.json();
            newItem.id = d.id;
            newItem.token_code = d.token_code || newItem.token_code;
          }
        } catch { /* use local */ }
      }
      setItems(prev => [...prev, newItem]);
      say(`Artículo creado: ${newItem.token_code} — ${newItem.name}`);
    } else if (form.id) {
      // Persist to backend (skip local-only IDs)
      if (token && !form.id.startsWith('local-')) {
        try {
          await fetch(`${apiBase}/inventory/products/${form.id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              detail_description: form.detail_description,
              item_class: form.item_class,
              token_type: form.token_type,
              area: form.area,
              unit_of_measure: form.unit_of_measure,
              default_cost: parseFloat(form.default_cost) || undefined,
              min_stock: parseFloat(form.min_stock) || undefined,
              max_stock: parseFloat(form.max_stock) || undefined,
              brand: form.brand || undefined,
              specs: form.specs || undefined,
              location: form.location || undefined,
              is_active: form.is_active,
            }),
          });
        } catch { /* continue with local update */ }
      }
      // Update local state
      setItems(prev => prev.map(it => it.id === form.id ? {
        ...it, name: form.name, detail_description: form.detail_description,
        item_class: form.item_class as ItemClass, token_type: form.token_type as TokenType,
        area: form.area as Area, unit_of_measure: form.unit_of_measure,
        default_cost: parseFloat(form.default_cost) || 0,
        min_stock: parseFloat(form.min_stock) || 0, max_stock: parseFloat(form.max_stock) || 0,
        brand: form.brand, specs: form.specs, location: form.location, is_active: form.is_active,
      } : it));
      say(`Artículo actualizado: ${form.token_code}`);
    }
    setModalMode(null);
  };

  const handleDelete = () => {
    if (!form.id) return;
    if (!confirm(`¿Eliminar "${form.name}"?\nEsta acción es irreversible.`)) return;
    setItems(prev => prev.filter(it => it.id !== form.id));
    setModalMode(null);
    say(`Artículo eliminado: ${form.token_code}`);
  };

  const handleToggleActive = () => {
    if (!form.id) return;
    setItems(prev => prev.map(it => it.id === form.id ? { ...it, is_active: !it.is_active } : it));
    setForm(f => ({ ...f, is_active: !f.is_active }));
    say(`Artículo ${form.is_active ? 'desactivado' : 'activado'}: ${form.token_code}`);
  };

  // ── validate purchases — llama al backend Y actualiza estado local ──────────
  const handleValidatePurchases = async () => {
    const toValidate = pendingPurchases.filter(p => p.checked);
    if (!toValidate.length) { alert('Seleccione al menos un artículo para validar'); return; }

    const warehouseId = warehouses[0]?.id;
    if (!warehouseId) { alert('Configure un almacén primero'); return; }

    // ── PRIORIDAD: Backend persiste en BD. Estado local solo como fallback ──────
    const hdrs = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    };

    let success = 0;
    const errors: string[] = [];

    setLoading(true);
    try {
      for (const p of toValidate) {
        // Preferir datos que ya vienen del backend (catalog_code del catálogo Python)
        const catalogMatch = matchCatalogItem(p.product_name, p.account_code, activeRubro);
        // cta: primeros 3 dígitos de la subcuenta PCGE — solo para construir el token de almacén
        // account_code completo (ej: "2522") se pasa por separado al backend
        const cta          = catalogMatch?.cta  || (p.account_code ? p.account_code.slice(0, 3) : '252');
        const nat          = p.catalog_nat  || catalogMatch?.nat  || 'SU';
        const rub          = p.catalog_rub  || activeRubro || 'GE';
        const tk           = p.catalog_tk   || catalogMatch?.tk   || 'F';
        const catalogCode  = p.catalog_code || catalogMatch?.code || `${cta}-${nat}-${rub}-9999-${tk}`;

        const body = {
          tenant_id:     tenantId,
          warehouse_id:  warehouseId,
          entry_id:      p.entry_id      || '',
          source_doc:    p.source_doc    || `${p.doc_series}-${p.doc_number}`,
          source_module: p.source_module || 'PURCHASING',
          product_name:  p.product_name,  // Siempre el nombre real de la factura, no el del catálogo
          sku:           catalogCode,
          unit:          p.unit || catalogMatch?.unit || 'UND',
          qty:           p.qty,
          unit_cost:     p.unit_cost,
          item_class:    p.item_class    || 'MERCADERIA',
          area:          p.area          || 'ALMACEN',
          account_code:  p.account_code  || cta,  // subcuenta PCGE completa (ej: "2522", no "252")
          cost_center:   p.cost_center   || 'LOG-ALM',
          catalog_code:  catalogCode,              // código almacén (ej: "252-HE-PA-0001-P")
          catalog_nat:   nat,
          catalog_rub:   rub,
          catalog_tk:    tk,
          catalog_match: !!catalogMatch,
          gasto_account: catalogMatch?.gasto || '',
          // Facturas (01) generan asiento Dr.Inventario/Cr.CxP; guías de remisión (09) solo mueven el kardex
          post_journal:  p.doc_type !== '09',
        };

        try {
          const res = await fetch(`${apiBase}/inventory/validate-purchase-items`, {
            method: 'POST',
            headers: hdrs,
            body: JSON.stringify(body),
          });
          if (res.ok) {
            success++;
          } else {
            const errText = await res.text();
            errors.push(`${p.product_name}: ${errText}`);
          }
        } catch (e) {
          errors.push(`${p.product_name}: error de red`);
        }
      }
    } finally {
      setLoading(false);
    }

    if (success > 0) {
      setPendingPurchases(prev => prev.filter(p => !p.checked));
      say(`✓ ${success} ítem(s) ingresados al kardex del almacén.${errors.length ? ` ${errors.length} con error.` : ''}`);
      onJournalPosted?.();
      // Recargar desde backend — datos reales reemplazan todo estado local
      try { await loadData(); } catch { /* BD no disponible */ }
    } else if (errors.length === toValidate.length) {
      // Backend falló completamente → fallback con estado local
      const newMovements: Movement[] = [];
      const newItemsFb: WarehouseItem[] = [];
      for (const p of toValidate) {
        let targetId = p.product_id;
        if (!targetId) {
          const catalogMatch = matchCatalogItem(p.product_name, p.account_code, activeRubro);
          const existingCodes = [...items, ...newItemsFb].map(i => i.token_code);
          const nat  = catalogMatch?.nat  || 'SU';
          const cta  = catalogMatch?.cta  || (p.account_code ? p.account_code.slice(0, 3) : '252');
          const tk   = catalogMatch?.tk   || 'F';
          const code = generateNextCode(existingCodes, cta, nat, activeRubro, tk as any);
          const newItem: WarehouseItem = {
            id: `local-${Date.now()}-${p.id}`, sku: code, token_code: code,
            name: catalogMatch?.name || p.product_name,
            item_class: (cta.startsWith('24') ? 'MATERIA_PRIMA' : cta.startsWith('20') ? 'MERCADERIA' : cta.startsWith('33') ? (tk === 'T' ? 'HERRAMIENTAS' : 'ACTIVO_FIJO') : (nat === 'HE' || nat === 'HT' || nat === 'MQ') ? 'HERRAMIENTAS' : 'INSUMOS') as any,
            token_type: tk === 'P' ? 'PERMANENTE' : 'TEMPORAL', area: p.area,
            unit_of_measure: catalogMatch?.unit || p.unit || 'UND', default_cost: p.unit_cost,
            default_cost_account: cta, default_sales_account: catalogMatch?.gasto || '6569',
            min_stock: 0, max_stock: 0, is_active: true,
            balance_qty: 0, balance_avg_cost: p.unit_cost, balance_value: 0,
          };
          newItemsFb.push(newItem); targetId = newItem.id;
        }
        if (!targetId) continue;
        newMovements.push({
          id: `val-${Date.now()}-${p.id}`, product_id: targetId,
          warehouse_id: warehouseId || 'w1', movement_type: 'ENTRY' as MovType,
          qty: p.qty, unit_cost: p.unit_cost, balance_qty: p.qty, balance_avg_cost: p.unit_cost,
          movement_reference: `ENT-VAL-${p.doc_series || 'XX'}-${p.doc_number || '000'}`,
          source_document: `${p.doc_series || 'XX'}-${p.doc_number || '000'}`,
          area: p.area, validated_by: 'ADMIN',
          notes: `[LOCAL] ${p.doc_series}-${p.doc_number} · ${p.supplier_name}`,
          created_at: new Date().toISOString(),
        });
      }
      if (newItemsFb.length) setItems(prev => [...prev, ...newItemsFb]);
      setMovements(prev => [...newMovements, ...prev]);
      setItems(prev => prev.map(it => {
        const match = toValidate.find(p => p.product_id === it.id);
        if (!match) return it;
        const newQty = it.balance_qty + match.qty;
        const newCost = newQty > 0 ? ((it.balance_qty * it.balance_avg_cost) + (match.qty * match.unit_cost)) / newQty : match.unit_cost;
        return { ...it, balance_qty: newQty, balance_avg_cost: newCost, balance_value: newQty * newCost };
      }));
      setPendingPurchases(prev => prev.filter(p => !p.checked));
      say(`⚠ Backend no disponible. ${toValidate.length} ítem(s) ingresados localmente (sin persistir en BD).`);
      onJournalPosted?.();
    }
    if (errors.length && success > 0) {
      alert(`Errores al ingresar al almacén:\n${errors.slice(0, 5).join('\n')}`);
    }
    if (success === 0 && errors.length === 0) {
      say('Sin ítems procesados.');
    }
  };

  // ── handleExit — registra salida/baja con motivo (top-level para cumplir Rules of Hooks) ──
  const handleExit = async () => {
    if (!exitForm.product_id) { setExitMsg('Seleccione un artículo'); return; }
    const qty = parseFloat(exitForm.qty);
    if (!qty || qty <= 0) { setExitMsg('Cantidad inválida'); return; }
    const warehouseId = warehouses[0]?.id;
    if (!warehouseId) { setExitMsg('Sin almacén configurado'); return; }
    setExitLoading(true); setExitMsg('');
    try {
      const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId };
      const body = {
        tenant_id: tenantId, product_id: exitForm.product_id, warehouse_id: warehouseId,
        qty, exit_reason: exitForm.exit_reason, notes: exitForm.notes,
        movement_reference: exitForm.doc_ref || undefined, post_journal: true,
      };
      const res = await fetch(`${apiBase}/inventory/exit`, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
      if (!res.ok) { setExitMsg(`Error: ${await res.text()}`); return; }
      const data = await res.json();
      const reason = EXIT_REASONS.find(r => r.code === exitForm.exit_reason);
      setExitMsg(`${reason?.icon} ${data.qty} und | S/. ${data.total_cost} | Saldo: ${data.new_balance_qty} und`);
      setExitForm(f => ({ ...f, product_id: '', qty: '1', notes: '', doc_ref: '' }));
      await loadData();
    } catch { setExitMsg('Error de conexión'); } finally { setExitLoading(false); }
  };

  // ── handleRefreshAcct — actualiza reporte por cuenta ─────────────────────
  const handleRefreshAcct = () => {
    if (!token || !tenantId) return;
    setAcctLoading(true);
    fetch(`${apiBase}/inventory/report/by-account`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAcctData(d); })
      .catch(() => {})
      .finally(() => setAcctLoading(false));
  };

  const toggleAcctExpanded = (code: string) => setAcctExpanded(prev => {
    const s = new Set(prev); s.has(code) ? s.delete(code) : s.add(code); return s;
  });

  // ── toggle all checkbox ───────────────────────────────────────
  const allChecked = pendingPurchases.length > 0 && pendingPurchases.every(p => p.checked);
  const toggleAllPurchases = () => {
    setPendingPurchases(prev => prev.map(p => ({ ...p, checked: !allChecked })));
  };
  const togglePurchase = (id: string) => {
    setPendingPurchases(prev => prev.map(p => p.id === id ? { ...p, checked: !p.checked } : p));
  };

  // ── toggle item checkbox ──────────────────────────────────────
  const allItemsChecked = filteredItems.length > 0 && filteredItems.every(i => checkedIds.has(i.id));
  const toggleAllItems = () => {
    if (allItemsChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(filteredItems.map(i => i.id)));
  };

  // ============================================================
  // RENDER
  // ============================================================
  const th: React.CSSProperties = {
    padding: '8px 10px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700,
    color: C.textMut, textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' as const, background: C.bg,
    position: 'sticky' as const, top: 0, zIndex: 1,
  };
  const td: React.CSSProperties = { padding: '7px 10px', fontSize: 12, color: C.text, borderBottom: `1px solid ${C.border}22`, verticalAlign: 'middle' as const };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: C.bg, color: C.text, fontFamily: "'Segoe UI', Arial, sans-serif", overflow: 'hidden' }}>

      {/* ── TOP BAR ── */}
      <div style={{ background: C.topbar, borderBottom: `1px solid ${C.border}`, padding: '10px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Title */}
          <div>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.accent, letterSpacing: '-0.3px' }}>
              🏭 ALMACÉN CENTRAL
            </span>
            <span style={{ marginLeft: 8, fontSize: 11, color: C.textDim }}>
              Sistema de Gestión de Inventario
            </span>
          </div>
          {/* Search */}
          <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.textDim, fontSize: 13 }}>⌕</span>
            <input style={{ ...inputStyle, paddingLeft: 28, height: 32 }}
              placeholder="Buscar por nombre, código o SKU..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          {/* Stats pills */}
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: '#1f3a5f', color: C.accent, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
              {stats.total} artículos
            </span>
            <span style={{ background: '#1a3a20', color: '#3fb950', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
              S/ {fmt(stats.totalValue)}
            </span>
            {stats.alerts > 0 && (
              <span style={{ background: '#3a1a1a', color: C.accentR, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                ⚠ {stats.alerts} alerta{stats.alerts > 1 ? 's' : ''}
              </span>
            )}
            {pendingPurchases.length > 0 && (
              <span style={{ background: '#2a2a10', color: C.accentY, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setPurchaseOpen(true)}>
                📦 {pendingPurchases.length} compras pendientes
              </span>
            )}
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btn('primary')} onClick={openCreate}>+ Nuevo Artículo</button>
            <button style={btn('ghost')} onClick={loadData}>{loading ? '⟳' : '↻'} Actualizar</button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={{ ...selectStyle, width: 'auto', minWidth: 130, height: 30, fontSize: 12 }} value={filters.item_class}
            onChange={e => setFilters(f => ({ ...f, item_class: e.target.value }))}>
            <option value="">Todas las clases</option>
            {CLASSES.map(c => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
          </select>
          <select style={{ ...selectStyle, width: 'auto', minWidth: 120, height: 30, fontSize: 12 }} value={filters.area}
            onChange={e => setFilters(f => ({ ...f, area: e.target.value }))}>
            <option value="">Todas las áreas</option>
            {AREAS.map(a => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
          </select>
          <select style={{ ...selectStyle, width: 'auto', minWidth: 100, height: 30, fontSize: 12 }} value={filters.token_type}
            onChange={e => setFilters(f => ({ ...f, token_type: e.target.value }))}>
            <option value="">Todo token</option>
            <option value="PERMANENTE">● Permanente</option>
            <option value="TEMPORAL">◌ Temporal</option>
          </select>
          <select style={{ ...selectStyle, width: 'auto', minWidth: 120, height: 30, fontSize: 12 }} value={filters.warehouse}
            onChange={e => setFilters(f => ({ ...f, warehouse: e.target.value }))}>
            <option value="">Todos los almacenes</option>
            {warehouses.map(w => <option key={w.id} value={w.code}>{w.code}</option>)}
          </select>
          <span style={{ fontSize: 11, color: C.textDim }}>Desde:</span>
          <input type="date" style={{ ...inputStyle, width: 130, height: 30, fontSize: 12 }} value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
          <span style={{ fontSize: 11, color: C.textDim }}>Hasta:</span>
          <input type="date" style={{ ...inputStyle, width: 130, height: 30, fontSize: 12 }} value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: C.textMut }}>
            <input type="checkbox" checked={filters.active_only} onChange={e => setFilters(f => ({ ...f, active_only: e.target.checked }))} />
            Solo activos
          </label>
          <button style={{ ...btn('ghost'), height: 30, fontSize: 11 }} onClick={() =>
            setFilters({ search: '', item_class: '', area: '', token_type: '', warehouse: '', active_only: true, date_from: '', date_to: '' })}>
            ✕ Limpiar
          </button>
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── SUB-NAV IZQUIERDA ── */}
        <aside style={{
          width: 168, minWidth: 168, background: '#0d1117', borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ padding: '10px 10px 6px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Módulos de Almacén
          </div>
          {[
            { id: 'stock',       icon: '🗄',  label: 'Stock General',       desc: 'Inventario actual' },
            { id: 'kardex',      icon: '📊',  label: 'Kardex',              desc: 'Historial por artículo' },
            { id: 'warehouses',  icon: '🏭',  label: 'Almacenes',           desc: 'Gestión de bodegas' },
            { id: 'entries',     icon: '📥',  label: 'Entradas',            desc: 'Ingresos al almacén' },
            { id: 'exits',       icon: '📤',  label: 'Salidas / Bajas',     desc: 'Salidas, desgaste, antigüedad' },
            { id: 'adjustments', icon: '⚖',  label: 'Ajustes',             desc: 'Diferencias y ajustes' },
            { id: 'tokens',      icon: '🏷',  label: 'Códigos / Tokens',    desc: 'Gestión de códigos' },
            { id: 'reports',     icon: '📈',  label: 'Reportes',            desc: 'Valorización y stock' },
            { id: 'by_account',  icon: '🔢',  label: 'Por Cuenta PCGE',     desc: 'Rotación y valor por cuenta' },
            { id: 'tool_delivery', icon: '🔧',  label: 'Entrega Herram.',        desc: 'Asignar a trabajador/obra' },
            { id: 'tool_return',   icon: '↩',   label: 'Devolución Herram.',     desc: 'Retorno al almacén' },
            { id: 'dispatch',      icon: '📦',  label: 'Despacho Mercadería',    desc: 'Salidas para venta/prod.' },
            { id: 'catalog',       icon: '📗',  label: 'Catálogo PCGE',          desc: 'Artículos por rubro/cuenta' },
          ].map(item => (
            <button key={item.id} onClick={() => setSubView(item.id)} style={{
              background: subView === item.id ? '#1f3a5f' : 'transparent',
              border: 'none', borderLeft: subView === item.id ? `3px solid ${C.accent}` : '3px solid transparent',
              padding: '9px 12px', cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'background .15s',
            }}>
              <div style={{ fontSize: 13 }}>{item.icon} <span style={{ fontSize: 12, fontWeight: 600, color: subView === item.id ? C.accent : C.text }}>{item.label}</span></div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, paddingLeft: 20 }}>{item.desc}</div>
            </button>
          ))}

          {/* Separador — atajos por clase */}
          <div style={{ padding: '10px 10px 6px', marginTop: 4, fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase', borderTop: `1px solid ${C.border}` }}>
            Por Clase
          </div>
          {CLASSES.map(cls => {
            const count = items.filter(i => i.item_class === cls && i.is_active).length;
            if (!count) return null;
            return (
              <button key={cls} onClick={() => { setSubView('stock'); setFilters(f => ({ ...f, item_class: cls === filters.item_class ? '' : cls })); }} style={{
                background: filters.item_class === cls ? CLASS_COLOR[cls] + '22' : 'transparent',
                border: 'none', borderLeft: filters.item_class === cls ? `3px solid ${CLASS_COLOR[cls]}` : '3px solid transparent',
                padding: '6px 12px', cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: CLASS_COLOR[cls], fontWeight: 600 }}>{CLASS_PREFIX[cls]} {CLASS_LABEL[cls]}</span>
                  <span style={{ fontSize: 10, background: CLASS_COLOR[cls] + '33', color: CLASS_COLOR[cls], borderRadius: 10, padding: '1px 6px' }}>{count}</span>
                </div>
              </button>
            );
          })}

          {/* Separador — alertas */}
          {stats.alerts > 0 && (
            <>
              <div style={{ padding: '10px 10px 6px', marginTop: 4, fontSize: 10, fontWeight: 700, color: C.accentR, letterSpacing: '0.1em', textTransform: 'uppercase', borderTop: `1px solid ${C.border}` }}>
                ⚠ Alertas Stock
              </div>
              {filteredItems.filter(i => i.min_stock > 0 && i.balance_qty < i.min_stock).map(i => (
                <button key={i.id} onClick={() => { setSubView('stock'); setSelectedId(i.id); }} style={{
                  background: 'transparent', border: 'none', borderLeft: `3px solid ${C.accentR}`,
                  padding: '5px 12px', cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                  <div style={{ fontSize: 10, color: C.accentR, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {i.token_code}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Stock: {fmt(i.balance_qty, 0)} / Mín: {fmt(i.min_stock, 0)}</div>
                </button>
              ))}
            </>
          )}

          {/* Botones de mantenimiento de BD */}
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <button style={{ ...btn('primary'), fontSize: 9, padding: '3px 8px', width: '100%' }} onClick={() => loadData()}>
              🔄 Recargar BD
            </button>
            <button style={{ ...btn('danger'), fontSize: 9, padding: '3px 8px', width: '100%' }}
              onClick={async () => {
                if (!confirm('¿Eliminar movimientos y saldos de prueba? (productos se conservan)')) return;
                const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId };
                const res = await fetch(`${apiBase}/inventory/reset-test-data`, { method: 'DELETE', headers: hdrs });
                if (res.ok) { const d = await res.json(); alert(`✓ ${d.deleted_movements} movimientos y ${d.deleted_balances} saldos eliminados.`); await loadData(); }
                else { alert('Error: ' + await res.text()); }
              }}>
              🗑 Limpiar movimientos
            </button>
            <button style={{ ...btn('danger'), fontSize: 9, padding: '3px 8px', width: '100%' }}
              onClick={async () => {
                if (!confirm('¿Eliminar TODOS los productos de prueba junto con sus movimientos y saldos?')) return;
                const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId };
                const res = await fetch(`${apiBase}/inventory/reset-products`, { method: 'DELETE', headers: hdrs });
                if (res.ok) { const d = await res.json(); alert(`✓ ${d.deleted_products} productos eliminados.`); await loadData(); }
                else { alert('Error: ' + await res.text()); }
              }}>
              🗑 Limpiar productos
            </button>
          </div>
        </aside>

        {/* ── ÁREA DE CONTENIDO PRINCIPAL ── */}
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* ── Sub-vistas alternativas ── */}
        {subView === 'kardex' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ color: C.accent, margin: '0 0 12px', fontSize: 15 }}>📊 Kardex — Historial de Movimientos por Artículo</h3>
            <div style={{ marginBottom: 12 }}>
              <select style={{ ...selectStyle, width: 320 }} onChange={e => setSelectedId(e.target.value || null)}>
                <option value="">— Seleccione un artículo —</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.token_code} · {i.name}</option>)}
              </select>
            </div>
            {movements.length === 0 && <div style={{ color: C.textDim, fontSize: 13, padding: 20, textAlign: 'center' }}>Sin movimientos. Valide compras o realice despachos para ver el kardex.</div>}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Fecha', 'Tipo', 'Cantidad', 'Costo Unit.', 'Saldo Qty', 'Costo Prom', 'Referencia', 'Documento', 'Área', ''].map(h => (
                  <th key={h} style={{ ...th, position: 'relative' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {(selectedId ? movements.filter(m => m.product_id === selectedId) : movements)
                  .slice(0, 100)
                  .map((m, idx) => (
                    <tr key={m.id} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}>
                      <td style={td}>{fmtDateTime(m.created_at)}</td>
                      <td style={td}><MovTypeIcon type={m.movement_type} /></td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: m.movement_type === 'ENTRY' ? C.accentG : C.accentR }}>
                        {m.movement_type === 'ENTRY' ? '+' : '-'}{fmt(m.qty, 0)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>S/ {fmt(m.unit_cost)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(m.balance_qty, 0)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>S/ {fmt(m.balance_avg_cost)}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: C.accent }}>{m.movement_reference}</td>
                      <td style={{ ...td, fontSize: 11 }}>{m.source_document}</td>
                      <td style={{ ...td, fontSize: 11, color: C.textMut }}>{m.area}</td>
                      <td style={td}>
                        <button style={{ ...btn('danger'), fontSize: 10, padding: '2px 6px' }}
                          onClick={() => { if (confirm('¿Eliminar este movimiento del kardex?')) setMovements(prev => prev.filter(x => x.id !== m.id)); }}>🗑</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {subView === 'warehouses' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>🏭 Gestión de Almacenes</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {warehouses.map(w => {
                const wItems = items.filter(i => i.warehouse_code === w.code);
                const wValue = wItems.reduce((s, i) => s + i.balance_value, 0);
                return (
                  <div key={w.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 4 }}>{w.code}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>{w.name}</div>
                    <div style={{ fontSize: 11, color: C.textMut, marginBottom: 4 }}>Tipo: {w.warehouse_type}</div>
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color: C.textMut }}>Artículos:</span>
                        <span style={{ color: C.text, fontWeight: 600 }}>{wItems.length}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                        <span style={{ color: C.textMut }}>Valor total:</span>
                        <span style={{ color: C.accentG, fontFamily: 'monospace', fontWeight: 700 }}>S/ {fmt(wValue)}</span>
                      </div>
                    </div>
                    {/* Mini breakdown por clase */}
                    <div style={{ marginTop: 10 }}>
                      {CLASSES.map(cls => {
                        const cItems = wItems.filter(i => i.item_class === cls);
                        if (!cItems.length) return null;
                        return (
                          <div key={cls} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 3 }}>
                            <span style={{ color: CLASS_COLOR[cls] }}>{CLASS_PREFIX[cls]} {CLASS_LABEL[cls]}</span>
                            <span style={{ color: C.textMut }}>{cItems.length} art.</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {subView === 'entries' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ color: C.accentG, margin: '0 0 12px', fontSize: 15 }}>📥 Entradas al Almacén</h3>
            {movements.filter(m => m.movement_type === 'ENTRY').length === 0 && (
              <div style={{ color: C.textDim, fontSize: 13, padding: 20, textAlign: 'center' }}>Sin entradas registradas. Valide compras desde el panel inferior o cree movimientos manualmente.</div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Fecha', 'Artículo', 'Clase', 'Área', 'Cant', 'Costo U.', 'Total S/', 'Documento', 'Referencia', 'Acciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {movements.filter(m => m.movement_type === 'ENTRY').map((m, idx) => {
                  const it = items.find(i => i.id === m.product_id);
                  return (
                    <tr key={m.id} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}>
                      <td style={td}>{fmtDateTime(m.created_at)}</td>
                      <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it?.name || m.product_id}</td>
                      <td style={td}>{it && <ClassBadge cls={it.item_class} />}</td>
                      <td style={{ ...td, fontSize: 11, color: C.textMut }}>{m.area}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.accentG }}>+{fmt(m.qty, 0)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>S/ {fmt(m.unit_cost)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.accentG }}>S/ {fmt(m.qty * m.unit_cost)}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{m.source_document}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: C.accent }}>{m.movement_reference}</td>
                      <td style={td}>
                        <button style={{ ...btn('danger'), fontSize: 10, padding: '2px 7px' }}
                          onClick={() => { if (confirm('¿Eliminar este movimiento?')) setMovements(prev => prev.filter(x => x.id !== m.id)); }}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: C.bg }}>
                  <td colSpan={7} style={{ ...td, borderTop: `2px solid ${C.border}`, fontWeight: 700, color: C.textMut }}>Total entradas</td>
                  <td style={{ ...td, borderTop: `2px solid ${C.border}`, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: C.accentG }}>
                    S/ {fmt(movements.filter(m => m.movement_type === 'ENTRY').reduce((s, m) => s + m.qty * m.unit_cost, 0))}
                  </td>
                  <td colSpan={2} style={{ ...td, borderTop: `2px solid ${C.border}` }} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {subView === 'exits' && (() => {
          // Derivados — no son hooks, son cálculos
          const selectedProduct = items.find(i => i.id === exitForm.product_id);
          const selectedReason  = EXIT_REASONS.find(r => r.code === exitForm.exit_reason);
          const exitQty         = parseFloat(exitForm.qty) || 0;
          const estimatedValue  = selectedProduct ? exitQty * selectedProduct.balance_avg_cost : 0;
          return (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <h3 style={{ color: C.accentR, margin: '0 0 16px', fontSize: 15 }}>📤 Salidas / Bajas de Inventario</h3>
              <div style={{ background: C.bgCard, border: `1px solid ${C.accentR}44`, borderRadius: 10, padding: 16, marginBottom: 24 }}>
                <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: C.accentR, letterSpacing: '0.07em' }}>REGISTRAR SALIDA / BAJA</p>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Artículo *</label>
                    <select style={selectStyle} value={exitForm.product_id} onChange={e => setExitForm(f => ({ ...f, product_id: e.target.value }))}>
                      <option value="">— Seleccionar artículo —</option>
                      {items.filter(i => i.balance_qty > 0 && i.is_active).map(i => (
                        <option key={i.id} value={i.id}>
                          {i.token_code} · {i.name} (Disp: {fmt(i.balance_qty, 0)} {i.unit_of_measure} | Costo avg: S/ {fmt(i.balance_avg_cost)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Cantidad *</label>
                    <input type="number" min="0.01" step="0.01" style={inputStyle} value={exitForm.qty}
                      onChange={e => setExitForm(f => ({ ...f, qty: e.target.value }))} placeholder="0" />
                    {selectedProduct && exitQty > selectedProduct.balance_qty && (
                      <div style={{ color: C.accentR, fontSize: 10, marginTop: 2 }}>⚠ Excede stock disponible ({fmt(selectedProduct.balance_qty, 0)})</div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Doc. Referencia</label>
                    <input style={inputStyle} value={exitForm.doc_ref} onChange={e => setExitForm(f => ({ ...f, doc_ref: e.target.value }))} placeholder="Ej: BAJA-2026-001" />
                  </div>
                </div>
                <label style={{ ...labelStyle, marginBottom: 8, display: 'block' }}>Motivo de salida *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
                  {EXIT_REASONS.map(r => (
                    <button key={r.code} onClick={() => setExitForm(f => ({ ...f, exit_reason: r.code }))}
                      style={{ background: exitForm.exit_reason === r.code ? r.color + '22' : C.bg, border: `1px solid ${exitForm.exit_reason === r.code ? r.color : C.border}`, borderRadius: 6, padding: '6px 8px', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 13 }}>{r.icon}</div>
                      <div style={{ fontSize: 10, color: exitForm.exit_reason === r.code ? r.color : C.textMut, fontWeight: 600, lineHeight: 1.2 }}>{r.label}</div>
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Observaciones / Sustento</label>
                  <input style={inputStyle} value={exitForm.notes} onChange={e => setExitForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Ej: Herramienta inutilizable por desgaste excesivo — acta N° 012" />
                </div>
                {selectedProduct && exitQty > 0 && (
                  <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, marginBottom: 12, fontFamily: 'monospace', fontSize: 11 }}>
                    <div style={{ color: C.textMut, marginBottom: 4, fontFamily: 'sans-serif', fontSize: 10, fontWeight: 700 }}>ASIENTO AUTOMÁTICO QUE SE GENERARÁ:</div>
                    <div style={{ color: C.accentR }}>  DEBE  {selectedReason?.label}  S/ {fmt(estimatedValue)}</div>
                    <div style={{ color: C.accentG }}>  HABER Inventario {selectedProduct.token_code}  S/ {fmt(estimatedValue)}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button style={{ ...btn('danger'), minWidth: 160 }} onClick={handleExit} disabled={exitLoading}>
                    {exitLoading ? '⏳ Registrando...' : '📤 Registrar Salida / Baja'}
                  </button>
                  {exitMsg && <span style={{ fontSize: 12, color: exitMsg.startsWith('Error') ? C.accentR : C.accentG }}>{exitMsg}</span>}
                </div>
              </div>
              <h4 style={{ color: C.textMut, fontSize: 12, marginBottom: 8 }}>Historial de Salidas y Bajas</h4>
              {movements.filter(m => m.movement_type === 'EXIT').length === 0 && (
                <div style={{ color: C.textDim, fontSize: 13, padding: 20, textAlign: 'center' }}>Sin salidas registradas aún.</div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Fecha', 'Código', 'Artículo', 'Clase', 'Área', 'Motivo / Nota', 'Cant', 'Costo U.', 'Valor S/', 'Documento', 'Referencia', 'Acciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {movements.filter(m => m.movement_type === 'EXIT').map((m, idx) => {
                    const it         = items.find(i => i.id === m.product_id);
                    const reasonCode = (m.notes || '').match(/\[([A-Z_]+)\]/)?.[1] || '';
                    const reasonDef  = EXIT_REASONS.find(r => r.code === reasonCode);
                    return (
                      <tr key={m.id} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(m.created_at)}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 10, color: C.accent }}>{it?.token_code || '-'}</td>
                        <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it?.name || m.product_id}</td>
                        <td style={td}>{it && <ClassBadge cls={it.item_class} />}</td>
                        <td style={{ ...td, fontSize: 11, color: C.textMut }}>{m.area}</td>
                        <td style={{ ...td, fontSize: 11 }}>
                          {reasonDef && <span style={{ background: reasonDef.color + '22', color: reasonDef.color, borderRadius: 4, padding: '1px 5px', marginRight: 4, fontWeight: 600 }}>{reasonDef.icon} {reasonDef.label}</span>}
                          <span style={{ color: C.textMut }}>{(m.notes || '').replace(/\[[A-Z_]+\]/, '').trim()}</span>
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.accentR }}>-{fmt(m.qty, 0)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>S/ {fmt(m.unit_cost)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.accentR }}>S/ {fmt(m.qty * m.unit_cost)}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>{m.source_document}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: C.accent }}>{m.movement_reference}</td>
                        <td style={td}>
                          <button style={{ ...btn('danger'), fontSize: 10, padding: '2px 7px' }}
                            onClick={() => { if (confirm('¿Eliminar este movimiento?')) setMovements(prev => prev.filter(x => x.id !== m.id)); }}>🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: C.bg }}>
                    <td colSpan={8} style={{ ...td, borderTop: `2px solid ${C.border}`, fontWeight: 700, color: C.textMut }}>Total salidas / bajas</td>
                    <td style={{ ...td, borderTop: `2px solid ${C.border}`, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: C.accentR }}>
                      S/ {fmt(movements.filter(m => m.movement_type === 'EXIT').reduce((s, m) => s + m.qty * m.unit_cost, 0))}
                    </td>
                    <td colSpan={3} style={{ ...td, borderTop: `2px solid ${C.border}` }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
        {subView === 'adjustments' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ color: C.accentY, margin: '0 0 12px', fontSize: 15 }}>⚖ Ajustes de Inventario</h3>
            <div style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16, maxWidth: 560, marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: C.text, margin: '0 0 12px' }}>Registrar ajuste de inventario (diferencia de conteo físico):</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Artículo</label>
                  <select style={selectStyle}>
                    <option value="">— Seleccionar —</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.token_code} · {i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tipo de ajuste</label>
                  <select style={selectStyle}>
                    <option value="ADJUST_UP">Ajuste positivo (sobrante)</option>
                    <option value="ADJUST_DOWN">Ajuste negativo (faltante)</option>
                    <option value="RECOUNT">Reconteo físico</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Cantidad a ajustar</label>
                  <input type="number" style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelStyle}>Motivo</label>
                  <input style={inputStyle} placeholder="Merma / Rotura / Error de conteo..." />
                </div>
              </div>
              <button style={btn('warning')}>⚖ Registrar Ajuste</button>
            </div>
            <div style={{ color: C.textMut, fontSize: 12 }}>Sin ajustes registrados en el período.</div>
          </div>
        )}
        {subView === 'tokens' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>🏷 Gestión de Códigos / Tokens</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
              {CLASSES.map(cls => {
                const permanent = items.filter(i => i.item_class === cls && i.token_type === 'PERMANENTE').length;
                const temporal  = items.filter(i => i.item_class === cls && i.token_type === 'TEMPORAL').length;
                return (
                  <div key={cls} style={{ background: C.bgCard, border: `1px solid ${CLASS_COLOR[cls]}44`, borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: CLASS_COLOR[cls], marginBottom: 4 }}>{CLASS_PREFIX[cls]} — {CLASS_LABEL[cls]}</div>
                    <div style={{ fontSize: 12, color: C.textMut }}>Permanentes: <strong style={{ color: '#3fb950' }}>{permanent}</strong></div>
                    <div style={{ fontSize: 12, color: C.textMut }}>Temporales: <strong style={{ color: '#d29922' }}>{temporal}</strong></div>
                    <div style={{ marginTop: 6, fontSize: 10, color: C.textDim }}>Prefijo: {CLASS_PREFIX[cls]}-[AREA]-NNNN{cls === 'HERRAMIENTAS' || cls === 'INSUMOS' || cls === 'CONSUMIBLE' ? '-T' : ''}</div>
                  </div>
                );
              })}
            </div>
            <h4 style={{ color: C.textMut, fontSize: 12, marginBottom: 8 }}>Todos los códigos token asignados</h4>
            {items.length === 0 && <div style={{ color: C.textDim, fontSize: 13, padding: 12 }}>Sin artículos registrados.</div>}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Código Token', 'Artículo', 'Clase', 'Tipo', 'Área', 'Estado', 'Acciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}>
                    <td style={{ ...td, fontFamily: 'monospace', color: CLASS_COLOR[it.item_class], fontWeight: 700 }}>{it.token_code}</td>
                    <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</td>
                    <td style={td}><ClassBadge cls={it.item_class} /></td>
                    <td style={td}><TokenBadge type={it.token_type} /></td>
                    <td style={{ ...td, fontSize: 11, color: C.textMut }}>{AREA_PREFIX[it.area]}</td>
                    <td style={td}><span style={{ color: it.is_active ? C.accentG : C.accentR, fontWeight: 600, fontSize: 11 }}>{it.is_active ? '● Activo' : '○ Inactivo'}</span></td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...btn('ghost'), fontSize: 10, padding: '2px 7px' }} onClick={() => openEdit(it)}>✏ Editar</button>
                        <button style={{ ...btn('danger'), fontSize: 10, padding: '2px 7px' }}
                          onClick={() => { if (confirm(`¿Eliminar ${it.token_code}?`)) setItems(prev => prev.filter(x => x.id !== it.id)); }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {subView === 'reports' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ color: C.accent, margin: '0 0 16px', fontSize: 15 }}>📈 Reportes de Inventario</h3>
            {/* Resumen general */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total artículos', value: String(items.length), color: C.accent },
                { label: 'Valor total S/', value: `S/ ${fmt(items.reduce((s, i) => s + i.balance_value, 0))}`, color: C.accentG },
                { label: 'Total entradas', value: String(movements.filter(m => m.movement_type === 'ENTRY').length), color: C.accentG },
                { label: 'Total salidas',  value: String(movements.filter(m => m.movement_type === 'EXIT').length), color: C.accentR },
              ].map(m => (
                <div key={m.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: C.textMut, marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: 'monospace' }}>{m.value}</div>
                </div>
              ))}
            </div>
            {/* Valorización por clase */}
            <h4 style={{ color: C.textMut, fontSize: 12, marginBottom: 8 }}>Valorización por Clase</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <thead><tr>{['Clase', 'Artículos', 'Qty Total', 'Valor S/', '% del Total'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {CLASSES.map((cls, idx) => {
                  const cItems = items.filter(i => i.item_class === cls);
                  if (!cItems.length) return null;
                  const val = cItems.reduce((s, i) => s + i.balance_value, 0);
                  const total = items.reduce((s, i) => s + i.balance_value, 0);
                  const pct = total > 0 ? (val / total) * 100 : 0;
                  return (
                    <tr key={cls} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}>
                      <td style={td}><ClassBadge cls={cls} /></td>
                      <td style={{ ...td, textAlign: 'right' }}>{cItems.length}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(cItems.reduce((s, i) => s + i.balance_qty, 0), 0)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: CLASS_COLOR[cls] }}>S/ {fmt(val)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <div style={{ width: 60, height: 6, borderRadius: 3, background: C.border }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: CLASS_COLOR[cls], borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: C.textMut }}>{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Artículos con stock bajo mínimo */}
            <h4 style={{ color: C.accentR, fontSize: 12, marginBottom: 8 }}>⚠ Artículos bajo stock mínimo</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Código', 'Artículo', 'Stock Actual', 'Stock Mínimo', 'Déficit', 'Área'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {items.filter(i => i.min_stock > 0 && i.balance_qty < i.min_stock).map((it, idx) => (
                  <tr key={it.id} style={{ background: idx % 2 === 0 ? '#1a0a0a' : '#150808' }}>
                    <td style={{ ...td, fontFamily: 'monospace', color: C.accentR }}>{it.token_code}</td>
                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.accentR, fontWeight: 700 }}>{fmt(it.balance_qty, 0)} {it.unit_of_measure}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.textMut }}>{fmt(it.min_stock, 0)} {it.unit_of_measure}</td>
                    <td style={{ ...td, textAlign: 'right', color: C.accentO, fontWeight: 700 }}>{fmt(it.min_stock - it.balance_qty, 0)}</td>
                    <td style={{ ...td, fontSize: 11, color: C.textMut }}>{AREA_PREFIX[it.area]}</td>
                  </tr>
                ))}
                {items.filter(i => i.min_stock > 0 && i.balance_qty < i.min_stock).length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: C.accentG }}>✓ Todos los artículos sobre stock mínimo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {/* ─────────────────────────────────────────────────
            SUB-VISTA: POR CUENTA PCGE — ROTACIÓN Y VALOR
            ───────────────────────────────────────────────── */}
        {subView === 'by_account' && (() => {
          const ROTATION_COLOR = (pct: number) => pct >= 80 ? '#f85149' : pct >= 40 ? '#d29922' : '#3fb950';
          return (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: C.accent, margin: 0, fontSize: 15 }}>🔢 Inventario por Cuenta PCGE — Rotación y Valor</h3>
                <button style={btn('primary')} onClick={handleRefreshAcct}>🔄 Actualizar</button>
              </div>

              {acctLoading && <div style={{ color: C.textMut, textAlign: 'center', padding: 40 }}>⏳ Cargando datos...</div>}

              {acctData && (
                <>
                  {/* Totales */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Valor total inventario', value: `S/ ${fmt(acctData.grand_total_value)}`, color: C.accentG },
                      { label: 'Cuentas PCGE activas',   value: String(acctData.accounts_count),         color: C.accent },
                      { label: 'Artículos totales',      value: String(acctData.by_account?.reduce((s: number, a: any) => s + a.products_count, 0) || 0), color: C.textMut },
                    ].map(m => (
                      <div key={m.label} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 11, color: C.textMut }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: 'monospace' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Tabla por cuenta */}
                  {(acctData.by_account || []).map((acc: any) => (
                    <div key={acc.account_code} style={{ marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      {/* Header de cuenta — clic para expandir */}
                      <div onClick={() => toggleAcctExpanded(acc.account_code)} style={{ background: C.bgCard, padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: C.accent, fontSize: 14 }}>{acc.account_code}</span>
                          <span style={{ color: C.text, fontSize: 13 }}>{acc.account_name}</span>
                          <span style={{ background: C.bg, borderRadius: 4, padding: '2px 7px', fontSize: 11, color: C.textMut }}>{acc.products_count} art.</span>
                        </div>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: C.textMut }}>Valor</div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: C.accentG }}>S/ {fmt(acc.total_value)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: C.textMut }}>Entradas</div>
                            <div style={{ fontFamily: 'monospace', color: C.accentG }}>{fmt(acc.total_entries_qty, 0)}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: C.textMut }}>Salidas</div>
                            <div style={{ fontFamily: 'monospace', color: C.accentR }}>{fmt(acc.total_exits_qty, 0)}</div>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 60 }}>
                            <div style={{ fontSize: 10, color: C.textMut }}>Rotación</div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: ROTATION_COLOR(acc.rotation_pct) }}>{acc.rotation_pct}%</div>
                          </div>
                          <span style={{ color: C.textMut, fontSize: 14 }}>{acctExpanded.has(acc.account_code) ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Detalle por artículo */}
                      {acctExpanded.has(acc.account_code) && (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: C.bg }}>
                              {['Token Code', 'Artículo', 'Clase', 'Stock', 'Costo Avg', 'Valor S/', 'Entradas', 'Salidas', 'Rotación', 'Estado'].map(h => (
                                <th key={h} style={{ ...th, fontSize: 10 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(acc.items || []).map((item: any, idx: number) => (
                              <tr key={item.product_id} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}>
                                <td style={{ ...td, fontFamily: 'monospace', fontSize: 10, color: C.accent }}>{item.token_code}</td>
                                <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                                <td style={td}><ClassBadge cls={item.item_class as ItemClass} /></td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(item.balance_qty, 0)} {item.unit}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>S/ {fmt(item.avg_cost)}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: C.accentG }}>S/ {fmt(item.balance_value)}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: C.accentG }}>▲ {fmt(item.entries_qty, 0)}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: C.accentR }}>▼ {fmt(item.exits_qty, 0)}</td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                    <div style={{ width: 40, height: 5, borderRadius: 3, background: C.border }}>
                                      <div style={{ height: '100%', width: `${Math.min(item.rotation_pct, 100)}%`, background: ROTATION_COLOR(item.rotation_pct), borderRadius: 3 }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: ROTATION_COLOR(item.rotation_pct), fontWeight: 600 }}>{item.rotation_pct}%</span>
                                  </div>
                                </td>
                                <td style={{ ...td, textAlign: 'center' }}>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: item.stock_status === 'OK' ? C.accentG : item.stock_status === 'AGOTADO' ? C.accentR : C.textMut }}>
                                    {item.stock_status === 'OK' ? '✓ OK' : item.stock_status === 'AGOTADO' ? '⚠ AGOTADO' : '• NUEVO'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: C.bg }}>
                              <td colSpan={5} style={{ ...td, borderTop: `1px solid ${C.border}`, fontWeight: 700, color: C.textMut, fontSize: 11 }}>Subtotal cuenta {acc.account_code}</td>
                              <td style={{ ...td, borderTop: `1px solid ${C.border}`, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: C.accentG }}>S/ {fmt(acc.total_value)}</td>
                              <td style={{ ...td, borderTop: `1px solid ${C.border}`, textAlign: 'right', fontFamily: 'monospace', color: C.accentG }}>{fmt(acc.total_entries_qty, 0)}</td>
                              <td style={{ ...td, borderTop: `1px solid ${C.border}`, textAlign: 'right', fontFamily: 'monospace', color: C.accentR }}>{fmt(acc.total_exits_qty, 0)}</td>
                              <td colSpan={2} style={{ ...td, borderTop: `1px solid ${C.border}` }} />
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  ))}
                </>
              )}
              {!acctData && !acctLoading && (
                <div style={{ textAlign: 'center', padding: 40, color: C.textMut }}>
                  Sin datos de inventario aún. Registre compras y valide el ingreso al almacén.
                </div>
              )}
            </div>
          );
        })()}
        {/* ─────────────────────────────────────────────────
            SUB-VISTA: ENTREGA DE HERRAMIENTAS
            ───────────────────────────────────────────────── */}
        {subView === 'tool_delivery' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ color: C.accentO, margin: '0 0 16px', fontSize: 15 }}>🔧 Entrega de Herramientas — Asignación a Trabajador / Obra</h3>

            {/* Formulario de nueva entrega */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.accentO}44`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: C.accentO, letterSpacing: '0.07em' }}>
                NUEVA ENTREGA DE HERRAMIENTA
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Herramienta *</label>
                  <select style={selectStyle} value={toolForm.tool_id} onChange={e => setToolForm(f => ({ ...f, tool_id: e.target.value }))}>
                    <option value="">— Seleccionar herramienta —</option>
                    {items.filter(i => i.item_class === 'HERRAMIENTAS' && i.balance_qty > 0).map(i => (
                      <option key={i.id} value={i.id}>{i.token_code} · {i.name} (Disp: {fmt(i.balance_qty, 0)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Nombre del Trabajador *</label>
                  <input style={inputStyle} value={toolForm.worker_name} onChange={e => setToolForm(f => ({ ...f, worker_name: e.target.value }))} placeholder="Ej: Juan Pérez Quispe" />
                </div>
                <div>
                  <label style={labelStyle}>DNI / Código Trabajador</label>
                  <input style={inputStyle} value={toolForm.worker_doc} onChange={e => setToolForm(f => ({ ...f, worker_doc: e.target.value }))} placeholder="00000000" />
                </div>
                <div>
                  <label style={labelStyle}>Proyecto / Obra</label>
                  <input style={inputStyle} value={toolForm.project} onChange={e => setToolForm(f => ({ ...f, project: e.target.value }))} placeholder="Ej: Obra Lima Norte Bloque A" />
                </div>
                <div>
                  <label style={labelStyle}>Área Destino</label>
                  <select style={selectStyle} value={toolForm.area} onChange={e => setToolForm(f => ({ ...f, area: e.target.value as Area }))}>
                    {AREAS.map(a => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Horas para devolución (token de tiempo)</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" min="1" max="9999" style={{ ...inputStyle, width: 80 }}
                      value={toolForm.hours}
                      onChange={e => {
                        const h = Math.max(1, parseInt(e.target.value) || 1);
                        const ret = new Date(); ret.setHours(ret.getHours() + h);
                        setToolForm(f => ({ ...f, hours: String(h), expected_return: ret.toISOString() }));
                      }} />
                    <span style={{ fontSize: 11, color: C.textMut }}>horas</span>
                    {toolForm.expected_return && (
                      <span style={{ fontSize: 11, color: C.accentY, fontWeight: 700 }}>
                        → vence {new Date(toolForm.expected_return).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Condición de Salida</label>
                  <select style={selectStyle} value={toolForm.condition_out} onChange={e => setToolForm(f => ({ ...f, condition_out: e.target.value }))}>
                    <option value="BUENO">Bueno</option>
                    <option value="REGULAR">Regular</option>
                    <option value="MALO">Malo / Con defectos</option>
                  </select>
                </div>
                <div style={{ gridColumn: '2 / 4' }}>
                  <label style={labelStyle}>Observaciones</label>
                  <input style={inputStyle} value={toolForm.notes} onChange={e => setToolForm(f => ({ ...f, notes: e.target.value }))} placeholder="Accesorios entregados, instrucciones especiales..." />
                </div>
              </div>
              <button style={{ ...btn('warning'), minWidth: 160 }} disabled={loading} onClick={async () => {
                if (!toolForm.tool_id || !toolForm.worker_name) {
                  alert('Complete: seleccione herramienta e ingrese nombre del trabajador');
                  return;
                }
                const tool = items.find(i => i.id === toolForm.tool_id);
                if (!tool) {
                  alert('Artículo no encontrado en el inventario.\nHaga clic en "↻ Actualizar" y vuelva a intentarlo.');
                  return;
                }
                if (tool.balance_qty < 1) {
                  alert(`Sin stock disponible para "${tool.name}"`);
                  return;
                }
                const warehouseId = tool.warehouse_id || warehouses[0]?.id;
                if (!warehouseId) {
                  alert('No hay almacén configurado. Configure uno primero.');
                  return;
                }

                const now       = new Date();
                const dateStr   = now.toLocaleDateString('en-CA').replace(/-/g, '');
                const workerKey = (toolForm.worker_doc || toolForm.worker_name.slice(0, 6)).replace(/\s/g, '').slice(0, 8);
                // 3 partes del código (CTA-NAT-RUB) → único por tipo de herramienta
                // 252-HE-PA → "252HEPA"  |  252-HE-PI → "252HEPI"
                const toolShort = (tool.token_code || tool.sku || 'ITEM').split('-').slice(0, 3).join('').slice(0, 10).toUpperCase();
                const asgToken  = `ASG-${toolShort}-${workerKey}-${dateStr.slice(4)}-H${toolForm.hours || '8'}`;

                setLoading(true);
                try {
                  const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId };
                  const res = await fetch(`${apiBase}/inventory/exit`, {
                    method: 'POST', headers: hdrs,
                    body: JSON.stringify({
                      tenant_id:          tenantId,
                      product_id:         toolForm.tool_id,
                      warehouse_id:       warehouseId,
                      qty:                1,
                      exit_reason:        'TRANSFERENCIA',
                      notes:              `[ASIGNACION] ${asgToken} → ${toolForm.worker_name}${toolForm.project ? ' · ' + toolForm.project : ''}${toolForm.notes ? ' | ' + toolForm.notes : ''}`,
                      movement_reference: asgToken,
                      source_document:    `ASIGN-${workerKey}`,
                      area:               toolForm.area,
                      post_journal:       false,
                    }),
                  });
                  if (!res.ok) {
                    const err = await res.text();
                    alert(`Error al registrar entrega:\n${err}`);
                    return;
                  }

                  // Registrar asignación en estado local para visualizar en la tabla
                  setToolAssignments(prev => [{
                    id:              `ta-${Date.now()}`,
                    tool_id:         toolForm.tool_id,
                    tool_code:       tool.token_code,
                    tool_name:       tool.name,
                    worker_name:     toolForm.worker_name,
                    worker_doc:      toolForm.worker_doc,
                    project:         toolForm.project,
                    area:            toolForm.area,
                    assigned_date:   now.toLocaleDateString('en-CA'),
                    expected_return: toolForm.expected_return,
                    status:          'ASIGNADO' as AssignStatus,
                    condition_out:   toolForm.condition_out,
                    notes:           toolForm.notes,
                    asg_token:       asgToken,
                    started_at:      now.toISOString(),
                  }, ...prev]);

                  const nextRet = new Date(); nextRet.setHours(nextRet.getHours() + 8);
                  setToolForm({ tool_id: '', worker_name: '', worker_doc: '', project: '', area: 'OBRA', expected_return: nextRet.toISOString(), hours: '8', condition_out: 'BUENO', notes: '' });
                  say(`✓ Token ${asgToken} generado. ${tool.name} entregada a ${toolForm.worker_name} · ${toolForm.hours}h`);
                  await loadData(); // recargar stock real desde BD
                } catch {
                  alert('Error de conexión al registrar la entrega. Verifique la conexión.');
                } finally {
                  setLoading(false);
                }
              }}>
                {loading ? '⏳ Registrando...' : '🔧 Registrar Entrega'}
              </button>
            </div>

            {/* Tabla de asignaciones */}
            <h4 style={{ color: C.textMut, fontSize: 12, marginBottom: 8 }}>ASIGNACIONES ACTIVAS — TOKEN TEMPORAL ASG</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Código Tool', 'Token ASG (temporal)', 'Herramienta', 'Trabajador', 'DNI', 'Proyecto / Área', 'Asignado', 'Dev. Prevista', 'Horas uso', 'Estado', 'Condición Salida'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {toolAssignments.map((a, idx) => {
                  const color = a.status === 'DEVUELTO' ? C.accentG : a.status === 'VENCIDO' ? C.accentR : C.accentO;
                  const hoursUsed = a.status === 'ASIGNADO' && a.started_at
                    ? Math.round((Date.now() - new Date(a.started_at).getTime()) / 3600000 * 10) / 10
                    : (a.hours_assigned || 0);
                  return (
                    <tr key={a.id} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}>
                      {/* Código permanente del artículo */}
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: C.accentO }}>{a.tool_code}</td>
                      {/* Token temporal de asignación — tachado al devolver */}
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 10, color: a.status === 'ASIGNADO' ? C.accentY : C.textMut }}>
                        {a.status === 'ASIGNADO'
                          ? <span title="Token activo — se desactiva al devolver">{a.asg_token}</span>
                          : <span style={{ textDecoration: 'line-through', opacity: 0.45 }}>{a.asg_token}</span>
                        }
                      </td>
                      <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.tool_name}>{a.tool_name}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{a.worker_name}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: C.textDim }}>{a.worker_doc}</td>
                      <td style={{ ...td, fontSize: 11 }}>{a.project} · <span style={{ color: C.textDim }}>{AREA_PREFIX[a.area]}</span></td>
                      <td style={{ ...td, fontSize: 11 }}>{fmtDate(a.assigned_date)}</td>
                      <td style={{ ...td, fontSize: 11, color: a.status === 'VENCIDO' ? C.accentR : C.textMut }}>{fmtDate(a.expected_return)}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: a.status === 'ASIGNADO' ? C.accentY : C.textMut }}>
                        {a.status === 'ASIGNADO' ? `${hoursUsed}h ⏱` : a.hours_assigned ? `${a.hours_assigned}h` : '-'}
                      </td>
                      <td style={td}><span style={{ color, fontWeight: 700, fontSize: 11 }}>● {a.status}</span></td>
                      <td style={{ ...td, fontSize: 11, color: C.textMut }}>{a.condition_out}{a.condition_in ? ` → ${a.condition_in}` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─────────────────────────────────────────────────
            SUB-VISTA: DEVOLUCIÓN DE HERRAMIENTAS
            Doble clic en trabajador → ver sus items y devolver
            ───────────────────────────────────────────────── */}
        {subView === 'tool_return' && (() => {
          // Agrupar por trabajador — lógica pura, sin hooks
          const workerMap = new Map<string, { name: string; doc: string; assignments: ToolAssignment[] }>();
          for (const a of toolAssignments) {
            const key = a.worker_doc || a.worker_name;
            if (!workerMap.has(key)) workerMap.set(key, { name: a.worker_name, doc: a.worker_doc, assignments: [] });
            workerMap.get(key)!.assignments.push(a);
          }
          const workers = Array.from(workerMap.values());
          const workerData = selectedWorkerKey ? workerMap.get(selectedWorkerKey) : null;

          const doReturn = async (ids: string[], cond: string) => {
            const now = new Date();
            const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId };
            const warehouseId = warehouses[0]?.id;
            let successCount = 0;

            const assignments = toolAssignments.filter(a => ids.includes(a.id) && a.status !== 'DEVUELTO');
            for (const a of assignments) {
              const hoursUsed = a.started_at
                ? Math.round((now.getTime() - new Date(a.started_at).getTime()) / 3600000 * 10) / 10
                : 0;
              const devRef = `DEV-${a.asg_token || a.id.slice(-6)}`;

              // Llamar backend para registrar la entrada al kardex
              try {
                const res = await fetch(`${apiBase}/inventory/movements`, {
                  method: 'POST', headers: hdrs,
                  body: JSON.stringify({
                    tenant_id:          tenantId,
                    product_id:         a.tool_id,
                    warehouse_id:       warehouseId || 'w1',
                    movement_type:      'ENTRY',
                    qty:                1,
                    unit_cost:          0,
                    movement_reference: devRef,
                    source_document:    `DEVOLUCION-${a.worker_doc}`,
                    area:               a.area,
                    notes:              `[DEVOLUCION] ${a.asg_token} | ${hoursUsed}h uso | Cond: ${cond} | ${a.worker_name}`,
                    post_cost_entry:    false,
                  }),
                });
                if (res.ok) successCount++;
              } catch { /* continuar con los demás */ }
            }

            // Marcar como devueltos en estado local
            setToolAssignments(prev => prev.map(a => {
              if (!ids.includes(a.id) || a.status === 'DEVUELTO') return a;
              const hoursUsed = a.started_at
                ? Math.round((now.getTime() - new Date(a.started_at).getTime()) / 3600000 * 10) / 10
                : 0;
              return {
                ...a,
                status:         'DEVUELTO' as AssignStatus,
                condition_in:   cond,
                actual_return:  now.toLocaleDateString('en-CA'),
                returned_at:    now.toISOString(),
                hours_assigned: hoursUsed,
              };
            }));
            setReturnChecked(new Set());
            say(`✓ ${successCount}/${ids.length} ítem(s) devuelto(s) al almacén. Token ASG desactivado.`);
            await loadData(); // recargar stock real desde BD
          };

          return (
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Lista de trabajadores */}
              <div style={{ width: 260, minWidth: 260, borderRight: `1px solid ${C.border}`, overflowY: 'auto', padding: '12px 0' }}>
                <div style={{ padding: '0 12px 8px', fontSize: 11, fontWeight: 700, color: C.textDim, letterSpacing: '0.08em' }}>
                  TRABAJADORES CON ASIGNACIONES
                </div>
                {workers.length === 0 && (
                  <div style={{ padding: '20px 12px', color: C.textDim, fontSize: 12 }}>
                    Sin asignaciones activas. Registre entregas desde "Entrega Herram."
                  </div>
                )}
                {workers.map(w => {
                  const key = w.doc || w.name;
                  const active  = w.assignments.filter(a => a.status !== 'DEVUELTO').length;
                  const overdue = w.assignments.filter(a => a.status === 'VENCIDO').length;
                  const isSelected = selectedWorkerKey === key;
                  return (
                    <div key={key}
                      onDoubleClick={() => { setSelectedWorkerKey(key); setReturnChecked(new Set()); }}
                      onClick={() => setSelectedWorkerKey(key)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        background: isSelected ? '#1f3a5f' : 'transparent',
                        borderLeft: isSelected ? `3px solid ${C.accent}` : '3px solid transparent',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? C.accent : C.text }}>👷 {w.name}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>DNI: {w.doc}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: active > 0 ? C.accentO : C.accentG, fontWeight: 700 }}>
                          {active} pendiente{active !== 1 ? 's' : ''}
                        </span>
                        {overdue > 0 && (
                          <span style={{ fontSize: 10, color: C.accentR, fontWeight: 700 }}>⚠ {overdue} vencido{overdue !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Panel de items del trabajador */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, minWidth: 0 }}>
                {!workerData ? (
                  <div style={{ color: C.textDim, fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
                    👆 Haga clic o doble clic en un trabajador para ver sus herramientas y suministros asignados.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <h3 style={{ color: C.accent, margin: 0, fontSize: 15 }}>👷 {workerData.name}</h3>
                        <div style={{ fontSize: 12, color: C.textMut }}>DNI: {workerData.doc} · {workerData.assignments.length} ítem(s) asignado(s)</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {returnChecked.size > 0 && (
                          <button style={btn('success')} onClick={() => doReturn(Array.from(returnChecked), returnCondition['_global'] || 'BUENO')}>
                            ↩ Devolver Seleccionados ({returnChecked.size})
                          </button>
                        )}
                        <select style={{ ...selectStyle, width: 130, fontSize: 12 }}
                          value={returnCondition['_global'] || ''}
                          onChange={e => setReturnCondition(prev => ({ ...prev, _global: e.target.value }))}>
                          <option value="">Condición retorno</option>
                          <option value="BUENO">Bueno</option>
                          <option value="REGULAR">Regular</option>
                          <option value="MALO">Malo / Dañado</option>
                        </select>
                        <button style={btn('warning')} onClick={() => {
                          const allActive = workerData.assignments.filter(a => a.status !== 'DEVUELTO').map(a => a.id);
                          if (returnChecked.size === allActive.length) setReturnChecked(new Set());
                          else setReturnChecked(new Set(allActive));
                        }}>
                          ☐ Seleccionar Todo
                        </button>
                      </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['', 'Código', 'Token ASG', 'Herramienta / Accesorio', 'Proyecto', 'Asignado', 'Dev. Prevista', 'Horas uso', 'Cond. Salida', 'Estado', 'Retorno'].map(h => (
                          <th key={h} style={th}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {workerData.assignments.map((a, idx) => {
                          const checked  = returnChecked.has(a.id);
                          const overdue  = a.status === 'VENCIDO';
                          const returned = a.status === 'DEVUELTO';
                          const rowBg    = returned ? '#0a1a0a' : overdue ? '#1a0a0a' : idx % 2 === 0 ? C.bgRow : C.bgRowAlt;
                          const hoursUsed = a.status === 'ASIGNADO' && a.started_at
                            ? Math.round((Date.now() - new Date(a.started_at).getTime()) / 3600000 * 10) / 10
                            : (a.hours_assigned || 0);
                          return (
                            <tr key={a.id} style={{ background: rowBg }}>
                              <td style={td}>
                                {!returned && (
                                  <input type="checkbox" checked={checked}
                                    onChange={() => setReturnChecked(prev => {
                                      const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n;
                                    })} />
                                )}
                              </td>
                              <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: returned ? C.textDim : C.accentO }}>{a.tool_code}</td>
                              <td style={{ ...td, fontFamily: 'monospace', fontSize: 10, color: returned ? C.textMut : C.accentY }}>
                                {returned
                                  ? <span style={{ textDecoration: 'line-through', opacity: 0.45 }}>{a.asg_token}</span>
                                  : a.asg_token
                                }
                              </td>
                              <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.tool_name}{a.notes ? ` · ${a.notes}` : ''}
                              </td>
                              <td style={{ ...td, fontSize: 11, color: C.textDim }}>{a.project}</td>
                              <td style={{ ...td, fontSize: 11 }}>{fmtDate(a.assigned_date)}</td>
                              <td style={{ ...td, fontSize: 11, color: overdue ? C.accentR : C.textMut, fontWeight: overdue ? 700 : 400 }}>
                                {fmtDate(a.expected_return)}{overdue ? ' ⚠' : ''}
                              </td>
                              <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: returned ? C.textMut : C.accentY }}>
                                {a.status === 'ASIGNADO' ? `${hoursUsed}h ⏱` : a.hours_assigned ? `${a.hours_assigned}h` : '-'}
                              </td>
                              <td style={{ ...td, fontSize: 11 }}>{a.condition_out}</td>
                              <td style={td}>
                                <span style={{ fontWeight: 700, fontSize: 11, color: returned ? C.accentG : overdue ? C.accentR : C.accentO }}>
                                  {returned ? '✓ DEVUELTO' : overdue ? '⚠ VENCIDO' : '● ASIGNADO'}
                                </span>
                              </td>
                              <td style={td}>
                                {returned ? (
                                  <div style={{ fontSize: 11, color: C.accentG }}>
                                    <div>✓ {a.condition_in}</div>
                                    <div style={{ color: C.textMut }}>{a.actual_return}</div>
                                  </div>
                                ) : (
                                  <button style={{ ...btn('success'), fontSize: 10, padding: '3px 8px' }}
                                    onClick={() => doReturn([a.id], returnCondition['_global'] || 'BUENO')}>
                                    ↩ Devolver
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Alerta de ítems pendientes */}
                    {workerData.assignments.some(a => a.status !== 'DEVUELTO') && (
                      <div style={{ marginTop: 14, padding: 10, background: '#1a0a0a', border: `1px solid ${C.accentR}44`, borderRadius: 6, fontSize: 11 }}>
                        <span style={{ color: C.accentR, fontWeight: 700 }}>⚠ Ítems pendientes de devolución:</span>
                        {workerData.assignments.filter(a => a.status !== 'DEVUELTO').map(a => (
                          <span key={a.id} style={{ marginLeft: 8, color: a.status === 'VENCIDO' ? C.accentR : C.accentO, fontFamily: 'monospace', fontSize: 10 }}>
                            {a.tool_code}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* ─────────────────────────────────────────────────
            SUB-VISTA: DESPACHO DE MERCADERÍA
            ───────────────────────────────────────────────── */}
        {subView === 'dispatch' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <h3 style={{ color: C.accentR, margin: '0 0 8px', fontSize: 15 }}>📦 Despacho de Mercadería — Salidas para Venta / Producción</h3>
            <p style={{ fontSize: 11, color: C.textMut, marginBottom: 12 }}>
              Seleccione los artículos a despachar, indique cantidades, destino y referencia de salida.
            </p>
            {/* Referencia de despacho */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Nro. Referencia / OT / Pedido *</label>
                <input style={{ ...inputStyle, width: 200 }} value={dispatchRef.reference} onChange={e => setDispatchRef(f => ({ ...f, reference: e.target.value }))} placeholder="OT-2026-0050" />
              </div>
              <div>
                <label style={labelStyle}>Destino (cliente / proyecto)</label>
                <input style={{ ...inputStyle, width: 220 }} value={dispatchRef.destination} onChange={e => setDispatchRef(f => ({ ...f, destination: e.target.value }))} placeholder="Obra Lima Norte / Cliente SAC" />
              </div>
              <div>
                <label style={labelStyle}>Observaciones</label>
                <input style={{ ...inputStyle, width: 220 }} value={dispatchRef.notes} onChange={e => setDispatchRef(f => ({ ...f, notes: e.target.value }))} placeholder="Notas de despacho..." />
              </div>
            </div>

            {/* Tabla de artículos para despacho */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}><input type="checkbox" onChange={e => setDispatchItems(prev => prev.map(d => ({ ...d, checked: e.target.checked })))} /></th>
                  {['Código', 'Artículo', 'Clase', 'Unid', 'Disp.', 'Cant. Despacho', 'Costo U.', 'Total S/', 'Destino'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {dispatchItems.map((d, idx) => (
                  <tr key={d.id} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}>
                    <td style={td}><input type="checkbox" checked={d.checked} onChange={() => setDispatchItems(prev => prev.map(x => x.id === d.id ? { ...x, checked: !x.checked } : x))} /></td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: CLASS_COLOR[d.item_class] }}>{d.token_code}</td>
                    <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.product_name}</td>
                    <td style={td}><ClassBadge cls={d.item_class} /></td>
                    <td style={{ ...td, textAlign: 'center', color: C.textMut }}>{d.unit}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: d.qty_available < 10 ? C.accentO : C.text }}>{fmt(d.qty_available, 0)}</td>
                    <td style={td}>
                      <input type="number" min="0" max={d.qty_available}
                        style={{ ...inputStyle, width: 80, textAlign: 'right', fontSize: 12 }}
                        value={d.qty_to_dispatch || ''}
                        onChange={e => setDispatchItems(prev => prev.map(x => x.id === d.id ? { ...x, qty_to_dispatch: Math.min(parseFloat(e.target.value) || 0, x.qty_available), checked: true } : x))} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>S/ {fmt(d.unit_cost)}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.accentR }}>S/ {fmt(d.qty_to_dispatch * d.unit_cost)}</td>
                    <td style={{ ...td, fontSize: 11 }}>
                      <input style={{ ...inputStyle, fontSize: 11, padding: '3px 6px' }}
                        value={d.destination} onChange={e => setDispatchItems(prev => prev.map(x => x.id === d.id ? { ...x, destination: e.target.value } : x))}
                        placeholder={dispatchRef.destination || 'Destino...'} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: C.bg }}>
                  <td colSpan={7} style={{ ...td, borderTop: `2px solid ${C.border}`, fontWeight: 700, color: C.textMut }}>
                    {dispatchItems.filter(d => d.checked && d.qty_to_dispatch > 0).length} artículos seleccionados
                  </td>
                  <td style={{ ...td, borderTop: `2px solid ${C.border}`, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: C.accentR }}>
                    S/ {fmt(dispatchItems.filter(d => d.checked).reduce((s, d) => s + d.qty_to_dispatch * d.unit_cost, 0))}
                  </td>
                  <td style={{ ...td, borderTop: `2px solid ${C.border}` }} />
                </tr>
              </tfoot>
            </table>

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button style={btn('danger')} onClick={() => {
                const toDispatch = dispatchItems.filter(d => d.checked && d.qty_to_dispatch > 0);
                if (!toDispatch.length) { alert('Seleccione artículos con cantidad mayor a 0'); return; }
                if (!dispatchRef.reference) { alert('Ingrese un número de referencia'); return; }
                // Create EXIT movements
                const newMovements: Movement[] = toDispatch.map(d => ({
                  id: `m-disp-${Date.now()}-${d.id}`,
                  product_id: d.product_id,
                  warehouse_id: 'w1',
                  movement_type: 'EXIT',
                  qty: d.qty_to_dispatch,
                  unit_cost: d.unit_cost,
                  balance_qty: d.qty_available - d.qty_to_dispatch,
                  balance_avg_cost: d.unit_cost,
                  movement_reference: `SAL-${dispatchRef.reference}`,
                  source_document: dispatchRef.reference,
                  area: d.area,
                  validated_by: 'ADMIN',
                  notes: `Despacho a ${d.destination || dispatchRef.destination} · ${dispatchRef.notes}`,
                  created_at: new Date().toISOString(),
                }));
                setMovements(prev => [...newMovements, ...prev]);
                setItems(prev => prev.map(it => {
                  const d = toDispatch.find(x => x.product_id === it.id);
                  if (!d) return it;
                  const newQty = it.balance_qty - d.qty_to_dispatch;
                  return { ...it, balance_qty: newQty, balance_value: newQty * it.balance_avg_cost };
                }));
                // Reset quantities
                setDispatchItems(prev => prev.map(d => ({ ...d, qty_to_dispatch: 0, checked: false })));
                say(`✓ Despacho ${dispatchRef.reference}: ${toDispatch.length} artículo(s) despachados.`);
              }}>
                📦 Confirmar Despacho ({dispatchItems.filter(d => d.checked && d.qty_to_dispatch > 0).length})
              </button>
              <button style={btn('ghost')} onClick={() => setDispatchItems(prev => prev.map(d => ({ ...d, qty_to_dispatch: 0, checked: false })))}>
                Limpiar selección
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            SUB-VISTA: CATÁLOGO PCGE / RUBRO
            Browser del catálogo maestro con selección de rubro,
            filtro por cuenta, naturaleza y búsqueda.
            Al hacer clic en un artículo se puede crear en el inventario.
        ═══════════════════════════════════════════════════════ */}
        {subView === 'catalog' && (() => {
          const rubroList = Object.entries(RUBROS_DEF) as [Rubro, typeof RUBROS_DEF[Rubro]][];
          const filteredCatalog = CATALOG.filter(item => {
            const inRubro = item.rubros.includes(activeRubro) || item.rubros.includes('GE');
            if (!inRubro) return false;
            if (catalogFilter.cta   && item.cta !== catalogFilter.cta) return false;
            if (catalogFilter.nat   && item.nat !== catalogFilter.nat) return false;
            if (catalogFilter.tk    && item.tk  !== catalogFilter.tk)  return false;
            if (catalogFilter.search) {
              const q = catalogFilter.search.toLowerCase();
              if (!item.name.toLowerCase().includes(q) &&
                  !item.code.toLowerCase().includes(q) &&
                  !item.aliases.some(a => a.toLowerCase().includes(q))) return false;
            }
            return true;
          });

          const uniqueCtas = Array.from(new Set(filteredCatalog.map(i => i.cta))).sort();
          const uniqueNats = Array.from(new Set(filteredCatalog.map(i => i.nat))).sort();

          const createFromCatalog = (item: CatalogItem) => {
            const existingCodes = items.map(i => i.token_code);
            const nextCode = generateNextCode(existingCodes, item.cta, item.nat, activeRubro, item.tk);
            openCreate();
            // Pre-fill the form with catalog data
            setForm(f => ({
              ...f,
              token_code: nextCode,
              sku: nextCode,
              name: item.name,
              item_class: (item.nat === 'MP' || item.nat === 'MC' || item.nat === 'MM' ? 'MATERIA_PRIMA'
                : item.nat === 'ME' || item.nat === 'MD' ? 'MERCADERIA'
                : item.nat === 'HE' || item.nat === 'HT' || item.nat === 'MQ' ? 'HERRAMIENTAS'
                : item.nat === 'SU' || item.nat === 'CO' || item.nat === 'LI' || item.nat === 'GA' ? 'INSUMOS'
                : item.nat === 'EP' || item.nat === 'AL' || item.nat === 'AG' || item.nat === 'ME' ? 'CONSUMIBLE'
                : item.nat === 'VH' || item.nat === 'EQ' || item.nat === 'MU' || item.nat === 'MQ' ? 'ACTIVO_FIJO'
                : 'MERCADERIA') as any,
              token_type: item.tk === 'P' ? 'PERMANENTE' : 'TEMPORAL',
              unit_of_measure: item.unit,
              default_cost_account: item.cta,
              default_sales_account: item.gasto,
              specs: item.description || '',
            }));
          };

          return (
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Panel de selección de rubro */}
              <div style={{ width: 200, minWidth: 200, borderRight: `1px solid ${C.border}`, overflowY: 'auto', background: '#090d12' }}>
                <div style={{ padding: '10px 12px 6px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Rubro de Empresa
                </div>
                {rubroList.map(([code, meta]) => (
                  <button key={code} onClick={() => { setActiveRubro(code); tenantStore.setRubro(code); setCatalogFilter({ cta: '', nat: '', tk: '', search: '' }); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '8px 12px',
                      background: activeRubro === code ? '#1f3a5f' : 'transparent',
                      border: 'none', borderLeft: activeRubro === code ? `3px solid ${meta.color}` : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}>
                    <span style={{ fontSize: 15 }}>{meta.icon}</span>
                    <span style={{ fontSize: 11, color: activeRubro === code ? meta.color : C.textMut, fontWeight: activeRubro === code ? 700 : 400 }}>
                      {meta.name.split(' (')[0]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Contenido del catálogo */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {/* Filtros del catálogo */}
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.bgCard, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>
                    {RUBROS_DEF[activeRubro].icon} {RUBROS_DEF[activeRubro].name}
                    <span style={{ marginLeft: 8, fontSize: 11, color: C.textMut }}>— {filteredCatalog.length} artículos</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  <input style={{ ...inputStyle, width: 200, height: 30, fontSize: 12 }} placeholder="Buscar artículo..."
                    value={catalogFilter.search} onChange={e => setCatalogFilter(f => ({ ...f, search: e.target.value }))} />
                  <select style={{ ...selectStyle, width: 100, height: 30, fontSize: 12 }} value={catalogFilter.cta}
                    onChange={e => setCatalogFilter(f => ({ ...f, cta: e.target.value }))}>
                    <option value="">Cta. PCGE</option>
                    {uniqueCtas.map(c => <option key={c} value={c}>{c} — {PCGE_INVENTARIO[c]?.slice(0,20) || c}</option>)}
                  </select>
                  <select style={{ ...selectStyle, width: 80, height: 30, fontSize: 12 }} value={catalogFilter.tk}
                    onChange={e => setCatalogFilter(f => ({ ...f, tk: e.target.value }))}>
                    <option value="">Token</option>
                    <option value="P">● P</option>
                    <option value="T">◌ T</option>
                    <option value="F">F</option>
                  </select>
                  <button style={{ ...btn('ghost'), height: 30, fontSize: 11 }}
                    onClick={() => setCatalogFilter({ cta: '', nat: '', tk: '', search: '' })}>✕ Limpiar</button>
                </div>

                {/* Tabla del catálogo */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                  {filteredCatalog.length === 0 && (
                    <div style={{ color: C.textDim, fontSize: 13, padding: 32, textAlign: 'center' }}>
                      Sin artículos para los filtros aplicados.
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                    <thead>
                      <tr>{['Código','Artículo','Cta. Inventario','Cta. Gasto','Nat.','Unid.','Token','Acción'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {filteredCatalog.map((item, idx) => (
                        <tr key={item.code} style={{ background: idx % 2 === 0 ? C.bgRow : C.bgRowAlt }}
                          title={item.description || item.aliases.join(' · ')}>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: C.accent, whiteSpace: 'nowrap' }}>{item.code}</td>
                          <td style={{ ...td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong style={{ fontSize: 12 }}>{item.name}</strong>
                            <div style={{ fontSize: 10, color: C.textDim }}>{item.aliases.slice(0, 2).join(' / ')}</div>
                          </td>
                          <td style={{ ...td, fontSize: 11 }}>
                            <div style={{ fontFamily: 'monospace', color: C.accentG, fontWeight: 700 }}>{item.cta}</div>
                            <div style={{ fontSize: 10, color: C.textDim }}>{item.cta_name}</div>
                          </td>
                          <td style={{ ...td, fontSize: 11 }}>
                            <div style={{ fontFamily: 'monospace', color: C.accentR, fontWeight: 700 }}>{item.gasto}</div>
                            <div style={{ fontSize: 10, color: C.textDim }}>{item.gasto_name}</div>
                          </td>
                          <td style={{ ...td, fontSize: 11, color: C.textMut, textAlign: 'center' }}>{item.nat}</td>
                          <td style={{ ...td, fontSize: 11, textAlign: 'center', color: C.textMut }}>{item.unit}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <span style={{
                              fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 4,
                              background: item.tk === 'P' ? '#1a3a20' : item.tk === 'T' ? '#1f3a5f' : '#2a1a0a',
                              color: item.tk === 'P' ? C.accentG : item.tk === 'T' ? C.accent : C.accentO,
                            }}>
                              {item.tk === 'P' ? '● PERM' : item.tk === 'T' ? '◌ TEMP' : '⊗ FUNG'}
                            </span>
                          </td>
                          <td style={td}>
                            <button style={{ ...btn('primary'), fontSize: 10, padding: '3px 8px' }}
                              onClick={() => createFromCatalog(item)}>
                              + Crear
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Info de cuentas al pie */}
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 16px', background: C.bgCard, fontSize: 11, color: C.textDim, display: 'flex', gap: 20 }}>
                  <span>
                    <span style={{ color: C.accentG, fontWeight: 700 }}>Cta. Inventario (Dr compra/Cr salida):</span> Cuenta 2XX · 3XX
                  </span>
                  <span>
                    <span style={{ color: C.accentR, fontWeight: 700 }}>Cta. Gasto (Dr consumo):</span> Cuenta 6XX + Centro de Costo
                  </span>
                  <span style={{ color: C.textDim }}>NIC 2 · PCGE Perú · Promedio Ponderado</span>
                </div>
              </div>
            </div>
          );
        })()}

        {subView === 'stock' && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* ── TABLA INVENTARIO (izquierda) ── */}
        <div style={{ flex: '0 0 62%', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}` }}>
          <div ref={tableRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 860 }}>
              <colgroup>
                <col style={{ width: 30 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 220 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 70 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={th}><input type="checkbox" checked={allItemsChecked} onChange={toggleAllItems} /></th>
                  <th style={th}>Código Token</th>
                  <th style={th}>Artículo / Área</th>
                  <th style={th}>Clase</th>
                  <th style={th}>Unid</th>
                  <th style={th}>Stock</th>
                  <th style={th}>Costo Prom</th>
                  <th style={th}>Valor S/</th>
                  <th style={th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: C.textDim, padding: 32 }}>Sin artículos para los filtros aplicados.</td></tr>
                )}
                {filteredItems.map((it, idx) => {
                  const isSel = it.id === selectedId;
                  const isChk = checkedIds.has(it.id);
                  const st = stockStatus(it.balance_qty, it.min_stock, it.max_stock);
                  const rowBg = isSel ? C.bgSel : idx % 2 === 0 ? C.bgRow : C.bgRowAlt;
                  return (
                    <tr key={it.id}
                      style={{ background: rowBg, cursor: 'pointer', transition: 'background .1s' }}
                      onClick={() => setSelectedId(it.id === selectedId ? null : it.id)}
                    >
                      <td style={td} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isChk} onChange={() => {
                          setCheckedIds(prev => { const n = new Set(prev); n.has(it.id) ? n.delete(it.id) : n.add(it.id); return n; });
                        }} />
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
                        <div style={{ color: CLASS_COLOR[it.item_class], fontWeight: 700 }}>{it.token_code}</div>
                        <TokenBadge type={it.token_type} />
                      </td>
                      <td style={td}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>{it.name}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>
                          {AREA_LABEL[it.area]} {it.location ? `· ${it.location}` : ''}
                          {it.brand ? ` · ${it.brand}` : ''}
                        </div>
                      </td>
                      <td style={td}><ClassBadge cls={it.item_class} /></td>
                      <td style={{ ...td, color: C.textMut, textAlign: 'center' }}>{it.unit_of_measure}</td>
                      <td style={td}><StockBar qty={it.balance_qty} min={it.min_stock} max={it.max_stock} /></td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>
                        <span style={{ color: st === 'critical' || st === 'low' ? C.accentO : C.text }}>
                          {fmt(it.balance_avg_cost)}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                        <span style={{ color: it.balance_value > 10000 ? C.accentG : C.text }}>
                          {fmt(it.balance_value)}
                        </span>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <button style={{ ...btn('ghost'), padding: '3px 8px', fontSize: 11 }}
                          onClick={e => { e.stopPropagation(); openEdit(it); }}>
                          ✏
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr style={{ background: C.bg, position: 'sticky', bottom: 0 }}>
                  <td colSpan={5} style={{ ...td, borderTop: `2px solid ${C.border}`, fontSize: 11, color: C.textMut, fontWeight: 700 }}>
                    {filteredItems.length} artículos · {checkedIds.size > 0 ? `${checkedIds.size} seleccionados` : ''}
                  </td>
                  <td style={{ ...td, borderTop: `2px solid ${C.border}`, textAlign: 'right', fontWeight: 700, fontSize: 12, color: C.accentG }}>
                    {fmt(filteredItems.reduce((s, i) => s + i.balance_qty, 0), 0)}
                  </td>
                  <td style={{ ...td, borderTop: `2px solid ${C.border}` }} />
                  <td style={{ ...td, borderTop: `2px solid ${C.border}`, textAlign: 'right', fontWeight: 800, fontSize: 13, color: C.accentG, fontFamily: 'monospace' }}>
                    S/ {fmt(stats.totalValue)}
                  </td>
                  <td style={{ ...td, borderTop: `2px solid ${C.border}` }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── PANEL DERECHO: MOVIMIENTOS ── */}
        <div style={{ flex: '0 0 38%', minWidth: 0, display: 'flex', flexDirection: 'column', background: C.bgCard }}>
          {/* Panel header */}
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '10px 14px', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6 }}>
              {selectedItem ? `📦 ${selectedItem.token_code} — ${selectedItem.name.slice(0, 40)}` : '📦 Todos los movimientos'}
            </div>
            {selectedItem && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <ClassBadge cls={selectedItem.item_class} />
                <TokenBadge type={selectedItem.token_type} />
                <span style={{ fontSize: 11, color: C.textMut }}>
                  Stock: <strong style={{ color: C.accentG }}>{fmt(selectedItem.balance_qty, 0)} {selectedItem.unit_of_measure}</strong>
                  &nbsp;· Valor: <strong style={{ color: C.accentG }}>S/ {fmt(selectedItem.balance_value)}</strong>
                </span>
              </div>
            )}
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2 }}>
              {(['ALL', 'ENTRY', 'EXIT'] as const).map(t => (
                <button key={t} style={{
                  ...btn('ghost'), padding: '4px 12px', fontSize: 11,
                  background: movTab === t ? (t === 'ENTRY' ? '#1a3a20' : t === 'EXIT' ? '#3a1a1a' : '#1f3a5f') : 'transparent',
                  color: movTab === t ? (t === 'ENTRY' ? '#3fb950' : t === 'EXIT' ? '#f85149' : C.accent) : C.textMut,
                  borderColor: movTab === t ? (t === 'ENTRY' ? '#3fb950' : t === 'EXIT' ? '#f85149' : C.accent) : C.border,
                }} onClick={() => setMovTab(t)}>
                  {t === 'ALL' ? '≡ Todos' : t === 'ENTRY' ? '▲ Entradas' : '▼ Salidas'}
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>
                    ({(t === 'ALL' ? itemMovements : itemMovements.filter(m => m.movement_type === t)).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Movement list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px 0' }}>
            {itemMovements.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                Sin movimientos registrados para el filtro aplicado.
              </div>
            )}
            {itemMovements.map((m, idx) => {
              const isEntry = m.movement_type === 'ENTRY';
              const itemName = items.find(i => i.id === m.product_id)?.name || m.product_id;
              return (
                <div key={m.id} style={{
                  borderBottom: `1px solid ${C.border}22`, padding: '10px 14px',
                  background: idx % 2 === 0 ? 'transparent' : C.bgRow + '44',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <MovTypeIcon type={m.movement_type} />
                      <span style={{ fontSize: 11, color: C.textDim }}>{fmtDateTime(m.created_at)}</span>
                    </div>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 13, fontWeight: 800,
                      color: isEntry ? C.accentG : C.accentR,
                    }}>
                      {isEntry ? '+' : '-'}{fmt(m.qty, 0)} {items.find(i => i.id === m.product_id)?.unit_of_measure || ''}
                    </span>
                  </div>
                  {!selectedId && (
                    <div style={{ fontSize: 11, color: C.textMut, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {itemName}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: C.textDim }}>
                    <span>Ref: <span style={{ color: C.text, fontFamily: 'monospace' }}>{m.movement_reference}</span></span>
                    <span>Doc: {m.source_document}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: C.textDim, marginTop: 2 }}>
                    <span>Área: <span style={{ color: C.textMut }}>{m.area || '—'}</span></span>
                    <span>Costo: S/ {fmt(m.unit_cost)}</span>
                    <span>Saldo: {fmt(m.balance_qty, 0)}</span>
                  </div>
                  {m.notes && (
                    <div style={{ marginTop: 3, fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>💬 {m.notes}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary by class */}
          {!selectedId && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMut, marginBottom: 8, letterSpacing: '0.07em' }}>
                VALOR POR CLASE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {CLASSES.map(cls => {
                  const clsItems = filteredItems.filter(i => i.item_class === cls);
                  if (!clsItems.length) return null;
                  const val = clsItems.reduce((s, i) => s + i.balance_value, 0);
                  const pct = stats.totalValue > 0 ? (val / stats.totalValue) * 100 : 0;
                  return (
                    <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 20, height: 10, borderRadius: 2, background: CLASS_COLOR[cls], flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: C.textMut, flex: 1 }}>{CLASS_LABEL[cls]}</span>
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.text }}>S/ {fmt(val)}</span>
                      <div style={{ width: 60, height: 4, borderRadius: 2, background: C.border, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: CLASS_COLOR[cls] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </div>
        )}
        </div>
      </div>

      {/* ── PANEL VALIDACIÓN DE COMPRAS ── */}
      <div style={{ borderTop: `2px solid ${C.accentY}44`, background: C.bgCard, flexShrink: 0 }}>
        {/* Cabecera del drawer */}
        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: purchaseOpen ? `1px solid ${C.border}` : 'none' }}
          onClick={() => setPurchaseOpen(o => !o)}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.accentY }}>
            {purchaseOpen ? '▼' : '▶'} &nbsp;📥 VALIDACIÓN DE COMPRAS PENDIENTES
          </span>
          {pendingPurchases.length > 0 && (
            <span style={{ background: '#3a2a00', color: C.accentY, borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
              {pendingPurchases.length} pendientes
            </span>
          )}
          {pendingChecked.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: C.textMut }}>
                {pendingChecked.length} seleccionados · S/ {fmt(pendingTotal)}
              </span>
              <button style={btn('success')} onClick={e => { e.stopPropagation(); handleValidatePurchases(); }}>
                ✓ Ingresar al Almacén ({pendingChecked.length})
              </button>
            </>
          )}
          {pendingPurchases.length > 0 && pendingChecked.length === 0 && (
            <button style={btn('primary')} onClick={e => { e.stopPropagation(); toggleAllPurchases(); }}>
              ☐ Seleccionar Todo
            </button>
          )}
        </div>

        {purchaseOpen && pendingPurchases.length > 0 && (
          <div style={{ maxHeight: 220, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 900 }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={th}><input type="checkbox" checked={allChecked} onChange={toggleAllPurchases} /></th>
                  <th style={th}>Tipo Doc.</th>
                  <th style={th}>OC / Ref</th>
                  <th style={th}>Artículo</th>
                  <th style={th}>Cta. Inv. (Dr)</th>
                  <th style={th}>Cta. Gasto (Dr)</th>
                  <th style={th}>Área CC</th>
                  <th style={th}>Cant</th>
                  <th style={th}>Costo U.</th>
                  <th style={th}>Proveedor RUC</th>
                  <th style={th}>Fecha</th>
                  <th style={th}>Total S/</th>
                </tr>
              </thead>
              <tbody>
                {pendingPurchases.map((p, idx) => {
                  // Auto-match catálogo para mostrar sugerencia
                  const catalogMatch = matchCatalogItem(p.product_name, p.account_code, activeRubro);
                  // ctaSuggested: primeros 3 dígitos para el token de almacén (no truncar account_code completo)
                  const ctaSuggested = catalogMatch?.cta || (p.account_code ? p.account_code.slice(0, 3) : '252');
                  const gastoSuggested = catalogMatch?.gasto || '6569';
                  const isGuia = p.doc_type === '09';
                  return (
                  <tr key={p.id}
                    style={{ background: p.checked ? '#1a2a10' : idx % 2 === 0 ? C.bgRow : C.bgRowAlt, cursor: 'pointer' }}
                    onClick={() => togglePurchase(p.id)}>
                    <td style={td} onClick={e => { e.stopPropagation(); togglePurchase(p.id); }}>
                      <input type="checkbox" checked={p.checked} onChange={() => togglePurchase(p.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isGuia ? '#2a1a50' : '#1a2a40', color: isGuia ? '#a371f7' : C.accent }}>
                        {isGuia ? '🚚 GUÍA' : '🧾 FACT'}
                      </span>
                      <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.textDim }}>{p.doc_series}-{p.doc_number}</div>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: C.accent }}>{p.purchase_ref}</td>
                    <td style={{ ...td, overflow: 'hidden' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }} title={p.product_name}>{p.product_name}</div>
                      {/* Código estructurado del almacén CTA-NAT-RUB-SEQQ-TK */}
                      {(p.catalog_code || catalogMatch?.code) && (
                        <div style={{ fontFamily: 'monospace', fontSize: 9, color: C.accentY, fontWeight: 700 }}>
                          {p.catalog_code || catalogMatch?.code}
                          {p.catalog_match || catalogMatch ? ' ✓' : ' ⚠provisional'}
                        </div>
                      )}
                      {catalogMatch && (
                        <div style={{ fontSize: 9, color: C.accentG }}>{catalogMatch.name}</div>
                      )}
                    </td>
                    <td style={td}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: C.accentG, fontSize: 12 }}>{ctaSuggested}</div>
                      <div style={{ fontSize: 9, color: C.textDim }}>{PCGE_INVENTARIO[ctaSuggested]?.slice(0,22) || ''}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, color: C.accentR, fontSize: 12 }}>{gastoSuggested}</div>
                      <div style={{ fontSize: 9, color: C.textDim }}>{PCGE_GASTO[gastoSuggested]?.slice(0,22) || ''}</div>
                    </td>
                    <td style={{ ...td, fontSize: 11, color: C.textMut }}>{AREA_PREFIX[p.area]}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(p.qty, 0)}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace' }}>S/ {fmt(p.unit_cost)}</td>
                    <td style={{ ...td, fontSize: 11 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }} title={p.supplier_name}>{p.supplier_name}</div>
                      {p.supplier_ruc && <div style={{ fontSize: 9, fontFamily: 'monospace', color: C.textDim }}>{p.supplier_ruc}</div>}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: C.textDim }}>{fmtDate(p.doc_date)}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.accentG }}>
                      S/ {fmt(p.total)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: C.bg }}>
                  <td colSpan={10} style={{ ...td, borderTop: `2px solid ${C.border}`, fontWeight: 700, fontSize: 11, color: C.textMut }}>
                    {pendingPurchases.length} compras pendientes · {pendingChecked.length} seleccionadas
                  </td>
                  <td style={{ ...td, borderTop: `2px solid ${C.border}`, textAlign: 'right', fontWeight: 800, color: C.accentY, fontFamily: 'monospace' }}>
                    S/ {fmt(pendingPurchases.reduce((s, p) => s + p.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {purchaseOpen && pendingPurchases.length === 0 && (
          <div style={{ padding: '14px 16px', fontSize: 12, color: C.accentG }}>
            ✓ Sin compras pendientes de validación.
          </div>
        )}
      </div>

      {/* ── MODAL CRUD ── */}
      {modalMode && (
        <ItemModal
          mode={modalMode}
          form={form}
          onFormChange={setForm}
          onSave={handleSave}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
          onClose={() => setModalMode(null)}
          warehouses={warehouses}
          nextSeq={nextSeq}
        />
      )}
    </div>
  );
}
