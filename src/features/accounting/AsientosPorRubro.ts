/**
 * AsientosPorRubro — Motor de asientos contables PUC Colombia por sector/rubro
 * Basado en: PUC Decreto 2650/1993 · NIIF para Pymes · ET Colombia · Resoluciones DIAN
 * Rubros: COMERCIAL | SERVICIOS | CONSTRUCCION | FABRICACION | MINERIA | AGROPECUARIO | FINANCIERO
 */

export type Rubro =
  | 'COMERCIAL'
  | 'SERVICIOS'
  | 'CONSTRUCCION'
  | 'FABRICACION'
  | 'MINERIA'
  | 'AGROPECUARIO'
  | 'FINANCIERO'
  | 'SALUD'
  | 'EDUCACION';

export interface LineaAsiento {
  cuenta: string;
  nombre: string;
  tipo: 'DB' | 'CR';
  monto: 'variable' | string;
  nota?: string;
}

export interface PlantillaAsiento {
  id: string;
  titulo: string;
  descripcion: string;
  rubros: Rubro[];          // vacío = aplica a todos los rubros
  normativa: string;
  lineas: LineaAsiento[];
  gmf: boolean;             // true = genera GMF 4x1000 si hay movimiento bancario
  retefuente?: string;      // descripción de retención aplicable
}

// ─── ASIENTOS COMUNES (todos los rubros) ────────────────────────────────────
const ASIENTOS_COMUNES: PlantillaAsiento[] = [
  {
    id: 'venta_contado',
    titulo: 'Venta de contado — Factura Electrónica DIAN',
    descripcion: 'Venta gravada IVA 19% pagada al contado (Nequi/Daviplata/PSE/Efectivo)',
    rubros: [],
    normativa: 'Art. 420 ET · Art. 615 ET · Res. DIAN 042/2020',
    lineas: [
      { cuenta: '1110', nombre: 'Bancos / Nequi / Daviplata / PSE', tipo: 'DB', monto: 'Total factura', nota: 'PUC subcuenta según banco' },
      { cuenta: '4135', nombre: 'Ingresos por ventas', tipo: 'CR', monto: 'Base gravable', nota: '' },
      { cuenta: '2408', nombre: 'IVA generado (por pagar)', tipo: 'CR', monto: 'IVA 19%', nota: 'F300 bimestral DIAN' },
    ],
    gmf: true,
  },
  {
    id: 'venta_credito',
    titulo: 'Venta a crédito — Factura Electrónica DIAN',
    descripcion: 'Venta gravada IVA 19% a crédito — genera CXC',
    rubros: [],
    normativa: 'Art. 420 ET · Art. 488 ET',
    lineas: [
      { cuenta: '1305', nombre: 'Clientes (CXC)', tipo: 'DB', monto: 'Total factura', nota: '' },
      { cuenta: '4135', nombre: 'Ingresos por ventas', tipo: 'CR', monto: 'Base gravable', nota: '' },
      { cuenta: '2408', nombre: 'IVA generado', tipo: 'CR', monto: 'IVA 19%', nota: '' },
    ],
    gmf: false,
  },
  {
    id: 'cobro_cartera',
    titulo: 'Cobro de cartera — Pago cliente',
    descripcion: 'Recepción de pago de factura a crédito — con posible ReteFuente y ReteIVA',
    rubros: [],
    normativa: 'Art. 375 ET · Art. 437-2 ET · Art. 771-5 ET',
    lineas: [
      { cuenta: '1110', nombre: 'Bancos (Nequi/Daviplata/PSE/Transf.)', tipo: 'DB', monto: 'Valor recibido neto', nota: '' },
      { cuenta: '2365', nombre: 'ReteFuente sufrida', tipo: 'DB', monto: 'ReteFuente (si aplica)', nota: 'Si cliente es agente retenedor' },
      { cuenta: '2367', nombre: 'ReteIVA sufrida', tipo: 'DB', monto: 'ReteIVA 15% IVA (si aplica)', nota: 'Si cliente es Gran Contribuyente' },
      { cuenta: '1305', nombre: 'Clientes', tipo: 'CR', monto: 'Total factura', nota: '' },
    ],
    gmf: true,
    retefuente: 'Si el cliente es Gran Contribuyente o agente retenedor DIAN, practicar ReteFuente según concepto.',
  },
  {
    id: 'compra_fe',
    titulo: 'Compra con Factura Electrónica DIAN',
    descripcion: 'Registro de compra — IVA descontable cuenta 2408',
    rubros: [],
    normativa: 'Art. 468 ET · Art. 488 ET · Res. DIAN 042/2020',
    lineas: [
      { cuenta: '6135/513xxx', nombre: 'Costo/Gasto según naturaleza', tipo: 'DB', monto: 'Base gravable', nota: 'Ver tabla PUC por rubro' },
      { cuenta: '2408', nombre: 'IVA descontable', tipo: 'DB', monto: 'IVA 19%', nota: 'CUFE válido requerido' },
      { cuenta: '2205', nombre: 'Proveedores (CXP)', tipo: 'CR', monto: 'Total factura', nota: '' },
    ],
    gmf: false,
  },
  {
    id: 'pago_proveedor',
    titulo: 'Pago a proveedor — Transferencia / PSE',
    descripcion: 'Cancelación CXP con ReteFuente y GMF 4x1000',
    rubros: [],
    normativa: 'Art. 375 ET · Art. 871 ET · Art. 771-5 ET',
    lineas: [
      { cuenta: '2205', nombre: 'Proveedores', tipo: 'DB', monto: 'Total factura', nota: '' },
      { cuenta: '1110', nombre: 'Bancos', tipo: 'CR', monto: 'Neto pagado (Total - ReteFuente)', nota: '' },
      { cuenta: '2365', nombre: 'ReteFuente por pagar', tipo: 'CR', monto: 'ReteFuente practicada', nota: 'F350 mensual DIAN' },
      { cuenta: '519595', nombre: 'Gasto GMF 4x1000', tipo: 'DB', monto: '0.4% del pago', nota: 'No deducible renta Art. 115 ET' },
      { cuenta: '1110', nombre: 'Bancos (débito GMF)', tipo: 'CR', monto: '0.4% del pago', nota: 'Automático banco' },
    ],
    gmf: true,
    retefuente: 'Compras bienes: 3.5% · Servicios: 4% · Honorarios persona jurídica: 11%',
  },
  {
    id: 'gastos_bancarios',
    titulo: 'Gastos bancarios y comisiones',
    descripcion: 'Comisiones bancarias con IVA descontable y GMF',
    rubros: [],
    normativa: 'Art. 488 ET · Art. 871 ET',
    lineas: [
      { cuenta: '519595', nombre: 'Gastos bancarios y comisiones', tipo: 'DB', monto: 'Comisión bruta', nota: '' },
      { cuenta: '2408', nombre: 'IVA descontable (si el banco cobra IVA)', tipo: 'DB', monto: 'IVA 19% comisión', nota: '' },
      { cuenta: '1110', nombre: 'Bancos', tipo: 'CR', monto: 'Total descontado', nota: 'Automático en extracto' },
    ],
    gmf: true,
  },
];

// ─── ASIENTOS POR RUBRO ──────────────────────────────────────────────────────
const ASIENTOS_POR_RUBRO: PlantillaAsiento[] = [

  // ── COMERCIAL ──
  {
    id: 'comercial_costo_ventas',
    titulo: 'Costo de ventas — Comercio (PUC 6135)',
    descripcion: 'Registro del costo de mercancías vendidas — método promedio ponderado',
    rubros: ['COMERCIAL'],
    normativa: 'NIC 2 · Art. 64 ET (costo fiscal)',
    lineas: [
      { cuenta: '6135', nombre: 'Costo de ventas — mercancías', tipo: 'DB', monto: 'Costo promedio × unidades', nota: 'Inventario permanente' },
      { cuenta: '1430', nombre: 'Mercancías no fabricadas', tipo: 'CR', monto: 'Costo promedio × unidades', nota: 'Reduce inventario' },
    ],
    gmf: false,
  },
  {
    id: 'comercial_compra_mercancia',
    titulo: 'Compra mercancía para reventa',
    descripcion: 'Ingreso de inventario — método sistema permanente (NIC 2)',
    rubros: ['COMERCIAL'],
    normativa: 'NIC 2 · Art. 64 ET · Art. 488 ET',
    lineas: [
      { cuenta: '1430', nombre: 'Mercancías no fabricadas', tipo: 'DB', monto: 'Precio compra sin IVA', nota: 'Activo inventario' },
      { cuenta: '2408', nombre: 'IVA descontable', tipo: 'DB', monto: 'IVA 19%', nota: 'Solo si bien gravado' },
      { cuenta: '2205', nombre: 'Proveedores', tipo: 'CR', monto: 'Total factura', nota: '' },
    ],
    gmf: false,
  },
  {
    id: 'comercial_devolucion_ventas',
    titulo: 'Devolución de ventas — Nota Crédito DIAN',
    descripcion: 'Reversa parcial o total de venta con nota crédito electrónica (CUDE)',
    rubros: ['COMERCIAL'],
    normativa: 'Art. 484 ET · Res. DIAN 042/2020 (nota crédito)',
    lineas: [
      { cuenta: '4175', nombre: 'Devoluciones en ventas', tipo: 'DB', monto: 'Base gravable devuelta', nota: '' },
      { cuenta: '2408', nombre: 'IVA revertido', tipo: 'DB', monto: 'IVA devuelto', nota: 'Reduce IVA generado' },
      { cuenta: '1305', nombre: 'Clientes', tipo: 'CR', monto: 'Total nota crédito', nota: '' },
    ],
    gmf: false,
  },

  // ── SERVICIOS ──
  {
    id: 'servicios_honorarios',
    titulo: 'Facturación de honorarios profesionales',
    descripcion: 'Ingreso por prestación de servicios gravados IVA 19%',
    rubros: ['SERVICIOS'],
    normativa: 'Art. 420 ET · Art. 392 ET (ReteFuente 11%)',
    lineas: [
      { cuenta: '1305', nombre: 'Clientes', tipo: 'DB', monto: 'Total factura', nota: '' },
      { cuenta: '4145', nombre: 'Ingresos por prestación de servicios', tipo: 'CR', monto: 'Base gravable', nota: '' },
      { cuenta: '2408', nombre: 'IVA generado', tipo: 'CR', monto: 'IVA 19%', nota: '' },
    ],
    gmf: false,
    retefuente: 'Cliente practicará ReteFuente 11% (honorarios P.J.) o 10% (persona natural declarante) sobre base gravable.',
  },
  {
    id: 'servicios_cobro_con_retefuente',
    titulo: 'Cobro honorarios con ReteFuente sufrida',
    descripcion: 'Recepción de pago con ReteFuente 10%/11% y posible ReteIVA',
    rubros: ['SERVICIOS'],
    normativa: 'Art. 392 ET · Art. 437-2 ET',
    lineas: [
      { cuenta: '1110', nombre: 'Bancos', tipo: 'DB', monto: 'Valor neto recibido', nota: '' },
      { cuenta: '2365', nombre: 'ReteFuente honorarios sufrida', tipo: 'DB', monto: '10% o 11% base', nota: 'Descontado por cliente' },
      { cuenta: '2367', nombre: 'ReteIVA sufrida', tipo: 'DB', monto: '15% del IVA (si aplica)', nota: 'Si cliente es Gran Contrib.' },
      { cuenta: '1305', nombre: 'Clientes', tipo: 'CR', monto: 'Total factura', nota: '' },
    ],
    gmf: true,
  },

  // ── CONSTRUCCION ──
  {
    id: 'construccion_materiales',
    titulo: 'Compra materiales de construcción',
    descripcion: 'Ingreso de materiales a inventario para obra — cuentas de proyectos',
    rubros: ['CONSTRUCCION'],
    normativa: 'NIC 2 · NIIF 15 · Art. 64 ET',
    lineas: [
      { cuenta: '1435', nombre: 'Materias primas (cemento, acero, etc.)', tipo: 'DB', monto: 'Costo materiales', nota: 'Por proyecto/centro de costo' },
      { cuenta: '2408', nombre: 'IVA descontable', tipo: 'DB', monto: 'IVA 19%', nota: '' },
      { cuenta: '2205', nombre: 'Proveedores', tipo: 'CR', monto: 'Total', nota: '' },
    ],
    gmf: false,
  },
  {
    id: 'construccion_anticipo_contrato',
    titulo: 'Anticipo recibido de contrato de obra',
    descripcion: 'Anticipo de cliente — no es ingreso hasta ejecución (NIIF 15)',
    rubros: ['CONSTRUCCION'],
    normativa: 'NIIF 15 · Art. 27 ET (devengado)',
    lineas: [
      { cuenta: '1110', nombre: 'Bancos', tipo: 'DB', monto: 'Anticipo recibido', nota: '' },
      { cuenta: '2705', nombre: 'Anticipos y avances recibidos', tipo: 'CR', monto: 'Anticipo recibido', nota: 'Pasivo — no ingreso aún' },
    ],
    gmf: true,
  },
  {
    id: 'construccion_reconocer_ingreso',
    titulo: 'Reconocimiento ingreso por avance de obra (NIIF 15)',
    descripcion: 'Cuando se cumplen las obligaciones de desempeño — avance de obra',
    rubros: ['CONSTRUCCION'],
    normativa: 'NIIF 15 · Art. 27 ET',
    lineas: [
      { cuenta: '2705', nombre: 'Anticipos y avances recibidos', tipo: 'DB', monto: '% avance × contrato', nota: '' },
      { cuenta: '4152', nombre: 'Ingresos por contratos de construcción', tipo: 'CR', monto: '% avance × contrato', nota: '' },
      { cuenta: '7135', nombre: 'Costo de ventas construcción', tipo: 'DB', monto: 'Costo real del avance', nota: '' },
      { cuenta: '1435', nombre: 'Inventario materiales / obra en proceso', tipo: 'CR', monto: 'Costo real del avance', nota: '' },
    ],
    gmf: false,
  },

  // ── FABRICACION ──
  {
    id: 'fabricacion_produccion',
    titulo: 'Orden de producción — Costos de fabricación',
    descripcion: 'Acumulación de costos: materia prima, mano de obra, CIF',
    rubros: ['FABRICACION'],
    normativa: 'NIC 2 · Circular SFC · Decreto 2131/2012',
    lineas: [
      { cuenta: '1440', nombre: 'Productos en proceso', tipo: 'DB', monto: 'Total costos producción', nota: 'COS: MP + MOD + CIF' },
      { cuenta: '1435', nombre: 'Materias primas consumidas', tipo: 'CR', monto: 'Materias primas utilizadas', nota: '' },
      { cuenta: '7105', nombre: 'Mano de obra directa', tipo: 'CR', monto: 'Salario MOD', nota: '' },
      { cuenta: '7305', nombre: 'Costos indirectos de fabricación (CIF)', tipo: 'CR', monto: 'CIF aplicados', nota: 'Depreciación maquinaria, energía' },
    ],
    gmf: false,
  },
  {
    id: 'fabricacion_traslado_producto',
    titulo: 'Traslado Producción en Proceso → Producto Terminado',
    descripcion: 'Cuando se completa la producción',
    rubros: ['FABRICACION'],
    normativa: 'NIC 2 · Art. 64 ET',
    lineas: [
      { cuenta: '1445', nombre: 'Productos terminados', tipo: 'DB', monto: 'Costo total de producción', nota: '' },
      { cuenta: '1440', nombre: 'Productos en proceso', tipo: 'CR', monto: 'Costo total de producción', nota: '' },
    ],
    gmf: false,
  },
  {
    id: 'fabricacion_venta',
    titulo: 'Venta de producto fabricado — Costo de ventas manufactura',
    descripcion: 'Venta con FE DIAN + costo de ventas manufactura (PUC 7135)',
    rubros: ['FABRICACION'],
    normativa: 'NIC 2 · Art. 420 ET',
    lineas: [
      { cuenta: '1305', nombre: 'Clientes', tipo: 'DB', monto: 'Total factura', nota: '' },
      { cuenta: '4135', nombre: 'Ingresos por ventas productos fabricados', tipo: 'CR', monto: 'Base gravable', nota: '' },
      { cuenta: '2408', nombre: 'IVA generado', tipo: 'CR', monto: 'IVA 19%', nota: '' },
      { cuenta: '7135', nombre: 'Costo de ventas manufactura', tipo: 'DB', monto: 'Costo de producción unitario', nota: '' },
      { cuenta: '1445', nombre: 'Productos terminados', tipo: 'CR', monto: 'Costo de producción unitario', nota: '' },
    ],
    gmf: false,
  },

  // ── AGROPECUARIO ──
  {
    id: 'agropecuario_activos_biologicos',
    titulo: 'Activos biológicos — Semovientes / Cultivos (NIC 41)',
    descripcion: 'Valoración a valor razonable de activos biológicos',
    rubros: ['AGROPECUARIO'],
    normativa: 'NIC 41 · Art. 92 ET · NIIF plenas Colombia',
    lineas: [
      { cuenta: '1504', nombre: 'Semovientes / Activos biológicos', tipo: 'DB', monto: 'Valor razonable', nota: 'Ganado, cultivos permanentes' },
      { cuenta: '4260', nombre: 'Ganancia por cambio en valor razonable', tipo: 'CR', monto: 'Incremento VR', nota: 'Ingreso periodo NIC 41' },
    ],
    gmf: false,
  },

  // ── SALUD ──
  {
    id: 'salud_servicios_eps',
    titulo: 'Facturación servicios de salud a EPS/Aseguradora',
    descripcion: 'Prestación de servicios médicos — régimen especial IVA excluido',
    rubros: ['SALUD'],
    normativa: 'Art. 476 ET num. 1 (excluido IVA) · Res. 3047/2013 MINSALUD',
    lineas: [
      { cuenta: '1305', nombre: 'Clientes — EPS / Aseguradora', tipo: 'DB', monto: 'Valor servicio', nota: 'Sin IVA — excluido Art. 476 ET' },
      { cuenta: '4145', nombre: 'Ingresos — Prestación servicios salud', tipo: 'CR', monto: 'Valor servicio', nota: 'Excluido IVA' },
    ],
    gmf: false,
    retefuente: 'Servicios de salud: ReteFuente 4% si pagador es persona jurídica (Art. 392 ET).',
  },

  // ── EDUCACION ──
  {
    id: 'educacion_matrículas',
    titulo: 'Matrículas y pensiones — Excluidas de IVA',
    descripcion: 'Servicios educativos reconocidos por MEN — excluidos IVA Art. 476',
    rubros: ['EDUCACION'],
    normativa: 'Art. 476 ET num. 6 · Ley 30/1992',
    lineas: [
      { cuenta: '1305', nombre: 'Estudiantes / Padres de familia', tipo: 'DB', monto: 'Matrícula + pensión', nota: 'Sin IVA — excluido' },
      { cuenta: '4145', nombre: 'Ingresos — Servicios educativos', tipo: 'CR', monto: 'Valor matrícula', nota: '' },
    ],
    gmf: false,
  },
];

// ─── FUNCIÓN PRINCIPAL: obtener asientos por rubro ──────────────────────────
export function getAsientosByRubro(rubro: Rubro): PlantillaAsiento[] {
  const comunes = ASIENTOS_COMUNES;
  const especificos = ASIENTOS_POR_RUBRO.filter(
    a => a.rubros.length === 0 || a.rubros.includes(rubro)
  );
  return [...comunes, ...especificos];
}

export function getAllAsientos(): PlantillaAsiento[] {
  return [...ASIENTOS_COMUNES, ...ASIENTOS_POR_RUBRO];
}

// ─── MAPA CUENTAS PUC POR RUBRO ─────────────────────────────────────────────
export const PUC_POR_RUBRO: Record<Rubro, { ingreso: string; costo: string; inventario: string; label: string }> = {
  COMERCIAL:    { ingreso: '4135', costo: '6135', inventario: '1430', label: 'Mercancías no fabricadas' },
  SERVICIOS:    { ingreso: '4145', costo: '5105', inventario: '—', label: 'Prestación de servicios' },
  CONSTRUCCION: { ingreso: '4152', costo: '7135', inventario: '1435', label: 'Contratos de construcción' },
  FABRICACION:  { ingreso: '4135', costo: '7135', inventario: '1445', label: 'Productos terminados' },
  MINERIA:      { ingreso: '4135', costo: '7135', inventario: '1435', label: 'Minerales y materias primas' },
  AGROPECUARIO: { ingreso: '4135', costo: '7135', inventario: '1504', label: 'Activos biológicos NIC 41' },
  FINANCIERO:   { ingreso: '4210', costo: '5310', inventario: '—', label: 'Ingresos financieros' },
  SALUD:        { ingreso: '4145', costo: '5105', inventario: '1455', label: 'Servicios de salud' },
  EDUCACION:    { ingreso: '4145', costo: '5105', inventario: '—', label: 'Servicios educativos' },
};
