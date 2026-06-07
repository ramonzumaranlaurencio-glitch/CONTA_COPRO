/**
 * PlanSelectorModal — Pantalla flotante de selección de planes
 * Se muestra como overlay sobre cualquier pantalla
 * Detecta automáticamente si es Contador Independiente o Empresa
 */
import React, { useState } from 'react';

// ─── Paleta ────────────────────────────────────────────────────────────────
const C = {
  bg:     '#020812',
  card:   '#080f1f',
  card2:  '#0b1525',
  border: '#1a3050',
  text:   '#e2eaf8',
  muted:  '#6e93b8',
  dim:    '#3d6080',
  accent: '#38bdf8',
  blue:   '#0078d4',
  green:  '#22c55e',
  yellow: '#f59e0b',
  red:    '#ef4444',
  purple: '#a855f7',
  indigo: '#6366f1',
};

// ─── Tipos ─────────────────────────────────────────────────────────────────
export type UserType = 'CONTADOR' | 'EMPRESA';

export interface PlanSelected {
  id: string;
  name: string;
  price: number;
  userType: UserType;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  period: string;
  icon: string;
  color: string;
  tag: string | null;
  tagColor: string;
  features: string[];
  noIncluye: string[];
  nota: string;
  negocios?: number;
  ia: string;
}

interface Props {
  /** Si no se pasa, el usuario elige el tipo desde el modal */
  defaultType?: UserType;
  onSelect: (plan: PlanSelected) => void;
  onClose: () => void;
}

// ─── Datos de planes ────────────────────────────────────────────────────────
const PLANES_CONTADOR: Plan[] = [
  {
    id: 'TRIAL_CONTADOR',
    name: '1 Mes Gratis',
    price: 0,
    priceLabel: 'GRATIS',
    period: '1 mes',
    icon: '🎁',
    color: C.green,
    tag: 'PRUEBA',
    tagColor: C.green,
    negocios: 3,
    ia: 'Sin IA',
    features: [
      '3 negocios incluidos',
      'Contabilidad completa',
      'Ventas y compras',
      'Libro diario / mayor',
      'Reportes básicos',
    ],
    noIncluye: ['IA / OCR', 'Inventario', 'Planillas'],
    nota: 'Solo 1 vez por contador. Negocios no pueden repetir la prueba.',
  },
  {
    id: 'BASICO_CONTADOR',
    name: 'Básico',
    price: 50,
    priceLabel: '$50',
    period: '/mes',
    icon: '📊',
    color: C.muted,
    tag: null,
    tagColor: '',
    negocios: 5,
    ia: 'Sin IA',
    features: [
      '5 negocios activos',
      'Contabilidad completa',
      'Ventas y compras',
      'Libro diario / mayor',
      'Reportes estándar',
    ],
    noIncluye: ['IA / OCR', 'Inventario', 'Planillas'],
    nota: 'Continuación ideal después del mes gratis.',
  },
  {
    id: 'PLUS_CONTADOR',
    name: 'Plus',
    price: 99,
    priceLabel: '$99',
    period: '/mes',
    icon: '⚡',
    color: C.accent,
    tag: 'POPULAR',
    tagColor: C.accent,
    negocios: 10,
    ia: '50 usos/mes',
    features: [
      '10 negocios activos',
      'Contabilidad completa',
      'Ventas y compras',
      'Libro diario / mayor',
      'OCR Gemini IA',
      '50 documentos IA/mes',
      'Reportes avanzados',
    ],
    noIncluye: ['Inventario', 'Planillas'],
    nota: 'Igual que Básico + más negocios y IA.',
  },
  {
    id: 'PRO_CONTADOR',
    name: 'Pro',
    price: 129,
    priceLabel: '$129',
    period: '/mes',
    icon: '🚀',
    color: C.indigo,
    tag: null,
    tagColor: '',
    negocios: 15,
    ia: '100 usos/mes',
    features: [
      '15 negocios activos',
      'Contabilidad completa',
      'Ventas y compras',
      'Libro diario / mayor',
      'OCR Gemini IA',
      '100 documentos IA/mes',
      'BI avanzado',
      'Reportes completos',
    ],
    noIncluye: ['Inventario', 'Planillas'],
    nota: 'Igual que Plus + más negocios y IA.',
  },
  {
    id: 'MAESTRO_PLUS',
    name: 'Maestro+',
    price: 0,
    priceLabel: 'A tratar',
    period: '',
    icon: '👑',
    color: C.purple,
    tag: 'ERP COMPLETO',
    tagColor: C.purple,
    negocios: 0,
    ia: 'Ilimitada',
    features: [
      'Negocios ilimitados',
      'ERP completo activo',
      'Inventario y almacén',
      'Planillas completas',
      'Centros de costo',
      'IA sin límite',
      'DIAN completo',
      'Soporte dedicado',
    ],
    noIncluye: [],
    nota: 'Para contadores que necesitan ERP completo. Implementación guiada.',
  },
];

const PLANES_EMPRESA: Plan[] = [
  {
    id: 'PLUS_EMPRESA',
    name: 'Plus Empresa',
    price: 119,
    priceLabel: '$119',
    period: '/mes',
    icon: '⚡',
    color: C.accent,
    tag: null,
    tagColor: '',
    ia: '100 docs/mes',
    features: [
      '1 empresa',
      'Contabilidad completa',
      'Ventas y compras',
      'Inventario base',
      'OCR IA — 100 docs/mes',
      'Módulos según rubro',
      'Plan contable por actividad',
      'Reportes básicos',
    ],
    noIncluye: ['Planillas', 'Centros de costo', 'Almacenes múltiples'],
    nota: 'Módulos se activan automáticamente según el rubro elegido.',
  },
  {
    id: 'PRO_EMPRESA',
    name: 'Pro Empresa',
    price: 149,
    priceLabel: '$149',
    period: '/mes',
    icon: '🚀',
    color: C.blue,
    tag: 'RECOMENDADO',
    tagColor: C.blue,
    ia: '200 docs/mes',
    features: [
      '1 empresa',
      'Contabilidad completa',
      'Ventas y compras',
      'Inventario completo',
      'Planillas',
      'OCR IA — 200 docs/mes',
      'Centros de costo',
      'Almacenes múltiples',
      'BI avanzado',
      'DIAN integrado',
      'Reportes completos',
    ],
    noIncluye: ['Implementación personalizada'],
    nota: 'La opción más completa para empresas medianas.',
  },
  {
    id: 'MAESTRO_EMPRESA',
    name: 'Maestro Empresa',
    price: 0,
    priceLabel: 'A tratar',
    period: '',
    icon: '👑',
    color: C.purple,
    tag: 'PERSONALIZADO',
    tagColor: C.purple,
    ia: 'Ilimitada por proceso',
    features: [
      'ERP completo personalizado',
      'Diagnóstico de procesos',
      'Todos los módulos activos',
      'Múltiples usuarios',
      'IA configurada por área',
      'DIAN completo',
      'Integraciones (banco/SAP/Odoo)',
      'Capacitación al equipo',
      'Soporte dedicado',
    ],
    noIncluye: [],
    nota: 'Diagnóstico + implementación guiada + soporte post-arranque.',
  },
];

// ─── Audios explicativos por plan ──────────────────────────────────────────
const PLAN_AUDIO: Record<string, string> = {
  TRIAL_CONTADOR:
    'Plan gratuito de un mes para contadores colombianos. ' +
    'Puedes gestionar hasta tres empresas sin ningún costo. ' +
    'Incluye contabilidad completa con Plan Único de Cuentas colombiano, ' +
    'registro de ventas y compras, libro diario y reportes básicos compatibles con la DIAN. ' +
    'Sin tarjeta de crédito. Sin permanencia. ' +
    'Al terminar el mes eliges si continúas con un plan de pago. ' +
    'Recuerda que cada empresa solo puede usar esta prueba gratuita una vez.',

  BASICO_CONTADOR:
    'Plan Básico, cincuenta dólares al mes. ' +
    'Ideal para contadores colombianos que acaban de terminar su mes gratuito. ' +
    'Gestiona hasta cinco empresas activas con contabilidad completa en PUC, ' +
    'ventas, compras, libro diario y reportes estándar para la DIAN. ' +
    'Sin inteligencia artificial, pero con todas las herramientas esenciales para llevar una contabilidad ordenada en Colombia.',

  PLUS_CONTADOR:
    'Plan Plus, noventa y nueve dólares al mes. ' +
    'El más popular entre los contadores colombianos. ' +
    'Gestiona hasta diez empresas activas. ' +
    'Incluye el lector de facturas electrónicas con inteligencia artificial: ' +
    'solo subes la foto del comprobante y el sistema extrae todos los datos automáticamente, ' +
    'compatible con la facturación electrónica DIAN y el CUFE. ' +
    'Cincuenta documentos procesados por inteligencia artificial cada mes. ' +
    'La diferencia con el plan Básico es más empresas y la inteligencia artificial.',

  PRO_CONTADOR:
    'Plan Pro, ciento veintinueve dólares al mes. ' +
    'Para contadores con una cartera amplia de clientes en Colombia. ' +
    'Gestiona hasta quince empresas activas. ' +
    'Cien documentos procesados con inteligencia artificial por mes. ' +
    'Incluye Business Intelligence avanzado para analizar la situación financiera de todos tus clientes. ' +
    'La diferencia con el Plus es más empresas y más usos de inteligencia artificial. ' +
    'Los módulos contables son exactamente los mismos en Básico, Plus y Pro.',

  MAESTRO_PLUS:
    'Plan Maestro Plus, precio a tratar directamente con nosotros. ' +
    'Es la solución completa para contadores que necesitan un ERP total en Colombia. ' +
    'Empresas ilimitadas. Inventario y almacén activados. Nómina completa con aportes a Sistema Pensional (Colpensiones o SPP), EPS, ARL y caja de compensación. ' +
    'Centros de costo. Inteligencia artificial sin límite. ' +
    'DIAN integrado con facturación electrónica, medios magnéticos y exógena. ' +
    'Incluye implementación guiada, capacitación y soporte dedicado. ' +
    'Si gestionas empresas complejas con inventario o personal, este es tu plan.',

  PLUS_EMPRESA:
    'Plan Plus Empresa, ciento diecinueve dólares al mes. ' +
    'Diseñado para una empresa colombiana que quiere manejar su propia contabilidad. ' +
    'Contabilidad completa con PUC, ventas, compras, inventario base ' +
    'y cien documentos procesados con inteligencia artificial cada mes. ' +
    'Los módulos se activan automáticamente según el régimen tributario que elijas: ' +
    'SIMPLE, Ordinario, o Gran Contribuyente. ' +
    'El sistema crea el plan contable específico para tu actividad económica y sector.',

  PRO_EMPRESA:
    'Plan Pro Empresa, ciento cuarenta y nueve dólares al mes. ' +
    'La opción más completa para empresas medianas en Colombia. ' +
    'Incluye todo lo del Plus más nómina con aportes parafiscales a AFP, EPS, ARL y CCF, ' +
    'centros de costo, almacenes múltiples para controlar distintos depósitos, ' +
    'doscientos documentos procesados con inteligencia artificial al mes, ' +
    'Business Intelligence avanzado y DIAN integrado con facturación electrónica. ' +
    'Si tu empresa tiene personal, inventario en varios almacenes y necesita reportes detallados para la DIAN, ' +
    'el Pro Empresa es tu solución ideal.',

  MAESTRO_EMPRESA:
    'Plan Maestro Empresa, precio a tratar según el alcance. ' +
    'Es una implementación personalizada de ERP completo para tu empresa colombiana. ' +
    'Comenzamos con un diagnóstico detallado de tus procesos actuales. ' +
    'Configuramos todos los módulos según tu realidad operativa y régimen ante la DIAN. ' +
    'Parametrizamos la inteligencia artificial por área de tu negocio. ' +
    'Capacitamos a todo tu equipo en el uso del sistema y las obligaciones tributarias colombianas. ' +
    'Y brindamos soporte dedicado después de la puesta en marcha. ' +
    'Si tu empresa tiene procesos complejos o múltiples áreas, ' +
    'contáctanos para un diagnóstico sin compromiso.',
};

const speakPlan = (planId: string) => {
  if (!window.speechSynthesis) return;
  const text = PLAN_AUDIO[planId];
  if (!text) return;

  const speak = () => {
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name) && /male|hombre|jorge|pablo|diego/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name)) ||
      voices.find(v => v.lang === 'es-CO') ||
      voices.find(v => v.lang.startsWith('es'));

    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.lang   = 'es-CO';
    utter.rate   = 0.91;
    utter.pitch  = 0.88;
    utter.volume = 0.85;
    window.speechSynthesis.cancel(); // para el audio anterior inmediatamente
    window.speechSynthesis.speak(utter);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    speak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      speak();
    };
  }
};

// ─── Componente ─────────────────────────────────────────────────────────────
export const PlanSelectorModal: React.FC<Props> = ({ defaultType, onSelect, onClose }) => {
  const [tipo, setTipo] = useState<UserType>(defaultType ?? 'CONTADOR');
  const [hover, setHover] = useState('');
  const [activePlan, setActivePlan] = useState('');

  const planes = tipo === 'CONTADOR' ? PLANES_CONTADOR : PLANES_EMPRESA;

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* ── Overlay ── */}
      <div
        onClick={() => { window.speechSynthesis?.cancel(); onClose(); }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(2,8,18,0.88)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1000,
        }}
      />

      {/* ── Panel flotante ── */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        width: '95vw', maxWidth: tipo === 'CONTADOR' ? 1100 : 860,
        maxHeight: '90vh',
        overflowY: 'auto',
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px ${C.border}, 0 0 80px rgba(56,189,248,0.06)`,
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 28px 16px',
          borderBottom: `1px solid ${C.border}`,
          background: `linear-gradient(90deg, ${C.card} 0%, rgba(56,189,248,0.04) 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 2,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.text }}>
              Elige tu plan CONTA_COLPRO
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted }}>
              Precios en dólares · Sin permanencia · Cancela cuando quieras · Colombia
            </p>
          </div>

          {/* Selector tipo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex', background: C.card2,
              border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, gap: 3,
            }}>
              {(['CONTADOR', 'EMPRESA'] as UserType[]).map(t => (
                <button key={t} type="button" onClick={() => setTipo(t)} style={{
                  padding: '7px 18px', borderRadius: 7, border: 'none',
                  background: tipo === t
                    ? `linear-gradient(135deg, ${C.blue}, ${C.accent})`
                    : 'transparent',
                  color: tipo === t ? '#fff' : C.muted,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  fontFamily: "'Segoe UI', Arial, sans-serif",
                  transition: 'all 0.2s',
                }}>
                  {t === 'CONTADOR' ? '👤 Contador' : '🏢 Empresa'}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { window.speechSynthesis?.cancel(); onClose(); }} style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
              color: C.muted, fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Segoe UI', Arial, sans-serif",
            }}>✕</button>
          </div>
        </div>

        {/* Grid de planes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${planes.length}, 1fr)`,
          gap: 12,
          padding: '20px 24px 24px',
        }}>
          {planes.map(pl => {
            const isHover = hover === pl.id;
            const isMaestro = pl.id.includes('MAESTRO');
            return (
              <div
                key={pl.id}
                onMouseEnter={() => setHover(pl.id)}
                onMouseLeave={() => setHover('')}
                style={{
                  background: isHover ? `${pl.color}12` : C.card,
                  border: `1.5px solid ${isHover || pl.tag === 'POPULAR' || pl.tag === 'RECOMENDADO' ? pl.color : C.border}`,
                  borderTop: `3px solid ${pl.color}`,
                  borderRadius: 14,
                  padding: '20px 16px',
                  display: 'flex', flexDirection: 'column', gap: 0,
                  position: 'relative', overflow: 'hidden',
                  transform: isHover ? 'translateY(-4px)' : 'none',
                  boxShadow: isHover ? `0 12px 40px ${pl.color}28` : 'none',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setActivePlan(pl.id);
                  speakPlan(pl.id);
                }}
              >
                {/* Tag */}
                {pl.tag && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%',
                    transform: 'translateX(-50%)',
                    background: pl.tagColor, color: '#fff',
                    fontSize: 9, fontWeight: 800, padding: '3px 14px',
                    borderRadius: '0 0 8px 8px', whiteSpace: 'nowrap',
                    letterSpacing: '0.06em',
                  }}>{pl.tag}</div>
                )}

                {/* Icono + nombre */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: pl.tag ? 14 : 0, marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>{pl.icon}</span>
                  <span style={{ color: pl.color, fontWeight: 900, fontSize: 14 }}>{pl.name}</span>
                </div>

                {/* Precio */}
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: isMaestro ? 18 : 32, fontWeight: 900, color: C.text, fontFamily: 'Consolas, monospace' }}>
                    {pl.priceLabel}
                  </span>
                  {pl.period && (
                    <span style={{ fontSize: 12, color: C.dim, marginLeft: 3 }}>{pl.period}</span>
                  )}
                </div>

                {/* IA badge */}
                <div style={{
                  background: `${pl.color}20`, color: pl.color,
                  border: `1px solid ${pl.color}33`,
                  fontSize: 10, fontWeight: 700, padding: '4px 10px',
                  borderRadius: 8, marginBottom: 14, textAlign: 'center',
                }}>
                  🤖 {pl.ia}
                </div>

                {/* Empresas (solo contador) */}
                {tipo === 'CONTADOR' && pl.negocios !== undefined && (
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                    📁 {pl.negocios === 0 ? 'Empresas ilimitadas' : `${pl.negocios} empresas`}
                  </div>
                )}

                {/* Features */}
                <div style={{ flex: 1, marginBottom: 12 }}>
                  {pl.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '3px 0', fontSize: 11, color: C.dim }}>
                      <span style={{ color: C.green, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                    </div>
                  ))}
                  {pl.noIncluye.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '3px 0', fontSize: 11, color: `${C.dim}88` }}>
                      <span style={{ color: `${C.red}66`, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✕</span>
                      <span style={{ textDecoration: 'line-through' }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Nota */}
                {pl.nota && (
                  <p style={{ margin: '0 0 14px', fontSize: 10, color: C.dim, lineHeight: 1.4, borderTop: `1px dashed ${C.border}`, paddingTop: 10 }}>
                    {pl.nota}
                  </p>
                )}

                {/* Indicador audio activo */}
                {activePlan === pl.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, fontSize: 10, color: pl.color }}>
                    <span style={{ animation: 'pulse 1s infinite' }}>🔊</span>
                    <span>Escuchando explicación...</span>
                  </div>
                )}

                {/* Botón elegir */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    window.speechSynthesis?.cancel();
                    onSelect({ id: pl.id, name: pl.name, price: pl.price, userType: tipo });
                  }}
                  style={{
                    width: '100%', padding: '10px',
                    background: isHover || activePlan === pl.id
                      ? `linear-gradient(135deg, ${pl.color}, ${pl.color}cc)`
                      : `${pl.color}18`,
                    border: `1.5px solid ${pl.color}66`,
                    borderRadius: 9, color: isHover || activePlan === pl.id ? '#fff' : pl.color,
                    fontWeight: 800, fontSize: 12, cursor: 'pointer',
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    transition: 'all 0.2s',
                    boxShadow: isHover || activePlan === pl.id ? `0 4px 20px ${pl.color}44` : 'none',
                  }}>
                  {isMaestro ? 'Solicitar →' : pl.price === 0 ? 'Comenzar gratis →' : `Elegir ${pl.name} →`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 28px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: C.card,
        }}>
          <div style={{ display: 'flex', gap: 20 }}>
            {['🔒 Pago seguro', '📅 Sin permanencia', '🔄 Cancela cuando quieras', '💬 Soporte incluido'].map((f, i) => (
              <span key={i} style={{ fontSize: 11, color: C.dim }}>{f}</span>
            ))}
          </div>
          <span style={{ fontSize: 11, color: C.dim }}>Pagos: Nequi · Daviplata · PSE · Transferencia bancaria</span>
        </div>
      </div>
    </>
  );
};

export default PlanSelectorModal;
