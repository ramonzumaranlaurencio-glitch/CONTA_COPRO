/**
 * NormativasBancarias — Normativas bancarias y tributarias colombianas vigentes
 * GMF 4x1000 · PUC Colombia · Asientos DIAN · Bancos Colombia
 * Basado en: Estatuto Tributario, Circular Básica Contable SFC, Decreto 2420/2015
 */
import React, { useState } from 'react';

const C = {
  bg: '#020812', bgCard: '#080f1f', bgRow: '#0b1525',
  border: '#1a3050', text: '#e2eaf8', muted: '#6e93b8',
  dim: '#3d6080', accent: '#38bdf8', blue: '#0078d4',
  green: '#22c55e', yellow: '#FFCD00', red: '#ef4444',
  purple: '#a855f7', orange: '#f97316',
};

// ─── Bancos Colombia ────────────────────────────────────────────────────────
const BANCOS_COLOMBIA = [
  { codigo: '001', nombre: 'Bancolombia', puc: '111005', wallet: 'Nequi', color: C.green },
  { codigo: '002', nombre: 'Davivienda', puc: '111010', wallet: 'Daviplata', color: C.red },
  { codigo: '003', nombre: 'BBVA Colombia', puc: '111015', wallet: 'BBVA Wallet', color: C.blue },
  { codigo: '004', nombre: 'Banco de Bogotá', puc: '111020', wallet: '—', color: C.accent },
  { codigo: '005', nombre: 'Banco Popular', puc: '111025', wallet: '—', color: C.orange },
  { codigo: '006', nombre: 'Banco de Occidente', puc: '111030', wallet: '—', color: C.purple },
  { codigo: '007', nombre: 'Banco Agrario', puc: '111035', wallet: '—', color: '#16a34a' },
  { codigo: '008', nombre: 'Banco Caja Social', puc: '111040', wallet: '—', color: '#7c3aed' },
  { codigo: '009', nombre: 'Scotiabank Colpatria', puc: '111045', wallet: '—', color: '#dc2626' },
  { codigo: '010', nombre: 'Itaú Colombia', puc: '111050', wallet: '—', color: '#ea580c' },
];

// ─── GMF 4x1000 ─────────────────────────────────────────────────────────────
const GMF_INFO = {
  tasa: 0.004,  // 0.4% = 4 x 1000
  baseLegal: 'Art. 871-879 Estatuto Tributario Nacional',
  decreto: 'Decreto 2331 de 2000 y modificaciones',
  cuentaPUC_gasto: '519595',
  cuentaPUC_pasivo: '2455',
  descripcion: 'Grava los retiros de cuentas corrientes, de ahorro, depósitos y la disposición de recursos mediante cheques.',
  exenciones: [
    'Cuentas de nómina para pago de salarios (hasta el valor del salario)',
    'Pagos de pensiones y cesantías a fondos',
    'Desembolsos de crédito hipotecario para vivienda',
    'Operaciones de tesorería (interbancarias)',
    'Retiros de cuentas corrientes y de ahorro marcadas como exentas (Art. 879 ET)',
    'Primeros $350 UVT mensuales de movimientos en cuenta de ahorro persona natural',
  ],
};

// ─── Asientos PUC Colombia ───────────────────────────────────────────────────
const ASIENTOS_PUC = [
  {
    id: 'venta_fe',
    titulo: 'Venta con Factura Electrónica DIAN',
    descripcion: 'Registro de venta con IVA 19% — Factura Electrónica con CUFE',
    normativa: 'Art. 615 ET · Res. DIAN 042/2020',
    lineas: [
      { cuenta: '1305', nombre: 'Clientes', debito: 'Total factura', credito: '—', nota: 'Saldo a cobrar al cliente' },
      { cuenta: '4135', nombre: 'Ingresos por ventas', debito: '—', credito: 'Base gravable', nota: 'Sin IVA' },
      { cuenta: '2408', nombre: 'IVA generado (por pagar)', debito: '—', credito: 'IVA 19%', nota: 'Cuenta PUC IVA' },
    ],
  },
  {
    id: 'cobro_nequi',
    titulo: 'Cobro de Cartera vía Nequi / Daviplata / PSE',
    descripcion: 'Recepción de pago de cliente por billetera digital o PSE',
    normativa: 'Circular SFC 029/2014 · Art. 771-5 ET (bancarización)',
    lineas: [
      { cuenta: '1110', nombre: 'Bancos (Nequi/Daviplata/PSE)', debito: 'Valor recibido', credito: '—', nota: 'Subcuenta banco correspondiente' },
      { cuenta: '2365', nombre: 'ReteFuente sufrida', debito: 'ReteFuente (si aplica)', credito: '—', nota: 'Solo si cliente es agente retenedor' },
      { cuenta: '2367', nombre: 'ReteIVA sufrida', debito: 'ReteIVA (si aplica)', credito: '—', nota: '15% del IVA si cliente es Gran Contrib.' },
      { cuenta: '1305', nombre: 'Clientes', debito: '—', credito: 'Saldo factura', nota: 'Cancela la CXC' },
    ],
  },
  {
    id: 'gmf',
    titulo: 'GMF 4x1000 — Gravamen Movimientos Financieros',
    descripcion: 'Registro automático del 4x1000 al realizar retiros bancarios (Art. 871 ET)',
    normativa: 'Art. 871-879 ET · Decreto 2331/2000',
    lineas: [
      { cuenta: '519595', nombre: 'Gasto GMF 4x1000', debito: '0.4% del retiro', credito: '—', nota: 'Gasto no deducible de renta (Art. 115 ET)' },
      { cuenta: '1110', nombre: 'Bancos', debito: '—', credito: '0.4% del retiro', nota: 'El banco lo descuenta automáticamente' },
    ],
    alerta: '⚠️ El GMF NO es deducible en renta según Art. 115 ET. No confundir con 4x1000 pagado en actividades comerciales que SÍ puede ser 50% deducible.',
  },
  {
    id: 'compra_fe',
    titulo: 'Compra con Factura Electrónica DIAN',
    descripcion: 'Registro de compra con IVA descontable — CUFE requerido',
    normativa: 'Art. 468 ET · Art. 488 ET (IVA descontable)',
    lineas: [
      { cuenta: '6135', nombre: 'Costo de ventas / Gasto 513xxx', debito: 'Base gravable', credito: '—', nota: 'Según naturaleza del bien/servicio' },
      { cuenta: '2408', nombre: 'IVA descontable', debito: 'IVA 19%', credito: '—', nota: 'Solo si cumple requisitos Art. 488 ET' },
      { cuenta: '2205', nombre: 'Proveedores', debito: '—', credito: 'Total factura', nota: 'Saldo a pagar al proveedor' },
    ],
  },
  {
    id: 'pago_proveedor',
    titulo: 'Pago a Proveedor con Transferencia / PSE',
    descripcion: 'Cancelación de cuentas por pagar con ReteFuente aplicada',
    normativa: 'Art. 375 ET · Art. 771-5 ET · Art. 871 ET (GMF)',
    lineas: [
      { cuenta: '2205', nombre: 'Proveedores', debito: 'Valor total factura', credito: '—', nota: 'Cancela CXP' },
      { cuenta: '1110', nombre: 'Bancos', debito: '—', credito: 'Valor neto pagado', nota: 'Neto = Total - ReteFuente' },
      { cuenta: '2365', nombre: 'ReteFuente por pagar', debito: '—', credito: 'ReteFuente practicada', nota: 'Se declara en F350 mensual' },
      { cuenta: '519595', nombre: 'Gasto GMF 4x1000 (si aplica)', debito: '0.4% pago', credito: '—', nota: 'Si el pago genera GMF' },
      { cuenta: '1110', nombre: 'Bancos (débito GMF)', debito: '—', credito: '0.4% pago', nota: 'GMF deducido por el banco' },
    ],
  },
  {
    id: 'nomina',
    titulo: 'Nómina Colombia — AFP, EPS, ARL, CCF, SENA, ICBF',
    descripcion: 'Pago de nómina con todos los aportes parafiscales colombianos',
    normativa: 'Ley 100/1993 · CST · Ley 21/1982 · Decreto 1072/2015',
    lineas: [
      { cuenta: '5105', nombre: 'Gastos de personal (salario bruto)', debito: 'Salario bruto', credito: '—', nota: 'Art. 107 ET (deducible)' },
      { cuenta: '2610', nombre: 'Cesantías consolidadas (prov.)', debito: '—', credito: '1/12 salario', nota: 'Consignar a fondo antes 14 feb' },
      { cuenta: '2615', nombre: 'Intereses sobre cesantías (prov.)', debito: '—', credito: '12% anual cesantías', nota: 'Pago directo enero' },
      { cuenta: '2620', nombre: 'Prima de servicios (prov.)', debito: '—', credito: '1/24 salario/mes', nota: 'Jun y Dic' },
      { cuenta: '2625', nombre: 'Vacaciones (prov.)', debito: '—', credito: '1/24 salario/mes', nota: '15 días hábiles/año' },
      { cuenta: '2365', nombre: 'ReteFuente rentas laborales', debito: '—', credito: 'Según tablas DIAN', nota: 'Art. 383 ET' },
      { cuenta: '2405', nombre: 'AFP Pensiones x pagar (16%)', debito: '—', credito: '4% empleado + 12% empresa', nota: 'Vía PILA mensual' },
      { cuenta: '2406', nombre: 'EPS Salud x pagar (12.5%)', debito: '—', credito: '4% empleado + 8.5% empresa', nota: 'Vía PILA mensual' },
      { cuenta: '1110', nombre: 'Bancos (neto pagado empleado)', debito: '—', credito: 'Neto = Bruto - Deducciones', nota: 'Nequi, Daviplata, transferencia' },
    ],
  },
  {
    id: 'parafiscales',
    titulo: 'Aportes Parafiscales — SENA, ICBF, CCF, ARL',
    descripcion: 'Registro aportes empleador (no aplica si empleados ganan < 10 SMMLV)',
    normativa: 'Ley 21/1982 · Ley 100/1993 · Ley 1607/2012 (exoneración)',
    lineas: [
      { cuenta: '510510', nombre: 'Gasto SENA (2%)', debito: '2% nómina', credito: '—', nota: 'Exonerado si salario < 10 SMMLV' },
      { cuenta: '510515', nombre: 'Gasto ICBF (3%)', debito: '3% nómina', credito: '—', nota: 'Exonerado si salario < 10 SMMLV' },
      { cuenta: '510520', nombre: 'Gasto CCF Caja Compensación (4%)', debito: '4% nómina', credito: '—', nota: 'Siempre obligatorio' },
      { cuenta: '510535', nombre: 'Gasto ARL (0.348% a 8.7%)', debito: 'Según riesgo', credito: '—', nota: 'Riesgo I a V según actividad' },
      { cuenta: '2370', nombre: 'Aportes parafiscales por pagar', debito: '—', credito: 'Total aportes', nota: 'Pago vía PILA antes del 21 cada mes' },
    ],
  },
  {
    id: 'ica',
    titulo: 'ICA — Impuesto de Industria y Comercio',
    descripcion: 'Impuesto municipal sobre ingresos brutos — Bogotá: 4.14‰ a 13.8‰',
    normativa: 'Ley 14/1983 · Decreto 352/2002 (Bogotá) · Acuerdo Municipal',
    lineas: [
      { cuenta: '513040', nombre: 'Gasto ICA', debito: 'Tarifa × ingresos brutos', credito: '—', nota: 'Deducible de renta (Art. 115 ET, 50%)' },
      { cuenta: '240810', nombre: 'ICA por pagar', debito: '—', credito: 'ICA liquidado', nota: 'Declarar bimestral en municipio' },
    ],
    alerta: '📍 Tarifas varían por municipio y actividad. Bogotá: comercio 4.14‰, industria 6.9‰, servicios 9.66‰, financiero 13.8‰.',
  },
  {
    id: 'activos_fijos',
    titulo: 'Compra Activo Fijo + IVA + Depreciación',
    descripcion: 'Capitalización de activo fijo con IVA tratamiento especial NIIF',
    normativa: 'NIC 16 · Art. 137-148 ET · Decreto 2420/2015',
    lineas: [
      { cuenta: '1528', nombre: 'Equipo de cómputo y comunicación', debito: 'Valor costo', credito: '—', nota: 'Vida útil: 3 años NIIF / 5 años fiscal' },
      { cuenta: '2408', nombre: 'IVA descontable (si aplica)', debito: 'IVA 19%', credito: '—', nota: 'Solo si se usa en actividad IVA' },
      { cuenta: '2205', nombre: 'Proveedores', debito: '—', credito: 'Total factura', nota: '' },
      { cuenta: '516060', nombre: 'Gasto depreciación mensual', debito: 'Costo / vida útil / 12', credito: '—', nota: 'Mensual' },
      { cuenta: '1592', nombre: 'Depreciación acumulada', debito: '—', credito: 'Costo / vida útil / 12', nota: 'Cuenta de valoración' },
    ],
  },
];

// ─── Tasas ReteFuente 2026 ───────────────────────────────────────────────────
const RETEFUENTE_2026 = [
  { concepto: 'Compras bienes muebles — declarante', tarifa: '3.5%', cuantia: '$ 927.000', base: 'Art. 401 ET' },
  { concepto: 'Compras bienes muebles — no declarante', tarifa: '3.5%', cuantia: '$ 927.000', base: 'Art. 401 ET' },
  { concepto: 'Servicios generales — persona jurídica', tarifa: '4%', cuantia: '$ 130.000', base: 'Art. 392 ET' },
  { concepto: 'Servicios generales — persona natural', tarifa: '6%', cuantia: '$ 130.000', base: 'Art. 392 ET' },
  { concepto: 'Honorarios — persona jurídica', tarifa: '11%', cuantia: '$ 0', base: 'Art. 392 ET' },
  { concepto: 'Honorarios — persona natural (declarante)', tarifa: '10%', cuantia: '$ 0', base: 'Art. 392 ET' },
  { concepto: 'Arrendamiento inmuebles — persona jurídica', tarifa: '3.5%', cuantia: '$ 927.000', base: 'Art. 401 ET' },
  { concepto: 'Arrendamiento inmuebles — persona natural', tarifa: '3.5%', cuantia: '$ 927.000', base: 'Art. 401 ET' },
  { concepto: 'Dividendos gravados (tarifa especial)', tarifa: '10%', cuantia: '$ 0', base: 'Art. 242 ET' },
  { concepto: 'Loterías, rifas, apuestas', tarifa: '20%', cuantia: '$ 1.000.000', base: 'Art. 317 ET' },
  { concepto: 'Salarios — escala progresiva', tarifa: '0%-39%', cuantia: 'Según rangos UVT', base: 'Art. 383 ET' },
];

// ─── Componente ─────────────────────────────────────────────────────────────
export const NormativasBancarias: React.FC = () => {
  const [tab, setTab] = useState<'bancos' | 'gmf' | 'asientos' | 'retefuente'>('bancos');
  const [openAsiento, setOpenAsiento] = useState('');

  const TABS = [
    { id: 'bancos', label: '🏦 Bancos Colombia' },
    { id: 'gmf', label: '⚡ GMF 4×1000' },
    { id: 'asientos', label: '📊 Asientos PUC' },
    { id: 'retefuente', label: '📋 ReteFuente 2026' },
  ] as const;

  return (
    <div style={{ padding: '18px 20px', background: C.bg, minHeight: '100%', color: C.text, fontFamily: "'Segoe UI', Arial, sans-serif", overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 900 }}>🇨🇴 Normativas Bancarias y Tributarias Colombia</h1>
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
          GMF 4x1000 · PUC Colombia · Asientos DIAN vigentes · ReteFuente 2026 · Bancos y billeteras digitales
        </p>
      </div>

      {/* Alerta normativa vigente */}
      <div style={{ background: `${C.yellow}12`, border: `1px solid ${C.yellow}44`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12 }}>
        <strong style={{ color: C.yellow }}>📢 Normativa vigente 2026:</strong>{' '}
        <span style={{ color: C.muted }}>ET Colombia actualizado · Resolución DIAN 042/2020 (FE) · Decreto 2420/2015 (NIIF) · Circular SFC 029/2014 (billeteras digitales) · UVT 2026: $47.065</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            background: tab === t.id ? `linear-gradient(135deg, ${C.blue}, ${C.accent})` : C.bgCard,
            color: tab === t.id ? '#fff' : C.muted,
            fontWeight: 700, fontSize: 12, fontFamily: "'Segoe UI', Arial, sans-serif",
            border: `1px solid ${tab === t.id ? C.accent : C.border}`,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─── BANCOS COLOMBIA ─── */}
      {tab === 'bancos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: '#030810', fontSize: 11, fontWeight: 700, color: C.muted,
              display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px 1fr' }}>
              <span>CÓD.</span><span>BANCO</span><span>CTA. PUC</span><span>BILLETERA DIGITAL</span><span>NORMALIDAD</span>
            </div>
            {BANCOS_COLOMBIA.map((b, i) => (
              <div key={b.codigo} style={{
                display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px 1fr',
                padding: '10px 16px', background: i % 2 === 0 ? C.bgCard : C.bgRow,
                borderBottom: `1px solid ${C.border}`, fontSize: 12, alignItems: 'center',
              }}>
                <span style={{ color: C.dim, fontFamily: 'Consolas, monospace' }}>{b.codigo}</span>
                <span style={{ color: b.color, fontWeight: 700 }}>{b.nombre}</span>
                <span style={{ color: C.accent, fontFamily: 'Consolas, monospace' }}>{b.puc}</span>
                <span style={{ color: b.wallet === '—' ? C.dim : C.green, fontWeight: b.wallet !== '—' ? 700 : 400 }}>{b.wallet}</span>
                <span style={{ color: C.dim, fontSize: 11 }}>Regulado SFC · PSE · ACH Colombia</span>
              </div>
            ))}
          </div>

          {/* Billeteras digitales Colombia */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { icon: '💚', nombre: 'Nequi', banco: 'Bancolombia', reg: 'Regulada SFC como Institución Oficial Especial', limite: 'Hasta $3.000.000 COP/transacción · $4.500.000/día', asiento: 'PUC 111005 · No genera GMF hasta límite exento (Art. 879 ET)', color: '#22c55e' },
              { icon: '🔴', nombre: 'Daviplata', banco: 'Davivienda', reg: 'Regulada SFC · Superintendencia Financiera de Colombia', limite: 'Hasta $3.000.000 COP/transacción · $6.000.000/día', asiento: 'PUC 111010 · GMF aplica según cuenta asociada', color: '#ef4444' },
              { icon: '🔵', nombre: 'PSE (ACH Colombia)', banco: 'Red interbancaria', reg: 'Regulado Banco de la República · Circular DCIN 83', limite: 'Sin límite definido · varía por banco', asiento: 'PUC 1110 subcuenta banco destino · Genera GMF si aplica', color: '#0078d4' },
            ].map((w, i) => (
              <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderTop: `3px solid ${w.color}`, borderRadius: 12, padding: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 900, color: w.color }}>{w.icon} {w.nombre}</p>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: C.muted }}><strong style={{ color: C.text }}>Banco:</strong> {w.banco}</p>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: C.muted }}><strong style={{ color: C.text }}>Reg.:</strong> {w.reg}</p>
                <p style={{ margin: '0 0 4px', fontSize: 11, color: C.muted }}><strong style={{ color: C.text }}>Límites:</strong> {w.limite}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.accent, fontFamily: 'Consolas, monospace' }}>📊 {w.asiento}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── GMF 4x1000 ─── */}
      {tab === 'gmf' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Info general */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ background: C.bgCard, border: `1px solid ${C.yellow}44`, borderTop: `3px solid ${C.yellow}`, borderRadius: 12, padding: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 900, color: C.yellow }}>⚡ GMF — Gravamen Movimientos Financieros</p>
              <div style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                <div><span style={{ color: C.muted }}>Tasa:</span> <strong style={{ color: C.text }}>0.4% (4 × 1.000)</strong></div>
                <div><span style={{ color: C.muted }}>Base legal:</span> <span style={{ color: C.accent }}>{GMF_INFO.baseLegal}</span></div>
                <div><span style={{ color: C.muted }}>Cuenta PUC gasto:</span> <span style={{ color: C.accent, fontFamily: 'Consolas, monospace' }}>{GMF_INFO.cuentaPUC_gasto} — Gasto GMF</span></div>
                <div><span style={{ color: C.muted }}>Cuenta PUC pasivo:</span> <span style={{ color: C.accent, fontFamily: 'Consolas, monospace' }}>{GMF_INFO.cuentaPUC_pasivo} — GMF por pagar</span></div>
                <div><span style={{ color: C.muted }}>¿Deducible de renta?</span> <strong style={{ color: C.red }}>NO — Art. 115 ET (excepto 50% si pagado en actividades comerciales)</strong></div>
                <div style={{ marginTop: 6, fontSize: 11, color: C.muted, background: `${C.red}10`, border: `1px solid ${C.red}33`, borderRadius: 6, padding: '6px 10px' }}>
                  {GMF_INFO.descripcion}
                </div>
              </div>
            </div>

            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.green }}>✅ Exenciones GMF (Art. 879 ET)</p>
              {GMF_INFO.exenciones.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, fontSize: 11, color: C.muted }}>
                  <span style={{ color: C.green, fontWeight: 700 }}>✓</span> {e}
                </div>
              ))}
            </div>
          </div>

          {/* Asiento GMF */}
          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: C.text }}>📊 Asiento PUC Colombia — GMF 4x1000</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { titulo: 'Ejemplo: Pago a proveedor por $ 1.000.000', lineas: [
                  { cuenta: '519595', nombre: 'Gasto GMF 4x1000', debe: '$ 4.000', haber: '—', nota: '0.4% × $1.000.000' },
                  { cuenta: '1110', nombre: 'Bancos (débito automático GMF)', debe: '—', haber: '$ 4.000', nota: 'El banco descuenta automáticamente' },
                ]},
                { titulo: 'Pago nómina $ 5.000.000 — GMF sobre transferencia', lineas: [
                  { cuenta: '2610/2620', nombre: 'Cesantías/Prima/Deducciones', debe: '$ 5.000.000', haber: '—', nota: 'Total nómina bruta' },
                  { cuenta: '1110', nombre: 'Bancos (neto pagado)', debe: '—', haber: '$ 4.980.000', nota: 'Neto pagado a empleado' },
                  { cuenta: '519595', nombre: 'Gasto GMF 4x1000', debe: '$ 20.000', haber: '—', nota: '0.4% × $5.000.000' },
                  { cuenta: '1110', nombre: 'Bancos (débito GMF)', debe: '—', haber: '$ 20.000', nota: 'Automático banco' },
                ]},
              ].map((ej, ei) => (
                <div key={ei} style={{ background: C.bgRow, borderRadius: 8, padding: 12 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: C.accent }}>{ej.titulo}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 120px 1fr', gap: 4, fontSize: 11 }}>
                    <span style={{ color: C.dim, fontWeight: 700 }}>CUENTA</span>
                    <span style={{ color: C.dim, fontWeight: 700 }}>NOMBRE</span>
                    <span style={{ color: C.dim, fontWeight: 700 }}>DÉBITO</span>
                    <span style={{ color: C.dim, fontWeight: 700 }}>CRÉDITO</span>
                    <span style={{ color: C.dim, fontWeight: 700 }}>NOTA</span>
                    {ej.lineas.map((l, li) => (<React.Fragment key={li}>
                      <span style={{ color: C.accent, fontFamily: 'Consolas, monospace' }}>{l.cuenta}</span>
                      <span style={{ color: C.text }}>{l.nombre}</span>
                      <span style={{ color: C.green, fontFamily: 'Consolas, monospace' }}>{l.debe}</span>
                      <span style={{ color: C.red, fontFamily: 'Consolas, monospace' }}>{l.haber}</span>
                      <span style={{ color: C.dim }}>{l.nota}</span>
                    </React.Fragment>))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── ASIENTOS PUC ─── */}
      {tab === 'asientos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ASIENTOS_PUC.map(a => (
            <div key={a.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpenAsiento(openAsiento === a.id ? '' : a.id)} style={{
                width: '100%', padding: '12px 16px', background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: C.text }}>{a.titulo}</p>
                  <p style={{ margin: '0 0 2px', fontSize: 11, color: C.muted }}>{a.descripcion}</p>
                  <span style={{ fontSize: 10, color: C.accent, fontFamily: 'Consolas, monospace' }}>📋 {a.normativa}</span>
                </div>
                <span style={{ color: C.dim, fontSize: 16, marginTop: 2 }}>{openAsiento === a.id ? '▲' : '▼'}</span>
              </button>

              {openAsiento === a.id && (
                <div style={{ padding: '0 16px 16px' }}>
                  {a.alerta && (
                    <div style={{ background: `${C.yellow}12`, border: `1px solid ${C.yellow}33`, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: C.yellow }}>
                      {a.alerta}
                    </div>
                  )}
                  <div style={{ background: C.bgRow, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 1fr', padding: '8px 12px', background: '#030810',
                      fontSize: 10, fontWeight: 700, color: C.dim, gap: 4 }}>
                      <span>CTA. PUC</span><span>NOMBRE CUENTA</span><span style={{ color: C.green }}>DÉBITO</span><span style={{ color: C.red }}>CRÉDITO</span><span>NOTA</span>
                    </div>
                    {a.lineas.map((l, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 1fr', padding: '8px 12px',
                        background: i % 2 === 0 ? C.bgRow : C.bgCard, borderBottom: `1px solid ${C.border}`,
                        fontSize: 11, gap: 4, alignItems: 'center' }}>
                        <span style={{ color: C.accent, fontFamily: 'Consolas, monospace', fontWeight: 700 }}>{l.cuenta}</span>
                        <span style={{ color: C.text }}>{l.nombre}</span>
                        <span style={{ color: l.debito !== '—' ? C.green : C.dim, fontFamily: 'Consolas, monospace' }}>{l.debito}</span>
                        <span style={{ color: l.credito !== '—' ? C.red : C.dim, fontFamily: 'Consolas, monospace' }}>{l.credito}</span>
                        <span style={{ color: C.dim, fontSize: 10 }}>{l.nota}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── RETEFUENTE 2026 ─── */}
      {tab === 'retefuente' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: `${C.blue}10`, border: `1px solid ${C.blue}33`, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: C.muted }}>
            <strong style={{ color: C.accent }}>📋 Retención en la Fuente 2026</strong> — UVT 2026: <strong style={{ color: C.text }}>$47.065</strong> ·
            Declaración mensual F350 DIAN · Cuenta PUC <span style={{ color: C.accent, fontFamily: 'Consolas, monospace' }}>2365</span>
          </div>

          <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr 1fr', padding: '10px 16px', background: '#030810',
              fontSize: 10, fontWeight: 700, color: C.dim }}>
              <span>CONCEPTO</span><span>TARIFA</span><span>CUANTÍA MÍNIMA</span><span>BASE LEGAL</span>
            </div>
            {RETEFUENTE_2026.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr 1fr', padding: '9px 16px', fontSize: 12,
                background: i % 2 === 0 ? C.bgCard : C.bgRow, borderBottom: `1px solid ${C.border}`, alignItems: 'center' }}>
                <span style={{ color: C.text }}>{r.concepto}</span>
                <span style={{ color: C.yellow, fontWeight: 800, fontFamily: 'Consolas, monospace' }}>{r.tarifa}</span>
                <span style={{ color: C.green, fontFamily: 'Consolas, monospace' }}>{r.cuantia}</span>
                <span style={{ color: C.accent, fontSize: 11 }}>{r.base}</span>
              </div>
            ))}
          </div>

          {/* ReteIVA y ReteICA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.purple }}>🟣 ReteIVA</p>
              <div style={{ display: 'grid', gap: 6, fontSize: 11, color: C.muted }}>
                <div><strong style={{ color: C.text }}>Tarifa:</strong> 15% del IVA (= 2.85% del valor bruto con IVA 19%)</div>
                <div><strong style={{ color: C.text }}>Quién la practica:</strong> Gran Contribuyente, entidades públicas, agentes retenedores DIAN</div>
                <div><strong style={{ color: C.text }}>Cuenta PUC quien la sufre:</strong> <span style={{ color: C.accent, fontFamily: 'Consolas, monospace' }}>2367 ReteIVA a favor</span></div>
                <div><strong style={{ color: C.text }}>Cuenta PUC quien la practica:</strong> <span style={{ color: C.accent, fontFamily: 'Consolas, monospace' }}>2367 ReteIVA por pagar</span></div>
                <div><strong style={{ color: C.text }}>Declaración:</strong> Formulario 300 DIAN (bimestral)</div>
                <div><strong style={{ color: C.text }}>Base legal:</strong> Art. 437-2 ET</div>
              </div>
            </div>
            <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.orange }}>🟠 ReteICA</p>
              <div style={{ display: 'grid', gap: 6, fontSize: 11, color: C.muted }}>
                <div><strong style={{ color: C.text }}>Bogotá:</strong> 11.04‰ servicios / 4.14‰ industria / 6.9‰ comercio</div>
                <div><strong style={{ color: C.text }}>Medellín:</strong> 5‰ a 10‰ según actividad</div>
                <div><strong style={{ color: C.text }}>Quién la practica:</strong> Grandes contribuyentes designados por municipio</div>
                <div><strong style={{ color: C.text }}>Cuenta PUC:</strong> <span style={{ color: C.accent, fontFamily: 'Consolas, monospace' }}>2368 ReteICA</span></div>
                <div><strong style={{ color: C.text }}>Declaración:</strong> Declaración ICA municipal (bimestral Bogotá)</div>
                <div><strong style={{ color: C.text }}>Base legal:</strong> Ley 14/1983 · Acuerdo municipal</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NormativasBancarias;
