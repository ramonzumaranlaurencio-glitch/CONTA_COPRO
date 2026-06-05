import React, { useState } from 'react';
import { useTenantStore, type Company } from '../../hooks/useTenantStore';
import { PLAN_FEATURES } from '../../config/planFeatures';
import type { Plan } from '../../config/planFeatures';
import type { Rubro } from '../../config/itemCatalog';

const C = {
  bg: '#020812', bg1: '#050d1a', bg2: '#080f1f', border: '#1e3a5f',
  accent: '#38bdf8', blue: '#0078d4', green: '#22c55e', yellow: '#f59e0b',
  red: '#ef4444', purple: '#a855f7', text: '#e8f0fe', muted: '#7da3c4',
  dim: '#4d7a9e',
};

const RUBROS_LISTA = [
  { id: 'CO' as Rubro, label: 'Comercial',    icon: '🏪' },
  { id: 'GE' as Rubro, label: 'Servicios',    icon: '💼' },
  { id: 'CM' as Rubro, label: 'Construcción', icon: '🏗️' },
  { id: 'FA' as Rubro, label: 'Fabricación',  icon: '🏭' },
  { id: 'MI' as Rubro, label: 'Minería',      icon: '⛏️' },
  { id: 'TR' as Rubro, label: 'Transporte',   icon: '🚛' },
  { id: 'SA' as Rubro, label: 'Salud',        icon: '🏥' },
  { id: 'ED' as Rubro, label: 'Educación',    icon: '🎓' },
  { id: 'HO' as Rubro, label: 'Hostelería',   icon: '🏨' },
  { id: 'RE' as Rubro, label: 'Restaurante',  icon: '🍽️' },
  { id: 'AG' as Rubro, label: 'Agro',         icon: '🌾' },
  { id: 'TE' as Rubro, label: 'Tecnología',   icon: '💻' },
];

const PLAN_LABELS: Record<string, string> = {
  TRIAL_CONTADOR:   '1 Mes Gratis',
  BASICO_CONTADOR:  'Básico',
  PLUS_CONTADOR:    'Plus',
  PRO_CONTADOR:     'Pro',
  MAESTRO_PLUS:     'Maestro+',
};

type Props = {
  userPlan: string;
  displayName: string;
  onSelectCompany: (company: Company) => void;
};

export const CompanySelectScreen: React.FC<Props> = ({ userPlan, displayName, onSelectCompany }) => {
  const { companies, addCompany } = useTenantStore();
  const [showForm, setShowForm]   = useState(false);
  const [ruc,     setRuc]         = useState('');
  const [nombre,  setNombre]      = useState('');
  const [rubro,   setRubro]       = useState<Rubro>('CO');
  const [error,   setError]       = useState('');

  const features   = PLAN_FEATURES[userPlan as Plan] ?? PLAN_FEATURES.TRIAL_CONTADOR;
  const maxEmpresas = features.maxBusinesses; // 0 = ilimitado
  const canAdd     = maxEmpresas === 0 || companies.length < maxEmpresas;
  const limitLabel = maxEmpresas === 0 ? 'Ilimitadas' : `${companies.length} / ${maxEmpresas}`;

  const handleAdd = () => {
    if (!ruc.trim() || ruc.trim().length < 11) { setError('El RUC debe tener 11 dígitos.'); return; }
    if (!nombre.trim()) { setError('Ingresa la razón social.'); return; }
    const company: Company = {
      id: `tenant-${Date.now()}`,
      ruc: ruc.trim(),
      businessName: nombre.trim(),
      rubro,
      rubros: [rubro],
    };
    addCompany(company);
    setRuc(''); setNombre(''); setRubro('CO'); setError(''); setShowForm(false);
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', boxSizing: 'border-box',
    background: 'rgba(5,13,26,0.8)', border: `1.5px solid ${C.border}`,
    borderRadius: 8, color: C.text, fontSize: 13, outline: 'none',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI', Arial, sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 760 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏢</div>
          <h1 style={{ color: C.text, fontSize: 22, fontWeight: 900, margin: '0 0 6px' }}>
            Selecciona una empresa
          </h1>
          <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>
            Hola <strong style={{ color: C.accent }}>{displayName}</strong> — elige la empresa cuya contabilidad vas a gestionar hoy
          </p>
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, background: `${C.blue}18`, border: `1px solid ${C.blue}44`, borderRadius: 20, padding: '4px 14px' }}>
            <span style={{ color: C.accent, fontSize: 11, fontWeight: 700 }}>Plan {PLAN_LABELS[userPlan] || userPlan}</span>
            <span style={{ color: C.dim, fontSize: 11 }}>·</span>
            <span style={{ color: C.muted, fontSize: 11 }}>Empresas: {limitLabel}</span>
          </div>
        </div>

        {/* Grid de empresas */}
        {companies.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            {companies.map(c => {
              const rubroInfo = RUBROS_LISTA.find(r => r.id === c.rubro);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCompany(c)}
                  style={{
                    background: C.bg2, border: `1.5px solid ${C.border}`, borderRadius: 14,
                    padding: '20px 18px', textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.2s', fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent;
                    (e.currentTarget as HTMLButtonElement).style.background = `rgba(56,189,248,0.08)`;
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = C.border;
                    (e.currentTarget as HTMLButtonElement).style.background = C.bg2;
                    (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                  }}
                >
                  <div style={{ fontSize: 30, marginBottom: 10 }}>{rubroInfo?.icon || '🏢'}</div>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 4, lineHeight: 1.3 }}>{c.businessName}</div>
                  <div style={{ color: C.dim, fontSize: 11, marginBottom: 10 }}>RUC {c.ruc}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${C.blue}22`, border: `1px solid ${C.blue}44`, borderRadius: 20, padding: '2px 10px' }}>
                    <span style={{ color: C.accent, fontSize: 10, fontWeight: 700 }}>{rubroInfo?.label || c.rubro}</span>
                  </div>
                  <div style={{ marginTop: 12, color: C.accent, fontSize: 12, fontWeight: 700 }}>
                    Ingresar →
                  </div>
                </button>
              );
            })}

            {/* Tarjeta agregar empresa */}
            {canAdd && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                style={{
                  background: 'transparent', border: `1.5px dashed ${C.border}`, borderRadius: 14,
                  padding: '20px 18px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.2s', fontFamily: "'Segoe UI', Arial, sans-serif",
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  minHeight: 160,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; }}
              >
                <div style={{ fontSize: 28, color: C.dim }}>+</div>
                <div style={{ color: C.muted, fontSize: 12, fontWeight: 700 }}>Agregar empresa</div>
                {maxEmpresas > 0 && <div style={{ color: C.dim, fontSize: 10 }}>({companies.length}/{maxEmpresas} usadas)</div>}
              </button>
            )}
          </div>
        )}

        {/* Estado vacío */}
        {companies.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', padding: '40px 0', marginBottom: 24 }}>
            <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.4 }}>🏢</div>
            <p style={{ color: C.muted, fontSize: 14, margin: '0 0 20px' }}>
              Aún no tienes empresas registradas.<br />
              <span style={{ color: C.dim, fontSize: 12 }}>Crea tu primera empresa cliente para comenzar.</span>
            </p>
            <button type="button" onClick={() => setShowForm(true)} style={{
              padding: '12px 28px', background: `linear-gradient(135deg, ${C.blue}, ${C.accent})`,
              border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
              boxShadow: `0 4px 20px ${C.blue}55`,
            }}>
              + Crear primera empresa
            </button>
          </div>
        )}

        {/* Solo mostrar el botón agregar si ya hay empresas y aún no se abrió el form */}
        {companies.length > 0 && !showForm && canAdd && companies.length > 0 && (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <button type="button" onClick={() => setShowForm(true)} style={{
              padding: '10px 24px', background: 'transparent', border: `1.5px solid ${C.border}`,
              borderRadius: 10, color: C.muted, fontWeight: 600, fontSize: 13,
              cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
            }}>
              + Agregar otra empresa
            </button>
          </div>
        )}

        {/* Formulario nueva empresa */}
        {showForm && (
          <div style={{ background: C.bg2, border: `1px solid ${C.accent}44`, borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
            <h3 style={{ color: C.text, fontSize: 15, fontWeight: 800, margin: '0 0 18px' }}>
              + Nueva empresa cliente
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>RUC (11 dígitos) *</label>
                <input value={ruc} onChange={e => { setRuc(e.target.value); setError(''); }}
                  placeholder="20XXXXXXXXX" maxLength={12}
                  style={{ ...inp, fontFamily: 'Consolas, monospace' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Razón social *</label>
                <input value={nombre} onChange={e => { setNombre(e.target.value); setError(''); }}
                  placeholder="EMPRESA SAC" style={inp} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rubro *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {RUBROS_LISTA.map(r => (
                  <button key={r.id} type="button" onClick={() => setRubro(r.id)} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
                    background: rubro === r.id ? `${C.accent}22` : 'transparent',
                    border: `1px solid ${rubro === r.id ? C.accent : C.border}`,
                    color: rubro === r.id ? C.accent : C.muted,
                    transition: 'all 0.15s',
                  }}>{r.icon} {r.label}</button>
                ))}
              </div>
            </div>
            {error && <p style={{ margin: '0 0 12px', color: C.red, fontSize: 12 }}>⚠ {error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setShowForm(false); setError(''); setRuc(''); setNombre(''); }} style={{
                padding: '10px 20px', background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 9, color: C.muted, fontSize: 13, cursor: 'pointer',
                fontFamily: "'Segoe UI', Arial, sans-serif",
              }}>Cancelar</button>
              <button type="button" onClick={handleAdd} style={{
                padding: '10px 24px', background: `linear-gradient(135deg, ${C.blue}, ${C.accent})`,
                border: 'none', borderRadius: 9, color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif",
              }}>+ Guardar empresa</button>
            </div>
          </div>
        )}

        {/* Límite alcanzado */}
        {!canAdd && companies.length > 0 && (
          <div style={{ textAlign: 'center', padding: '12px', background: `${C.yellow}10`, border: `1px solid ${C.yellow}33`, borderRadius: 10, marginBottom: 20 }}>
            <p style={{ margin: 0, color: C.yellow, fontSize: 12 }}>
              Has alcanzado el límite de <strong>{maxEmpresas} empresas</strong> de tu plan {PLAN_LABELS[userPlan] || userPlan}.
              Actualiza tu plan para agregar más.
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', color: C.dim, fontSize: 11 }}>
          CONTA_PRO Enterprise · Selecciona una empresa para ingresar al workspace
        </p>
      </div>
    </div>
  );
};

export default CompanySelectScreen;
