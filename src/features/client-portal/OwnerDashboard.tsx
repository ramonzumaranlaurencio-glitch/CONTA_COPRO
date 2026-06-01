/**
 * OwnerDashboard — Panel exclusivo del dueño CONTA_PRO
 * Visible solo con plan CONTA_PRO (superadmin)
 * Secciones: KPIs · Pagos Yape/Plin · Clientes · Códigos únicos · Consumo IA · Alertas
 */
import React, { useMemo, useState } from 'react';

// ─── Paleta ────────────────────────────────────────────────────────────────
const C = {
  bg:      '#020812',
  bgCard:  '#080f1f',
  bgRow:   '#0b1525',
  bgHover: '#0f1e35',
  border:  '#1a3050',
  text:    '#e2eaf8',
  muted:   '#6e93b8',
  dim:     '#3d6080',
  accent:  '#38bdf8',
  blue:    '#0078d4',
  green:   '#22c55e',
  yellow:  '#f59e0b',
  red:     '#ef4444',
  purple:  '#a855f7',
  orange:  '#f97316',
  pink:    '#ec4899',
};

// ─── Tipos ─────────────────────────────────────────────────────────────────
type PaymentStatus = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
type ClientStatus  = 'ACTIVO' | 'SUSPENDIDO' | 'VENCIDO' | 'TRIAL';
type CodeStatus    = 'ACTIVO' | 'USADO' | 'BLOQUEADO' | 'EXPIRADO';

interface PendingPayment {
  id: string;
  fecha: string;
  cliente: string;
  ruc: string;
  plan: string;
  monto: number;
  metodo: 'YAPE' | 'PLIN' | 'TRANSFERENCIA';
  referencia: string;
  telefono: string;
  status: PaymentStatus;
  captura?: string;
}

interface Client {
  id: string;
  tipo: 'CONTADOR' | 'EMPRESA';
  nombre: string;
  ruc: string;
  email: string;
  plan: string;
  status: ClientStatus;
  fechaRegistro: string;
  ultimoAcceso: string;
  vencimiento: string;
  docsIA: number;
  limiteIA: number;
  codigoAcceso: string;
  ips: string[];
  negocios: number;
}

interface AccessCode {
  codigo: string;
  cliente: string;
  plan: string;
  fechaGen: string;
  fechaUso: string;
  status: CodeStatus;
  ips: string[];
  intentosDuplicado: number;
}

interface Alert {
  id: string;
  tipo: 'PAGO' | 'VENCIMIENTO' | 'SEGURIDAD' | 'INACTIVIDAD' | 'LIMITE';
  nivel: 'ALTO' | 'MEDIO' | 'INFO';
  mensaje: string;
  cliente: string;
  fecha: string;
}

// ─── Datos demo ────────────────────────────────────────────────────────────
const DEMO_PAGOS: PendingPayment[] = [
  { id: 'P001', fecha: '2026-06-01', cliente: 'Ferretería El Maestro EIRL', ruc: '20601234567', plan: 'Plus Empresa', monto: 149, metodo: 'YAPE', referencia: 'YP-2026060112345', telefono: '987654321', status: 'PENDIENTE' },
  { id: 'P002', fecha: '2026-06-01', cliente: 'CPC Juan Pérez García', ruc: '10453219876', plan: 'Pro Contador', monto: 99, metodo: 'PLIN', referencia: 'PL-2026060198765', telefono: '956123456', status: 'PENDIENTE' },
  { id: 'P003', fecha: '2026-05-31', cliente: 'Construcciones Norte SAC', ruc: '20509876543', plan: 'Pro Empresa', monto: 249, metodo: 'TRANSFERENCIA', referencia: 'BCP-00123456', telefono: '912345678', status: 'PENDIENTE' },
  { id: 'P004', fecha: '2026-05-30', cliente: 'Minería Los Andes EIRL', ruc: '20455667788', plan: 'Maestro Empresa', monto: 890, metodo: 'YAPE', referencia: 'YP-2026053000011', telefono: '943216789', status: 'APROBADO' },
  { id: 'P005', fecha: '2026-05-29', cliente: 'CPC María Torres', ruc: '10123456789', plan: 'Plus Contador', monto: 69, metodo: 'PLIN', referencia: 'PL-INVALIDO', telefono: '978001234', status: 'RECHAZADO' },
];

const DEMO_CLIENTES: Client[] = [
  { id: 'C001', tipo: 'EMPRESA', nombre: 'Ferretería El Maestro EIRL', ruc: '20601234567', email: 'admin@ferreteria.com', plan: 'PLUS_EMPRESA', status: 'TRIAL', fechaRegistro: '2026-05-15', ultimoAcceso: '2026-06-01', vencimiento: '2026-06-15', docsIA: 12, limiteIA: 100, codigoAcceso: 'CP-2026-A1B2', ips: ['190.232.1.10'], negocios: 1 },
  { id: 'C002', tipo: 'CONTADOR', nombre: 'CPC Juan Pérez García', ruc: '10453219876', email: 'jperez@contador.pe', plan: 'PRO_CONTADOR', status: 'ACTIVO', fechaRegistro: '2026-04-10', ultimoAcceso: '2026-06-01', vencimiento: '2026-07-10', docsIA: 67, limiteIA: 100, codigoAcceso: 'CP-2026-C3D4', ips: ['190.232.5.88', '181.65.2.11'], negocios: 12 },
  { id: 'C003', tipo: 'EMPRESA', nombre: 'Construcciones Norte SAC', ruc: '20509876543', email: 'contabilidad@cnorte.com', plan: 'PRO_EMPRESA', status: 'ACTIVO', fechaRegistro: '2026-03-01', ultimoAcceso: '2026-05-28', vencimiento: '2026-06-01', docsIA: 198, limiteIA: 200, codigoAcceso: 'CP-2026-E5F6', ips: ['181.65.8.44'], negocios: 1 },
  { id: 'C004', tipo: 'EMPRESA', nombre: 'Minería Los Andes EIRL', ruc: '20455667788', email: 'erp@andes.pe', plan: 'MAESTRO_EMPRESA', status: 'ACTIVO', fechaRegistro: '2026-01-15', ultimoAcceso: '2026-06-01', vencimiento: '2027-01-15', docsIA: 0, limiteIA: 0, codigoAcceso: 'CP-2026-G7H8', ips: ['200.60.3.22'], negocios: 1 },
  { id: 'C005', tipo: 'CONTADOR', nombre: 'CPC María Torres Quispe', ruc: '10123456789', email: 'mtorres@mcontable.pe', plan: 'PLUS_CONTADOR', status: 'VENCIDO', fechaRegistro: '2026-02-20', ultimoAcceso: '2026-05-20', vencimiento: '2026-05-20', docsIA: 45, limiteIA: 50, codigoAcceso: 'CP-2026-I9J0', ips: ['190.232.9.5'], negocios: 8 },
  { id: 'C006', tipo: 'EMPRESA', nombre: 'Distribuidora Sur SAC', ruc: '20312456789', email: 'admin@dissur.com', plan: 'PLUS_EMPRESA', status: 'SUSPENDIDO', fechaRegistro: '2026-04-01', ultimoAcceso: '2026-04-15', vencimiento: '2026-05-01', docsIA: 3, limiteIA: 100, codigoAcceso: 'CP-2026-K1L2', ips: ['181.65.4.33'], negocios: 1 },
];

const DEMO_CODIGOS: AccessCode[] = [
  { codigo: 'CP-2026-A1B2', cliente: 'Ferretería El Maestro EIRL', plan: 'PLUS_EMPRESA', fechaGen: '2026-05-15', fechaUso: '2026-05-15', status: 'ACTIVO', ips: ['190.232.1.10'], intentosDuplicado: 0 },
  { codigo: 'CP-2026-C3D4', cliente: 'CPC Juan Pérez García', plan: 'PRO_CONTADOR', fechaGen: '2026-04-10', fechaUso: '2026-04-10', status: 'ACTIVO', ips: ['190.232.5.88', '181.65.2.11'], intentosDuplicado: 0 },
  { codigo: 'CP-2026-E5F6', cliente: 'Construcciones Norte SAC', plan: 'PRO_EMPRESA', fechaGen: '2026-03-01', fechaUso: '2026-03-01', status: 'ACTIVO', ips: ['181.65.8.44'], intentosDuplicado: 0 },
  { codigo: 'CP-2026-G7H8', cliente: 'Minería Los Andes EIRL', plan: 'MAESTRO_EMPRESA', fechaGen: '2026-01-15', fechaUso: '2026-01-15', status: 'ACTIVO', ips: ['200.60.3.22'], intentosDuplicado: 0 },
  { codigo: 'CP-2026-I9J0', cliente: 'CPC María Torres Quispe', plan: 'PLUS_CONTADOR', fechaGen: '2026-02-20', fechaUso: '2026-02-20', status: 'EXPIRADO', ips: ['190.232.9.5'], intentosDuplicado: 0 },
  { codigo: 'CP-2026-K1L2', cliente: 'Distribuidora Sur SAC', plan: 'PLUS_EMPRESA', fechaGen: '2026-04-01', fechaUso: '2026-04-01', status: 'BLOQUEADO', ips: ['181.65.4.33', '190.1.2.3', '200.5.6.7'], intentosDuplicado: 2 },
  { codigo: 'CP-2026-M3N4', cliente: 'SIN ASIGNAR', plan: 'PLUS_EMPRESA', fechaGen: '2026-06-01', fechaUso: '—', status: 'USADO', ips: [], intentosDuplicado: 0 },
];

const DEMO_ALERTAS: Alert[] = [
  { id: 'A001', tipo: 'SEGURIDAD', nivel: 'ALTO', mensaje: 'Código CP-2026-K1L2 usado desde 3 IPs distintas', cliente: 'Distribuidora Sur SAC', fecha: '2026-06-01' },
  { id: 'A002', tipo: 'VENCIMIENTO', nivel: 'ALTO', mensaje: 'Plan vence HOY — pendiente renovación', cliente: 'Construcciones Norte SAC', fecha: '2026-06-01' },
  { id: 'A003', tipo: 'LIMITE', nivel: 'MEDIO', mensaje: 'Consumió 198/200 documentos IA este mes', cliente: 'Construcciones Norte SAC', fecha: '2026-06-01' },
  { id: 'A004', tipo: 'PAGO', nivel: 'MEDIO', mensaje: '3 pagos pendientes de validar', cliente: 'Sistema', fecha: '2026-06-01' },
  { id: 'A005', tipo: 'VENCIMIENTO', nivel: 'INFO', mensaje: 'Plan vence en 14 días', cliente: 'Ferretería El Maestro EIRL', fecha: '2026-06-01' },
  { id: 'A006', tipo: 'INACTIVIDAD', nivel: 'INFO', mensaje: 'Sin actividad por 45 días', cliente: 'Distribuidora Sur SAC', fecha: '2026-06-01' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString('es-PE');

const planColor = (plan: string): string => {
  if (plan.includes('MAESTRO')) return C.purple;
  if (plan.includes('PRO')) return C.blue;
  if (plan.includes('PLUS')) return C.accent;
  if (plan.includes('BASICO') || plan.includes('TRIAL')) return C.green;
  return C.muted;
};

const statusColor = (s: ClientStatus | PaymentStatus | CodeStatus): string => {
  if (s === 'ACTIVO' || s === 'APROBADO') return C.green;
  if (s === 'TRIAL') return C.accent;
  if (s === 'PENDIENTE' || s === 'USADO') return C.yellow;
  if (s === 'VENCIDO' || s === 'EXPIRADO' || s === 'RECHAZADO') return C.red;
  if (s === 'SUSPENDIDO' || s === 'BLOQUEADO') return C.orange;
  return C.muted;
};

const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{
    background: `${color}22`, color, border: `1px solid ${color}44`,
    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800,
    whiteSpace: 'nowrap', letterSpacing: '0.05em',
  }}>{label}</span>
);

const metodoBadge = (m: 'YAPE' | 'PLIN' | 'TRANSFERENCIA') => {
  const map = { YAPE: '#7c3aed', PLIN: '#0ea5e9', TRANSFERENCIA: C.muted };
  return <Badge label={m} color={map[m]} />;
};

const KpiCard = ({ icon, label, value, sub, color, alert }: { icon: string; label: string; value: string; sub: string; color: string; alert?: boolean }) => (
  <div style={{
    background: C.bgCard, border: `1px solid ${alert ? color : C.border}`,
    borderTop: `3px solid ${color}`, borderRadius: 12,
    padding: '16px 18px', position: 'relative', overflow: 'hidden',
    boxShadow: alert ? `0 0 20px ${color}22` : 'none',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'Consolas, monospace' }}>{value}</span>
    </div>
    <p style={{ margin: 0, fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
    <p style={{ margin: '3px 0 0', fontSize: 11, color }}>{sub}</p>
    <div style={{ position: 'absolute', right: 10, bottom: 6, fontSize: 28, opacity: 0.06 }}>{icon}</div>
  </div>
);

// ─── Generador de código único ─────────────────────────────────────────────
const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `CP-${new Date().getFullYear()}-${seg()}`;
};

// ─── Componente principal ───────────────────────────────────────────────────
type Tab = 'INICIO' | 'PAGOS' | 'CLIENTES' | 'CODIGOS' | 'CONSUMO' | 'ALERTAS' | 'PLANES' | 'CONFIG';

export const OwnerDashboard = () => {
  const [tab, setTab] = useState<Tab>('INICIO');
  const [pagos, setPagos] = useState<PendingPayment[]>(DEMO_PAGOS);
  const [clientes] = useState<Client[]>(DEMO_CLIENTES);
  const [codigos] = useState<AccessCode[]>(DEMO_CODIGOS);
  const [alertas] = useState<Alert[]>(DEMO_ALERTAS);
  const [clienteFilter, setClienteFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [newCode, setNewCode] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const aprobarPago = (id: string) => setPagos(p => p.map(x => x.id === id ? { ...x, status: 'APROBADO' } : x));
  const rechazarPago = (id: string) => setPagos(p => p.map(x => x.id === id ? { ...x, status: 'RECHAZADO' } : x));

  const kpis = useMemo(() => ({
    totalClientes: clientes.length,
    activos:       clientes.filter(c => c.status === 'ACTIVO').length,
    trials:        clientes.filter(c => c.status === 'TRIAL').length,
    vencidos:      clientes.filter(c => c.status === 'VENCIDO' || c.status === 'SUSPENDIDO').length,
    ingresosMes:   pagos.filter(p => p.status === 'APROBADO').reduce((s, p) => s + p.monto, 0),
    pendientes:    pagos.filter(p => p.status === 'PENDIENTE').length,
    totalDocsIA:   clientes.reduce((s, c) => s + c.docsIA, 0),
    alertasAlto:   alertas.filter(a => a.nivel === 'ALTO').length,
    codigosUsados: codigos.filter(c => c.status === 'ACTIVO' || c.status === 'USADO').length,
    codBloqueados: codigos.filter(c => c.status === 'BLOQUEADO').length,
  }), [clientes, pagos, alertas, codigos]);

  const clientesFiltrados = useMemo(() =>
    clientes.filter(c =>
      (clienteFilter === '' || c.nombre.toLowerCase().includes(clienteFilter.toLowerCase()) || c.ruc.includes(clienteFilter)) &&
      (planFilter === '' || c.plan.includes(planFilter))
    ), [clientes, clienteFilter, planFilter]);

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'INICIO',   label: 'Inicio',    icon: '🏠' },
    { id: 'PAGOS',    label: 'Pagos',     icon: '💰', badge: kpis.pendientes },
    { id: 'CLIENTES', label: 'Clientes',  icon: '👥' },
    { id: 'CODIGOS',  label: 'Códigos',   icon: '🔑', badge: kpis.codBloqueados },
    { id: 'CONSUMO',  label: 'Consumo IA',icon: '🤖' },
    { id: 'ALERTAS',  label: 'Alertas',   icon: '🚨', badge: kpis.alertasAlto },
    { id: 'PLANES',   label: 'Planes',    icon: '📋' },
    { id: 'CONFIG',   label: 'Config',    icon: '⚙️' },
  ];

  const thStyle: React.CSSProperties = {
    padding: '9px 12px', fontSize: 10, fontWeight: 700, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    borderBottom: `1px solid ${C.border}`, textAlign: 'left', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 12, borderBottom: `1px solid ${C.border}22`, color: C.text,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: "'Segoe UI', Arial, sans-serif", overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>⭐</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.text }}>Panel CONTA_PRO — Dueño del Sistema</h1>
            <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Control total · Clientes · Pagos · Códigos de acceso · Consumo IA</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {kpis.pendientes > 0 && <Badge label={`${kpis.pendientes} pagos pendientes`} color={C.yellow} />}
          {kpis.alertasAlto > 0 && <Badge label={`${kpis.alertasAlto} alertas críticas`} color={C.red} />}
          <span style={{ color: C.dim, fontSize: 11 }}>01 Jun 2026</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 2, padding: '0 16px', background: C.bgCard, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', fontSize: 12, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? C.accent : C.muted,
            borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`,
            background: 'none', border: 'none', borderRadius: '4px 4px 0 0',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: "'Segoe UI', Arial, sans-serif", transition: 'all 0.15s',
          }}>
            <span>{t.icon}</span> {t.label}
            {t.badge ? <span style={{ background: C.red, color: '#fff', borderRadius: 20, fontSize: 9, fontWeight: 800, padding: '1px 6px', marginLeft: 2 }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>

        {/* ═══════════════ INICIO ═══════════════ */}
        {tab === 'INICIO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ── Mi cuenta CONTA_PRO ── */}
            <div style={{
              background: `linear-gradient(135deg, ${C.purple}22 0%, ${C.accent}12 50%, ${C.bgCard} 100%)`,
              border: `1.5px solid ${C.purple}66`,
              borderRadius: 16, padding: '18px 24px',
              boxShadow: `0 0 40px ${C.purple}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.purple}, ${C.accent})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  boxShadow: `0 4px 20px ${C.purple}55`, flexShrink: 0,
                }}>⭐</div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: C.purple, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Mi cuenta</p>
                  <p style={{ margin: '2px 0', fontSize: 18, fontWeight: 900, color: C.text }}>CONTA_PRO — Dueño del Sistema</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>contapro · SuperAdmin · Acceso total sin restricciones</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['♾️ Sin límites', '🤖 IA ilimitada', '🔑 Todos los módulos', '📅 Sin vencimiento', '👥 Todos los clientes'].map((f, i) => (
                  <span key={i} style={{ background: `${C.purple}22`, color: C.purple, border: `1px solid ${C.purple}44`, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{f}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              <KpiCard icon="👥" label="Total clientes" value={String(kpis.totalClientes)} sub={`${kpis.activos} activos · ${kpis.trials} en trial`} color={C.accent} />
              <KpiCard icon="💰" label="Ingresos del mes" value={`S/ ${fmt(kpis.ingresosMes)}`} sub="Pagos aprobados" color={C.green} />
              <KpiCard icon="⏳" label="Pagos pendientes" value={String(kpis.pendientes)} sub="Yape · Plin · Transferencia" color={C.yellow} alert={kpis.pendientes > 0} />
              <KpiCard icon="🤖" label="Docs IA procesados" value={fmtInt(kpis.totalDocsIA)} sub="Este mes · todos los clientes" color={C.purple} />
              <KpiCard icon="🚨" label="Alertas críticas" value={String(kpis.alertasAlto)} sub={`${kpis.codBloqueados} códigos bloqueados`} color={C.red} alert={kpis.alertasAlto > 0} />
            </div>

            {/* Distribución de planes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: C.text }}>📊 Distribución de planes</p>
                {[
                  { plan: 'Maestro Empresa', count: clientes.filter(c => c.plan === 'MAESTRO_EMPRESA').length, color: C.purple },
                  { plan: 'Pro Empresa',     count: clientes.filter(c => c.plan === 'PRO_EMPRESA').length,     color: C.blue   },
                  { plan: 'Plus Empresa',    count: clientes.filter(c => c.plan === 'PLUS_EMPRESA').length,    color: C.accent },
                  { plan: 'Pro Contador',    count: clientes.filter(c => c.plan === 'PRO_CONTADOR').length,    color: C.indigo || C.blue },
                  { plan: 'Plus Contador',   count: clientes.filter(c => c.plan === 'PLUS_CONTADOR').length,   color: C.muted  },
                ].filter(p => p.count > 0).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>{p.plan}</span>
                        <span style={{ fontSize: 11, color: p.color, fontWeight: 700 }}>{p.count}</span>
                      </div>
                      <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(p.count / kpis.totalClientes) * 100}%`, background: p.color, borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: C.text }}>💳 Últimos pagos</p>
                {pagos.slice(0, 4).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px dashed ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{p.cliente.slice(0, 28)}</div>
                      <div style={{ fontSize: 10, color: C.dim }}>{p.fecha} · {metodoBadge(p.metodo)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>S/ {fmt(p.monto)}</div>
                      <Badge label={p.status} color={statusColor(p.status)} />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setTab('PAGOS')} style={{ marginTop: 10, background: 'none', border: 'none', color: C.accent, fontSize: 11, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                  Ver todos los pagos →
                </button>
              </div>
            </div>

            {/* Alertas del sistema */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: C.text }}>🚨 Alertas recientes</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alertas.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.bgRow, borderRadius: 8, borderLeft: `3px solid ${a.nivel === 'ALTO' ? C.red : a.nivel === 'MEDIO' ? C.yellow : C.dim}` }}>
                    <span style={{ fontSize: 14 }}>{a.tipo === 'SEGURIDAD' ? '🔒' : a.tipo === 'VENCIMIENTO' ? '📅' : a.tipo === 'PAGO' ? '💳' : a.tipo === 'LIMITE' ? '📊' : '💤'}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, color: C.text }}>{a.mensaje}</span>
                      <span style={{ fontSize: 10, color: C.dim, marginLeft: 8 }}>· {a.cliente}</span>
                    </div>
                    <Badge label={a.nivel} color={a.nivel === 'ALTO' ? C.red : a.nivel === 'MEDIO' ? C.yellow : C.dim} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ PAGOS ═══════════════ */}
        {tab === 'PAGOS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>💰 Validación de Pagos — Yape · Plin · Transferencia</h2>
              <Badge label={`${pagos.filter(p => p.status === 'PENDIENTE').length} pendientes`} color={C.yellow} />
            </div>

            <div style={{ background: `${C.yellow}10`, border: `1px solid ${C.yellow}33`, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: C.muted }}>
              <strong style={{ color: C.yellow }}>⚠ Regla:</strong> Cada pago aprobado activa un <strong>código único</strong> para ese cliente. El mismo código no puede ser usado por otra persona o empresa.
            </div>

            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#030810' }}>
                  <tr>
                    {['Fecha', 'Cliente', 'RUC', 'Plan', 'Monto', 'Método', 'Referencia', 'Teléfono', 'Estado', 'Acciones'].map((h, i) => (
                      <th key={i} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? C.bgCard : C.bgRow }}>
                      <td style={tdStyle}>{p.fecha}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', fontSize: 11 }}>{p.ruc}</td>
                      <td style={tdStyle}><Badge label={p.plan} color={planColor(p.plan)} /></td>
                      <td style={{ ...tdStyle, color: C.green, fontWeight: 700, fontFamily: 'Consolas, monospace' }}>S/ {fmt(p.monto)}</td>
                      <td style={tdStyle}>{metodoBadge(p.metodo)}</td>
                      <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', fontSize: 11, color: C.accent }}>{p.referencia}</td>
                      <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', fontSize: 11 }}>{p.telefono}</td>
                      <td style={tdStyle}><Badge label={p.status} color={statusColor(p.status)} /></td>
                      <td style={tdStyle}>
                        {p.status === 'PENDIENTE' && (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button type="button" onClick={() => aprobarPago(p.id)} style={{ padding: '4px 10px', background: `${C.green}22`, border: `1px solid ${C.green}44`, borderRadius: 6, color: C.green, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                              ✓ Aprobar
                            </button>
                            <button type="button" onClick={() => rechazarPago(p.id)} style={{ padding: '4px 10px', background: `${C.red}22`, border: `1px solid ${C.red}44`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                              ✗ Rechazar
                            </button>
                          </div>
                        )}
                        {p.status !== 'PENDIENTE' && <span style={{ color: C.dim, fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Instrucciones de validación */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { icon: '💜', title: 'Yape', steps: ['Verificar número de teléfono', 'Confirmar monto exacto', 'Validar código de operación YP-XXXXXXXXX', 'Aprobar y generar código de acceso'] },
                { icon: '💙', title: 'Plin', steps: ['Verificar número de teléfono', 'Confirmar monto exacto', 'Validar código de operación PL-XXXXXXXXX', 'Aprobar y generar código de acceso'] },
                { icon: '🏦', title: 'Transferencia', steps: ['Verificar número de operación', 'Confirmar monto en cuenta bancaria', 'Validar fecha de abono', 'Aprobar y generar código de acceso'] },
              ].map((m, i) => (
                <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: C.text }}>{m.icon} {m.title}</p>
                  {m.steps.map((s, j) => (
                    <div key={j} style={{ display: 'flex', gap: 6, marginBottom: 6, fontSize: 11, color: C.muted }}>
                      <span style={{ color: C.accent, fontWeight: 700 }}>{j + 1}.</span> {s}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ CLIENTES ═══════════════ */}
        {tab === 'CLIENTES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>👥 Gestión de Clientes</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={clienteFilter} onChange={e => setClienteFilter(e.target.value)}
                  placeholder="Buscar por nombre o RUC..."
                  style={{ padding: '7px 12px', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12, outline: 'none', width: 220, fontFamily: "'Segoe UI', Arial, sans-serif" }} />
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
                  style={{ padding: '7px 12px', background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 12, outline: 'none', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                  <option value="">Todos los planes</option>
                  <option value="MAESTRO">Maestro</option>
                  <option value="PRO">Pro</option>
                  <option value="PLUS">Plus</option>
                </select>
              </div>
            </div>

            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#030810' }}>
                  <tr>
                    {['Tipo', 'Cliente / RUC', 'Plan', 'Estado', 'Registrado', 'Último acceso', 'Vencimiento', 'IA Consumida', 'Código', 'Acciones'].map((h, i) => (
                      <th key={i} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((c, i) => {
                    const pct = c.limiteIA > 0 ? Math.round((c.docsIA / c.limiteIA) * 100) : 0;
                    const porVencer = c.status === 'ACTIVO' && new Date(c.vencimiento) <= new Date(Date.now() + 15 * 86400000);
                    return (
                      <tr key={c.id} style={{ background: i % 2 === 0 ? C.bgCard : C.bgRow, cursor: 'pointer' }}
                        onClick={() => setSelectedClient(selectedClient?.id === c.id ? null : c)}>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 14 }}>{c.tipo === 'EMPRESA' ? '🏢' : '👤'}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, color: C.text }}>{c.nombre}</div>
                          <div style={{ color: C.dim, fontSize: 10, fontFamily: 'Consolas, monospace' }}>{c.ruc} · {c.email}</div>
                        </td>
                        <td style={tdStyle}><Badge label={c.plan.replace('_', ' ')} color={planColor(c.plan)} /></td>
                        <td style={tdStyle}><Badge label={c.status} color={statusColor(c.status)} /></td>
                        <td style={{ ...tdStyle, color: C.dim }}>{c.fechaRegistro}</td>
                        <td style={{ ...tdStyle, color: C.dim }}>{c.ultimoAcceso}</td>
                        <td style={tdStyle}>
                          <span style={{ color: porVencer ? C.yellow : C.dim }}>{c.vencimiento}</span>
                          {porVencer && <span style={{ color: C.yellow, fontSize: 10 }}> ⚠</span>}
                        </td>
                        <td style={tdStyle}>
                          {c.limiteIA > 0 ? (
                            <div>
                              <div style={{ fontSize: 11, color: pct > 90 ? C.red : pct > 70 ? C.yellow : C.green }}>{c.docsIA}/{c.limiteIA} docs</div>
                              <div style={{ height: 4, background: C.border, borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? C.red : pct > 70 ? C.yellow : C.green, borderRadius: 2 }} />
                              </div>
                            </div>
                          ) : <span style={{ color: C.muted }}>Ilimitado</span>}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', fontSize: 10, color: C.accent }}>{c.codigoAcceso}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button type="button" style={{ padding: '3px 8px', background: `${C.accent}18`, border: `1px solid ${C.accent}33`, borderRadius: 5, color: C.accent, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>Ver</button>
                            {c.status !== 'SUSPENDIDO' ? (
                              <button type="button" style={{ padding: '3px 8px', background: `${C.red}18`, border: `1px solid ${C.red}33`, borderRadius: 5, color: C.red, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>Suspender</button>
                            ) : (
                              <button type="button" style={{ padding: '3px 8px', background: `${C.green}18`, border: `1px solid ${C.green}33`, borderRadius: 5, color: C.green, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>Activar</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Panel detalle cliente */}
            {selectedClient && (
              <div style={{ background: `${C.accent}08`, border: `1px solid ${C.accent}33`, borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.accent }}>📋 Detalle — {selectedClient.nombre}</h3>
                  <button type="button" onClick={() => setSelectedClient(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    ['RUC', selectedClient.ruc], ['Email', selectedClient.email],
                    ['Tipo', selectedClient.tipo], ['Plan', selectedClient.plan],
                    ['Estado', selectedClient.status], ['Código', selectedClient.codigoAcceso],
                    ['IPs registradas', selectedClient.ips.join(', ') || '—'],
                    ['Negocios/Empresas', String(selectedClient.negocios)],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: C.bgCard, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ color: C.dim, fontSize: 10, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ CÓDIGOS ÚNICOS ═══════════════ */}
        {tab === 'CODIGOS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>🔑 Códigos de Acceso Únicos</h2>

            <div style={{ background: `${C.purple}10`, border: `1px solid ${C.purple}33`, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: C.muted }}>
              <strong style={{ color: C.purple }}>🔒 Regla de seguridad:</strong> Cada cliente recibe un código único al activar su plan. <strong>Un código no puede ser usado por otra persona o empresa.</strong> Si se detecta uso desde múltiples IPs distintas, el código se bloquea automáticamente y se genera una alerta.
            </div>

            {/* Generador de código nuevo */}
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: C.text }}>✨ Generar nuevo código</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ fontFamily: 'Consolas, monospace', fontSize: 18, fontWeight: 900, color: C.accent, background: `${C.accent}12`, padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.accent}33`, letterSpacing: 3 }}>
                  {newCode || 'CP-2026-????'}
                </div>
                <button type="button" onClick={() => setNewCode(generateCode())} style={{ padding: '10px 20px', background: `linear-gradient(135deg, ${C.purple}, ${C.accent})`, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                  🔄 Generar código
                </button>
                {newCode && (
                  <button type="button" onClick={() => navigator.clipboard.writeText(newCode)} style={{ padding: '10px 16px', background: `${C.green}18`, border: `1px solid ${C.green}44`, borderRadius: 8, color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
                    📋 Copiar
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#030810' }}>
                  <tr>
                    {['Código', 'Cliente', 'Plan', 'Generado', 'Usado', 'Estado', 'IPs registradas', 'Intentos duplicados', 'Acciones'].map((h, i) => (
                      <th key={i} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {codigos.map((c, i) => (
                    <tr key={c.codigo} style={{ background: c.intentosDuplicado > 0 ? `${C.red}08` : i % 2 === 0 ? C.bgCard : C.bgRow }}>
                      <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', color: C.accent, fontWeight: 700 }}>{c.codigo}</td>
                      <td style={{ ...tdStyle, maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c.cliente === 'SIN ASIGNAR' ? C.dim : C.text }}>{c.cliente}</div>
                      </td>
                      <td style={tdStyle}><Badge label={c.plan.replace('_', ' ')} color={planColor(c.plan)} /></td>
                      <td style={{ ...tdStyle, color: C.dim }}>{c.fechaGen}</td>
                      <td style={{ ...tdStyle, color: C.dim }}>{c.fechaUso}</td>
                      <td style={tdStyle}><Badge label={c.status} color={statusColor(c.status)} /></td>
                      <td style={{ ...tdStyle, fontSize: 10, fontFamily: 'Consolas, monospace' }}>
                        {c.ips.length > 0 ? c.ips.map((ip, j) => <div key={j} style={{ color: j > 0 ? C.orange : C.muted }}>{ip}</div>) : '—'}
                      </td>
                      <td style={tdStyle}>
                        {c.intentosDuplicado > 0 ? (
                          <span style={{ color: C.red, fontWeight: 700 }}>🚨 {c.intentosDuplicado} intento(s)</span>
                        ) : (
                          <span style={{ color: C.green }}>✓ Limpio</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {c.status === 'BLOQUEADO' && (
                            <button type="button" style={{ padding: '3px 8px', background: `${C.green}18`, border: `1px solid ${C.green}33`, borderRadius: 5, color: C.green, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>Desbloquear</button>
                          )}
                          {c.status === 'ACTIVO' && (
                            <button type="button" style={{ padding: '3px 8px', background: `${C.red}18`, border: `1px solid ${C.red}33`, borderRadius: 5, color: C.red, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>Revocar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════ CONSUMO IA ═══════════════ */}
        {tab === 'CONSUMO' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>🤖 Consumo de IA por cliente</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Total docs procesados', value: fmtInt(clientes.reduce((s, c) => s + c.docsIA, 0)), color: C.purple, icon: '📄' },
                { label: 'Clientes cerca del límite', value: String(clientes.filter(c => c.limiteIA > 0 && c.docsIA / c.limiteIA > 0.9).length), color: C.red, icon: '⚠️' },
                { label: 'Con IA ilimitada', value: String(clientes.filter(c => c.limiteIA === 0).length), color: C.green, icon: '♾️' },
                { label: 'Promedio uso mensual', value: `${Math.round(clientes.filter(c => c.limiteIA > 0).reduce((s, c) => s + c.docsIA, 0) / Math.max(clientes.filter(c => c.limiteIA > 0).length, 1))} docs`, color: C.accent, icon: '📊' },
              ].map((k, i) => <KpiCard key={i} icon={k.icon} label={k.label} value={k.value} sub="" color={k.color} />)}
            </div>

            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#030810' }}>
                  <tr>
                    {['Cliente', 'Plan', 'Documentos IA', '% Usado', 'Límite mensual', 'Estado'].map((h, i) => (
                      <th key={i} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...clientes].sort((a, b) => (b.limiteIA > 0 ? b.docsIA / b.limiteIA : 0) - (a.limiteIA > 0 ? a.docsIA / a.limiteIA : 0)).map((c, i) => {
                    const pct = c.limiteIA > 0 ? Math.round((c.docsIA / c.limiteIA) * 100) : 0;
                    const barColor = pct > 90 ? C.red : pct > 70 ? C.yellow : C.green;
                    return (
                      <tr key={c.id} style={{ background: i % 2 === 0 ? C.bgCard : C.bgRow }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{c.nombre}</td>
                        <td style={tdStyle}><Badge label={c.plan.replace('_', ' ')} color={planColor(c.plan)} /></td>
                        <td style={{ ...tdStyle, fontFamily: 'Consolas, monospace', color: barColor, fontWeight: 700 }}>{c.docsIA}</td>
                        <td style={{ ...tdStyle, minWidth: 150 }}>
                          {c.limiteIA > 0 ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                              </div>
                              <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          ) : <span style={{ color: C.green }}>Sin límite</span>}
                        </td>
                        <td style={{ ...tdStyle, color: C.muted }}>{c.limiteIA === 0 ? 'Ilimitado' : `${c.limiteIA} docs/mes`}</td>
                        <td style={tdStyle}>
                          {pct > 90 && <Badge label="LÍMITE CERCANO" color={C.red} />}
                          {pct > 70 && pct <= 90 && <Badge label="USO ALTO" color={C.yellow} />}
                          {pct <= 70 && c.limiteIA > 0 && <Badge label="NORMAL" color={C.green} />}
                          {c.limiteIA === 0 && <Badge label="MAESTRO" color={C.purple} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════ ALERTAS ═══════════════ */}
        {tab === 'ALERTAS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>🚨 Centro de Alertas del Sistema</h2>
            {['ALTO', 'MEDIO', 'INFO'].map(nivel => {
              const grupo = alertas.filter(a => a.nivel === nivel);
              if (grupo.length === 0) return null;
              const colorNivel = nivel === 'ALTO' ? C.red : nivel === 'MEDIO' ? C.yellow : C.dim;
              return (
                <div key={nivel}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: colorNivel, letterSpacing: '0.06em' }}>
                    {nivel === 'ALTO' ? '🔴' : nivel === 'MEDIO' ? '🟡' : '🔵'} NIVEL {nivel} — {grupo.length} alerta{grupo.length > 1 ? 's' : ''}
                  </p>
                  {grupo.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: C.bgCard, borderRadius: 10, marginBottom: 8, borderLeft: `4px solid ${colorNivel}` }}>
                      <span style={{ fontSize: 20 }}>{a.tipo === 'SEGURIDAD' ? '🔒' : a.tipo === 'VENCIMIENTO' ? '📅' : a.tipo === 'PAGO' ? '💳' : a.tipo === 'LIMITE' ? '📊' : '💤'}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600 }}>{a.mensaje}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 11, color: C.dim }}>Cliente: {a.cliente} · {a.fecha}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Badge label={a.tipo} color={colorNivel} />
                        {a.tipo === 'VENCIMIENTO' && <button type="button" style={{ padding: '4px 12px', background: `${C.green}18`, border: `1px solid ${C.green}44`, borderRadius: 6, color: C.green, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>Renovar</button>}
                        {a.tipo === 'SEGURIDAD' && <button type="button" style={{ padding: '4px 12px', background: `${C.red}18`, border: `1px solid ${C.red}44`, borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>Bloquear código</button>}
                        {a.tipo === 'PAGO' && <button type="button" style={{ padding: '4px 12px', background: `${C.yellow}18`, border: `1px solid ${C.yellow}44`, borderRadius: 6, color: C.yellow, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Segoe UI', Arial, sans-serif" }}>Ver pagos</button>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════ PLANES ═══════════════ */}
        {tab === 'PLANES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>📋 Todos los planes CONTA_PRO</h2>

            {/* ─ CONTADORES ─ */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.accent, letterSpacing: '0.06em' }}>👤 PLANES PARA CONTADORES INDEPENDIENTES</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {[
                  {
                    id: 'TRIAL',  name: '1 Mes Gratis', price: 'S/ 0', period: '1 mes', icon: '🎁', color: C.green,
                    negocios: 3, ia: 'Sin IA', modulos: ['Contabilidad', 'Ventas', 'Compras', 'Reportes básicos'],
                    restricciones: ['Solo 1 vez por contador', 'Negocios no pueden repetir prueba', 'Sin IA ni OCR'],
                    clientes: clientes.filter(c => c.plan === 'TRIAL_CONTADOR').length,
                  },
                  {
                    id: 'BASICO', name: 'Básico', price: 'S/ XX', period: '/mes', icon: '📊', color: C.muted,
                    negocios: 5, ia: 'Sin IA', modulos: ['Contabilidad completa', 'Ventas', 'Compras', 'Reportes'],
                    restricciones: ['Sin IA ni OCR', 'Sin inventario', 'Sin planillas'],
                    clientes: clientes.filter(c => c.plan === 'BASICO_CONTADOR').length,
                  },
                  {
                    id: 'PLUS',   name: 'Plus', price: 'S/ XX', period: '/mes', icon: '⚡', color: C.blue,
                    negocios: 10, ia: '50 usos/mes', modulos: ['Contabilidad completa', 'Ventas', 'Compras', 'OCR Gemini', 'IA 50 docs/mes', 'Reportes'],
                    restricciones: ['Sin inventario', 'Sin planillas'],
                    clientes: clientes.filter(c => c.plan === 'PLUS_CONTADOR').length,
                  },
                  {
                    id: 'PRO',    name: 'Pro', price: 'S/ XX', period: '/mes', icon: '🚀', color: C.indigo || C.blue,
                    negocios: 15, ia: '100 usos/mes', modulos: ['Contabilidad completa', 'Ventas', 'Compras', 'OCR Gemini', 'IA 100 docs/mes', 'BI avanzado', 'Reportes'],
                    restricciones: ['Sin inventario', 'Sin planillas'],
                    clientes: clientes.filter(c => c.plan === 'PRO_CONTADOR').length,
                  },
                  {
                    id: 'MAESTRO+', name: 'Maestro+', price: 'A tratar', period: '', icon: '👑', color: C.purple,
                    negocios: 0, ia: 'Ilimitada', modulos: ['Contabilidad completa', 'Ventas', 'Compras', 'Inventario', 'Almacén', 'Planillas', 'Centros de costo', 'OCR IA ilimitado', 'ERP completo', 'SUNAT', 'Auditoría'],
                    restricciones: ['Implementación guiada', 'A tratar con el dueño'],
                    clientes: clientes.filter(c => c.plan === 'MAESTRO_PLUS').length,
                  },
                ].map((pl) => (
                  <div key={pl.id} style={{
                    background: C.bgCard, border: `1px solid ${pl.color}44`,
                    borderTop: `3px solid ${pl.color}`, borderRadius: 12,
                    padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 22 }}>{pl.icon}</span>
                      <span style={{ background: `${pl.color}22`, color: pl.color, fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                        {pl.clientes} cliente{pl.clientes !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ color: pl.color, fontWeight: 900, fontSize: 14 }}>{pl.name}</div>
                    <div style={{ color: C.text, fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
                      {pl.price}<span style={{ color: C.dim, fontSize: 10, fontWeight: 400 }}>{pl.period}</span>
                    </div>
                    <div style={{ color: C.muted, fontSize: 11 }}>
                      {pl.negocios === 0 ? '♾️ Negocios ilimitados' : `📁 ${pl.negocios} negocios`}
                    </div>
                    <div style={{ background: `${pl.color}18`, color: pl.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, textAlign: 'center' }}>
                      🤖 {pl.ia}
                    </div>
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                      <p style={{ margin: '0 0 5px', fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>Módulos activos</p>
                      {pl.modulos.map((m, i) => (
                        <div key={i} style={{ fontSize: 10, color: C.dim, padding: '1px 0', display: 'flex', gap: 4 }}>
                          <span style={{ color: pl.color }}>✓</span> {m}
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                      <p style={{ margin: '0 0 5px', fontSize: 10, color: C.red, fontWeight: 700, textTransform: 'uppercase' }}>Restricciones</p>
                      {pl.restricciones.map((r, i) => (
                        <div key={i} style={{ fontSize: 10, color: C.dim, padding: '1px 0', display: 'flex', gap: 4 }}>
                          <span style={{ color: C.red }}>✕</span> {r}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─ EMPRESAS ─ */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.green, letterSpacing: '0.06em' }}>🏢 PLANES PARA EMPRESAS / NEGOCIOS</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  {
                    id: 'PLUS_EMPRESA', name: 'Plus Empresa', price: 'S/ XX', period: '/mes', icon: '⚡', color: C.accent,
                    ia: '100 docs/mes', modulos: ['Contabilidad', 'Ventas', 'Compras', 'Inventario base', 'OCR IA 100 docs', 'Módulos por rubro', 'Plan contable por actividad'],
                    noIncluye: ['Planillas', 'Centros de costo', 'Almacenes múltiples'],
                    clientes: clientes.filter(c => c.plan === 'PLUS_EMPRESA').length,
                  },
                  {
                    id: 'PRO_EMPRESA',  name: 'Pro Empresa', price: 'S/ XX', period: '/mes', icon: '🚀', color: C.blue,
                    ia: '200 docs/mes', modulos: ['Contabilidad', 'Ventas', 'Compras', 'Inventario completo', 'Planillas', 'OCR IA 200 docs', 'Centros de costo', 'Almacenes múltiples', 'BI avanzado', 'SUNAT'],
                    noIncluye: ['Implementación personalizada'],
                    clientes: clientes.filter(c => c.plan === 'PRO_EMPRESA').length,
                  },
                  {
                    id: 'MAESTRO',     name: 'Maestro Empresa', price: 'A tratar', period: '', icon: '👑', color: C.purple,
                    ia: 'Ilimitada + por proceso', modulos: ['ERP completo personalizado', 'Diagnóstico de procesos', 'Todos los módulos', 'Múltiples usuarios', 'IA configurada por área', 'SUNAT completo', 'Auditoría', 'Integración bancos/SAP/Odoo', 'Capacitación', 'Soporte dedicado'],
                    noIncluye: [],
                    clientes: clientes.filter(c => c.plan === 'MAESTRO_EMPRESA').length,
                  },
                ].map((pl) => (
                  <div key={pl.id} style={{
                    background: C.bgCard, border: `1px solid ${pl.color}44`,
                    borderTop: `3px solid ${pl.color}`, borderRadius: 12, padding: '18px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24 }}>{pl.icon}</span>
                        <div>
                          <div style={{ color: pl.color, fontWeight: 900, fontSize: 14 }}>{pl.name}</div>
                          <div style={{ color: C.text, fontWeight: 800, fontSize: 20, lineHeight: 1 }}>
                            {pl.price}<span style={{ color: C.dim, fontSize: 11, fontWeight: 400 }}>{pl.period}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ background: `${pl.color}22`, color: pl.color, fontSize: 10, fontWeight: 800, padding: '4px 12px', borderRadius: 20, textAlign: 'center' }}>
                        {pl.clientes} cliente{pl.clientes !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ background: `${pl.color}18`, color: pl.color, fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, marginBottom: 12, textAlign: 'center' }}>
                      🤖 IA: {pl.ia}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <p style={{ margin: '0 0 6px', fontSize: 10, color: pl.color, fontWeight: 700, textTransform: 'uppercase' }}>✓ Incluye</p>
                        {pl.modulos.map((m, i) => (
                          <div key={i} style={{ fontSize: 11, color: C.dim, padding: '2px 0', display: 'flex', gap: 5 }}>
                            <span style={{ color: C.green }}>✓</span> {m}
                          </div>
                        ))}
                      </div>
                      {pl.noIncluye.length > 0 && (
                        <div>
                          <p style={{ margin: '0 0 6px', fontSize: 10, color: C.red, fontWeight: 700, textTransform: 'uppercase' }}>✕ No incluye</p>
                          {pl.noIncluye.map((r, i) => (
                            <div key={i} style={{ fontSize: 11, color: C.dim, padding: '2px 0', display: 'flex', gap: 5 }}>
                              <span style={{ color: C.red }}>✕</span> {r}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─ SUPER ADMIN ─ */}
            <div style={{ background: `linear-gradient(135deg, ${C.purple}18, ${C.accent}10)`, border: `1px solid ${C.purple}44`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>⭐</span>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.purple }}>CONTA_PRO — Dueño del Sistema</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Acceso total · Sin límites · Panel de administración</p>
                </div>
                <Badge label="SOLO TÚ" color={C.purple} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {['Todos los módulos activos', 'IA ilimitada', 'Todos los clientes visibles', 'Validación de pagos Yape/Plin', 'Gestión de códigos únicos', 'Alertas del sistema', 'Configuración global', 'Sin fecha de vencimiento'].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
                    <span style={{ color: C.purple, fontWeight: 700 }}>⭐</span> {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ CONFIG ═══════════════ */}
        {tab === 'CONFIG' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>⚙️ Configuración del Sistema</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { title: '💰 Precios de planes', items: ['Plus Empresa: S/ 149/mes', 'Pro Empresa: S/ 249/mes', 'Maestro Empresa: A tratar', 'Plus Contador: S/ 69/mes', 'Pro Contador: S/ 99/mes', 'Maestro+: A tratar'] },
                { title: '📱 Medios de pago activos', items: ['✅ Yape (validación manual)', '✅ Plin (validación manual)', '✅ Transferencia BCP/Interbank', '⬜ Culqi (tarjeta — próximamente)', '⬜ Izipay (POS virtual — próximamente)'] },
                { title: '🤖 Límites de IA por plan', items: ['Trial: 0 docs/mes', 'Plus Empresa: 100 docs/mes', 'Pro Empresa: 200 docs/mes', 'Plus Contador: 50 docs/mes', 'Pro Contador: 100 docs/mes', 'Maestro: Ilimitado'] },
                { title: '🔑 Reglas de códigos únicos', items: ['1 código por cliente al activar plan', 'Código no puede ser reutilizado', 'Máximo 2 IPs distintas por código', 'Bloqueo automático a la 3ra IP distinta', 'Alerta al dueño por intento duplicado'] },
              ].map((s, i) => (
                <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: C.text }}>{s.title}</p>
                  {s.items.map((item, j) => (
                    <div key={j} style={{ fontSize: 12, color: C.muted, padding: '5px 0', borderBottom: j < s.items.length - 1 ? `1px dashed ${C.border}` : 'none' }}>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default OwnerDashboard;
