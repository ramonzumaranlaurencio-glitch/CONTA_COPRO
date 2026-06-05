/**
 * CXC / CXP — Cuentas por Cobrar y por Pagar
 * Datos reales: GET /api/v1/reports/accounts-receivable/aging
 *               GET /api/v1/reports/accounts-payable/aging
 * PCGE: 1211 / 1212 (CXC) · 4211 / 4212 (CXP)
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
interface AgingDocument {
  partner_ruc?: string;
  partner_name?: string;
  document_type?: string;
  document_series?: string;
  document_number?: string;
  issue_date?: string;
  due_date?: string;
  days_overdue: number;
  bucket: string;
  balance_amount: string;
  account_code?: string;
}

interface AgingBuckets {
  current: string;
  '1_30':  string;
  '31_60': string;
  '61_90': string;
  '90_plus': string;
}

interface AgingReport {
  direction: 'AR' | 'AP';
  as_of: string;
  buckets: AgingBuckets;
  documents: AgingDocument[];
  total?: string;
}

/* ─── Helpers ─── */
const toN = (v: string | number | undefined | null) => {
  const n = parseFloat(String(v ?? '0'));
  return isFinite(n) ? n : 0;
};
const fmt = (n: number) =>
  `$ ${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (s?: string) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return s; }
};

/* ─── PCGE relevante para CXC/CXP ─── */
const PCGE_CXCXP = [
  { code: '1211', name: 'Facturas por cobrar — terceros',   tipo: 'CXC', color: C.green  },
  { code: '1212', name: 'Letras por cobrar — terceros',     tipo: 'CXC', color: C.green  },
  { code: '1213', name: 'Honorarios por cobrar',            tipo: 'CXC', color: C.green  },
  { code: '1611', name: 'Préstamos a terceros',             tipo: 'CXC', color: C.accent },
  { code: '4211', name: 'Facturas por pagar — terceros',    tipo: 'CXP', color: C.red    },
  { code: '4212', name: 'Letras por pagar — terceros',      tipo: 'CXP', color: C.red    },
  { code: '4213', name: 'Honorarios por pagar',             tipo: 'CXP', color: C.orange },
  { code: '4511', name: 'Instituciones financieras — CP',   tipo: 'CXP', color: C.red    },
];

/* ─── Buckets config ─── */
const BUCKETS: { key: keyof AgingBuckets; label: string; color: string }[] = [
  { key: 'current', label: 'Al corriente', color: C.green  },
  { key: '1_30',    label: '1–30 días',    color: C.yellow },
  { key: '31_60',   label: '31–60 días',   color: C.orange },
  { key: '61_90',   label: '61–90 días',   color: C.red    },
  { key: '90_plus', label: '+90 días',     color: '#7f1d1d' },
];

/* ─── Barra horizontal ─── */
const AgingBar = ({ buckets, total }: { buckets: AgingBuckets; total: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {BUCKETS.map(b => {
      const val = toN(buckets[b.key]);
      const pct = total > 0 ? (val / total) * 100 : 0;
      return (
        <div key={b.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: C.textMut }}>{b.label}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.textDim }}>{pct.toFixed(1)}%</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: b.color, fontFamily: 'Consolas, monospace', minWidth: 90, textAlign: 'right' }}>
                {fmt(val)}
              </span>
            </div>
          </div>
          <div style={{ height: 7, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, background: b.color,
              borderRadius: 3, transition: 'width 0.5s ease',
              boxShadow: val > 0 ? `0 0 6px ${b.color}44` : 'none',
            }} />
          </div>
        </div>
      );
    })}
  </div>
);

/* ─── Componente principal ─── */
export const FinancialDashboard = () => {
  const [arData,    setArData]    = useState<AgingReport | null>(null);
  const [apData,    setApData]    = useState<AgingReport | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [message,   setMessage]   = useState('');
  const [activeTab, setActiveTab] = useState<'cxc' | 'cxp' | 'pcge'>('cxc');
  const [search,    setSearch]    = useState('');

  /* ── Auth ── */
  const getHeaders = useCallback(async () => {
    let tok = localStorage.getItem('access_token') || '';
    if (!tok) { const u = localStorage.getItem('login_username'); const pw = localStorage.getItem('login_password'); if (u && pw) { try { const r = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: pw }) }); if (r.ok) { const d = await r.json() as { access_token?: string }; tok = d.access_token || ''; if (tok) localStorage.setItem('access_token', tok); } } catch {} } }
    return {
      Authorization: `Bearer ${tok}`,
      'X-Tenant-Id': TENANT_ID,
      'Content-Type': 'application/json',
    };
  }, []);

  /* ── Fetch aging ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const hdrs = await getHeaders();
      const [arRes, apRes] = await Promise.all([
        fetch(`${API_BASE}/reports/accounts-receivable/aging`, { headers: hdrs }),
        fetch(`${API_BASE}/reports/accounts-payable/aging`,   { headers: hdrs }),
      ]);
      if (arRes.ok) setArData(await arRes.json());
      if (apRes.ok) setApData(await apRes.json());
      setMessage(`Actualizado: ${new Date().toLocaleTimeString('es-CO')}`);
    } catch {
      setMessage('Backend no disponible — sin datos CXC/CXP.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Totales ── */
  const arTotal = useMemo(() =>
    arData ? Object.values(arData.buckets).reduce((s, v) => s + toN(v), 0) : 0,
    [arData]);
  const apTotal = useMemo(() =>
    apData ? Object.values(apData.buckets).reduce((s, v) => s + toN(v), 0) : 0,
    [apData]);

  const arOverdue = useMemo(() =>
    arData ? toN(arData.buckets['1_30']) + toN(arData.buckets['31_60']) + toN(arData.buckets['61_90']) + toN(arData.buckets['90_plus']) : 0,
    [arData]);
  const apOverdue = useMemo(() =>
    apData ? toN(apData.buckets['1_30']) + toN(apData.buckets['31_60']) + toN(apData.buckets['61_90']) + toN(apData.buckets['90_plus']) : 0,
    [apData]);

  const activeData = activeTab === 'cxc' ? arData : apData;
  const activeTotal = activeTab === 'cxc' ? arTotal : apTotal;
  const activeOverdue = activeTab === 'cxc' ? arOverdue : apOverdue;

  /* ── Filtrado de documentos ── */
  const filteredDocs = useMemo(() => {
    if (!activeData?.documents) return [];
    const q = search.toLowerCase();
    return activeData.documents.filter(d =>
      !q ||
      (d.partner_name || '').toLowerCase().includes(q) ||
      (d.partner_ruc  || '').includes(q) ||
      (d.document_series && `${d.document_series}-${d.document_number}`).toLowerCase().includes(q)
    );
  }, [activeData, search]);

  const bucketColor = (bucket: string) =>
    BUCKETS.find(b => b.key === bucket)?.color || C.textMut;

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
            background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
            display: 'grid', placeItems: 'center', fontSize: 19,
          }}>⚖️</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
              Cuentas por Cobrar / Pagar — CXC / CXP
            </h2>
            <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>
              PCGE: 1211–1213 (CXC) · 4211–4213 (CXP) · Aging real desde la base de datos
              {message && <> · <span style={{ color: C.accent }}>{message}</span></>}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          style={{
            padding: '7px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: loading ? C.bgRow : 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
            color: '#fff', border: 'none', borderRadius: 7,
            boxShadow: loading ? 'none' : '0 3px 10px rgba(59,130,246,0.35)',
          }}
        >
          {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
        </button>
      </div>

      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'TOTAL CXC',        value: fmt(arTotal),    color: C.green,  icon: '💚', top: C.green,  sub: `${arData?.documents.length ?? 0} documentos` },
            { label: 'CXC VENCIDA',      value: fmt(arOverdue),  color: C.yellow, icon: '⚠️', top: C.yellow, sub: arTotal > 0 ? `${((arOverdue / arTotal) * 100).toFixed(1)}% del total` : 'sin vencimientos' },
            { label: 'TOTAL CXP',        value: fmt(apTotal),    color: C.red,    icon: '❤️', top: C.red,    sub: `${apData?.documents.length ?? 0} documentos` },
            { label: 'CXP VENCIDA',      value: fmt(apOverdue),  color: C.orange, icon: '🔴', top: C.orange, sub: apTotal > 0 ? `${((apOverdue / apTotal) * 100).toFixed(1)}% del total` : 'sin vencimientos' },
          ].map((k, i) => (
            <div key={i} style={{
              background: C.bgCard, border: `1px solid ${C.border}`,
              borderTop: `3px solid ${k.top}`, borderRadius: 10,
              padding: '12px 14px', overflow: 'hidden', position: 'relative',
              boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 16 }}>{k.icon}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: k.color, fontFamily: 'Consolas, monospace' }}>
                  {k.value}
                </span>
              </div>
              <p style={{ margin: '4px 0 2px', fontSize: 9, color: C.textMut, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
              <p style={{ margin: 0, fontSize: 10, color: k.color }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── GRÁFICAS DE AGING ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* CXC Aging */}
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderTop: `3px solid ${C.green}`, borderRadius: 12,
            overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              padding: '11px 15px', borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(90deg, ${C.green}10, transparent)`,
              display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <span style={{ fontSize: 14 }}>💚</span>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>Aging — Cuentas por COBRAR (CXC)</p>
                <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>Cta. 1211 · 1212 · al {fmtDate(arData?.as_of)}</p>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: C.green, fontFamily: 'Consolas, monospace' }}>
                {fmt(arTotal)}
              </span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              {arData ? (
                <AgingBar buckets={arData.buckets} total={arTotal} />
              ) : (
                <p style={{ margin: 0, fontSize: 11, color: C.textDim, textAlign: 'center', padding: '16px 0' }}>
                  {loading ? 'Cargando datos...' : 'Sin datos CXC — verifique el período activo'}
                </p>
              )}
            </div>
          </div>

          {/* CXP Aging */}
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderTop: `3px solid ${C.red}`, borderRadius: 12,
            overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              padding: '11px 15px', borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(90deg, ${C.red}10, transparent)`,
              display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <span style={{ fontSize: 14 }}>❤️</span>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>Aging — Cuentas por PAGAR (CXP)</p>
                <p style={{ margin: 0, fontSize: 10, color: C.textDim }}>Cta. 4211 · 4212 · al {fmtDate(apData?.as_of)}</p>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: C.red, fontFamily: 'Consolas, monospace' }}>
                {fmt(apTotal)}
              </span>
            </div>
            <div style={{ padding: '14px 16px' }}>
              {apData ? (
                <AgingBar buckets={apData.buckets} total={apTotal} />
              ) : (
                <p style={{ margin: 0, fontSize: 11, color: C.textDim, textAlign: 'center', padding: '16px 0' }}>
                  {loading ? 'Cargando datos...' : 'Sin datos CXP — verifique el período activo'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{
          display: 'flex', gap: 4, padding: 5,
          background: C.bgCard, borderRadius: 10, border: `1px solid ${C.border}`,
        }}>
          {([
            { id: 'cxc', label: '💚 Por Cobrar (CXC)', count: arData?.documents.length ?? 0 },
            { id: 'cxp', label: '❤️ Por Pagar (CXP)',  count: apData?.documents.length ?? 0 },
            { id: 'pcge', label: '📋 Cuentas PCGE',    count: PCGE_CXCXP.length },
          ] as const).map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)} style={{
              flex: 1, padding: '8px 12px', fontSize: 11, fontWeight: 700,
              border: 'none', borderRadius: 7, cursor: 'pointer',
              background: activeTab === t.id ? C.accent : 'transparent',
              color: activeTab === t.id ? '#fff' : C.textMut,
              transition: 'background 0.15s',
            }}>
              {t.label}
              <span style={{
                marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: 10,
                background: activeTab === t.id ? 'rgba(255,255,255,0.2)' : C.border,
                color: activeTab === t.id ? '#fff' : C.textDim,
              }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── TABLA DOCUMENTOS CXC / CXP ── */}
        {(activeTab === 'cxc' || activeTab === 'cxp') && (
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 10, overflow: 'hidden',
            borderTop: `3px solid ${activeTab === 'cxc' ? C.green : C.red}`,
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(90deg, ${(activeTab === 'cxc' ? C.green : C.red)}0d, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                  {activeTab === 'cxc' ? 'Documentos por Cobrar — Cta. 1211/1212' : 'Documentos por Pagar — Cta. 4211/4212'}
                </span>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textDim }}>
                  {filteredDocs.length} documentos · Total: {fmt(activeOverdue > 0 ? activeTotal : 0)}
                  {activeOverdue > 0 && <span style={{ color: C.red }}> · Vencido: {fmt(activeOverdue)}</span>}
                </p>
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por RUC, nombre o documento..."
                style={{
                  background: C.bgRow, border: `1px solid ${C.border}`, borderRadius: 6,
                  color: C.text, padding: '5px 10px', fontSize: 11, width: 260,
                }}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.header }}>
                    {['RUC / PARTNER', 'NOMBRE', 'DOCUMENTO', 'EMISIÓN', 'VENCIMIENTO', 'DÍAS MORA', 'ANTIGÜEDAD', 'SALDO', 'CUENTA'].map((h, i) => (
                      <th key={i} style={{
                        padding: '8px 10px', textAlign: i >= 5 && i <= 7 ? 'right' : 'left',
                        fontSize: 10, fontWeight: 700, color: C.textMut,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '28px 16px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                        {loading
                          ? '⏳ Cargando datos desde la base de datos...'
                          : activeData
                            ? `Sin documentos ${activeTab === 'cxc' ? 'por cobrar' : 'por pagar'} en el período activo.`
                            : 'Backend no disponible — inicie el servidor para ver los datos reales.'}
                      </td>
                    </tr>
                  ) : filteredDocs.map((d, i) => {
                    const bc = bucketColor(d.bucket);
                    const docNum = d.document_series && d.document_number
                      ? `${d.document_series}-${d.document_number}` : '—';
                    return (
                      <tr
                        key={i}
                        style={{ background: i % 2 === 1 ? C.bgRow : C.bgCard, borderBottom: `1px solid ${C.border}22` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgHover; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? C.bgRow : C.bgCard; }}
                      >
                        <td style={{ padding: '8px 10px', color: C.textMut, fontFamily: 'Consolas, monospace', fontSize: 11 }}>
                          {d.partner_ruc || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: C.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.partner_name || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: C.accent, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>
                          {docNum}
                        </td>
                        <td style={{ padding: '8px 10px', color: C.textMut, whiteSpace: 'nowrap', fontSize: 11 }}>
                          {fmtDate(d.issue_date)}
                        </td>
                        <td style={{ padding: '8px 10px', color: d.days_overdue > 0 ? C.red : C.textMut, whiteSpace: 'nowrap', fontSize: 11 }}>
                          {fmtDate(d.due_date)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: d.days_overdue > 0 ? C.red : C.green, fontWeight: 800, fontFamily: 'Consolas, monospace' }}>
                          {d.days_overdue > 0 ? `+${d.days_overdue}` : '0'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                            color: bc, background: `${bc}18`, border: `1px solid ${bc}33`,
                          }}>
                            {BUCKETS.find(b => b.key === d.bucket)?.label || d.bucket}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: bc, fontFamily: 'Consolas, monospace' }}>
                          {fmt(toN(d.balance_amount))}
                        </td>
                        <td style={{ padding: '8px 10px', color: C.purple, fontFamily: 'Consolas, monospace', fontSize: 11 }}>
                          {d.account_code || (activeTab === 'cxc' ? '1211' : '4211')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filteredDocs.length > 0 && (
                  <tfoot>
                    <tr style={{ background: C.bgRow, borderTop: `2px solid ${C.border}` }}>
                      <td colSpan={7} style={{ padding: '8px 10px', fontWeight: 800, color: C.textMut, fontSize: 10, textTransform: 'uppercase' }}>
                        TOTAL
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: activeTab === 'cxc' ? C.green : C.red, fontFamily: 'Consolas, monospace', fontSize: 13 }}>
                        {fmt(filteredDocs.reduce((s, d) => s + toN(d.balance_amount), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── TAB PCGE ── */}
        {activeTab === 'pcge' && (
          <div style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(90deg, ${C.accent}0d, transparent)`,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                Plan General Contable — Cuentas CXC / CXP
              </span>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: C.textDim }}>
                Cuentas PCGE directamente vinculadas al módulo de Cuentas por Cobrar y Pagar
              </p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.header }}>
                    {['CÓDIGO', 'NOMBRE', 'TIPO', 'SALDO REAL'].map((h, i) => (
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
                  {PCGE_CXCXP.map((c, i) => {
                    const isCXC = c.tipo === 'CXC';
                    return (
                      <tr
                        key={c.code}
                        style={{ background: i % 2 === 1 ? C.bgRow : C.bgCard, borderBottom: `1px solid ${C.border}22` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgHover; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? C.bgRow : C.bgCard; }}
                      >
                        <td style={{ padding: '9px 12px', fontFamily: 'Consolas, monospace', fontWeight: 800, color: c.color, fontSize: 14 }}>
                          {c.code}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: C.text }}>{c.name}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{
                            padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                            color: c.color, background: `${c.color}18`, border: `1px solid ${c.color}33`,
                          }}>
                            {c.tipo}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', fontFamily: 'Consolas, monospace', fontWeight: 800, color: c.color }}>
                          {isCXC
                            ? (arTotal > 0 ? fmt(arTotal) : '—')
                            : (apTotal > 0 ? fmt(apTotal) : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
