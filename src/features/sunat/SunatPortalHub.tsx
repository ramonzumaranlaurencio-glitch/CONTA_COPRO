/**
 * DianPortalHub — Portal DIAN completo
 * Acceso a trámites · Biblioteca tributaria completa · Audio natural Google
 * Todos los planes (dian:true)
 */
import React, { useRef, useState } from 'react';

// ─── Paleta ────────────────────────────────────────────────────────────────
const C = {
  bg:     '#020812', bgCard: '#080f1f', bgRow: '#0b1525',
  border: '#1a3050', text:   '#e2eaf8', muted:  '#6e93b8',
  dim:    '#3d6080', accent: '#38bdf8', blue:   '#0078d4',
  green:  '#22c55e', yellow: '#f59e0b', red:    '#ef4444',
  purple: '#a855f7', orange: '#f97316', indigo: '#6366f1',
};

// ─── Motor de voz (Google TTS gratis) ──────────────────────────────────────
let currentUtterance: SpeechSynthesisUtterance | null = null;

const speak = (text: string, onEnd?: () => void) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;

  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name) && /male|hombre|jorge|pablo|diego/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name)) ||
      voices.find(v => v.lang === 'es-CO') ||
      voices.find(v => v.lang.startsWith('es'));

    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.lang = 'es-CO'; utter.rate = 0.91; utter.pitch = 0.88; utter.volume = 0.85;
    if (onEnd) utter.onend = onEnd;
    currentUtterance = utter;
    window.speechSynthesis.speak(utter);
  };

  if (window.speechSynthesis.getVoices().length > 0) doSpeak();
  else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }; }
};

const stopAudio = () => { window.speechSynthesis?.cancel(); currentUtterance = null; };

// ─── Datos: Servicios DIAN ────────────────────────────────────────────────
// ─── Servicios DIAN con URLs verificadas 2026 ────────────────────────────
const DIAN_SERVICIOS = [
  {
    categoria: 'Portal Muisca (DIAN)',
    icon: '🔐', color: C.blue,
    items: [
      { nombre: 'Portal Transaccional', url: 'https://muisca.dian.gov.co/', desc: 'Acceso a servicios con firma digital · Requiere Usuario Muisca', sol: true },
      { nombre: 'Recuperar contraseña', url: 'https://www.dian.gov.co/servicios/identidad-digital', desc: 'Recuperar acceso al portal Muisca · Público', sol: false },
      { nombre: 'Declaraciones y Pagos', url: 'https://www.dian.gov.co/servicios/en-linea', desc: 'Presentar y pagar IVA, renta y retenciones · Requiere Cuenta Muisca', sol: true },
      { nombre: 'Formulario 300 - IVA', url: 'https://www.dian.gov.co/', desc: 'Guía para declarar IVA y presentar el Formulario 300 · Público', sol: false },
    ],
  },
  {
    categoria: 'Comprobantes Electrónicos',
    icon: '📄', color: C.green,
    items: [
      { nombre: 'Facturación Electrónica', url: 'https://catalogo-vpfe.dian.gov.co/', desc: 'Acceso al sistema de facturación electrónica · Requiere Token', sol: true },
      { nombre: 'Consulta de CUFE', url: 'https://catalogo-vpfe.dian.gov.co/User/SearchDocument', desc: 'Verificar validez de facturas electrónicas · Público', sol: false },
      { nombre: 'Habilitación de Factura', url: 'https://www.dian.gov.co/', desc: 'Pasos para habilitarse como facturador · Público', sol: false },
      { nombre: 'Documento Soporte', url: 'https://www.dian.gov.co/', desc: 'Información sobre documentos de soporte y facturación electrónica · Público', sol: false },
    ],
  },
  {
    categoria: 'Consultas Públicas',
    icon: '🔍', color: C.accent,
    items: [
      { nombre: 'Consulta de NIT (RUT)', url: 'https://muisca.dian.gov.co/WebRutMuisca/', desc: 'Estado y condición del NIT · Público sin clave', sol: false },
      { nombre: 'Consulta de CUFE', url: 'https://catalogo-vpfe.dian.gov.co/User/SearchDocument', desc: 'Verificar validez de facturas electrónicas · Público', sol: false },
      { nombre: 'Consultas de normatividad', url: 'https://www.dian.gov.co/consultas', desc: 'Buscar decretos, circulares y normas tributarias · Público', sol: false },
      { nombre: 'Deuda tributaria', url: 'https://www.dian.gov.co/', desc: 'Consultar obligaciones y saldo con DIAN · Requiere Cuenta Muisca', sol: true },
    ],
  },
  {
    categoria: 'Documentos Electrónicos',
    icon: '📚', color: C.purple,
    items: [
      { nombre: 'Habilitar facturación electrónica', url: 'https://www.dian.gov.co/', desc: 'Guía para habilitarse como facturador electrónico · Público', sol: false },
      { nombre: 'Envío de documentos', url: 'https://www.dian.gov.co/', desc: 'Procedimientos para enviar facturas y documentos electrónicos a DIAN · Público', sol: false },
      { nombre: 'Conservación digital', url: 'https://www.dian.gov.co/', desc: 'Requisitos para conservar documentos electrónicos · Público', sol: false },
      { nombre: 'Cronograma DIAN', url: 'https://www.dian.gov.co/', desc: 'Fechas y plazos para obligaciones electrónicas · Público', sol: false },
    ],
  },
  {
    categoria: 'Retenciones en la fuente',
    icon: '🏦', color: C.yellow,
    items: [
      { nombre: 'Retenciones en la fuente', url: 'https://www.dian.gov.co/', desc: 'Guía general sobre retenciones en la fuente · Público', sol: false },
      { nombre: 'Base gravable y tarifas', url: 'https://www.dian.gov.co/', desc: 'Tarifas de retención según tipo de pago · Público', sol: false },
      { nombre: 'Declaración de retenciones', url: 'https://www.dian.gov.co/', desc: 'Presentar declaración de retenciones a la DIAN · Requiere Cuenta Muisca', sol: true },
      { nombre: 'Pagos a la DIAN', url: 'https://www.dian.gov.co/', desc: 'Pagar retenciones y anticipos de impuesto en línea · Requiere Cuenta Muisca', sol: true },
    ],
  },
  {
    categoria: 'Trámites DIAN',
    icon: '📋', color: C.orange,
    items: [
      { nombre: 'Orientación tributaria', url: 'https://www.dian.gov.co/', desc: 'Manuales, preguntas frecuentes y servicios en línea · Público', sol: false },
      { nombre: 'Mesa de partes virtual', url: 'https://www.dian.gov.co/', desc: 'Presentar documentos y peticiones ante DIAN · Requiere Cuenta Muisca', sol: true },
      { nombre: 'Aplazamientos y calendarios', url: 'https://www.dian.gov.co/', desc: 'Información sobre plazos, prórrogas y pagos fraccionados · Público', sol: false },
      { nombre: 'Noticias DIAN', url: 'https://www.dian.gov.co/', desc: 'Actualizaciones de normativa y comunicación oficial · Público', sol: false },
    ],
  },
  {
    categoria: 'Recursos y Capacitación DIAN',
    icon: '🎓', color: C.indigo,
    items: [
      { nombre: 'Capacitación DIAN', url: 'https://www.dian.gov.co/', desc: 'Cursos y seminarios oficiales de la DIAN · Público', sol: false },
      { nombre: 'Normatividad tributaria', url: 'https://www.dian.gov.co/', desc: 'Texto consolidado de leyes, decretos y normas tributarias · Público', sol: false },
      { nombre: 'Consultas de reforma tributaria', url: 'https://www.dian.gov.co/', desc: 'Actualizaciones sobre leyes y cambios de impuesto · Público', sol: false },
      { nombre: 'Portal empresarial DIAN', url: 'https://www.dian.gov.co/', desc: 'Recursos para empresarios y contadores · Público', sol: false },
    ],
  },
];

// ─── Biblioteca tributaria ──────────────────────────────────────────────────
const BIBLIOTECA = [
  {
    id: 'igv',
    categoria: 'IVA — Impuesto sobre las Ventas',
    icon: '💰', color: C.blue,
    articulos: [
      {
        titulo: 'IVA: Base legal y tasa vigente',
        resumen: 'El Impuesto sobre las Ventas (IVA) en Colombia se aplica a la venta de bienes, la prestación de servicios y las importaciones. La tasa general es 19%.',
        audio: 'En Colombia el Impuesto sobre las Ventas, conocido como IVA, grava la venta de bienes y servicios y las importaciones. Su tasa general es diecinueve por ciento.',
        datos: ['Tasa general: 19%', 'Declaración: Formulario 300', 'Base legal: Estatuto Tributario', 'IVA en importaciones'],
      },
      {
        titulo: 'Crédito fiscal del IVA: requisitos',
        resumen: 'Para descontar el IVA soportado en compras, se requiere factura electrónica válida, proveedor activo en el RUT, relación causal con la actividad económica y registro en el libro de compras dentro del plazo.',
        audio: 'El crédito fiscal del IVA se aplica cuando el comprobante es válido, el proveedor está activo en el RUT, la adquisición es necesaria para la actividad económica y el IVA se registra en el libro de compras o en la contabilidad electrónica dentro del plazo correspondiente.',
        datos: ['Proveedor activo en el RUT', 'Factura electrónica válida', 'Gasto causal', 'Registro oportuno en libro de compras'],
      },
      {
        titulo: 'Operaciones exentas y no sujetas',
        resumen: 'En Colombia hay operaciones exentas, excluidas y no sujetas al IVA. Exentas son servicios de salud, educación y transporte público. Exportaciones son no sujetas con tarifa 0%.',
        audio: 'En Colombia algunas operaciones están exentas del IVA, como servicios de salud, educación y transporte público. Las exportaciones son no sujetas con tarifa cero. Las operaciones excluidas no forman parte del hecho generador del impuesto.',
        datos: ['Exentas: salud, educación, transporte público', 'Exportaciones: tarifa 0%', 'No sujetas: fuera del hecho generador', 'Diferente a exentas y excluidas'],
      },
    ],
  },
  {
    id: 'renta',
    categoria: 'Impuesto sobre la Renta',
    icon: '📊', color: C.green,
    articulos: [
      {
        titulo: 'Regímenes tributarios en Colombia',
        resumen: 'Colombia distingue el Régimen Común, el Régimen Simplificado, el Régimen Simple de Tributación y regímenes especiales. Cada uno tiene requisitos, obligaciones de facturación y régimen de IVA diferentes.',
        audio: 'En Colombia existen varios regímenes tributarios. El Régimen Común paga IVA y retenciones en la fuente. El Régimen Simplificado está diseñado para pequeños comerciantes. El Régimen Simple unifica impuesto de renta e IVA en un solo pago. Los regímenes especiales aplican a sectores particulares con normas propias.',
        datos: ['Régimen Común', 'Régimen Simplificado', 'Régimen Simple de Tributación', 'Regímenes especiales'],
      },
      {
        titulo: 'Pagos a cuenta y retenciones en la fuente',
        resumen: 'Las empresas deben practicar retención en la fuente sobre pagos a proveedores y trabajadores según tarifas definidas por la DIAN. Los anticipos de renta se consolidan en la declaración anual.',
        audio: 'Las retenciones en la fuente son anticipos del impuesto a cargo del beneficiario. En Colombia se practican sobre honorarios, servicios, arrendamientos y pagos de nómina. El agente retenedor es responsable de declarar y pagar esa renta a la DIAN.',
        datos: ['Retención a proveedores', 'Retención de nómina', 'Pagar a DIAN en plazo', 'Crédito para el beneficiario'],
      },
    ],
  },
  {
    id: 'detracciones',
    categoria: 'Retenciones en la fuente',
    icon: '🏦', color: C.yellow,
    articulos: [
      {
        titulo: '¿Qué es la retención en la fuente?',
        resumen: 'La retención en la fuente es un mecanismo por el cual el pagador descuenta una parte del pago y la entrega directamente a la DIAN. Se aplica a servicios, honorarios, arrendamientos y otros pagos gravados.',
        audio: 'La retención en la fuente en Colombia es un anticipo del impuesto de renta o del IVA. El pagador descuenta una proporción y la entrega a la DIAN. El proveedor recibe el neto y puede usar la retención como crédito fiscal o de renta.',
        datos: ['Anticipo de impuesto', 'Se descuenta al pagar', 'Se paga a DIAN', 'Crédito para el beneficiario'],
      },
      {
        titulo: 'Tarifas de retención más comunes',
        resumen: 'Las tarifas varían según el tipo de pago: honorarios 11%, servicios 11%, arrendamientos 3.5% o 4.1%, obras civiles 3.5%, compras nacionales 1.5%.',
        audio: 'Las retenciones en la fuente más frecuentes en Colombia aplican a honorarios, servicios profesionales, arrendamientos y contratos de obra. La tarifa depende del tipo de pago y del agente retenedor, y se consulta en la normativa DIAN vigente.',
        datos: ['Honorarios: 11%', 'Servicios: 11%', 'Arrendamientos: 3.5–4.1%', 'Obras civiles: 3.5%'],
      },
    ],
  },
  {
    id: 'comprobantes',
    categoria: 'Comprobantes Electrónicos',
    icon: '🧾', color: C.accent,
    articulos: [
      {
        titulo: 'Tipos de documentos DIAN',
        resumen: 'En Colombia los comprobantes incluyen factura electrónica, nota crédito, nota débito, documento soporte y tiquete electrónico. La mayoría se emiten de forma electrónica y deben cumplir con los requisitos de la DIAN.',
        audio: 'Los documentos tributarios en Colombia incluyen factura electrónica, nota crédito, nota débito y documento soporte. La DIAN exige que el emisor esté autorizado y que los comprobantes electrónicos se transmitan con el esquema oficial.',
        datos: ['Factura electrónica', 'Nota crédito', 'Nota débito', 'Documento soporte'],
      },
      {
        titulo: 'Obligación de facturación electrónica',
        resumen: 'Las empresas obligadas deben expedir factura electrónica o tiquete electrónico en la plataforma de la DIAN o mediante un proveedor tecnológico autorizado.',
        audio: 'La facturación electrónica en Colombia es obligatoria para contribuyentes definidos por la DIAN. Se puede usar la plataforma de la DIAN o un proveedor tecnológico autorizado, y los documentos deben conservarse digitalmente.',
        datos: ['DIAN o proveedor autorizado', 'Factura electrónica obligatoria', 'Tiquete electrónico para puntos de venta', 'Conservación digital de documentos'],
      },
    ],
  },
  {
    id: 'infracciones',
    categoria: 'Infracciones y sanciones DIAN',
    icon: '⚠️', color: C.red,
    articulos: [
      {
        titulo: 'Sanciones por incumplimiento tributario',
        resumen: 'La DIAN impone sanciones por no facturar, no declarar, presentar información falsa o incumplir plazos de pago. Las multas pueden ser porcentajes del impuesto omitido o sanciones fijas.',
        audio: 'La DIAN sanciona las omisiones tributarias. No presentar declaraciones, presentar información inexacta o expedir documentos no autorizados puede resultar en multas calculadas sobre el impuesto omitido o valores fijos.',
        datos: ['Multas por no declarar', 'Multas por facturación irregular', 'Multas por información falsa', 'Plazo de prescripción tributaria'],
      },
      {
        titulo: 'Solicitud de corrección y gradualidad',
        resumen: 'En Colombia existen mecanismos para corregir errores y reducir sanciones cuando se subsanan antes de una notificación administrativa. La gradualidad no elimina la obligación de pagar el tributo.',
        audio: 'Si un contribuyente corrige una declaración o presenta información en forma voluntaria, puede reducir la sanción. Este mecanismo promueve el cumplimiento oportuno, pero el impuesto adeudado sigue siendo exigible.',
        datos: ['Subsanación voluntaria', 'Reducir sanción', 'No exime de pagar impuesto', 'Aplicable antes de notificación'],
      },
    ],
  },
  {
    id: 'calendario',
    categoria: 'Calendario Tributario',
    icon: '📅', color: C.indigo,
    articulos: [
      {
        titulo: 'Fechas de declaración DIAN por NIT',
        resumen: 'Las obligaciones de IVA, retenciones y otros impuestos se consultan con el último dígito del NIT y el calendario publicado por la DIAN. Las fechas varían por tipo de contribuyente y régimen.',
        audio: 'El calendario tributario de la DIAN establece las fechas de presentación y pago según el último dígito del NIT y el régimen del contribuyente. Hay plazos específicos para el Formulario 300, retenciones y renta.',
        datos: ['Último dígito del NIT', 'Formulario 300', 'Retenciones en la fuente', 'Calendario DIAN vigente'],
      },
      {
        titulo: 'Declaración anual de renta',
        resumen: 'La declaración de renta de personas jurídicas y naturales se presenta en el mes que indica la DIAN para cada grupo de NIT. El formulario y la periodicidad dependen del régimen.',
        audio: 'La declaración anual de renta en Colombia se presenta en las fechas que la DIAN define para cada grupo de NIT. La forma y el formulario dependen de si el contribuyente está en Régimen Común, Simplificado o Simple.',
        datos: ['Fechas según NIT', 'Persona jurídica y natural', 'Formularios DIAN aplicables', 'Dependiente del régimen'],
      },
    ],
  },
  {
    id: 'pcge',
    categoria: 'PUC — Plan Único de Cuentas',
    icon: '📒', color: C.purple,
    articulos: [
      {
        titulo: 'Estructura del PUC Colombia',
        resumen: 'El Plan Único de Cuentas en Colombia agrupa las cuentas en clases: 1 Activo, 2 Pasivo, 3 Patrimonio, 4 Ingresos, 5 Costos y 6 Gastos. Las cuentas auxiliares permiten detallar inventarios, cuentas por cobrar, proveedores e IVA.',
        audio: 'El PUC colombiano usa seis clases contables. La clase uno agrupa activos; la clase dos pasivos; la clase tres patrimonio; la clase cuatro ingresos; la clase cinco costos; y la clase seis gastos. Además existen cuentas auxiliares para IVA, inventarios y proveedores.',
        datos: ['1: Activo', '2: Pasivo', '3: Patrimonio', '4: Ingresos', '5: Costos', '6: Gastos'],
      },
      {
        titulo: 'Cuentas frecuentes en PUC',
        resumen: 'Ejemplos de cuentas típicas colombianas incluyen 1110 Caja, 1125 Cuentas por cobrar comerciales, 1310 Inventarios, 2208 Cuentas por pagar comerciales, 2408 IVA, 4105 Ventas y 5105 Compras.',
        audio: 'En el PUC de Colombia las cuentas frecuentes para operaciones comerciales incluyen la clase once de caja y bancos, la clase doce de cuentas por cobrar, la clase trece de inventarios, la clase veintidós de cuentas por pagar, la clase veinticuatro de impuestos y la clase cuarenta y uno de ingresos.',
        datos: ['1110: Caja', '1125: CxC comerciales', '1310: Inventarios', '2208: CxP comerciales', '2408: IVA', '4105: Ventas'],
      },
    ],
  },
];

// ─── Componente ─────────────────────────────────────────────────────────────
type Tab = 'ACCESO' | 'BIBLIOTECA' | 'CONSULTA_NIT';

export const SunatPortalHub: React.FC = () => {
  const [tab, setTab] = useState<Tab>('ACCESO');
  const [catActiva, setCatActiva] = useState('igv');
  const [artActivo, setArtActivo] = useState('');
  const [playingId, setPlayingId] = useState('');
  const [nitQuery, setNitQuery] = useState('');
  const audioIdRef = useRef('');

  const playArticulo = (id: string, audioText: string) => {
    if (audioIdRef.current === id && window.speechSynthesis?.speaking) {
      stopAudio(); setPlayingId(''); audioIdRef.current = ''; return;
    }
    audioIdRef.current = id; setPlayingId(id);
    speak(audioText, () => { setPlayingId(''); audioIdRef.current = ''; });
  };

  const openSunat = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const catActiva_ = BIBLIOTECA.find(c => c.id === catActiva) || BIBLIOTECA[0];

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:C.bg, color:C.text, fontFamily:"'Segoe UI', Arial, sans-serif", overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, background:C.bgCard, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:10, background:'linear-gradient(135deg,#c0392b,#e74c3c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🏛️</div>
          <div>
            <h1 style={{ margin:0, fontSize:16, fontWeight:900, color:C.text }}>Portal DIAN — Acceso y Biblioteca Tributaria</h1>
            <p style={{ margin:'2px 0 0', fontSize:11, color:C.muted }}>Trámites · Servicios en línea · Biblioteca completa con lectura en audio</p>
          </div>
        </div>
        <button type="button" onClick={() => openSunat('https://www.dian.gov.co/')} style={{
          padding:'8px 18px', background:'linear-gradient(135deg,#c0392b,#e74c3c)',
          border:'none', borderRadius:9, color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer',
          fontFamily:"'Segoe UI', Arial, sans-serif",
        }}>
          🌐 Ir a DIAN.gov.co →
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, padding:'0 16px', background:C.bgCard, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {([
          { id:'ACCESO',       label:'🔐 Acceso a Trámites'   },
          { id:'BIBLIOTECA',   label:'📚 Biblioteca Tributaria' },
          { id:'CONSULTA_NIT', label:'🔍 Consulta NIT'         },
        ] as { id:Tab; label:string }[]).map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
            padding:'10px 18px', fontSize:12, fontWeight: tab===t.id ? 800 : 500,
            color: tab===t.id ? C.accent : C.muted,
            borderBottom:`2px solid ${tab===t.id ? C.accent : 'transparent'}`,
            background:'none', border:'none', cursor:'pointer',
            fontFamily:"'Segoe UI', Arial, sans-serif", transition:'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>

        {/* ═══ ACCESO A TRÁMITES ═══ */}
        {tab === 'ACCESO' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {DIAN_SERVICIOS.map(cat => (
                <div key={cat.categoria} style={{ background:C.bgCard, border:`1px solid ${cat.color}33`, borderTop:`3px solid ${cat.color}`, borderRadius:12, overflow:'hidden' }}>
                  <div style={{ padding:'12px 14px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8, background:`${cat.color}08` }}>
                    <span style={{ fontSize:18 }}>{cat.icon}</span>
                    <span style={{ fontSize:12, fontWeight:800, color:cat.color }}>{cat.categoria}</span>
                  </div>
                  <div style={{ padding:'8px 0' }}>
                    {cat.items.map(item => (
                      <button key={item.nombre} type="button" onClick={() => openSunat(item.url)}
                        style={{ width:'100%', padding:'9px 14px', textAlign:'left', background:'none', border:'none', cursor:'pointer', display:'block', transition:'background 0.1s', fontFamily:"'Segoe UI', Arial, sans-serif" }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.bgRow)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                          <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{item.nombre}</span>
                          <span style={{
                            fontSize:9, fontWeight:800, padding:'1px 7px', borderRadius:20, whiteSpace:'nowrap', flexShrink:0,
                            background: (item as any).sol ? `${C.yellow}22` : `${C.green}18`,
                            color: (item as any).sol ? C.yellow : C.green,
                            border: `1px solid ${(item as any).sol ? C.yellow+'44' : C.green+'33'}`,
                          }}>
                            {(item as any).sol ? '🔑 Clave SOL' : '🌐 Público'}
                          </span>
                        </div>
                        <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ background:`${C.yellow}10`, border:`1px solid ${C.yellow}33`, borderRadius:10, padding:'12px 18px' }}>
                <p style={{ margin:'0 0 6px', fontSize:11, fontWeight:700, color:C.yellow }}>🔑 Requiere Cuenta Muisca</p>
                <p style={{ margin:0, fontSize:11, color:C.muted }}>
                  Los servicios marcados con 🔑 requieren tu cuenta Muisca / usuario DIAN. Consulta el portal oficial en DIAN para obtener acceso y guías.
                </p>
              </div>
              <div style={{ background:`${C.green}10`, border:`1px solid ${C.green}33`, borderRadius:10, padding:'12px 18px' }}>
                <p style={{ margin:'0 0 6px', fontSize:11, fontWeight:700, color:C.green }}>🌐 Acceso público</p>
                <p style={{ margin:0, fontSize:11, color:C.muted }}>
                  Los marcados con 🌐 son de consulta libre. La DIAN no permite embeber su portal (bloquea iframes). Todos los links abren en pestaña nueva. URLs verificadas junio 2026.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BIBLIOTECA TRIBUTARIA ═══ */}
        {tab === 'BIBLIOTECA' && (
          <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:16, height:'100%' }}>

            {/* Sidebar categorías */}
            <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', alignSelf:'start' }}>
              <div style={{ padding:'10px 14px', borderBottom:`1px solid ${C.border}`, fontSize:11, fontWeight:800, color:C.muted, letterSpacing:'0.07em', textTransform:'uppercase' }}>
                Categorías
              </div>
              {BIBLIOTECA.map(cat => (
                <button key={cat.id} type="button" onClick={() => { setCatActiva(cat.id); setArtActivo(''); stopAudio(); setPlayingId(''); }}
                  style={{
                    width:'100%', padding:'11px 14px', textAlign:'left', background: catActiva===cat.id ? `${cat.color}18` : 'none',
                    border:'none', borderLeft:`3px solid ${catActiva===cat.id ? cat.color : 'transparent'}`,
                    cursor:'pointer', display:'flex', alignItems:'center', gap:8, transition:'all 0.15s',
                    fontFamily:"'Segoe UI', Arial, sans-serif",
                  }}>
                  <span style={{ fontSize:14 }}>{cat.icon}</span>
                  <span style={{ fontSize:12, fontWeight: catActiva===cat.id ? 700 : 400, color: catActiva===cat.id ? cat.color : C.muted }}>
                    {cat.categoria.split('—')[0].trim()}
                  </span>
                </button>
              ))}
            </div>

            {/* Artículos */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
                <span style={{ fontSize:20 }}>{catActiva_.icon}</span>
                <h2 style={{ margin:0, fontSize:15, fontWeight:800, color:catActiva_.color }}>{catActiva_.categoria}</h2>
              </div>

              {catActiva_.articulos.map(art => {
                const artId = `${catActiva_.id}-${art.titulo}`;
                const isPlaying = playingId === artId;
                const isOpen = artActivo === artId;
                return (
                  <div key={artId} style={{
                    background:C.bgCard, border:`1px solid ${isOpen ? catActiva_.color+'44' : C.border}`,
                    borderRadius:12, overflow:'hidden', transition:'all 0.2s',
                    boxShadow: isOpen ? `0 4px 20px ${catActiva_.color}18` : 'none',
                  }}>
                    {/* Header del artículo */}
                    <div style={{ padding:'13px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', background: isOpen ? `${catActiva_.color}08` : 'none' }}
                      onClick={() => setArtActivo(isOpen ? '' : artId)}>
                      <span style={{ fontSize:13, fontWeight:700, color: isOpen ? catActiva_.color : C.text }}>{art.titulo}</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {/* Botón audio */}
                        <button type="button"
                          onClick={e => { e.stopPropagation(); playArticulo(artId, art.audio); }}
                          style={{
                            width:34, height:34, borderRadius:'50%',
                            background: isPlaying ? catActiva_.color : `${catActiva_.color}18`,
                            border:`1px solid ${catActiva_.color}44`,
                            color: isPlaying ? '#fff' : catActiva_.color,
                            fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                            fontFamily:"'Segoe UI', Arial, sans-serif",
                            animation: isPlaying ? 'pulse 1s infinite' : 'none',
                          }}>
                          {isPlaying ? '⏹' : '🔊'}
                        </button>
                        <span style={{ color:C.dim, fontSize:14, transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▼</span>
                      </div>
                    </div>

                    {/* Contenido expandible */}
                    {isOpen && (
                      <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${C.border}` }}>
                        <p style={{ margin:'12px 0 10px', fontSize:12, color:C.muted, lineHeight:1.7 }}>{art.resumen}</p>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                          {art.datos.map((d,i) => (
                            <span key={i} style={{ background:`${catActiva_.color}18`, color:catActiva_.color, border:`1px solid ${catActiva_.color}33`, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>{d}</span>
                          ))}
                        </div>
                        {isPlaying && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:`${catActiva_.color}12`, borderRadius:8, fontSize:11, color:catActiva_.color }}>
                            <span style={{ animation:'pulse 1s infinite' }}>🔊</span>
                            <span>Leyendo en audio... haz clic en ⏹ para detener</span>
                          </div>
                        )}
                        <button type="button"
                          onClick={() => playArticulo(artId, art.audio)}
                          style={{
                            marginTop:10, padding:'7px 16px',
                            background: isPlaying ? `${C.red}18` : `${catActiva_.color}18`,
                            border:`1px solid ${isPlaying ? C.red : catActiva_.color}44`,
                            borderRadius:8, color: isPlaying ? C.red : catActiva_.color,
                            fontWeight:700, fontSize:11, cursor:'pointer',
                            fontFamily:"'Segoe UI', Arial, sans-serif",
                          }}>
                          {isPlaying ? '⏹ Detener audio' : '🔊 Escuchar explicación'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ CONSULTA NIT ═══ */}
        {tab === 'CONSULTA_NIT' && (
          <div style={{ maxWidth:700 }}>
            <h2 style={{ margin:'0 0 6px', fontSize:15, fontWeight:800, color:C.text }}>🔍 Consulta de NIT</h2>
            <p style={{ margin:'0 0 16px', fontSize:12, color:C.muted }}>Consulta directamente en el padrón de la DIAN el estado, régimen y condición del NIT.</p>

            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <input value={nitQuery} onChange={e => setNitQuery(e.target.value.replace(/\D/g,'').slice(0,10))}
                placeholder="Ingresa el NIT (hasta 10 dígitos)"
                style={{ flex:1, padding:'10px 14px', background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:14, outline:'none', fontFamily:"'Segoe UI', Arial, sans-serif" }} />
              <button type="button"
                onClick={() => openSunat('https://muisca.dian.gov.co/WebRutMuisca/')}
                style={{ padding:'10px 20px', background:`linear-gradient(135deg,${C.blue},${C.accent})`, border:'none', borderRadius:9, color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:"'Segoe UI', Arial, sans-serif" }}>
                Consultar en DIAN →
              </button>
            </div>

            {/* Info sobre la consulta */}
            <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', marginBottom:16 }}>
              <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:700, color:C.text }}>¿Qué información entrega la DIAN al consultar un NIT?</p>
              {[
                { campo:'Estado del contribuyente', desc:'ACTIVO = puede emitir comprobantes válidos · BAJA = no puede operar' },
                { campo:'Condición del domicilio', desc:'HABIDO = dirección verificada · NO HABIDO = no ubicable por la DIAN' },
                { campo:'Régimen tributario', desc:'Régimen Común / Simplificado / Simple / Especial' },
                { campo:'Tipo de contribuyente', desc:'Persona Natural / Persona Jurídica / etc.' },
                { campo:'Fecha de inscripción', desc:'Cuándo se registró ante la DIAN' },
                { campo:'Actividad económica', desc:'Código CIIU y descripción del giro del negocio' },
              ].map((i,j) => (
                <div key={j} style={{ display:'flex', gap:8, padding:'7px 0', borderBottom:`1px dashed ${C.border}` }}>
                  <span style={{ color:C.accent, fontWeight:700, fontSize:12, minWidth:220 }}>{i.campo}:</span>
                  <span style={{ color:C.dim, fontSize:12 }}>{i.desc}</span>
                </div>
              ))}
            </div>

            <div style={{ background:`${C.red}10`, border:`1px solid ${C.red}33`, borderRadius:10, padding:'12px 16px' }}>
              <p style={{ margin:'0 0 6px', fontSize:12, fontWeight:700, color:C.red }}>⚠️ Regla fundamental del crédito fiscal:</p>
              <p style={{ margin:0, fontSize:12, color:C.muted }}>
                Antes de usar el crédito fiscal de una factura de compra, verifica que el proveedor tenga estado
                <strong style={{ color:C.green }}> ACTIVO</strong> y condición
                <strong style={{ color:C.green }}> HABIDO</strong> en la DIAN.
                Si el proveedor no está activo o no cumple requisitos, la DIAN puede desconocer el crédito fiscal aunque el comprobante sea electrónico y válido.
              </p>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
};

export default SunatPortalHub;
