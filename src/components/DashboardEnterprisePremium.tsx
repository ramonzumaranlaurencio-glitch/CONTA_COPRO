import React, { useMemo, useState } from 'react';

/* ─── Tipo compatible con JournalRow de EnterpriseWorkspace ─────── */
export type DashboardRow = {
  id: string;
  entryId?: string;
  date: string;
  period?: string;
  description: string;
  account: string;
  accountName?: string;
  costCenter?: string;
  debit: string;
  credit: string;
  status: string;
  sourceModule: string;
  partnerRuc?: string;
  documentSeries?: string;
  documentNumber?: string;
};

type Props = {
  rows?: DashboardRow[];
};

/* ─── Helpers ───────────────────────────────────────────────────── */

const toNum = (v: string | number | undefined | null) => {
  const raw = String(v ?? '0').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(raw);
  return isFinite(n) ? n : 0;
};

const fmt = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const modUp = (r: DashboardRow) => String(r.sourceModule ?? '').toUpperCase();

const isVenta = (r: DashboardRow) => modUp(r) === 'BILLING' || modUp(r) === 'VENTAS';
const isCompra = (r: DashboardRow) => modUp(r) === 'PURCHASING' || modUp(r) === 'COMPRAS';

/* ─── Componentes visuales ──────────────────────────────────────── */

const StatusBadge = ({ status }: { status: string }) => {
  const s = status?.toUpperCase();
  const map: Record<string, { bg: string; color: string }> = {
    SUNAT:    { bg: '#dbeafe', color: '#1d4ed8' },
    POSTED:   { bg: '#dcfce7', color: '#15803d' },
    POSTEADO: { bg: '#dcfce7', color: '#15803d' },
    PENDING:  { bg: '#fef9c3', color: '#a16207' },
    PENDIENTE:{ bg: '#fef9c3', color: '#a16207' },
    REVIEW:   { bg: '#ffedd5', color: '#c2410c' },
    REVISION: { bg: '#ffedd5', color: '#c2410c' },
  };
  const theme = map[s] ?? { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 10, fontWeight: 800, background: theme.bg, color: theme.color,
      letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {s}
    </span>
  );
};

type KpiProps = { title: string; value: string; sub: string; color: string; icon: string };
const KpiCard = ({ title, value, sub, color, icon }: KpiProps) => (
  <div style={{
    background: '#fff', borderRadius: 14, padding: '18px 20px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${color}`,
    display: 'flex', alignItems: 'center', gap: 14, minWidth: 0,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12, background: `${color}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, flexShrink: 0,
    }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>{title}</p>
      <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: '#111827' }}>{value}</p>
      <p style={{ margin: '2px 0 0', fontSize: 11, color: color, fontWeight: 600 }}>{sub}</p>
    </div>
  </div>
);

type PanelProps = {
  title: string; subtitle?: string; accent: string; icon: string;
  action?: React.ReactNode; children: React.ReactNode;
};
const Panel = ({ title, subtitle, accent, icon, action, children }: PanelProps) => (
  <div style={{
    background: '#fff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
  }}>
    <div style={{
      padding: '14px 18px', borderBottom: '1px solid #f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: `linear-gradient(90deg, ${accent}0a 0%, transparent 100%)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: `${accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>{icon}</div>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</h3>
          {subtitle && <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div style={{ padding: '14px 18px', flex: 1 }}>{children}</div>
  </div>
);

type ColDef = { label: string; align?: 'left' | 'right' | 'center'; width?: string | number };
const DataTable = ({ cols, children }: { cols: ColDef[]; children: React.ReactNode }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
          {cols.map((c, i) => (
            <th key={i} style={{
              padding: '7px 10px', textAlign: c.align ?? 'left', fontWeight: 700,
              fontSize: 10, color: '#64748b', letterSpacing: '0.07em',
              whiteSpace: 'nowrap', width: c.width,
            }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const TR = ({ idx, children }: { idx: number; children: React.ReactNode }) => (
  <tr
    style={{ background: idx % 2 === 1 ? '#f8fafc' : '#fff', borderBottom: '1px solid #f1f5f9', cursor: 'default' }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 1 ? '#f8fafc' : '#fff'; }}
  >{children}</tr>
);

const Td = ({ v, right, center, bold, muted, mono, color }: {
  v: React.ReactNode; right?: boolean; center?: boolean;
  bold?: boolean; muted?: boolean; mono?: boolean; color?: string;
}) => (
  <td style={{
    padding: '8px 10px',
    textAlign: right ? 'right' : center ? 'center' : 'left',
    fontWeight: bold ? 700 : 400,
    color: color ?? (muted ? '#9ca3af' : '#374151'),
    fontFamily: mono ? 'monospace' : undefined,
    whiteSpace: 'nowrap',
  }}>{v}</td>
);

const EmptyRow = ({ cols, msg }: { cols: number; msg: string }) => (
  <tr>
    <td colSpan={cols} style={{
      padding: '32px 16px', textAlign: 'center',
      color: '#9ca3af', fontSize: 13, fontStyle: 'italic',
    }}>
      {msg}
    </td>
  </tr>
);

const TotalRow = ({ cols, label, total, color }: { cols: number; label: string; total: number; color: string }) => (
  <tr style={{ background: `${color}0d`, borderTop: `2px solid ${color}33` }}>
    <td colSpan={cols - 1} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 12, color }}>{label}</td>
    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 13, color }}>{fmt(total)}</td>
  </tr>
);

/* ─── Componente principal ──────────────────────────────────────── */

export const DashboardEnterprisePremium = ({ rows = [] }: Props) => {
  const [tab, setTab] = useState<'ventas' | 'compras' | 'contabilidad'>('ventas');

  /* Derivaciones desde rows reales */
  const ventasRows = useMemo(
    () => rows.filter(isVenta).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [rows],
  );
  const comprasRows = useMemo(
    () => rows.filter(isCompra).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [rows],
  );
  const recentRows = useMemo(
    () => [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    [rows],
  );

  /* KPIs calculados */
  const kpis = useMemo(() => {
    const hasData = rows.length > 0;
    const ventasTotal = rows.filter(isVenta).reduce((s, r) => s + toNum(r.credit), 0);
    const comprasTotal = rows.filter(isCompra).reduce((s, r) => s + toNum(r.debit), 0);
    const igvCredit = rows.filter(r => r.account?.startsWith('40')).reduce((s, r) => s + toNum(r.credit), 0);
    const igvDebit  = rows.filter(r => r.account?.startsWith('40')).reduce((s, r) => s + toNum(r.debit), 0);
    const igv = igvCredit - igvDebit;
    return {
      ventas:  hasData ? fmt(ventasTotal)  : '—',
      compras: hasData ? fmt(comprasTotal) : '—',
      igv:     hasData ? fmt(igv)          : '—',
      asientos: String(rows.length),
      balance: hasData ? fmt(ventasTotal - comprasTotal) : '—',
    };
  }, [rows]);

  const noData = rows.length === 0;

  const tabBtn = (t: typeof tab, label: string): React.ReactNode => (
    <button
      type="button"
      onClick={() => setTab(t)}
      style={{
        padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 7,
        cursor: 'pointer', transition: 'all 0.13s',
        background: tab === t ? '#0078d4' : 'transparent',
        color: tab === t ? '#fff' : '#64748b',
      }}
    >{label}</button>
  );

  return (
    <div style={{
      padding: '18px 22px', background: '#f0f2f5', minHeight: '100%',
      overflowY: 'auto', fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* Aviso sin datos */}
      {noData && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10,
          padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#92400e', fontWeight: 500,
        }}>
          ⚠ Sin asientos en el período. Registre ventas y compras para ver los datos aquí.
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard title="VENTAS PERÍODO"    value={kpis.ventas}   sub={`${ventasRows.length} comprobantes`}  color="#0078d4" icon="🧾" />
        <KpiCard title="COMPRAS PERÍODO"   value={kpis.compras}  sub={`${comprasRows.length} comprobantes`} color="#7c3aed" icon="📦" />
        <KpiCard title="IGV NETO"          value={kpis.igv}      sub="cta. 40xx"                            color="#f59e0b" icon="🏛️" />
        <KpiCard title="BALANCE BRUTO"     value={kpis.balance}  sub="ventas − compras"                     color="#10b981" icon="📊" />
        <KpiCard title="ASIENTOS PERÍODO"  value={kpis.asientos} sub="en libro diario"                      color="#6366f1" icon="📒" />
      </div>

      {/* ── Tabla de transacciones con tabs ── */}
      <div style={{
        background: '#fff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden', marginBottom: 18,
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(90deg, #0078d418 0%, transparent 100%)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Últimas Transacciones</h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
              {noData ? 'Sin datos — registre ventas y compras' : `${rows.length} asientos en el período activo`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 3, background: '#f1f5f9', borderRadius: 9, padding: 3 }}>
            {tabBtn('ventas', '🧾 Ventas')}
            {tabBtn('compras', '📦 Compras')}
            {tabBtn('contabilidad', '📒 Contabilidad')}
          </div>
        </div>

        <div style={{ padding: '0 2px 2px' }}>
          {/* ── Ventas ── */}
          {tab === 'ventas' && (
            <DataTable cols={[
              { label: 'FECHA', width: 95 },
              { label: 'DOCUMENTO', width: 130 },
              { label: 'RUC / CLIENTE' },
              { label: 'GLOSA' },
              { label: 'CUENTA', width: 70 },
              { label: 'DEBE', align: 'right', width: 110 },
              { label: 'HABER', align: 'right', width: 110 },
              { label: 'ESTADO', align: 'center', width: 95 },
            ]}>
              {ventasRows.length === 0
                ? <EmptyRow cols={8} msg="Sin ventas registradas en el período. Use 'Registrar Venta' para crear comprobantes." />
                : ventasRows.map((r, i) => {
                    const docNum = r.documentSeries && r.documentNumber ? `${r.documentSeries}-${r.documentNumber}` : '—';
                    return (
                      <TR key={r.id} idx={i}>
                        <Td v={r.date} muted />
                        <Td v={docNum} bold color="#0078d4" mono />
                        <Td v={r.partnerRuc || '—'} muted />
                        <Td v={r.description} />
                        <Td v={r.account} color="#6366f1" mono />
                        <Td v={toNum(r.debit) > 0 ? fmt(toNum(r.debit)) : '—'} right color={toNum(r.debit) > 0 ? '#15803d' : '#d1d5db'} mono />
                        <Td v={toNum(r.credit) > 0 ? fmt(toNum(r.credit)) : '—'} right color={toNum(r.credit) > 0 ? '#dc2626' : '#d1d5db'} mono />
                        <Td v={<StatusBadge status={r.status} />} center />
                      </TR>
                    );
                  })
              }
              {ventasRows.length > 0 && (
                <TotalRow
                  cols={8}
                  label={`TOTAL VENTAS — ${ventasRows.length} líneas`}
                  total={ventasRows.reduce((s, r) => s + toNum(r.credit), 0)}
                  color="#0078d4"
                />
              )}
            </DataTable>
          )}

          {/* ── Compras ── */}
          {tab === 'compras' && (
            <DataTable cols={[
              { label: 'FECHA', width: 95 },
              { label: 'DOCUMENTO', width: 130 },
              { label: 'RUC / PROVEEDOR' },
              { label: 'GLOSA' },
              { label: 'CUENTA', width: 70 },
              { label: 'DEBE', align: 'right', width: 110 },
              { label: 'HABER', align: 'right', width: 110 },
              { label: 'ESTADO', align: 'center', width: 95 },
            ]}>
              {comprasRows.length === 0
                ? <EmptyRow cols={8} msg="Sin compras registradas en el período. Use 'Registrar Compra' para crear comprobantes." />
                : comprasRows.map((r, i) => {
                    const docNum = r.documentSeries && r.documentNumber ? `${r.documentSeries}-${r.documentNumber}` : '—';
                    return (
                      <TR key={r.id} idx={i}>
                        <Td v={r.date} muted />
                        <Td v={docNum} bold color="#7c3aed" mono />
                        <Td v={r.partnerRuc || '—'} muted />
                        <Td v={r.description} />
                        <Td v={r.account} color="#6366f1" mono />
                        <Td v={toNum(r.debit) > 0 ? fmt(toNum(r.debit)) : '—'} right color={toNum(r.debit) > 0 ? '#15803d' : '#d1d5db'} mono />
                        <Td v={toNum(r.credit) > 0 ? fmt(toNum(r.credit)) : '—'} right color={toNum(r.credit) > 0 ? '#dc2626' : '#d1d5db'} mono />
                        <Td v={<StatusBadge status={r.status} />} center />
                      </TR>
                    );
                  })
              }
              {comprasRows.length > 0 && (
                <TotalRow
                  cols={8}
                  label={`TOTAL COMPRAS — ${comprasRows.length} líneas`}
                  total={comprasRows.reduce((s, r) => s + toNum(r.debit), 0)}
                  color="#7c3aed"
                />
              )}
            </DataTable>
          )}

          {/* ── Contabilidad ── */}
          {tab === 'contabilidad' && (
            <DataTable cols={[
              { label: 'FECHA', width: 95 },
              { label: 'ASIENTO', width: 140 },
              { label: 'GLOSA' },
              { label: 'CUENTA', width: 70 },
              { label: 'MÓDULO', width: 100 },
              { label: 'DEBE', align: 'right', width: 110 },
              { label: 'HABER', align: 'right', width: 110 },
              { label: 'ESTADO', align: 'center', width: 95 },
            ]}>
              {recentRows.length === 0
                ? <EmptyRow cols={8} msg="Sin asientos contables en el período." />
                : recentRows.map((r, i) => (
                    <TR key={r.id} idx={i}>
                      <Td v={r.date} muted />
                      <Td v={(r.entryId ?? r.id).slice(-12)} bold color="#0f172a" mono />
                      <Td v={r.description} />
                      <Td v={r.account} color="#6366f1" mono />
                      <Td v={
                        <span style={{
                          fontSize: 10, fontWeight: 700, background: '#f1f5f9',
                          color: '#475569', padding: '3px 8px', borderRadius: 6,
                        }}>{r.sourceModule}</span>
                      } />
                      <Td v={toNum(r.debit) > 0 ? fmt(toNum(r.debit)) : '—'} right color={toNum(r.debit) > 0 ? '#15803d' : '#d1d5db'} mono />
                      <Td v={toNum(r.credit) > 0 ? fmt(toNum(r.credit)) : '—'} right color={toNum(r.credit) > 0 ? '#dc2626' : '#d1d5db'} mono />
                      <Td v={<StatusBadge status={r.status} />} center />
                    </TR>
                  ))
              }
            </DataTable>
          )}
        </div>
      </div>

      {/* ── Fila inferior: Estado módulos + Libros PLE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Estado de módulos */}
        <Panel title="Estado de Módulos" subtitle="Datos del período activo" accent="#10b981" icon="🔌">
          <DataTable cols={[
            { label: 'MÓDULO' },
            { label: 'ASIENTOS', align: 'right', width: 80 },
            { label: 'VENTAS', align: 'right', width: 110 },
            { label: 'COMPRAS', align: 'right', width: 110 },
          ]}>
            {[
              { mod: 'BILLING',    label: 'Ventas',       filt: isVenta },
              { mod: 'PURCHASING', label: 'Compras',      filt: isCompra },
              { mod: 'ACCOUNTING', label: 'Contabilidad', filt: (r: DashboardRow) => modUp(r) === 'ACCOUNTING' || modUp(r) === 'CONTABILIDAD' },
              { mod: 'ASSETS',     label: 'Activos',      filt: (r: DashboardRow) => modUp(r) === 'ASSETS' || modUp(r) === 'ACTIVOS' },
              { mod: 'PAYROLL',    label: 'Planillas',    filt: (r: DashboardRow) => modUp(r) === 'PAYROLL' || modUp(r) === 'PLANILLAS' },
            ].map((m, i) => {
              const filtered = rows.filter(m.filt);
              const ventasAmt = filtered.reduce((s, r) => s + toNum(r.credit), 0);
              const comprasAmt = filtered.reduce((s, r) => s + toNum(r.debit), 0);
              return (
                <TR key={m.mod} idx={i}>
                  <Td v={m.label} bold />
                  <Td v={filtered.length || '—'} right color={filtered.length > 0 ? '#0078d4' : '#d1d5db'} />
                  <Td v={ventasAmt > 0 ? fmt(ventasAmt) : '—'} right color={ventasAmt > 0 ? '#15803d' : '#d1d5db'} mono />
                  <Td v={comprasAmt > 0 ? fmt(comprasAmt) : '—'} right color={comprasAmt > 0 ? '#dc2626' : '#d1d5db'} mono />
                </TR>
              );
            })}
          </DataTable>
        </Panel>

        {/* Libros PLE */}
        <Panel
          title="Libros Electrónicos PLE"
          subtitle="Estado del período activo"
          accent="#0078d4"
          icon="📚"
          action={
            <button type="button" style={{
              padding: '5px 12px', fontSize: 12, fontWeight: 700,
              background: '#0078d4', color: '#fff', border: 'none',
              borderRadius: 7, cursor: 'pointer',
            }}>
              Generar PLE
            </button>
          }
        >
          {[
            { label: 'Libro Diario (5.1)',       count: rows.length },
            { label: 'Registro de Ventas (14.1)', count: ventasRows.length },
            { label: 'Registro de Compras (8.1)', count: comprasRows.length },
          ].map((l, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>{l.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
                  {l.count > 0 ? `${l.count} registro${l.count !== 1 ? 's' : ''}` : 'Sin registros aún'}
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '3px 10px',
                background: l.count > 0 ? '#dcfce7' : '#f1f5f9',
                color: l.count > 0 ? '#15803d' : '#9ca3af',
              }}>
                {l.count > 0 ? 'LISTO' : 'VACÍO'}
              </span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
};

export default DashboardEnterprisePremium;
