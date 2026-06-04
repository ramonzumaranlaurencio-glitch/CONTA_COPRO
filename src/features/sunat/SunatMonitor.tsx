/**
 * Módulo de Integraciones DIAN — Plan Único de Cuentas Colombia (PUC)
 * Conexión: tax/submissions · tax/ops/queue-status · tax/ops/dlq
 * Cuentas PUC vinculadas · Declaraciones DIAN · Gráficas de estado
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

/* ─── Paleta azul marino ─── */
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

const API_BASE  = '/api/v1';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

/* ─── Tipos ─── */
type SubStatus = 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'RETRYING' | 'ERROR' | string;

interface Submission {
  id: string;
  financial_document_id?: string | null;
  submission_type: string;
  endpoint_type: string;
  status: SubStatus;
  ticket?: string | null;
  cdr_code?: string | null;
  cdr_description?: string | null;
  created_at: string;
}

interface QueueStatus {
  outbox:      Record<string, number>;
  submissions: Record<string, number>;
  dlq_total:   number;
}

interface DlqEvent {
  id: string;
  topic: string;
  aggregate_id: string;
  reason: string;
  created_at: string;
}

/* ─── PUC Colombia — cuentas vinculadas a DIAN ─── */
const PCGE_SUNAT = [
  { codigo: '2408', nombre: 'IVA por pagar',                   tipo: 'Pasivo',   sunat: 'F300 — Declaración IVA bimestral/cuatrimestral', libro: 'F300' },
  { codigo: '2365', nombre: 'ReteFuente por pagar',            tipo: 'Pasivo',   sunat: 'F350 — Retención en la Fuente mensual',          libro: 'F350' },
  { codigo: '2367', nombre: 'ReteIVA por pagar',               tipo: 'Pasivo',   sunat: 'F300 — Retención de IVA',                        libro: 'F300' },
  { codigo: '2368', nombre: 'ReteICA por pagar',               tipo: 'Pasivo',   sunat: 'ICA — Declaración municipal',                    libro: 'ICA' },
  { codigo: '1305', nombre: 'Clientes',                        tipo: 'Activo',   sunat: 'Factura Electrónica — Ventas DIAN',              libro: 'FE' },
  { codigo: '2205', nombre: 'Proveedores',                     tipo: 'Pasivo',   sunat: 'Factura Electrónica — Compras DIAN',             libro: 'FE' },
  { codigo: '4135', nombre: 'Ingresos — Ventas comerciales',   tipo: 'Ingreso',  sunat: 'Base gravable IVA ventas',                       libro: 'F300' },
  { codigo: '6135', nombre: 'Costo de ventas',                 tipo: 'Costo',    sunat: 'Base deducible renta',                           libro: 'F110' },
  { codigo: '2610', nombre: 'Cesantías consolidadas',          tipo: 'Pasivo',   sunat: 'Nómina — Aportes parafiscales',                  libro: 'PILA' },
  { codigo: '2615', nombre: 'Intereses s/ cesantías',          tipo: 'Pasivo',   sunat: 'Aportes SENA/ICBF/CCF',                         libro: 'PILA' },
  { codigo: '1105', nombre: 'Caja',                            tipo: 'Activo',   sunat: 'Libro de Caja y Bancos',                        libro: 'Diario' },
  { codigo: '1110', nombre: 'Bancos (Bancolombia/Davivienda)', tipo: 'Activo',   sunat: 'Libro de Caja y Bancos',                        libro: 'Diario' },
];

/* ─── Declaraciones DIAN Colombia ─── */
const PLE_BOOKS = [
  { codigo: 'F300',  nombre: 'Declaración IVA',                submit_type: 'IVA',       min_ops: 0 },
  { codigo: 'F350',  nombre: 'Retención en la Fuente',         submit_type: 'RETEFUENTE', min_ops: 0 },
  { codigo: 'F110',  nombre: 'Renta Personas Jurídicas',       submit_type: 'RENTA',      min_ops: 0 },
  { codigo: 'DIARIO',nombre: 'Libro Diario PUC',               submit_type: 'LEDGER',     min_ops: 0 },
  { codigo: 'MAYOR', nombre: 'Libro Mayor',                    submit_type: 'LEDGER',     min_ops: 0 },
  { codigo: 'EXO',   nombre: 'Medios Magnéticos / Exógena',    submit_type: 'EXOGENA',    min_ops: 0 },
];

/* ─── Helpers ─── */
const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return iso; }
};

const fmtTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const statusMeta = (s: SubStatus): { label: string; color: string; bg: string } => {
  const u = String(s).toUpperCase();
  if (u === 'ACCEPTED') return { label: 'ACEPTADO',   color: C.green,  bg: `${C.green}18`  };
  if (u === 'REJECTED') return { label: 'RECHAZADO',  color: C.red,    bg: `${C.red}18`    };
  if (u === 'PENDING')  return { label: 'PENDIENTE',  color: C.yellow, bg: `${C.yellow}18` };
  if (u === 'RETRYING') return { label: 'REINTENTO',  color: C.purple, bg: `${C.purple}18` };
  if (u === 'ERROR')    return { label: 'ERROR',      color: C.red,    bg: `${C.red}18`    };
  return                        { label: u,            color: C.textMut,bg: `${C.border}44` };
};

const typeLabel: Record<string, { label: string; icon: string; color: string }> = {
  INVOICE:   { label: 'Factura Venta',  icon: '🧾', color: C.accent  },
  PURCHASE:  { label: 'Factura Compra', icon: '📦', color: C.purple  },
  CREDIT:    { label: 'Nota Crédito',   icon: '↩',  color: C.green   },
  DEBIT:     { label: 'Nota Débito',    icon: '↪',  color: C.orange  },
  LEDGER:    { label: 'Libro Diario',   icon: '📒', color: C.yellow  },
  RETENTION: { label: 'Retención',      icon: '✂️', color: C.red     },
};

/* ─── Donut SVG ─── */
const DonutChart = ({ data, total }: {
  data: { label: string; value: number; color: string }[];
  total: number;
}) => {
  const cx = 54, cy = 54, r = 38, sw = 14;
  const circ = 2 * Math.PI * r;
  let off = -circ / 4;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <svg width={108} height={108} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={sw} />
        {data.filter(d => d.value > 0).map((d, i) => {
          const pct  = total > 0 ? d.value / total : 0;
          const dash = pct * circ;
          const gap  = circ - dash;
          const el   = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color} strokeWidth={sw}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-off}
              strokeLinecap="butt"
            />
          );
          off += dash;
          return el;
        })}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={10} fill={C.textMut} fontWeight={700}>TOTAL</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={14} fill={C.text} fontWeight={900}>{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMut }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              {d.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: d.color, fontFamily: 'Consolas, monospace' }}>
              {d.value}
              {total > 0 && <span style={{ fontWeight: 400, color: C.textDim, fontSize: 10 }}> ({Math.round((d.value / total) * 100)}%)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Bar chart horizontal ─── */
const HorizBar = ({ items, maxVal }: {
  items: { label: string; value: number; color: string; icon: string }[];
  maxVal: number;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
    {items.filter(it => it.value > 0).map((it, i) => (
      <div key={i}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 11, color: C.textMut, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{it.icon}</span> {it.label}
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: it.color, fontFamily: 'Consolas, monospace' }}>{it.value}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${maxVal > 0 ? (it.value / maxVal) * 100 : 0}%`,
            background: it.color,
            borderRadius: 3,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    ))}
    {items.every(it => it.value === 0) && (
      <p style={{ margin: 0, fontSize: 11, color: C.textDim, textAlign: 'center', paddingTop: 12 }}>
        Sin envíos registrados
      </p>
    )}
  </div>
);

/* ─── Card panel ─── */
const Card = ({ title, subtitle, icon, accent = C.accent, action, children, style }: {
  title: string; subtitle?: string; icon: string; accent?: string;
  action?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties;
}) => (
  <div style={{
    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12,
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
    boxShadow: '0 4px 16px rgba(0,0,0,0.45)', ...style,
  }}>
    <div style={{
      padding: '11px 15px', borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      background: `linear-gradient(90deg, ${accent}10 0%, transparent 100%)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7, background: `${accent}20`,
          display: 'grid', placeItems: 'center', fontSize: 13, flexShrink: 0,
        }}>{icon}</span>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>{title}</p>
          {subtitle && <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    <div style={{ padding: '13px 15px', flex: 1 }}>{children}</div>
  </div>
);

/* ─── Badge ─── */
const Badge = ({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 9px', borderRadius: 999,
    fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
    color, background: bg, border: `1px solid ${border}`, whiteSpace: 'nowrap',
  }}>
    {label}
  </span>
);

/* ═══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════════════════ */
export const SunatMonitor = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [queueInfo, setQueueInfo]     = useState<QueueStatus | null>(null);
  const [dlq, setDlq]                 = useState<DlqEvent[]>([]);
  const [loading, setLoading]         = useState(false);
  const [message, setMessage]         = useState('');
  const [activeTab, setActiveTab]     = useState<'submissions' | 'pcge' | 'ple' | 'dlq'>('submissions');
  const [pcgeSearch, setPcgeSearch]   = useState('');

  /* ── Auth token ── */
  const getHeaders = useCallback(async () => {
    const r = await fetch(`${API_BASE}/auth/dev-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT_ID, user_id: 'erp.operator', role: 'ADMIN' }),
    });
    if (!r.ok) throw new Error('Token no disponible');
    const p = await r.json();
    return {
      Authorization: `Bearer ${p.access_token}`,
      'X-Tenant-Id': TENANT_ID,
      'Content-Type': 'application/json',
    };
  }, []);

  /* ── Load all data ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const hdrs = await getHeaders();
      const [subRes, qRes, dlqRes] = await Promise.all([
        fetch(`${API_BASE}/tax/submissions?limit=200`, { headers: hdrs }),
        fetch(`${API_BASE}/tax/ops/queue-status`,      { headers: hdrs }),
        fetch(`${API_BASE}/tax/ops/dlq?limit=50`,      { headers: hdrs }),
      ]);
      if (subRes.ok)  setSubmissions(await subRes.json());
      if (qRes.ok)    setQueueInfo(await qRes.json());
      if (dlqRes.ok)  setDlq(await dlqRes.json());
      setMessage(`Actualizado: ${new Date().toLocaleTimeString('es-CO')}`);
    } catch {
      setMessage('Backend no disponible — sin datos DIAN.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── Actions ── */
  const retry = async (id: string) => {
    try {
      const hdrs = await getHeaders();
      await fetch(`${API_BASE}/tax/submissions/${id}/retry`, { method: 'POST', headers: hdrs });
      setMessage(`Submission ${id.slice(0, 8)} enviada a retry.`);
      await loadAll();
    } catch { setMessage('Error al reintentar.'); }
  };

  const reprocess = async (id: string) => {
    try {
      const hdrs = await getHeaders();
      await fetch(`${API_BASE}/tax/submissions/${id}/reprocess`, { method: 'POST', headers: hdrs });
      setMessage(`Submission ${id.slice(0, 8)} puesta en PENDING.`);
      await loadAll();
    } catch { setMessage('Error al reprocesar.'); }
  };

  /* ── Métricas calculadas ── */
  const stats = useMemo(() => {
    const total     = submissions.length;
    const accepted  = submissions.filter(s => s.status.toUpperCase() === 'ACCEPTED').length;
    const rejected  = submissions.filter(s => s.status.toUpperCase() === 'REJECTED').length;
    const pending   = submissions.filter(s => s.status.toUpperCase() === 'PENDING').length;
    const retrying  = submissions.filter(s => s.status.toUpperCase() === 'RETRYING').length;
    return { total, accepted, rejected, pending, retrying };
  }, [submissions]);

  const donutData = [
    { label: 'Aceptados',  value: stats.accepted, color: C.green  },
    { label: 'Rechazados', value: stats.rejected,  color: C.red    },
    { label: 'Pendientes', value: stats.pending,   color: C.yellow },
    { label: 'Reintento',  value: stats.retrying,  color: C.purple },
  ];

  /* Distribución por tipo de comprobante */
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    submissions.forEach(s => {
      const t = s.submission_type?.toUpperCase() || 'OTHER';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([k, v]) => ({
        label: typeLabel[k]?.label || k,
        icon:  typeLabel[k]?.icon  || '📄',
        color: typeLabel[k]?.color || C.textMut,
        value: v,
      }))
      .sort((a, b) => b.value - a.value);
  }, [submissions]);
  const maxTypeVal = Math.max(...typeData.map(d => d.value), 1);

  /* Queue totals */
  const queueOutbox  = queueInfo ? Object.values(queueInfo.outbox).reduce((s, v) => s + v, 0) : 0;
  const queueSubsm   = queueInfo ? Object.values(queueInfo.submissions).reduce((s, v) => s + v, 0) : 0;
  const dlqTotal     = queueInfo?.dlq_total ?? 0;

  /* PLE status per book */
  const pleWithStatus = useMemo(() => PLE_BOOKS.map(b => {
    const matching = submissions.filter(s =>
      s.submission_type?.toUpperCase() === b.submit_type.toUpperCase()
    );
    const any        = matching.length > 0;
    const allOk      = any && matching.every(s => s.status.toUpperCase() === 'ACCEPTED');
    const hasRejected = matching.some(s => s.status.toUpperCase() === 'REJECTED');
    return {
      ...b,
      count: matching.length,
      badge: !any ? 'VACÍO' : allOk ? 'LISTO' : hasRejected ? 'RECHAZADO' : 'PENDIENTE',
      badgeColor: !any ? C.textMut : allOk ? C.green : hasRejected ? C.red : C.yellow,
    };
  }), [submissions]);

  /* PCGE filtrado */
  const filteredPcge = useMemo(() => {
    const q = pcgeSearch.toLowerCase();
    if (!q) return PCGE_SUNAT;
    return PCGE_SUNAT.filter(c =>
      c.codigo.includes(q) || c.nombre.toLowerCase().includes(q) ||
      c.sunat.toLowerCase().includes(q) || c.libro.toLowerCase().includes(q)
    );
  }, [pcgeSearch]);

  const tipoColor: Record<string, string> = {
    Activo: C.green, Pasivo: C.red, Ingreso: C.accent, Gasto: C.orange,
  };

  return (
    <div style={{
      height: '100%', overflowY: 'auto', background: C.bg,
      color: C.text, fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
        background: C.bgCard, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #3b82f6, #a855f7)',
            display: 'grid', placeItems: 'center', fontSize: 19,
          }}>🔗</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
              Integraciones — DIAN · PUC Colombia · Declaraciones
            </h2>
            <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>
              Monitor de envíos DIAN · Plan Único de Cuentas vinculado · Declaraciones tributarias
              {message && <> · <span style={{ color: C.accent }}>{message}</span></>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {dlqTotal > 0 && (
            <span style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: `${C.red}18`, color: C.red, border: `1px solid ${C.red}33`,
            }}>
              ⚠ {dlqTotal} DLQ
            </span>
          )}
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            style={{
              padding: '7px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: loading ? C.bgRow : 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
              color: '#fff', border: 'none', borderRadius: 7,
              boxShadow: loading ? 'none' : '0 3px 10px rgba(59,130,246,0.4)',
            }}
          >
            {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { label: 'TOTAL ENVIADOS',  value: stats.total,    color: C.accent,  icon: '📤', top: C.accent  },
            { label: 'ACEPTADOS',        value: stats.accepted, color: C.green,   icon: '✅', top: C.green   },
            { label: 'RECHAZADOS',       value: stats.rejected, color: C.red,     icon: '❌', top: C.red     },
            { label: 'PENDIENTES',       value: stats.pending,  color: C.yellow,  icon: '⏳', top: C.yellow  },
            { label: 'DLQ / ERRORES',   value: dlqTotal,        color: C.orange,  icon: '🚨', top: C.orange  },
          ].map((k, i) => (
            <div key={i} style={{
              background: C.bgCard, border: `1px solid ${C.border}`,
              borderTop: `3px solid ${k.top}`, borderRadius: 10,
              padding: '12px 14px', position: 'relative', overflow: 'hidden',
              boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 16 }}>{k.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: k.color, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {k.value}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 9, color: C.textMut, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {k.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── FILA CHARTS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

          {/* Distribución de estados */}
          <Card title="Estado de Envíos DIAN" subtitle="Distribución por estado" icon="🍩" accent={C.accent}>
            <DonutChart data={donutData} total={stats.total} />
          </Card>

          {/* Tipos de comprobante */}
          <Card title="Tipos de Comprobante" subtitle="Facturas DIAN, notas crédito/débito, CUFE" icon="📊" accent={C.purple}>
            <HorizBar items={typeData} maxVal={maxTypeVal} />
          </Card>

          {/* Cola de eventos */}
          <Card title="Cola de Eventos DIAN" subtitle="Outbox · Submissions · DLQ" icon="⚡" accent={C.yellow}>
            {queueInfo ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Outbox */}
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.textMut, textTransform: 'uppercase' }}>Outbox Events</p>
                  {Object.entries(queueInfo.outbox).length > 0
                    ? Object.entries(queueInfo.outbox).map(([status, count]) => {
                        const m = statusMeta(status);
                        return (
                          <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: C.textMut }}>{status}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: m.color }}>{count}</span>
                          </div>
                        );
                      })
                    : <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>Sin eventos en cola</p>
                  }
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.textMut, textTransform: 'uppercase' }}>Queue Submissions</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: C.textMut }}>Total procesados</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>{queueSubsm}</span>
                  </div>
                </div>
                {dlqTotal > 0 && (
                  <div style={{
                    padding: '8px 10px', background: `${C.red}12`,
                    border: `1px solid ${C.red}33`, borderRadius: 7,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⚠ Dead Letter Queue</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: C.red, fontFamily: 'Consolas, monospace' }}>{dlqTotal}</span>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: C.textDim, textAlign: 'center', paddingTop: 16 }}>
                Cola no disponible — backend offline
              </p>
            )}
          </Card>
        </div>

        {/* ── TABS NAVEGACIÓN ── */}
        <div style={{
          display: 'flex', gap: 4, padding: 5,
          background: C.bgCard, borderRadius: 10,
          border: `1px solid ${C.border}`, overflow: 'hidden',
        }}>
          {([
            { id: 'submissions', label: '📤 Envíos DIAN',   count: submissions.length },
            { id: 'pcge',        label: '📋 Plan Contable',  count: PCGE_SUNAT.length  },
            { id: 'ple',         label: '📚 Declaraciones DIAN',     count: PLE_BOOKS.length   },
            { id: 'dlq',         label: '🚨 Dead Letter',    count: dlqTotal            },
          ] as const).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, padding: '8px 12px', fontSize: 11, fontWeight: 700,
                border: 'none', borderRadius: 7, cursor: 'pointer',
                background: activeTab === t.id ? C.accent : 'transparent',
                color: activeTab === t.id ? '#fff' : C.textMut,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background 0.15s',
              }}
            >
              {t.label}
              <span style={{
                padding: '1px 7px', borderRadius: 999, fontSize: 10,
                background: activeTab === t.id ? 'rgba(255,255,255,0.2)' : `${C.border}`,
                color: activeTab === t.id ? '#fff' : C.textMut,
                fontFamily: 'Consolas, monospace',
              }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── TAB: SUBMISSIONS ── */}
        {activeTab === 'submissions' && (
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(90deg, ${C.accent}0d 0%, transparent 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                Historial de Envíos Electrónicos
              </span>
              <span style={{ fontSize: 10, color: C.textDim }}>
                {submissions.length} registros · tabla de base de datos: sunat_submissions
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.header }}>
                    {['FECHA', 'TIPO', 'ENDPOINT', 'ESTADO CDR', 'CÓDIGO CDR', 'DESCRIPCIÓN', 'ACCIONES'].map((h, i) => (
                      <th key={i} style={{
                        padding: '8px 10px', textAlign: 'left',
                        fontSize: 10, fontWeight: 700, color: C.textMut,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '28px 16px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                        Sin envíos DIAN registrados.
                        {!loading && <><br /><span style={{ fontSize: 10 }}>Registre facturas electrónicas para ver el historial aquí.</span></>}
                      </td>
                    </tr>
                  ) : submissions.map((s, i) => {
                    const sm   = statusMeta(s.status);
                    const tm   = typeLabel[s.submission_type?.toUpperCase()] || { label: s.submission_type, icon: '📄', color: C.textMut };
                    return (
                      <tr
                        key={s.id}
                        style={{ background: i % 2 === 1 ? C.bgRow : C.bgCard, borderBottom: `1px solid ${C.border}22` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgHover; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? C.bgRow : C.bgCard; }}
                      >
                        <td style={{ padding: '8px 10px', color: C.textMut, whiteSpace: 'nowrap' }}>
                          <div>{fmtDate(s.created_at)}</div>
                          <div style={{ fontSize: 10, color: C.textDim }}>{fmtTime(s.created_at)}</div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: tm.color, fontWeight: 700, fontSize: 11 }}>
                            <span>{tm.icon}</span> {tm.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: C.textMut, fontSize: 11 }}>{s.endpoint_type || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <Badge label={sm.label} color={sm.color} bg={sm.bg} border={`${sm.color}44`} />
                        </td>
                        <td style={{ padding: '8px 10px', color: C.accent, fontFamily: 'Consolas, monospace', fontSize: 11 }}>
                          {s.cdr_code ?? '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: C.textMut, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.cdr_description ?? '—'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {s.status.toUpperCase() !== 'ACCEPTED' && (
                              <button
                                type="button"
                                onClick={() => retry(s.id)}
                                style={{
                                  padding: '3px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                  background: `${C.accent}18`, color: C.accent,
                                  border: `1px solid ${C.accent}33`, borderRadius: 5,
                                }}
                              >↺ Retry</button>
                            )}
                            <button
                              type="button"
                              onClick={() => reprocess(s.id)}
                              style={{
                                padding: '3px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                background: `${C.textMut}12`, color: C.textMut,
                                border: `1px solid ${C.border}`, borderRadius: 5,
                              }}
                            >⟳ Reprocesar</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: PLAN CONTABLE (PCGE) ── */}
        {activeTab === 'pcge' && (
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(90deg, ${C.green}0d 0%, transparent 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                  Plan Único de Cuentas (PUC) — Cuentas vinculadas a DIAN Colombia
                </span>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textDim }}>
                  Conexión directa entre cuentas contables y obligaciones tributarias
                </p>
              </div>
              <input
                value={pcgeSearch}
                onChange={e => setPcgeSearch(e.target.value)}
                placeholder="Buscar cuenta, nombre o libro..."
                style={{
                  background: C.bgRow, border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.text, padding: '6px 10px',
                  fontSize: 12, width: 240,
                }}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.header }}>
                    {['CÓDIGO', 'NOMBRE DE LA CUENTA', 'TIPO', 'VINCULACIÓN DIAN', 'DECLARACIÓN'].map((h, i) => (
                      <th key={i} style={{
                        padding: '8px 12px', textAlign: 'left',
                        fontSize: 10, fontWeight: 700, color: C.textMut,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPcge.map((c, i) => (
                    <tr
                      key={c.codigo}
                      style={{ background: i % 2 === 1 ? C.bgRow : C.bgCard, borderBottom: `1px solid ${C.border}22` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgHover; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? C.bgRow : C.bgCard; }}
                    >
                      <td style={{ padding: '9px 12px', fontFamily: 'Consolas, monospace', fontWeight: 800, color: C.accent, fontSize: 13 }}>
                        {c.codigo}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: C.text }}>{c.nombre}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                          color: tipoColor[c.tipo] || C.textMut,
                          background: `${tipoColor[c.tipo] || C.textMut}18`,
                          border: `1px solid ${tipoColor[c.tipo] || C.textMut}33`,
                        }}>
                          {c.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', color: C.textMut, fontSize: 11 }}>{c.sunat}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          padding: '3px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          color: C.yellow, background: `${C.yellow}18`,
                          border: `1px solid ${C.yellow}33`,
                          fontFamily: 'Consolas, monospace',
                        }}>
                          {c.libro}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB: DECLARACIONES DIAN ── */}
        {activeTab === 'ple' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {pleWithStatus.map((b, i) => (
              <div key={i} style={{
                background: C.bgCard, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '14px 16px', overflow: 'hidden',
                borderTop: `3px solid ${b.badgeColor}`,
                boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${b.badgeColor}20`,
                      display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0,
                    }}>📚</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.text }}>Libro {b.codigo}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>{b.nombre}</p>
                    </div>
                  </div>
                  <Badge
                    label={b.badge}
                    color={b.badgeColor}
                    bg={`${b.badgeColor}18`}
                    border={`${b.badgeColor}44`}
                  />
                </div>

                <div style={{ background: C.bgRow, borderRadius: 7, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: C.textMut }}>Envíos registrados</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.accent, fontFamily: 'Consolas, monospace' }}>
                      {b.count}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: C.textMut }}>Tipo DIAN</span>
                    <span style={{ fontSize: 10, color: C.textMut, fontFamily: 'Consolas, monospace' }}>{b.submit_type}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button
                    type="button"
                    style={{
                      flex: 1, padding: '6px 0', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      background: `${C.accent}18`, color: C.accent,
                      border: `1px solid ${C.accent}33`, borderRadius: 6,
                    }}
                    onClick={() => setMessage(`Generando ${b.nombre} (${b.codigo}) para DIAN...`)}
                  >
                    ⬇ Generar DIAN
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1, padding: '6px 0', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      background: `${C.green}18`, color: C.green,
                      border: `1px solid ${C.green}33`, borderRadius: 6,
                    }}
                    onClick={() => setMessage(`Enviando ${b.nombre} a DIAN / Muisca...`)}
                  >
                    📤 Enviar a DIAN
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: DEAD LETTER QUEUE ── */}
        {activeTab === 'dlq' && (
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 10, overflow: 'hidden', borderTop: `3px solid ${C.red}`,
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(90deg, ${C.red}0d 0%, transparent 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                🚨 Dead Letter Queue — Eventos fallidos
              </span>
              <span style={{ fontSize: 10, color: C.textDim }}>
                {dlq.length} eventos · tabla: dead_letter_events
              </span>
            </div>
            {dlq.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                ✅ Sin eventos en DLQ — cola saludable
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.header }}>
                      {['FECHA', 'TÓPICO', 'AGGREGATE ID', 'RAZÓN'].map((h, i) => (
                        <th key={i} style={{
                          padding: '8px 12px', textAlign: 'left',
                          fontSize: 10, fontWeight: 700, color: C.textMut,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: `1px solid ${C.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dlq.map((e, i) => (
                      <tr
                        key={e.id}
                        style={{ background: i % 2 === 1 ? C.bgRow : C.bgCard, borderBottom: `1px solid ${C.border}22` }}
                        onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = C.bgHover; }}
                        onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = i % 2 === 1 ? C.bgRow : C.bgCard; }}
                      >
                        <td style={{ padding: '8px 12px', color: C.textMut, whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                        <td style={{ padding: '8px 12px', color: C.purple, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>{e.topic}</td>
                        <td style={{ padding: '8px 12px', color: C.textMut, fontFamily: 'Consolas, monospace', fontSize: 11 }}>
                          {e.aggregate_id?.slice(0, 16)}...
                        </td>
                        <td style={{ padding: '8px 12px', color: C.red, fontSize: 11 }}>{e.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
