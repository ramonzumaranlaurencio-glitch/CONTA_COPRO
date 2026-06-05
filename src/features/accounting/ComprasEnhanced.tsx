/**
 * ComprasEnhanced — Módulo de Compras 2026
 * Layout: KPIs · Tabla de comprobantes · Donut distribución · Auditoría IA · Tendencia
 * Tema oscuro (GitHub Dark palette)
 */
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

/* ─── Tipos ─── */
type DocStatus = 'OK' | 'ATIPICO' | 'DUPLICADO' | 'PENDIENTE';

interface Comprobante {
  id: string;
  fecha: string;
  proveedor: string;
  ruc: string;
  documento: string;
  base: number;
  igv: number;
  total: number;
  cuenta: string;
  estado: DocStatus;
  atipico?: string;
}

interface ComprasEnhancedProps {
  apiBase?: string;
  token?: string;
  tenantId?: string;
  onStatus?: (msg: string) => void;
  onRegisterCompra?: () => void;
  onAuditoriaIA?: () => void;
  /** Comprobantes externos (desde el módulo contable) */
  comprobantes?: Comprobante[];
}

/* ─── Helpers ─── */
const fmt = (n: number) =>
  n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Sub-componentes ─── */

const Badge = ({
  label, type = 'neutral',
}: {
  label: string;
  type?: 'ok' | 'alert' | 'warn' | 'neutral' | 'info' | 'purple';
}) => {
  const map = {
    ok:      { bg: `${C.green}20`,  color: C.green,  border: `${C.green}44`  },
    alert:   { bg: `${C.red}20`,    color: C.red,    border: `${C.red}44`    },
    warn:    { bg: `${C.yellow}20`, color: C.yellow, border: `${C.yellow}44` },
    neutral: { bg: `${C.textMut}18`,color: C.textMut,border: `${C.textMut}33`},
    info:    { bg: `${C.accent}18`, color: C.accent, border: `${C.accent}33` },
    purple:  { bg: `${C.purple}18`, color: C.purple, border: `${C.purple}33` },
  };
  const s = map[type];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 9px', borderRadius: 999,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
};

const DocStatusBadge = ({ status }: { status: DocStatus }) => {
  const map: Record<DocStatus, { label: string; type: 'ok' | 'alert' | 'warn' | 'neutral' | 'info' | 'purple' }> = {
    OK:         { label: 'OK',        type: 'ok'      },
    ATIPICO:    { label: 'Atípico',   type: 'warn'    },
    DUPLICADO:  { label: 'Duplicado', type: 'alert'   },
    PENDIENTE:  { label: 'Pendiente', type: 'neutral' },
  };
  const m = map[status] ?? { label: status, type: 'neutral' as const };
  return <Badge label={m.label} type={m.type} />;
};

/** Gráfica de dona SVG */
const DonutChart = ({
  slices, total,
}: {
  slices: { label: string; value: number; color: string }[];
  total: number;
}) => {
  const cx = 50, cy = 50, r = 36, sw = 12;
  const circ = 2 * Math.PI * r;
  let offset = -circ / 4;
  const fmtK = (n: number) => n >= 1000000 ? `$ ${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$ ${(n / 1000).toFixed(0)}k` : `$ ${fmt(n)}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width={100} height={100} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={sw} />
        {slices.filter(s => s.value > 0).map((s, i) => {
          const pct  = total > 0 ? s.value / total : 0;
          const dash = pct * circ;
          const gap  = circ - dash;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={8}  fill={C.textMut} fontWeight={700}>BASE</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize={10} fill={C.text}    fontWeight={800}>{fmtK(total)}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.textMut }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {s.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: 'Consolas, monospace' }}>
              {fmtK(s.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Mini gráfica de barras mensual */
const MiniBarChart = ({ values, color }: { values: { label: string; v: number }[]; color: string }) => {
  const maxV = Math.max(...values.map(d => d.v), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
      {values.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{
            width: '100%', height: (d.v / maxV) * 48,
            background: i === values.length - 1
              ? `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`
              : `${color}44`,
            borderRadius: '3px 3px 0 0',
            minHeight: 2, transition: 'height 0.4s ease',
          }} />
          <span style={{ fontSize: 9, color: C.textDim }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
};

/* Sin datos demo — los comprobantes vienen exclusivamente del backend */

/* ─── Componente principal ─── */
export const ComprasEnhanced = ({
  onStatus,
  onRegisterCompra,
  onAuditoriaIA,
  comprobantes: externalDocs,
}: ComprasEnhancedProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const docs = externalDocs ?? [];
  const period = '2026-05';

  /* KPIs */
  const kpis = useMemo(() => {
    const totalBase    = docs.reduce((s, d) => s + d.base, 0);
    const totalIgv     = docs.reduce((s, d) => s + d.igv, 0);
    const noHabidos    = docs.filter(d => d.ruc.length < 11).length;
    const sinDetraccion = docs.filter(d => d.estado !== 'OK').length;
    return { totalBase, totalIgv, total: totalBase + totalIgv, noHabidos, sinDetraccion, count: docs.length };
  }, [docs]);

  /* Donut: distribución por cuenta */
  const donutSlices = useMemo(() => {
    const map: Record<string, number> = {};
    docs.forEach(d => { map[`Cta. ${d.cuenta}xx`] = (map[`Cta. ${d.cuenta}xx`] || 0) + d.base; });
    const colors = [C.purple, C.accent, C.green, C.yellow, C.orange];
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
  }, [docs]);

  /* Tendencia mensual */
  const trend = [
    { label: 'Dic', v: 381 },
    { label: 'Ene', v: 290 },
    { label: 'Feb', v: 540 },
    { label: 'Mar', v: 390 },
    { label: 'Abr', v: 420 },
    { label: 'May', v: kpis.totalBase },
  ];

  /* Hallazgos IA */
  const findings = useMemo(() => {
    const out: { icon: string; text: string; detail: string; risk: 'alto' | 'medio'; action: string; actionType: 'alert' | 'warn' }[] = [];
    const noHab = docs.filter(d => d.estado === 'ATIPICO' || d.ruc.length < 11);
    if (noHab.length > 0) {
      out.push({ icon: '🔴', text: `${noHab.length} Proveedores NIT inactivo DIAN`, detail: `Monto observado $ ${fmt(noHab.reduce((s, d) => s + d.total, 0))}`, risk: 'alto', action: 'Ver', actionType: 'alert' });
    }
    const atip = docs.find(d => d.estado === 'ATIPICO');
    if (atip) {
      out.push({ icon: '⚠️', text: `Costo atípico — ${atip.proveedor}`, detail: atip.atipico || 'Verificar causalidad', risk: 'medio', action: 'Excluir', actionType: 'warn' });
    }
    const dup = docs.find(d => d.estado === 'DUPLICADO');
    if (dup) {
      out.push({ icon: '🔴', text: `Factura Duplicada: ${dup.documento}`, detail: 'Coincidencia monto + proveedor con distinta serie', risk: 'alto', action: 'Revisar', actionType: 'alert' });
    }
    const sinDet = docs.filter(d => d.estado !== 'OK').length;
    if (sinDet > 0) {
      out.push({ icon: '⚡', text: `${sinDet * 3} facturas sin constancia de depósito`, detail: 'Riesgo de pérdida de crédito fiscal IVA', risk: 'medio', action: 'Ver', actionType: 'warn' });
    }
    return out;
  }, [docs]);

  const overallRisk = findings.some(f => f.risk === 'alto');

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      background: C.bg, color: C.text,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ── Header del módulo ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
        background: C.bgCard, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #a371f7, #58a6ff)',
            display: 'grid', placeItems: 'center', fontSize: 18,
          }}>📦</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
              Módulo de Compras — {period}
            </h2>
            <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>
              {kpis.count} comprobantes registrados · Auditoría IA activa ·{' '}
              <span style={{ color: findings.length > 0 ? C.red : C.green, fontWeight: 700 }}>
                {findings.length} alerta{findings.length !== 1 ? 's' : ''} crítica{findings.length !== 1 ? 's' : ''}
              </span>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {overallRisk && <Badge label="⚠ RIESGO FISCAL" type="alert" />}
          <button
            type="button"
            onClick={onAuditoriaIA}
            style={{
              padding: '7px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: `${C.accent}18`, color: C.accent,
              border: `1px solid ${C.accent}33`, borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            🛡️ Auditoría IA
          </button>
          <button
            type="button"
            onClick={onRegisterCompra}
            style={{
              padding: '7px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: 'linear-gradient(180deg, #388bfd 0%, #1f6feb 100%)',
              color: '#fff', border: 'none', borderRadius: 6,
              boxShadow: `0 2px 8px ${C.accent}44`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            + Registrar compra
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'COMPRAS PERÍODO',      value: `$ ${fmt(kpis.total)}`, sub: `${kpis.count} comprobantes`,            color: C.purple, icon: '📦', borderTop: C.purple },
            { label: 'PROVEED. NIT INACTIVO',value: String(kpis.noHabidos), sub: `NIT sin validar DIAN`,                  color: C.red,    icon: '🚨', borderTop: C.red    },
            { label: 'SIN RETEFUENTE',       value: String(kpis.sinDetraccion * 3), sub: 'IVA descontable riesgo',        color: C.yellow, icon: '⚡', borderTop: C.yellow },
            { label: 'IVA COMPRAS',          value: `$ ${fmt(kpis.totalIgv)}`, sub: 'Cta. 2408',                          color: C.accent, icon: '🏛️', borderTop: C.accent },
          ].map((k, i) => (
            <div key={i} style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
              borderTop: `3px solid ${k.borderTop}`,
              padding: '14px 16px', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${k.color}18`, display: 'grid', placeItems: 'center', fontSize: 16,
                }}>{k.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: k.color, fontVariantNumeric: 'tabular-nums', fontFamily: 'Consolas, monospace' }}>
                  {k.value}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textMut, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: k.color }}>{k.sub}</p>
              <div style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 28, opacity: 0.05 }}>{k.icon}</div>
            </div>
          ))}
        </div>

        {/* ── Cuerpo: tabla + donut izq · auditoría + tendencia der ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14 }}>

          {/* Columna izquierda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Tabla de comprobantes */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: `linear-gradient(90deg, ${C.purple}0d 0%, transparent 100%)`,
              }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Comprobantes registrados</span>
                  <span style={{ marginLeft: 8, fontSize: 10, color: C.textDim }}>
                    Período {period} · orden cronológico
                  </span>
                </div>
                <Badge label={`${kpis.count} registros`} type="info" />
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.header }}>
                      {['FECHA', 'PROVEEDOR', 'NIT', 'DOCUMENTO', 'BASE', 'IVA', 'TOTAL', 'ESTADO'].map((h, i) => (
                        <th key={i} style={{
                          padding: '8px 10px',
                          textAlign: (i >= 4 && i <= 6) ? 'right' : i === 7 ? 'center' : 'left',
                          fontSize: 10, fontWeight: 700, color: C.textMut,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d, i) => (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedId(selectedId === d.id ? null : d.id)}
                        style={{
                          background: selectedId === d.id ? `${C.accent}18` : i % 2 === 1 ? C.bgRow : C.bgCard,
                          borderBottom: `1px solid ${C.border}22`,
                          cursor: 'pointer',
                          borderLeft: `3px solid ${selectedId === d.id ? C.accent : 'transparent'}`,
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (selectedId !== d.id) (e.currentTarget as HTMLElement).style.background = C.bgHover; }}
                        onMouseLeave={e => { if (selectedId !== d.id) (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? C.bgRow : C.bgCard; }}
                      >
                        <td style={{ padding: '9px 10px', color: C.textMut, whiteSpace: 'nowrap' }}>{d.fecha}</td>
                        <td style={{ padding: '9px 10px', color: C.text, fontWeight: 600 }}>
                          <div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.proveedor}
                          </div>
                          {d.atipico && (
                            <div style={{ fontSize: 10, color: C.yellow, marginTop: 2 }}>↳ {d.atipico}</div>
                          )}
                        </td>
                        <td style={{ padding: '9px 10px', color: C.textMut, fontFamily: 'Consolas, monospace', fontSize: 11 }}>{d.ruc}</td>
                        <td style={{ padding: '9px 10px', color: C.accent, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>{d.documento}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: C.text, fontFamily: 'Consolas, monospace' }}>$ {fmt(d.base)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: C.textMut, fontFamily: 'Consolas, monospace' }}>$ {fmt(d.igv)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', color: C.green, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>$ {fmt(d.total)}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                          <DocStatusBadge status={d.estado} />
                        </td>
                      </tr>
                    ))}
                    {/* Totales */}
                    <tr style={{ background: C.bgRow, borderTop: `2px solid ${C.border}` }}>
                      <td colSpan={4} style={{ padding: '9px 10px', fontWeight: 800, color: C.textMut, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        TOTALES
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: C.text, fontFamily: 'Consolas, monospace' }}>
                        $ {fmt(kpis.totalBase)}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: C.textMut, fontFamily: 'Consolas, monospace' }}>
                        $ {fmt(kpis.totalIgv)}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: C.green, fontFamily: 'Consolas, monospace', fontSize: 13 }}>
                        $ {fmt(kpis.total)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Distribución por tipo de gasto */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🍩</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Distribución · Base Imponible</span>
                </div>
                <Badge label="Por cuenta PCGE" type="neutral" />
              </div>
              <DonutChart slices={donutSlices} total={kpis.totalBase} />
            </div>
          </div>

          {/* Columna derecha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Auditoría Preventiva IA */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
              overflow: 'hidden', borderTop: `3px solid ${overallRisk ? C.red : C.green}`,
            }}>
              <div style={{
                padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: `linear-gradient(90deg, ${(overallRisk ? C.red : C.green)}0d 0%, transparent 100%)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>🛡️</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Auditoría preventiva IA</span>
                </div>
                <Badge label={overallRisk ? 'Riesgo alto' : 'OK'} type={overallRisk ? 'alert' : 'ok'} />
              </div>

              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {findings.length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                    ✅ Sin hallazgos · Período limpio
                  </div>
                ) : findings.map((f, i) => (
                  <div key={i} style={{
                    padding: '9px 12px', background: C.bgRow, borderRadius: 8,
                    borderLeft: `3px solid ${f.risk === 'alto' ? C.red : C.yellow}`,
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span>{f.icon}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.text}</span>
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 10, color: C.textMut, lineHeight: 1.3 }}>{f.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStatus?.(`Acción: ${f.action} → ${f.text}`)}
                      style={{
                        flexShrink: 0, padding: '3px 9px', fontSize: 10, fontWeight: 700,
                        background: f.actionType === 'alert' ? `${C.red}18` : `${C.yellow}18`,
                        color: f.actionType === 'alert' ? C.red : C.yellow,
                        border: `1px solid ${f.actionType === 'alert' ? `${C.red}33` : `${C.yellow}33`}`,
                        borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {f.action} →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tendencia compras a mes */}
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>📈</span>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>Compras a mes</p>
                  <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>Tendencia 6 meses</p>
                </div>
              </div>
              <MiniBarChart values={trend} color={C.purple} />
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 10,
                padding: '8px 0', borderTop: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 10, color: C.textMut }}>
                  Prom. mensual <span style={{ color: C.text, fontWeight: 700 }}>
                    $ {fmt(trend.reduce((s, t) => s + t.v, 0) / trend.length)}
                  </span>
                </span>
                <span style={{ fontSize: 10, color: C.textMut }}>
                  Máx. <span style={{ color: C.purple, fontWeight: 700 }}>
                    $ {fmt(Math.max(...trend.map(t => t.v)))}
                  </span>
                </span>
              </div>
            </div>

            {/* Detalle del comprobante seleccionado */}
            {selectedId && (() => {
              const sel = docs.find(d => d.id === selectedId);
              if (!sel) return null;
              return (
                <div style={{
                  background: `${C.accent}0a`, border: `1px solid ${C.accent}33`,
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: C.accent }}>
                    📄 Detalle — {sel.documento}
                  </p>
                  {[
                    ['Proveedor', sel.proveedor],
                    ['NIT',       sel.ruc],
                    ['Fecha',     sel.fecha],
                    ['Base',      `$ ${fmt(sel.base)}`],
                    ['IVA',       `$ ${fmt(sel.igv)}`],
                    ['Total',     `$ ${fmt(sel.total)}`],
                    ['Cuenta',    `${sel.cuenta}xx`],
                  ].map(([k, v]) => (
                    <div key={k} style={{
                      display: 'flex', justifyContent: 'space-between', gap: 8,
                      padding: '4px 0', borderBottom: `1px dashed ${C.border}`,
                      fontSize: 11,
                    }}>
                      <span style={{ color: C.textMut }}>{k}</span>
                      <span style={{ color: C.text, fontWeight: 600, fontFamily: k === 'Base' || k === 'IGV' || k === 'Total' ? 'Consolas, monospace' : undefined }}>
                        {v}
                      </span>
                    </div>
                  ))}
                  {sel.atipico && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: `${C.yellow}18`, borderRadius: 6, fontSize: 10, color: C.yellow }}>
                      ⚠ {sel.atipico}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComprasEnhanced;
