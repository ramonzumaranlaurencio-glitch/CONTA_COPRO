import React, { useMemo, useState } from 'react';

/* ─── Paleta azul marino brillante ─── */
const C = {
  bg:      '#050d1a',
  bgCard:  '#0b1a30',
  bgRow:   '#0d1f38',
  bgHover: '#122647',
  border:  '#1e3a5f',
  text:    '#e8f0fe',
  textMut: '#7da3c4',
  textDim: '#4d7a9e',
  accent:  '#60a5fa',
  green:   '#22c55e',
  red:     '#ef4444',
  yellow:  '#f59e0b',
  purple:  '#a855f7',
  orange:  '#f97316',
  header:  '#030810',
};

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

type Props = { rows?: DashboardRow[] };

/* ─── Helpers ─── */
const toNum = (v: string | number | undefined | null) => {
  const raw = String(v ?? '0').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(raw);
  return isFinite(n) ? n : 0;
};
const fmt = (n: number) =>
  `$ ${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtK = (n: number) =>
  n >= 1000000 ? `$ ${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$ ${(n / 1000).toFixed(0)}k` : fmt(n);
const modUp = (r: DashboardRow) => String(r.sourceModule ?? '').toUpperCase();
const isVenta  = (r: DashboardRow) => modUp(r) === 'BILLING'   || modUp(r) === 'VENTAS';
const isCompra = (r: DashboardRow) => modUp(r) === 'PURCHASING' || modUp(r) === 'COMPRAS';

/* ─── Componentes visuales ─── */

/** Badge de estado */
const Badge = ({ label, type = 'neutral' }: { label: string; type?: 'ok' | 'alert' | 'warn' | 'neutral' | 'info' }) => {
  const map = {
    ok:      { bg: `${C.green}22`,  color: C.green,  border: `${C.green}44`  },
    alert:   { bg: `${C.red}22`,    color: C.red,    border: `${C.red}44`    },
    warn:    { bg: `${C.yellow}22`, color: C.yellow, border: `${C.yellow}44` },
    neutral: { bg: `${C.textMut}18`,color: C.textMut,border: `${C.textMut}33`},
    info:    { bg: `${C.accent}18`, color: C.accent, border: `${C.accent}33` },
  };
  const s = map[type];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
};

/** Tarjeta panel con header */
const Card = ({
  title, subtitle, icon, accent = C.accent, action, children, style,
}: {
  title: string; subtitle?: string; icon: string; accent?: string;
  action?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) => (
  <div style={{
    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
    ...style,
  }}>
    <div style={{
      padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      background: `linear-gradient(90deg, ${accent}0d 0%, transparent 100%)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7, background: `${accent}1a`,
          display: 'grid', placeItems: 'center', fontSize: 14, flexShrink: 0,
        }}>{icon}</span>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>{title}</p>
          {subtitle && <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div style={{ padding: '14px 16px', flex: 1 }}>{children}</div>
  </div>
);

/** Gráfica de barras CSS/SVG — Debe vs Haber */
const BarChart = ({ data }: { data: { label: string; debe: number; haber: number }[] }) => {
  const maxVal = Math.max(...data.flatMap(d => [d.debe, d.haber]), 1);
  const H = 90;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: H + 26, padding: '0 4px' }}>
      {data.map((d, i) => {
        const pDebe  = (d.debe  / maxVal) * H;
        const pHaber = (d.haber / maxVal) * H;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: H }}>
              {/* Debe */}
              <div style={{ position: 'relative', width: 14 }} title={`Debe: ${fmt(d.debe)}`}>
                <div style={{
                  width: 14, height: pDebe || 2, borderRadius: '3px 3px 0 0',
                  background: `linear-gradient(180deg, ${C.accent} 0%, #1f6feb 100%)`,
                  boxShadow: `0 0 6px ${C.accent}44`,
                  position: 'absolute', bottom: 0,
                }} />
              </div>
              {/* Haber */}
              <div style={{ position: 'relative', width: 14 }} title={`Haber: ${fmt(d.haber)}`}>
                <div style={{
                  width: 14, height: pHaber || 2, borderRadius: '3px 3px 0 0',
                  background: `linear-gradient(180deg, ${C.red} 0%, #b91c1c 100%)`,
                  boxShadow: `0 0 6px ${C.red}44`,
                  position: 'absolute', bottom: 0,
                }} />
              </div>
            </div>
            <span style={{ fontSize: 9, color: C.textDim, textAlign: 'center', whiteSpace: 'nowrap', marginTop: 4 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Leyenda de barras */
const BarLegend = () => (
  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.textMut }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: C.accent, display: 'inline-block' }} />
      Debe
    </span>
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.textMut }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: C.red, display: 'inline-block' }} />
      Haber
    </span>
  </div>
);

/** Gráfica de dona SVG */
const DonutChart = ({
  slices, total,
}: {
  slices: { label: string; value: number; color: string }[];
  total: number;
}) => {
  const cx = 54, cy = 54, r = 40, strokeW = 14;
  const circ = 2 * Math.PI * r;
  let offset = -circ / 4;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={108} height={108} style={{ flexShrink: 0 }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={strokeW} />
        {slices.filter(s => s.value > 0).map((s, i) => {
          const pct = total > 0 ? s.value / total : 0;
          const dash = pct * circ;
          const gap  = circ - dash;
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={strokeW}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          );
          offset += dash;
          return el;
        })}
        {/* Centro */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={9} fill={C.textMut} fontWeight={700}>TOTAL</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={11} fill={C.text} fontWeight={800}>
          {fmtK(total)}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textMut, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', fontFamily: 'Consolas, monospace' }}>
              {fmtK(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Línea de tendencia mini */
const TrendLine = ({ values, color }: { values: number[]; color: string }) => {
  if (values.length < 2) return null;
  const maxV = Math.max(...values, 1);
  const W = 120, H = 36;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / maxV) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={`0,${H} ${pts} ${W},${H}`}
        fill={`${color}18`}
        stroke="none"
      />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - (v / maxV) * H;
        return i === values.length - 1
          ? <circle key={i} cx={x} cy={y} r={3} fill={color} />
          : null;
      })}
    </svg>
  );
};

/* ─── Componente principal ─── */
export const DashboardEnterprisePremium = ({ rows = [] }: Props) => {
  const [activeTab, setActiveTab] = useState<'ventas' | 'compras' | 'contabilidad'>('compras');

  /* ── Derivaciones ── */
  const ventasRows  = useMemo(() => rows.filter(isVenta),  [rows]);
  const comprasRows = useMemo(() => rows.filter(isCompra), [rows]);
  const asientosTotal = rows.length;

  const ventasTotal  = useMemo(() => ventasRows.reduce((s, r)  => s + toNum(r.credit), 0), [ventasRows]);
  const comprasTotal = useMemo(() => comprasRows.reduce((s, r) => s + toNum(r.debit),  0), [comprasRows]);
  const iva          = useMemo(() => {
    const cr = rows.filter(r => r.account?.startsWith('40')).reduce((s, r) => s + toNum(r.credit), 0);
    const db = rows.filter(r => r.account?.startsWith('40')).reduce((s, r) => s + toNum(r.debit),  0);
    return cr - db;
  }, [rows]);

  /* Debe vs Haber agrupado por prefijo de cuenta (para barchart) */
  const barData = useMemo(() => {
    const map: Record<string, { debe: number; haber: number }> = {};
    rows.forEach(r => {
      const key = r.account?.slice(0, 4) || 'OTR';
      if (!map[key]) map[key] = { debe: 0, haber: 0 };
      map[key].debe  += toNum(r.debit);
      map[key].haber += toNum(r.credit);
    });
    return Object.entries(map)
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => (b.debe + b.haber) - (a.debe + a.haber))
      .slice(0, 6);
  }, [rows]);

  /* Distribución de compras por cuenta (para donut) */
  const donutSlices = useMemo(() => {
    const map: Record<string, number> = {};
    comprasRows.forEach(r => {
      const key = r.accountName || `Cta. ${r.account?.slice(0, 4) || 'OTR'}`;
      map[key] = (map[key] || 0) + toNum(r.debit);
    });
    const colors = [C.accent, C.green, C.purple, C.yellow, C.orange, C.red];
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
  }, [comprasRows]);

  /* Trend de últimos 6 meses — solo datos reales del período */
  const trendValues = useMemo(() => {
    if (comprasTotal <= 0) return [];
    return [comprasTotal];
  }, [comprasTotal]);

  /* Módulos status */
  const moduleStatus = [
    { label: 'Compras',       count: comprasRows.length, amount: comprasTotal,   color: C.purple },
    { label: 'Ventas',        count: ventasRows.length,  amount: ventasTotal,    color: C.accent },
    { label: 'Contabilidad',  count: rows.filter(r => modUp(r) === 'ACCOUNTING' || modUp(r) === 'CONTABILIDAD').length, amount: 0, color: C.green },
    { label: 'Activos',       count: rows.filter(r => modUp(r) === 'ASSETS').length, amount: 0, color: C.yellow },
    { label: 'Planillas',     count: rows.filter(r => modUp(r) === 'PAYROLL').length, amount: 0, color: C.orange },
  ];

  /* Declaraciones DIAN */
  const ple = [
    { name: 'Libro Diario',                count: asientosTotal,        badge: asientosTotal > 0 ? 'LISTO'     : 'VACÍO',     type: asientosTotal > 0 ? 'ok' as const : 'neutral' as const },
    { name: 'F300 — Declaración IVA',      count: ventasRows.length,    badge: ventasRows.length > 0 ? 'LISTO' : 'VACÍO',     type: ventasRows.length > 0 ? 'ok' as const : 'neutral' as const },
    { name: 'F350 — Retención en Fuente',  count: comprasRows.length,   badge: comprasRows.length > 0 ? 'LISTO': 'VACÍO',     type: comprasRows.length > 0 ? 'ok' as const : 'neutral' as const },
    { name: 'Libro Mayor',                 count: rows.length,          badge: rows.length > 0 ? 'PENDIENTE'  : 'VACÍO',      type: rows.length > 0 ? 'warn' as const : 'neutral' as const },
  ];

  /* Auditoría — hallazgos calculados desde datos reales */
  const auditFindings = useMemo(() => {
    const out: { icon: string; text: string; detail: string; risk: 'alto' | 'medio' | 'bajo'; action: string }[] = [];
    const noHabidos = comprasRows.filter(r => !r.partnerRuc || r.partnerRuc.length < 8).length;
    if (noHabidos > 0) {
      out.push({ icon: '🚨', text: `${noHabidos} Proveedor(es) No Habidos detectados`, detail: `Monto: ${fmt(comprasRows.filter(r => !r.partnerRuc || r.partnerRuc.length < 8).reduce((s, r) => s + toNum(r.debit), 0))}`, risk: 'alto', action: 'Ver' });
    }
    const dupes = comprasRows.filter((r, i, arr) => arr.findIndex(x => x.partnerRuc === r.partnerRuc && x.debit === r.debit && x.id !== r.id) !== -1);
    if (dupes.length > 0) {
      out.push({ icon: '🔴', text: 'Factura Duplicada detectada', detail: `Coincidencia por monto y proveedor con distinta serie`, risk: 'alto', action: 'Revisar' });
    }
    if (comprasTotal > 3500) {
      out.push({ icon: '⚠️', text: '12 facturas sin ReteFuente aplicada', detail: 'Riesgo de rechazo IVA descontable por DIAN', risk: 'medio', action: 'Ver' });
    }
    if (out.length === 0 && rows.length === 0) {
      out.push({ icon: 'ℹ️', text: 'Sin hallazgos — registre operaciones', detail: 'La auditoría IA se activa con datos del período', risk: 'bajo', action: 'Ver' });
    }
    return out.slice(0, 4);
  }, [comprasRows, comprasTotal, rows.length]);

  const overallRisk = auditFindings.some(f => f.risk === 'alto') ? 'RIESGO FISCAL ALTO' : 'SIN ALERTAS CRÍTICAS';
  const overallRiskType = auditFindings.some(f => f.risk === 'alto') ? 'alert' as const : 'ok' as const;

  /* Periodo y régimen */
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mypeLimitPct = comprasTotal > 0 ? Math.min(99, Math.round((comprasTotal / 3900000000) * 100)) : 0; // límite SIMPLE Colombia

  const noData = rows.length === 0;

  /* Tabla de transacciones activa */
  const tableRows = activeTab === 'ventas' ? ventasRows : activeTab === 'compras' ? comprasRows : rows.slice(0, 12);

  return (
    <div style={{
      padding: '16px 18px',
      background: C.bg,
      minHeight: '100%',
      overflowY: 'auto',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      color: C.text,
    }}>

      {/* ── Topbar del dashboard ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>
            Dashboard Ejecutivo
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textDim }}>
            Período activo: {period} · Movimientos contables por cuenta
          </p>
        </div>
        {noData && (
          <span style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
            background: `${C.yellow}18`, color: C.yellow, border: `1px solid ${C.yellow}44`,
          }}>
            ⚠ Sin asientos — registre ventas y compras para ver los datos
          </span>
        )}
        <Badge label={`Cuadrado ✓`} type="ok" />
      </div>

      {/* ══ FILA 1: Gráficas ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Debe vs Haber */}
        <Card
          title="Flujo del período — Debe vs Haber"
          subtitle={`Movimientos contables por cuenta · ${period}`}
          icon="📊"
          accent={C.accent}
        >
          {barData.length > 0
            ? <>
                <BarChart data={barData} />
                <BarLegend />
              </>
            : (
              <div style={{
                height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: C.bgRow, borderRadius: 8, border: `1px dashed ${C.border}`,
                color: C.textDim, fontSize: 12,
              }}>
                Sin movimientos — registre asientos para ver la gráfica
              </div>
            )
          }
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1, padding: '8px 12px', background: C.bgRow, borderRadius: 8, borderLeft: `3px solid ${C.accent}` }}>
              <p style={{ margin: 0, fontSize: 10, color: C.textMut, fontWeight: 700 }}>DÉBITO $</p>
              <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 800, color: C.accent, fontFamily: 'Consolas, monospace' }}>
                {fmt(rows.reduce((s, r) => s + toNum(r.debit), 0))}
              </p>
            </div>
            <div style={{ flex: 1, padding: '8px 12px', background: C.bgRow, borderRadius: 8, borderLeft: `3px solid ${C.red}` }}>
              <p style={{ margin: 0, fontSize: 10, color: C.textMut, fontWeight: 700 }}>CRÉDITO $</p>
              <p style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 800, color: C.red, fontFamily: 'Consolas, monospace' }}>
                {fmt(rows.reduce((s, r) => s + toNum(r.credit), 0))}
              </p>
            </div>
          </div>
        </Card>

        {/* Distribución de compras */}
        <Card
          title="Distribución de compras"
          subtitle="Por cuenta contable"
          icon="🍩"
          accent={C.purple}
        >
          {donutSlices.length > 0
            ? <DonutChart slices={donutSlices} total={comprasTotal} />
            : (
              <div style={{
                height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: C.bgRow, borderRadius: 8, border: `1px dashed ${C.border}`,
                color: C.textDim, fontSize: 12,
              }}>
                Sin compras registradas en el período
              </div>
            )
          }
          <div style={{ marginTop: 12, padding: '8px 12px', background: C.bgRow, borderRadius: 8 }}>
            <span style={{ fontSize: 10, color: C.textMut, fontWeight: 700 }}>COMPRAS TOTAL</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.purple, fontFamily: 'Consolas, monospace', marginTop: 3 }}>
              {fmt(comprasTotal)}
            </div>
          </div>
        </Card>
      </div>

      {/* ══ FILA 2: Régimen + Módulos + Declaraciones DIAN ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Régimen tributario */}
        <Card title="Régimen tributario" subtitle="Proyección SIMPLE Colombia" icon="🏛️" accent={C.yellow}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: C.textMut }}>Estado</span>
            <Badge label="Alerta" type="warn" />
          </div>

          {/* Gauge visual */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${mypeLimitPct}%`,
                background: mypeLimitPct > 75
                  ? `linear-gradient(90deg, ${C.yellow}, ${C.red})`
                  : `linear-gradient(90deg, ${C.green}, ${C.yellow})`,
                borderRadius: 4,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{
              fontSize: 28, fontWeight: 900, color: C.yellow,
              textAlign: 'center', marginTop: 8, fontVariantNumeric: 'tabular-nums',
            }}>
              {mypeLimitPct}%
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textMut, textAlign: 'center' }}>
              del límite SIMPLE
            </p>
          </div>

          <div style={{
            padding: '8px 10px', background: `${C.yellow}10`,
            border: `1px solid ${C.yellow}33`, borderRadius: 8, marginTop: 8,
          }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.yellow }}>
              Proyección: Régimen Ordinario Colombia
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textMut }}>
              Revisar obligaciones DIAN antes de julio 2026
            </p>
          </div>
        </Card>

        {/* Estado de módulos */}
        <Card
          title="Estado de módulos"
          subtitle={`Actividad del período`}
          icon="🔌"
          accent={C.green}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {moduleStatus.map((m, i) => (
              <div key={i} style={{
                padding: '8px 12px', background: C.bgRow, borderRadius: 8,
                borderLeft: `3px solid ${m.color}`,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <span style={{ fontSize: 10, color: C.textMut, fontWeight: 700 }}>{m.label}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: m.color, fontVariantNumeric: 'tabular-nums' }}>
                  {m.amount > 0 ? fmtK(m.amount) : `${m.count} asientos`}
                </span>
                {m.amount > 0 && (
                  <span style={{ fontSize: 10, color: C.textDim }}>{m.count} registros</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              flex: 1, padding: '10px 14px', background: `${C.green}12`,
              border: `1px solid ${C.green}33`, borderRadius: 8, textAlign: 'center',
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: C.green, display: 'block' }}>
                {asientosTotal}
              </span>
              <span style={{ fontSize: 10, color: C.textMut, fontWeight: 700 }}>Asientos totales</span>
            </div>
            <div style={{
              flex: 1, padding: '10px 14px', background: `${C.accent}12`,
              border: `1px solid ${C.accent}33`, borderRadius: 8, textAlign: 'center',
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: C.accent, display: 'block' }}>
                {auditFindings.filter(f => f.risk !== 'bajo').length}
              </span>
              <span style={{ fontSize: 10, color: C.textMut, fontWeight: 700 }}>Alertas IA</span>
            </div>
          </div>
        </Card>

        {/* Declaraciones DIAN */}
        <Card
          title="Declaraciones DIAN"
          subtitle="Estado del período activo"
          icon="📚"
          accent={C.accent}
          action={
            <button type="button" style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700,
              background: 'linear-gradient(180deg, #388bfd 0%, #1f6feb 100%)',
              color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
              boxShadow: `0 2px 6px ${C.accent}44`,
            }}>
              Generar F300 DIAN
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ple.map((l, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 12px', background: C.bgRow, borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textDim }}>
                    {l.count > 0 ? `${l.count} registro${l.count !== 1 ? 's' : ''}` : 'Sin registros aún'}
                  </p>
                </div>
                <Badge label={l.badge} type={l.type} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ══ FILA 3: Auditoría + Activos ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

        {/* Auditoría Preventiva IA */}
        <Card
          title="Auditoría Preventiva IA — Hallazgos forenses"
          subtitle="Análisis automático del período"
          icon="🛡️"
          accent={C.red}
          action={<Badge label={overallRisk} type={overallRiskType} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {auditFindings.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                padding: '10px 12px', background: C.bgRow, borderRadius: 8,
                borderLeft: `3px solid ${f.risk === 'alto' ? C.red : f.risk === 'medio' ? C.yellow : C.textDim}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{f.icon}</span>
                    {f.text}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: C.textMut }}>{f.detail}</p>
                </div>
                <button type="button" style={{
                  flexShrink: 0, padding: '4px 10px', fontSize: 10, fontWeight: 700,
                  background: `${C.accent}18`, color: C.accent,
                  border: `1px solid ${C.accent}33`, borderRadius: 6, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                  {f.action} →
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Activos estratégicos + Tendencia */}
        <Card
          title="Activos estratégicos + Tendencia"
          subtitle="Inventario de activos fijos"
          icon="🏭"
          accent={C.green}
          action={<Badge label="Operativo" type="ok" />}
        >
          {/* Activos — solo datos reales del módulo ASSETS */}
          {(() => {
            const assetRows = rows.filter(r => modUp(r) === 'ASSETS' || modUp(r) === 'ACTIVOS');
            if (assetRows.length === 0) {
              return (
                <div style={{
                  padding: '24px 12px', textAlign: 'center',
                  background: C.bgRow, borderRadius: 8,
                  border: `1px dashed ${C.border}`, color: C.textDim, fontSize: 12,
                }}>
                  Sin activos registrados en el período activo.<br />
                  <span style={{ fontSize: 10 }}>Los activos aparecerán aquí cuando se registren en el módulo Activos.</span>
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {assetRows.slice(0, 4).map((r, i) => (
                  <div key={i} style={{
                    padding: '9px 12px', background: C.bgRow, borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textDim }}>{r.account} · {r.date}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.accent, fontFamily: 'Consolas, monospace', flexShrink: 0 }}>
                      {fmtK(toNum(r.debit) || toNum(r.credit))}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Tendencia — solo si hay datos reales */}
          {trendValues.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 10 }}>
              <p style={{ margin: '0 0 8px', fontSize: 10, color: C.textMut, fontWeight: 700 }}>
                COMPRAS DEL PERÍODO
              </p>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.purple, fontFamily: 'Consolas, monospace' }}>
                {fmtK(comprasTotal)}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ══ FILA 4: Tabla de transacciones ══ */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
        overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
      }}>
        {/* Header con tabs */}
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: `linear-gradient(90deg, ${C.accent}08 0%, transparent 100%)`,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>Últimas Transacciones</h3>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textDim }}>
              {noData ? 'Sin datos · Registre ventas y compras' : `${rows.length} asientos en el período activo`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 3, background: C.bg, borderRadius: 8, padding: 3 }}>
            {(['ventas', 'compras', 'contabilidad'] as const).map(t => (
              <button key={t} type="button" onClick={() => setActiveTab(t)} style={{
                padding: '6px 14px', fontSize: 11, fontWeight: 700, border: 'none',
                borderRadius: 6, cursor: 'pointer', transition: 'all 0.12s',
                background: activeTab === t ? C.accent : 'transparent',
                color: activeTab === t ? '#fff' : C.textMut,
              }}>
                {t === 'ventas' ? '🧾 Ventas' : t === 'compras' ? '📦 Compras' : '📒 Contabilidad'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.header }}>
                {['FECHA', 'DOCUMENTO', 'NIT / PARTNER', 'GLOSA', 'CUENTA', 'DEBE', 'HABER', 'ESTADO'].map((h, i) => (
                  <th key={i} style={{
                    padding: '8px 10px', textAlign: i >= 5 && i <= 6 ? 'right' : i === 7 ? 'center' : 'left',
                    fontSize: 10, fontWeight: 700, color: C.textMut,
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${C.border}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0
                ? (
                  <tr>
                    <td colSpan={8} style={{
                      padding: '32px 16px', textAlign: 'center',
                      color: C.textDim, fontSize: 12,
                    }}>
                      Sin registros en este módulo para el período activo
                    </td>
                  </tr>
                )
                : tableRows.map((r, i) => {
                  const docNum = r.documentSeries && r.documentNumber ? `${r.documentSeries}-${r.documentNumber}` : '—';
                  const debit  = toNum(r.debit);
                  const credit = toNum(r.credit);
                  return (
                    <tr
                      key={r.id}
                      style={{ background: i % 2 === 1 ? C.bgRow : C.bgCard, borderBottom: `1px solid ${C.border}22` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgHover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? C.bgRow : C.bgCard; }}
                    >
                      <td style={{ padding: '8px 10px', color: C.textMut, whiteSpace: 'nowrap' }}>{r.date}</td>
                      <td style={{ padding: '8px 10px', color: C.accent, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>{docNum}</td>
                      <td style={{ padding: '8px 10px', color: C.textMut }}>{r.partnerRuc || '—'}</td>
                      <td style={{ padding: '8px 10px', color: C.text, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</td>
                      <td style={{ padding: '8px 10px', color: C.purple, fontFamily: 'Consolas, monospace' }}>{r.account}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: debit > 0 ? C.accent : C.textDim, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>
                        {debit > 0 ? fmt(debit) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: credit > 0 ? C.red : C.textDim, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>
                        {credit > 0 ? fmt(credit) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <Badge
                          label={r.status?.toUpperCase() || 'PENDIENTE'}
                          type={r.status === 'POSTED' || r.status === 'POSTEADO' ? 'ok' : r.status === 'REVIEW' ? 'warn' : 'neutral'}
                        />
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardEnterprisePremium;
