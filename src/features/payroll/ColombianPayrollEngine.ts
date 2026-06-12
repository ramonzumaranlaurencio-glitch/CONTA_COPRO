/**
 * ColombianPayrollEngine — Motor de nómina Colombia
 * Cumple: CST · Ley 100/1993 · Ley 1607/2012 · Decreto 1072/2015
 * Ministerio del Trabajo · UGPP · DIAN · Superintendencia Financiera
 * ─────────────────────────────────────────────────────────────────
 * SMMLV 2025: $1.423.500 (Decreto 2361/2024)
 * SMMLV 2026: pendiente decreto (estimado $1.520.000 — actualizar en enero)
 * Auxilio Transporte 2025: $200.000
 * UVT 2026: $47.065
 */

// ─── PARÁMETROS LEGALES VIGENTES ─────────────────────────────────────────────
export const PARAMETROS_COLOMBIA_2026 = {
  smmlv:                1_520_000,    // Estimado — actualizar con decreto enero 2026
  auxilioTransporte:      212_000,    // Estimado 2026 (2025: $200.000)
  uvt:                    47_065,     // UVT 2026 DIAN
  limiteAuxTransporte: 2,             // Aplica si salario <= 2 SMMLV

  // AFP / Pensiones (Art. 20 Ley 100/1993)
  afpEmpleado:         0.04,          // 4%
  afpEmpleador:        0.12,          // 12%
  totalAfp:            0.16,          // 16% total

  // EPS / Salud (Art. 204 Ley 100/1993)
  epsEmpleado:         0.04,          // 4%
  epsEmpleador:        0.085,         // 8.5%
  totalEps:            0.125,         // 12.5% total

  // Fondo Solidaridad Pensional (Art. 27 Ley 100/1993)
  solidaridadBase:     0.01,          // 1% si salario >= 4 SMMLV
  solidaridadAdd1:     0.005,         // +0.5% adicional si >= 16 SMMLV
  solidaridadAdd2:     0.01,          // +1% adicional si >= 17 SMMLV
  solidaridadAdd3:     0.012,         // +1.2% si >= 18 SMMLV
  solidaridadAdd4:     0.014,         // +1.4% si >= 19 SMMLV
  solidaridadAdd5:     0.016,         // +1.6% si >= 20 SMMLV

  // CCF — Caja de Compensación Familiar (Ley 21/1982)
  ccf: 0.04,                          // 4% empleador

  // SENA / ICBF (exonerados si salario < 10 SMMLV — Ley 1607/2012 Art. 65)
  sena: 0.02,                         // 2% empleador
  icbf: 0.03,                         // 3% empleador
  limiteSenaIcbf: 10,                 // Exonerados si < 10 SMMLV

  // Prestaciones sociales (CST)
  cesantias:           1 / 12,        // 8.33% mensual (1 mes/año)
  intCesantias:        0.12,          // 12% anual sobre saldo cesantías
  prima:               1 / 12,        // 8.33% mensual (2 pagos: jun y dic)
  vacaciones:          15 / 360,      // 4.17% mensual (15 días/año)

  // Horas extras (Art. 168 CST)
  recHEDiurna:         0.25,          // +25% del valor hora ordinaria
  recHENocturna:       0.75,          // +75%
  recHEDominicalDiurna: 0.75,         // +75%
  recHEDominicalNocturna: 1.10,       // +110%
  recNocturno:         0.35,          // +35% recargo nocturno (no hora extra)
  recDominicalDiurno:  0.75,          // +75% recargo dominical diurno
  recDominicalNocturno: 1.10,         // +110%

  // Salario integral (Art. 132 CST)
  minimoIntegral:      10,            // >= 10 SMMLV
  factorPrestacional:  0.30,          // 30% del salario integral
  baseCalcIntegral:    0.70,          // Base para aportes = 70% del salario integral

  // ReteFuente rentas laborales (Art. 383 ET)
  rentaExentaPct:      0.25,          // 25% del ingreso laboral
  rentaExentaMaxUvt:   240,           // Máximo 240 UVT/mes
  deduccionDependientes: 0.10,        // 10% del ingreso
  deduccionDepMaxUvt:  32,            // Máximo 32 UVT/mes

  // ARL por clase de riesgo (Decreto 1607/2002)
  arlClases: {
    I:   0.00348,   // 0.348% — Oficinas, comercio, servicios
    II:  0.00435,   // 0.435% — Procesos industriales leves
    III: 0.00783,   // 0.783% — Manufactura, construcción leve
    IV:  0.01044,   // 1.044% — Construcción, agricultura
    V:   0.08700,   // 8.700% — Minería subterránea, explosivos
  } as Record<string, number>,
};

// ─── TIPOS ───────────────────────────────────────────────────────────────────
export type TipoContrato = 'INDEFINIDO' | 'TERMINO_FIJO' | 'OBRA_LABOR' | 'APRENDIZAJE';
export type TipoSalario  = 'ORDINARIO' | 'INTEGRAL';
export type ClaseRiesgoArl = 'I' | 'II' | 'III' | 'IV' | 'V';
export type SistemaPension = 'AFP_PORVENIR' | 'AFP_PROTECCION' | 'AFP_COLFONDOS' | 'AFP_OLD_MUTUAL' | 'RPM_COLPENSIONES';

export interface EmpleadoInput {
  // Datos básicos
  nombres:            string;
  apellidos:          string;
  cedula:             string;
  fecha_ingreso:      string;
  cargo:              string;
  area:               string;
  tipo_contrato:      TipoContrato;
  tipo_salario:       TipoSalario;

  // Salario y tiempo
  salario_basico:     number;         // Mensual en COP
  dias_trabajados:    number;         // 0-30
  horas_extras_diurnas:    number;
  horas_extras_nocturnas:  number;
  horas_extras_dominicales_diurnas:  number;
  horas_extras_dominicales_nocturnas: number;
  dias_recargo_nocturno:   number;
  dias_recargo_dominical_diurno: number;

  // Seguridad social
  sistema_pension:    SistemaPension;
  eps:                string;
  arl_clase:          ClaseRiesgoArl;
  caja_compensacion:  string;

  // Deducciones adicionales
  libranza:           number;
  adelanto_nomina:    number;
  otras_deducciones:  number;

  // Ingresos adicionales
  bonificaciones_constitutivas:    number;  // Constitutivas de salario
  bonificaciones_no_constitutivas: number;  // No constitutivas
  comisiones:         number;

  // Incapacidades y ausencias
  dias_incapacidad:   number;
  dias_licencia_remunerada: number;
  dias_licencia_no_remunerada: number;
  dias_vacaciones:    number;

  // Periodo
  anio:  number;
  mes:   number;        // 1-12
}

export interface LiquidacionNomina {
  // ── DEVENGADO ──────────────────────────────────────────────────
  salario_proporcional:    number;   // Salario × días_trabajados/30
  auxilio_transporte:      number;   // 0 si > 2 SMMLV o salario integral
  horas_extras_diurnas_val:       number;
  horas_extras_nocturnas_val:     number;
  horas_extras_dom_diurnas_val:   number;
  horas_extras_dom_noct_val:      number;
  recargo_nocturno_val:           number;
  recargo_dominical_val:          number;
  bonificaciones_constitutivas:   number;
  bonificaciones_no_constitutivas: number;
  comisiones:              number;
  incapacidad_val:         number;  // EPS paga desde día 4, empleador días 1-3
  vacaciones_val:          number;
  total_devengado:         number;

  // ── DEDUCCIONES EMPLEADO ────────────────────────────────────────
  afp_empleado:            number;   // 4% salario
  eps_empleado:            number;   // 4% salario
  fondo_solidaridad:       number;   // 1%+ si >= 4 SMMLV
  retefuente:              number;   // Art. 383 ET
  libranza:                number;
  adelanto_nomina:         number;
  otras_deducciones:       number;
  total_deducciones:       number;

  // ── NETO A PAGAR ───────────────────────────────────────────────
  neto_pagar:              number;

  // ── APORTES EMPLEADOR (no descuentan al empleado) ──────────────
  afp_empleador:           number;   // 12%
  eps_empleador:           number;   // 8.5%
  arl:                     number;   // Según clase I-V
  ccf:                     number;   // 4%
  sena:                    number;   // 2% (0 si exonerado)
  icbf:                    number;   // 3% (0 si exonerado)
  total_aportes_empleador: number;

  // ── COSTO TOTAL EMPLEADOR ──────────────────────────────────────
  costo_total_empleador:   number;   // Devengado + aportes empleador + provisiones

  // ── PROVISIONES MENSUALES ──────────────────────────────────────
  provision_cesantias:     number;   // 8.33% devengado + aux transporte
  provision_int_cesantias: number;   // 1% mensual del saldo cesantías
  provision_prima:         number;   // 8.33% devengado + aux transporte
  provision_vacaciones:    number;   // 4.17% salario básico
  total_provisiones:       number;

  // ── ASIENTOS PUC ──────────────────────────────────────────────
  asientos: AsientoPUC[];

  // ── ALERTAS ────────────────────────────────────────────────────
  alertas: string[];

  // ── METADATOS ──────────────────────────────────────────────────
  params: typeof PARAMETROS_COLOMBIA_2026;
  base_calculo_seguridad:  number;   // Base para AFP/EPS (salario o 70% integral)
  aplica_auxilio_transporte: boolean;
  exonerado_sena_icbf:     boolean;
  hora_ordinaria_valor:    number;
}

export interface AsientoPUC {
  cuenta: string;
  nombre: string;
  debito: number;
  credito: number;
  nota?: string;
}

// ─── MOTOR PRINCIPAL ─────────────────────────────────────────────────────────
export function liquidarNomina(emp: EmpleadoInput): LiquidacionNomina {
  const P = PARAMETROS_COLOMBIA_2026;
  const alertas: string[] = [];

  // ── Validaciones iniciales ───────────────────────────────────────
  if (emp.salario_basico < P.smmlv && emp.tipo_salario === 'ORDINARIO') {
    alertas.push(`⚠️ Salario $${emp.salario_basico.toLocaleString('es-CO')} está por debajo del SMMLV 2026 ($${P.smmlv.toLocaleString('es-CO')}). Infracción Art. 145 CST.`);
  }
  if (emp.tipo_salario === 'INTEGRAL' && emp.salario_basico < P.smmlv * 10) {
    alertas.push(`⚠️ Salario integral debe ser >= 10 SMMLV ($${(P.smmlv * 10).toLocaleString('es-CO')}). Art. 132 CST.`);
  }
  if (emp.dias_trabajados < 0 || emp.dias_trabajados > 30) {
    alertas.push('⚠️ Días trabajados debe estar entre 0 y 30.');
  }

  const esIntegral = emp.tipo_salario === 'INTEGRAL';
  const diasTrab = Math.min(Math.max(emp.dias_trabajados, 0), 30);

  // ── Base de cálculo ──────────────────────────────────────────────
  const baseSeguridad = esIntegral ? emp.salario_basico * P.baseCalcIntegral : emp.salario_basico;
  const horaOrdinaria = emp.salario_basico / 30 / 8; // Valor hora ordinaria

  // ── DEVENGADO ────────────────────────────────────────────────────
  const salarioProporcional = emp.salario_basico * (diasTrab / 30);

  // Auxilio de transporte (solo salario ordinario <= 2 SMMLV, días proporcional)
  const aplicaAux = !esIntegral && emp.salario_basico <= P.smmlv * P.limiteAuxTransporte;
  const auxilioTransporte = aplicaAux ? P.auxilioTransporte * (diasTrab / 30) : 0;

  // Horas extras
  const heDiv   = emp.horas_extras_diurnas       * horaOrdinaria * (1 + P.recHEDiurna);
  const heNoc   = emp.horas_extras_nocturnas      * horaOrdinaria * (1 + P.recHENocturna);
  const heDomDi = emp.horas_extras_dominicales_diurnas  * horaOrdinaria * (1 + P.recHEDominicalDiurna);
  const heDomNo = emp.horas_extras_dominicales_nocturnas * horaOrdinaria * (1 + P.recHEDominicalNocturna);

  // Recargos (sin hora extra)
  const recNoc = emp.dias_recargo_nocturno        * (emp.salario_basico / 30) * P.recNocturno;
  const recDom = emp.dias_recargo_dominical_diurno * (emp.salario_basico / 30) * P.recDominicalDiurno;

  // Incapacidad: empleador paga días 1-3 al 100%; EPS paga 66.67% días 4-90
  const valDia = emp.salario_basico / 30;
  const diasIncEmp = Math.min(emp.dias_incapacidad, 3);
  const incapacidadVal = diasIncEmp * valDia;
  if (emp.dias_incapacidad > 3) {
    alertas.push(`ℹ️ Días de incapacidad > 3: EPS ${emp.eps} paga los días ${4}-${emp.dias_incapacidad} al 66.67% (Art. 227 CST / Art. 227 ET).`);
  }

  // Vacaciones (50% salario básico proporcional)
  const vacacionesVal = emp.dias_vacaciones > 0
    ? (emp.salario_basico / 30) * emp.dias_vacaciones * 0.5 * 2  // Art. 192 CST
    : 0;

  const totalDevengado = round(
    salarioProporcional + auxilioTransporte + heDiv + heNoc + heDomDi + heDomNo
    + recNoc + recDom + emp.bonificaciones_constitutivas
    + emp.bonificaciones_no_constitutivas + emp.comisiones
    + incapacidadVal + vacacionesVal
  );

  // ── DEDUCCIONES EMPLEADO ──────────────────────────────────────────
  const afpEmpleado  = round(baseSeguridad * P.afpEmpleado * (diasTrab / 30));
  const epsEmpleado  = round(baseSeguridad * P.epsEmpleado * (diasTrab / 30));

  // Fondo solidaridad (1% si salario >= 4 SMMLV)
  let fondoSolidaridad = 0;
  if (baseSeguridad >= P.smmlv * 4) {
    fondoSolidaridad = baseSeguridad * P.solidaridadBase;
    if (baseSeguridad >= P.smmlv * 16) fondoSolidaridad += baseSeguridad * P.solidaridadAdd1;
    if (baseSeguridad >= P.smmlv * 17) fondoSolidaridad += baseSeguridad * P.solidaridadAdd2;
    if (baseSeguridad >= P.smmlv * 18) fondoSolidaridad += baseSeguridad * P.solidaridadAdd3;
    if (baseSeguridad >= P.smmlv * 19) fondoSolidaridad += baseSeguridad * P.solidaridadAdd4;
    if (baseSeguridad >= P.smmlv * 20) fondoSolidaridad += baseSeguridad * P.solidaridadAdd5;
    fondoSolidaridad = round(fondoSolidaridad * (diasTrab / 30));
  }

  // ReteFuente rentas laborales (Art. 383 ET — Procedimiento 1)
  const retefuente = calcularRetefuenteLaboral(totalDevengado, P);
  if (retefuente > 0) {
    alertas.push(`ℹ️ ReteFuente rentas laborales aplicada: $${retefuente.toLocaleString('es-CO')} (Art. 383 ET, Procedimiento 1).`);
  }

  const totalDeducciones = round(
    afpEmpleado + epsEmpleado + fondoSolidaridad + retefuente
    + emp.libranza + emp.adelanto_nomina + emp.otras_deducciones
  );

  const netoPagar = round(totalDevengado - totalDeducciones);

  // ── APORTES EMPLEADOR ─────────────────────────────────────────────
  const afpEmpleador = round(baseSeguridad * P.afpEmpleador * (diasTrab / 30));
  const epsEmpleador = round(baseSeguridad * P.epsEmpleador * (diasTrab / 30));
  const arl = round(baseSeguridad * (P.arlClases[emp.arl_clase] ?? P.arlClases.I) * (diasTrab / 30));
  const ccf = round(salarioProporcional * P.ccf);

  // SENA e ICBF: exonerados si salario < 10 SMMLV (Ley 1607/2012 Art. 65)
  const exoneradoSenaIcbf = baseSeguridad < P.smmlv * P.limiteSenaIcbf;
  const sena = exoneradoSenaIcbf ? 0 : round(salarioProporcional * P.sena);
  const icbf = exoneradoSenaIcbf ? 0 : round(salarioProporcional * P.icbf);

  if (exoneradoSenaIcbf) {
    alertas.push('✅ Exonerado SENA/ICBF/EPS empleador (Ley 1607/2012 Art. 65 — salario < 10 SMMLV).');
  }

  const totalAportesEmpleador = round(afpEmpleador + epsEmpleador + arl + ccf + sena + icbf);

  // ── PROVISIONES MENSUALES ─────────────────────────────────────────
  // Base provisiones = salario + auxilio transporte (Art. 249 CST para cesantías)
  const baseProvisiones = salarioProporcional + (aplicaAux ? auxilioTransporte : 0);

  const provCesantias   = round(baseProvisiones * P.cesantias);
  const provIntCes      = round(provCesantias * (P.intCesantias / 12));
  const provPrima       = round(baseProvisiones * P.prima);
  const provVacaciones  = round(salarioProporcional * P.vacaciones); // Solo salario básico
  const totalProvisiones = round(provCesantias + provIntCes + provPrima + provVacaciones);

  const costoTotalEmpleador = round(totalDevengado + totalAportesEmpleador + totalProvisiones);

  // ── ASIENTOS PUC COLOMBIA ─────────────────────────────────────────
  const asientos = generarAsientosPUC({
    salarioProporcional, auxilioTransporte, heDiv, heNoc, heDomDi, heDomNo,
    recNoc, recDom, bonConst: emp.bonificaciones_constitutivas,
    bonNoCon: emp.bonificaciones_no_constitutivas, comisiones: emp.comisiones,
    incapacidadVal, vacacionesVal,
    afpEmpleado, epsEmpleado, fondoSolidaridad, retefuente,
    libranza: emp.libranza, adelanto: emp.adelanto_nomina,
    otrasDed: emp.otras_deducciones,
    netoPagar,
    afpEmpleador, epsEmpleador, arl, ccf, sena, icbf,
    provCesantias, provIntCes, provPrima, provVacaciones,
  });

  // Alertas de compliance
  if (emp.horas_extras_diurnas + emp.horas_extras_nocturnas + emp.horas_extras_dominicales_diurnas + emp.horas_extras_dominicales_nocturnas > 48) {
    alertas.push('⚠️ Total horas extras supera 48 horas mensuales permitidas (Art. 165 CST). Requiere autorización Inspector Trabajo.');
  }

  return {
    salario_proporcional: salarioProporcional,
    auxilio_transporte: auxilioTransporte,
    horas_extras_diurnas_val: heDiv,
    horas_extras_nocturnas_val: heNoc,
    horas_extras_dom_diurnas_val: heDomDi,
    horas_extras_dom_noct_val: heDomNo,
    recargo_nocturno_val: recNoc,
    recargo_dominical_val: recDom,
    bonificaciones_constitutivas: emp.bonificaciones_constitutivas,
    bonificaciones_no_constitutivas: emp.bonificaciones_no_constitutivas,
    comisiones: emp.comisiones,
    incapacidad_val: incapacidadVal,
    vacaciones_val: vacacionesVal,
    total_devengado: totalDevengado,
    afp_empleado: afpEmpleado,
    eps_empleado: epsEmpleado,
    fondo_solidaridad: fondoSolidaridad,
    retefuente,
    libranza: emp.libranza,
    adelanto_nomina: emp.adelanto_nomina,
    otras_deducciones: emp.otras_deducciones,
    total_deducciones: totalDeducciones,
    neto_pagar: netoPagar,
    afp_empleador: afpEmpleador,
    eps_empleador: epsEmpleador,
    arl,
    ccf,
    sena,
    icbf,
    total_aportes_empleador: totalAportesEmpleador,
    costo_total_empleador: costoTotalEmpleador,
    provision_cesantias: provCesantias,
    provision_int_cesantias: provIntCes,
    provision_prima: provPrima,
    provision_vacaciones: provVacaciones,
    total_provisiones: totalProvisiones,
    asientos,
    alertas,
    params: P,
    base_calculo_seguridad: baseSeguridad,
    aplica_auxilio_transporte: aplicaAux,
    exonerado_sena_icbf: exoneradoSenaIcbf,
    hora_ordinaria_valor: horaOrdinaria,
  };
}

// ─── CÁLCULO RETEFUENTE RENTAS LABORALES (Art. 383 ET) ──────────────────────
function calcularRetefuenteLaboral(devengadoMensual: number, P: typeof PARAMETROS_COLOMBIA_2026): number {
  const uvt = P.uvt;

  // Depuración del ingreso (Art. 387 ET)
  const rentaExentaMax = Math.min(devengadoMensual * P.rentaExentaPct, 240 * uvt);
  const dedDepMax      = Math.min(devengadoMensual * P.deduccionDependientes, 32 * uvt);
  const ingresoNetaGravable = Math.max(devengadoMensual - rentaExentaMax - dedDepMax, 0);

  // Convertir a UVT
  const ing_uvt = ingresoNetaGravable / uvt;

  // Tabla marginal Art. 383 ET 2026 (en UVT mensuales)
  // Rango UVT — Tarifa marginal — Descuento UVT
  const rangos = [
    { desde: 0,    hasta: 95,    tarifa: 0,    descuento_uvt: 0 },
    { desde: 95,   hasta: 150,   tarifa: 0.19, descuento_uvt: 18.05 },
    { desde: 150,  hasta: 360,   tarifa: 0.28, descuento_uvt: 31.55 },
    { desde: 360,  hasta: 640,   tarifa: 0.33, descuento_uvt: 49.55 },
    { desde: 640,  hasta: 945,   tarifa: 0.35, descuento_uvt: 62.35 },
    { desde: 945,  hasta: 2300,  tarifa: 0.37, descuento_uvt: 81.26 },
    { desde: 2300, hasta: Infinity, tarifa: 0.39, descuento_uvt: 127.26 },
  ];

  const rango = rangos.find(r => ing_uvt > r.desde && ing_uvt <= r.hasta);
  if (!rango || rango.tarifa === 0) return 0;

  const reteMensual = round((ing_uvt * rango.tarifa - rango.descuento_uvt) * uvt);
  return Math.max(reteMensual, 0);
}

// ─── GENERADOR ASIENTOS PUC ──────────────────────────────────────────────────
interface AsientosInput {
  salarioProporcional: number; auxilioTransporte: number;
  heDiv: number; heNoc: number; heDomDi: number; heDomNo: number;
  recNoc: number; recDom: number; bonConst: number; bonNoCon: number;
  comisiones: number; incapacidadVal: number; vacacionesVal: number;
  afpEmpleado: number; epsEmpleado: number; fondoSolidaridad: number;
  retefuente: number; libranza: number; adelanto: number; otrasDed: number;
  netoPagar: number; afpEmpleador: number; epsEmpleador: number;
  arl: number; ccf: number; sena: number; icbf: number;
  provCesantias: number; provIntCes: number; provPrima: number; provVacaciones: number;
}

function generarAsientosPUC(d: AsientosInput): AsientoPUC[] {
  const asientos: AsientoPUC[] = [];

  const totalGastoPersonal = d.salarioProporcional + d.auxilioTransporte
    + d.heDiv + d.heNoc + d.heDomDi + d.heDomNo
    + d.recNoc + d.recDom + d.bonConst + d.comisiones + d.vacacionesVal;

  // 1. Gasto de personal — Salario y devengado
  if (totalGastoPersonal > 0) {
    asientos.push({ cuenta: '510506', nombre: 'Sueldos y salarios', debito: round(d.salarioProporcional + d.bonConst + d.comisiones), credito: 0 });
    if (d.auxilioTransporte > 0) asientos.push({ cuenta: '510530', nombre: 'Auxilio de transporte', debito: d.auxilioTransporte, credito: 0, nota: 'Hasta 2 SMMLV (Art. 7 Ley 1/1963)' });
    if (d.heDiv + d.heNoc + d.heDomDi + d.heDomNo > 0) asientos.push({ cuenta: '510512', nombre: 'Horas extras y recargos (Art. 168 CST)', debito: round(d.heDiv + d.heNoc + d.heDomDi + d.heDomNo + d.recNoc + d.recDom), credito: 0 });
    if (d.vacacionesVal > 0) asientos.push({ cuenta: '510527', nombre: 'Vacaciones disfrutadas (Art. 186 CST)', debito: d.vacacionesVal, credito: 0 });
  }

  // 2. Provisiones empleador
  if (d.provCesantias > 0) asientos.push({ cuenta: '510518', nombre: 'Gasto provisión cesantías (8.33% — Art. 249 CST)', debito: d.provCesantias, credito: 0 });
  if (d.provIntCes > 0) asientos.push({ cuenta: '510519', nombre: 'Gasto intereses sobre cesantías (12% anual — Art. 99 Ley 50/1990)', debito: d.provIntCes, credito: 0 });
  if (d.provPrima > 0) asientos.push({ cuenta: '510521', nombre: 'Gasto provisión prima de servicios (8.33% — Art. 306 CST)', debito: d.provPrima, credito: 0 });
  if (d.provVacaciones > 0) asientos.push({ cuenta: '510527', nombre: 'Gasto provisión vacaciones (4.17% — Art. 186 CST)', debito: d.provVacaciones, credito: 0 });

  // 3. Aportes parafiscales empleador
  if (d.afpEmpleador > 0) asientos.push({ cuenta: '510524', nombre: 'Gasto AFP empleador 12% (Art. 20 Ley 100/1993)', debito: d.afpEmpleador, credito: 0 });
  if (d.epsEmpleador > 0) asientos.push({ cuenta: '510522', nombre: 'Gasto EPS empleador 8.5% (Art. 204 Ley 100/1993)', debito: d.epsEmpleador, credito: 0 });
  if (d.arl > 0) asientos.push({ cuenta: '510523', nombre: 'Gasto ARL empleador (Decreto 1607/2002)', debito: d.arl, credito: 0 });
  if (d.ccf > 0) asientos.push({ cuenta: '510525', nombre: 'Gasto CCF 4% (Ley 21/1982)', debito: d.ccf, credito: 0 });
  if (d.sena > 0) asientos.push({ cuenta: '510510', nombre: 'Gasto SENA 2% (Ley 21/1982)', debito: d.sena, credito: 0 });
  if (d.icbf > 0) asientos.push({ cuenta: '510515', nombre: 'Gasto ICBF 3% (Ley 21/1982)', debito: d.icbf, credito: 0 });

  // 4. Pasivos empleado (deducciones)
  asientos.push({ cuenta: '2405', nombre: 'AFP pensiones por pagar (4% empleado + 12% empleador)', debito: 0, credito: round(d.afpEmpleado + d.afpEmpleador), nota: 'Pago vía PILA antes del 21' });
  asientos.push({ cuenta: '2406', nombre: 'EPS salud por pagar (4% empleado + 8.5% empleador)', debito: 0, credito: round(d.epsEmpleado + d.epsEmpleador), nota: 'Pago vía PILA antes del 21' });
  if (d.arl > 0) asientos.push({ cuenta: '2407', nombre: 'ARL por pagar (empleador)', debito: 0, credito: d.arl });
  if (d.ccf > 0) asientos.push({ cuenta: '2413', nombre: 'CCF por pagar (4%)', debito: 0, credito: d.ccf });
  if (d.sena > 0) asientos.push({ cuenta: '2414', nombre: 'SENA por pagar (2%)', debito: 0, credito: d.sena });
  if (d.icbf > 0) asientos.push({ cuenta: '2415', nombre: 'ICBF por pagar (3%)', debito: 0, credito: d.icbf });
  if (d.fondoSolidaridad > 0) asientos.push({ cuenta: '2409', nombre: 'Fondo solidaridad pensional empleado', debito: 0, credito: d.fondoSolidaridad });
  if (d.retefuente > 0) asientos.push({ cuenta: '2365', nombre: 'ReteFuente rentas laborales (Art. 383 ET)', debito: 0, credito: d.retefuente });
  if (d.libranza > 0) asientos.push({ cuenta: '2510', nombre: 'Libranzas y créditos empleado', debito: 0, credito: d.libranza });
  if (d.adelanto > 0) asientos.push({ cuenta: '1406', nombre: 'Anticipos de nómina a empleados', debito: 0, credito: d.adelanto, nota: 'Descuenta anticipo previamente otorgado' });

  // 5. Pasivos provisiones
  if (d.provCesantias > 0) asientos.push({ cuenta: '2610', nombre: 'Cesantías consolidadas por consignar', debito: 0, credito: d.provCesantias, nota: 'Consignar fondo antes del 14 de febrero' });
  if (d.provIntCes > 0) asientos.push({ cuenta: '2615', nombre: 'Intereses sobre cesantías por pagar', debito: 0, credito: d.provIntCes, nota: 'Pago directo al trabajador enero' });
  if (d.provPrima > 0) asientos.push({ cuenta: '2620', nombre: 'Prima de servicios por pagar', debito: 0, credito: d.provPrima, nota: 'Jun y Dic (Art. 306 CST)' });
  if (d.provVacaciones > 0) asientos.push({ cuenta: '2625', nombre: 'Vacaciones consolidadas por pagar', debito: 0, credito: d.provVacaciones });

  // 6. Pago neto empleado
  asientos.push({ cuenta: '2610', nombre: 'Nóminas por pagar (neto empleado)', debito: 0, credito: d.netoPagar, nota: 'Transferencia Nequi/Daviplata/Cuenta bancaria' });
  asientos.push({ cuenta: '1110', nombre: 'Bancos — pago nómina', debito: 0, credito: d.netoPagar, nota: 'Débito al banco el día de pago' });

  return asientos;
}

// ─── UTILIDADES ──────────────────────────────────────────────────────────────
function round(n: number): number {
  return Math.round(n);
}

// ─── CATÁLOGOS ───────────────────────────────────────────────────────────────
export const AFPs = [
  { id: 'AFP_PORVENIR',    nombre: 'Porvenir (Grupo Aval)', tipo: 'RAIS' },
  { id: 'AFP_PROTECCION',  nombre: 'Protección (Bancolombia/Sura)', tipo: 'RAIS' },
  { id: 'AFP_COLFONDOS',   nombre: 'Colfondos (Scotiabank Colpatria)', tipo: 'RAIS' },
  { id: 'AFP_OLD_MUTUAL',  nombre: 'Old Mutual Colombia', tipo: 'RAIS' },
  { id: 'RPM_COLPENSIONES', nombre: 'Colpensiones (RPM — público)', tipo: 'RPM' },
];

export const EPSs = [
  'Sura EPS', 'Sanitas', 'Nueva EPS', 'Compensar', 'Medimás',
  'Salud Total', 'Famisanar', 'Coosalud', 'Mutualser', 'Aliansalud',
];

export const CCFs = [
  { id: 'COMPENSAR',   nombre: 'Compensar', ciudad: 'Bogotá D.C.' },
  { id: 'CAFAM',       nombre: 'Cafam', ciudad: 'Bogotá D.C.' },
  { id: 'COLSUBSIDIO', nombre: 'Colsubsidio', ciudad: 'Bogotá D.C.' },
  { id: 'COMFENALCO_ANT', nombre: 'Comfenalco Antioquia', ciudad: 'Medellín' },
  { id: 'COMFAMA',     nombre: 'Comfama', ciudad: 'Medellín' },
  { id: 'COMFANDI',    nombre: 'Comfandi', ciudad: 'Cali' },
  { id: 'COMFACAUCA',  nombre: 'Comfacauca', ciudad: 'Popayán' },
  { id: 'COMFAORIENTE', nombre: 'Comfaoriente', ciudad: 'Cúcuta' },
  { id: 'CAJASAN',     nombre: 'Cajasan', ciudad: 'Bucaramanga' },
  { id: 'COMBARRANQUILLA', nombre: 'Combarranquilla', ciudad: 'Barranquilla' },
];

export const CLASES_RIESGO_ARL: Record<ClaseRiesgoArl, { descripcion: string; ejemplos: string; tasa: string }> = {
  I:   { descripcion: 'Riesgo Mínimo',   tasa: '0.348%', ejemplos: 'Oficinas, bancos, centros de salud, comercio, call centers' },
  II:  { descripcion: 'Riesgo Bajo',     tasa: '0.435%', ejemplos: 'Procesos manufactureros leves, laboratorios, almacenes' },
  III: { descripcion: 'Riesgo Medio',    tasa: '0.783%', ejemplos: 'Manufactura, transporte terrestre, construcción de obras civiles leves' },
  IV:  { descripcion: 'Riesgo Alto',     tasa: '1.044%', ejemplos: 'Construcción, agricultura, operación de maquinaria pesada' },
  V:   { descripcion: 'Riesgo Máximo',   tasa: '8.700%', ejemplos: 'Minería subterránea, explosivos, aviación, buceo comercial' },
};

// ─── FORMATO MONEDA ──────────────────────────────────────────────────────────
export const fmtCOP = (n: number): string =>
  `$ ${Math.round(n).toLocaleString('es-CO')}`;
