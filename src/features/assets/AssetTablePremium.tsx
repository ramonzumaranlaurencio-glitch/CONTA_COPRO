/**
 * AssetTablePremium — Tabla de activos fijos
 * Sin datos demo — conectado a la tabla fixed_assets vía API
 */
import React, { useCallback, useEffect, useState } from 'react';

const API_BASE  = '/api/v1';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

interface FixedAsset {
  id: string;
  asset_code: string;
  description: string;
  acquisition_date?: string;
  acquisition_cost: number;
  accumulated_depreciation: number;
  net_book_value: number;
  status?: string;
  location?: string;
}

const fmt = (n: number) =>
  `$ ${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const C = {
  bg: '#050d1a', bgCard: '#0b1a30', bgRow: '#0d1f38', bgHover: '#122647',
  border: '#1e3a5f', text: '#e8f0fe', textMut: '#7da3c4', textDim: '#4d7a9e',
  accent: '#60a5fa', green: '#22c55e', red: '#ef4444', header: '#030810',
};

export const AssetTablePremium = () => {
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let access_token = localStorage.getItem('access_token') || '';
      if (!access_token) { const _u = localStorage.getItem('login_username'); const _p = localStorage.getItem('login_password'); if (_u && _p) { const _r = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: _u, password: _p }) }); if (_r.ok) { const _d = await _r.json() as { access_token?: string }; access_token = _d.access_token || ''; if (access_token) localStorage.setItem('access_token', access_token); } } }
      const hdrs = { Authorization: `Bearer ${access_token}`, 'X-Tenant-Id': TENANT_ID };

      const res = await fetch(`${API_BASE}/assets/list?limit=100`, { headers: hdrs });
      if (res.ok) {
        const data = await res.json();
        setAssets(Array.isArray(data) ? data : (data.items ?? []));
        setMessage('');
      } else {
        setMessage('Sin datos de activos — verifique el módulo Activos.');
      }
    } catch {
      setMessage('Backend no disponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
        background: `linear-gradient(90deg, ${C.accent}0d, transparent)`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>🏭 Registro de Activos Fijos</span>
        <button
          type="button"
          onClick={load}
          style={{
            padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
            background: `${C.accent}18`, color: C.accent,
            border: `1px solid ${C.accent}33`, borderRadius: 5,
          }}
        >
          🔄 Actualizar
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.header }}>
              {['CÓDIGO', 'DESCRIPCIÓN', 'VALOR LIBROS', 'DEP. ACUM.', 'VALOR NETO', 'ESTADO'].map((h, i) => (
                <th key={i} style={{
                  padding: '8px 12px', textAlign: i >= 2 && i <= 4 ? 'right' : 'left',
                  fontSize: 10, fontWeight: 700, color: C.textMut,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderBottom: `1px solid ${C.border}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>⏳ Cargando activos...</td></tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: C.textDim, fontSize: 12 }}>
                  {message || 'Sin activos registrados. Registre activos fijos en el módulo Activos para verlos aquí.'}
                </td>
              </tr>
            ) : assets.map((a, i) => (
              <tr
                key={a.id}
                style={{ background: i % 2 === 1 ? C.bgRow : C.bgCard, borderBottom: `1px solid ${C.border}22` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bgHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? C.bgRow : C.bgCard; }}
              >
                <td style={{ padding: '9px 12px', color: C.accent, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>{a.asset_code}</td>
                <td style={{ padding: '9px 12px', color: C.text, fontWeight: 600 }}>
                  {a.description}
                  {a.location && <div style={{ fontSize: 10, color: C.textDim }}>{a.location}</div>}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: C.text, fontFamily: 'Consolas, monospace' }}>
                  {fmt(a.acquisition_cost)}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: C.red, fontFamily: 'Consolas, monospace' }}>
                  {fmt(a.accumulated_depreciation)}
                </td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: C.green, fontFamily: 'Consolas, monospace', fontWeight: 800 }}>
                  {fmt(a.net_book_value)}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <span style={{
                    padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                    color: a.status === 'ACTIVE' || a.status === 'OPERATIVO' ? C.green : C.textMut,
                    background: `${a.status === 'ACTIVE' || a.status === 'OPERATIVO' ? C.green : C.textMut}18`,
                    border: `1px solid ${a.status === 'ACTIVE' || a.status === 'OPERATIVO' ? C.green : C.textMut}33`,
                  }}>
                    {a.status || 'ACTIVO'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
