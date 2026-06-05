import React, { useState } from 'react';
import { ChevronDown16Regular, Add16Regular } from '@fluentui/react-icons';
import { useTenantStore, type Company } from '@/hooks/useTenantStore';
import type { Rubro } from '@/config/itemCatalog';

const RUBROS: { id: Rubro; label: string }[] = [
  { id: 'CO', label: 'Comercial' },
  { id: 'DI', label: 'Distribución' },
  { id: 'FA', label: 'Fabricación' },
  { id: 'MI', label: 'Minería' },
  { id: 'TR', label: 'Transporte' },
  { id: 'SA', label: 'Salud' },
  { id: 'ED', label: 'Educación' },
  { id: 'HO', label: 'Hostelería' },
  { id: 'RE', label: 'Restaurante' },
  { id: 'AG', label: 'Agro' },
  { id: 'PE', label: 'Pesca' },
  { id: 'EN', label: 'Energía' },
  { id: 'TE', label: 'Tecnología' },
  { id: 'CM', label: 'Construcción' },
  { id: 'GE', label: 'General / Servicios' },
];

export const TenantSelector = () => {
  const { currentCompany, companies, setCompany, addCompany } = useTenantStore();
  const [showForm, setShowForm] = useState(false);
  const [ruc, setRuc] = useState('');
  const [nombre, setNombre] = useState('');
  const [rubro, setRubro] = useState<Rubro>('GE');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!ruc.trim() || ruc.trim().length < 9) { setError('NIT inválido (mínimo 9 dígitos colombianos)'); return; }
    if (!nombre.trim()) { setError('Ingresa la razón social'); return; }
    const company: Company = {
      id: `tenant-${Date.now()}`,
      ruc: ruc.trim(),
      businessName: nombre.trim(),
      rubro,
      rubros: [rubro],
    };
    addCompany(company);
    setRuc(''); setNombre(''); setRubro('GE'); setError(''); setShowForm(false);
  };

  const inp: React.CSSProperties = {
    padding: '6px 10px', background: 'rgba(5,13,26,0.9)',
    border: '1px solid #1e3a5f', borderRadius: 6, color: '#e8f0fe',
    fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="tenant-selector">
        <div className="tenant-selector-info">
          <span className="tenant-selector-caption">Empresa Activa</span>
          {companies.length > 0 && currentCompany ? (
            <select
              value={currentCompany.id}
              onChange={e => setCompany(e.target.value)}
              className="tenant-selector-select"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id} className="text-slate-800">
                  {c.ruc} - {c.businessName}
                </option>
              ))}
            </select>
          ) : (
            <span style={{ color: '#7da3c4', fontSize: 12 }}>Sin empresas — agrega una</span>
          )}
        </div>
        <ChevronDown16Regular className="tenant-selector-icon" />
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          title="Agregar empresa"
          style={{
            background: showForm ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.3)', borderRadius: 5,
            color: '#38bdf8', cursor: 'pointer', padding: '3px 6px',
            display: 'flex', alignItems: 'center', marginLeft: 6,
          }}
        >
          <Add16Regular />
        </button>
      </div>

      {showForm && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 999,
          background: '#080f1f', border: '1px solid #1e3a5f', borderRadius: 10,
          padding: '16px', width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}>
          <p style={{ margin: '0 0 12px', color: '#e8f0fe', fontSize: 13, fontWeight: 700 }}>
            + Agregar empresa cliente
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: '#7da3c4', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>NIT (9-10 dígitos Colombia)</label>
              <input value={ruc} onChange={e => setRuc(e.target.value)} placeholder="900XXXXXX-1" maxLength={12} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#7da3c4', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Razón social</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="EMPRESA SAS" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#7da3c4', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rubro</label>
              <select value={rubro} onChange={e => setRubro(e.target.value as Rubro)} style={inp}>
                {RUBROS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>

            {error && <p style={{ margin: 0, color: '#ef4444', fontSize: 11 }}>⚠ {error}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button type="button" onClick={() => { setShowForm(false); setError(''); }} style={{
                flex: 1, padding: '8px', background: 'transparent', border: '1px solid #1e3a5f',
                borderRadius: 7, color: '#7da3c4', fontSize: 12, cursor: 'pointer',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}>Cancelar</button>
              <button type="button" onClick={handleAdd} style={{
                flex: 1, padding: '8px', background: 'linear-gradient(135deg,#0078d4,#38bdf8)',
                border: 'none', borderRadius: 7, color: '#fff', fontSize: 12,
                fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
              }}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
