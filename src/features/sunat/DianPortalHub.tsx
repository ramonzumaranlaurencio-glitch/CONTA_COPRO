/**
 * DianPortalHub — Portal DIAN Colombia completo
 * Acceso a trámites · Biblioteca tributaria colombiana · Audio natural Google
 * Todos los planes (dian:true)
 */
import React, { useRef, useState } from 'react';

// ─── Paleta ────────────────────────────────────────────────────────────────
const C = {
  bg:     '#020812', bgCard: '#080f1f', bgRow: '#0b1525',
  border: '#1a3050', text:   '#e2eaf8', muted:  '#6e93b8',
  dim:    '#3d6080', accent: '#38bdf8', blue:   '#0078d4',
  green:  '#22c55e', yellow: '#FFCD00', red:    '#ef4444',
  purple: '#a855f7', orange: '#f97316', indigo: '#6366f1',
};

// ─── Motor de voz (Google TTS) ──────────────────────────────────────────────
let currentUtterance: SpeechSynthesisUtterance | null = null;

const speak = (text: string, onEnd?: () => void) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;

  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find(v => v.lang === 'es-CO' && /google/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name) && /male|hombre|jorge|pablo|diego/i.test(v.name)) ||
      voices.find(v => v.lang.startsWith('es') && /google/i.test(v.name)) ||
      voices.find(v => v.lang === 'es-CO') ||
      voices.find(v => v.lang.startsWith('es'));

    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.lang = 'es-CO'; utter.rate = 0.90; utter.pitch = 0.88; utter.volume = 0.85;
    if (onEnd) utter.onend = onEnd;
    currentUtterance = utter;
    window.speechSynthesis.speak(utter);
  };

  if (window.speechSynthesis.getVoices().length > 0) doSpeak();
  else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }; }
};

const stopAudio = () => { window.speechSynthesis?.cancel(); currentUtterance = null; };

// ─── Datos: Servicios DIAN Colombia ───────────────────────────────────────
const DIAN_SERVICIOS = [
  {
    categoria: 'Portal Muisca DIAN',
    icon: '🔐', color: C.blue,
    items: [
      { nombre: 'Muisca — Portal principal DIAN', url: 'https://muisca.dian.gov.co/', desc: 'Acceso a todos los servicios electrónicos de la DIAN · Requiere usuario y contraseña', sol: true },
      { nombre: 'Crear usuario Muisca', url: 'https://muisca.dian.gov.co/WebArquitectura/DefInscripcionUsuario.faces', desc: 'Registrarse como usuario en el portal Muisca · Requiere NIT y RUT activo', sol: false },
      { nombre: 'Declaraciones y pagos', url: 'https://muisca.dian.gov.co/', desc: 'F300 IVA, F350 Retención, F110 Renta, F490 Pago · Requiere Muisca', sol: true },
      { nombre: 'Portal DIAN principal', url: 'https://www.dian.gov.co/', desc: 'Guías, normativas, resoluciones y comunicados DIAN · Público', sol: false },
    ],
  },
  {
    categoria: 'Facturación Electrónica',
    icon: '📄', color: C.green,
    items: [
      { nombre: 'Portal Factura Electrónica DIAN', url: 'https://www.dian.gov.co/tramitesservicios/Factura_Electronica/', desc: 'Información general sobre facturación electrónica en Colombia · Público', sol: false },
      { nombre: 'Consultar validez de factura (CUFE)', url: 'https://catalogo-vpfe.dian.gov.co/User/Login', desc: 'Verificar si una factura electrónica tiene CUFE válido · Público', sol: false },
      { nombre: 'Habilitación como facturador electrónico', url: 'https://www.dian.gov.co/tramitesservicios/Factura_Electronica/Paginas/Habilitacion.aspx', desc: 'Habilitar empresa para emitir facturas electrónicas · Requiere Muisca', sol: true },
      { nombre: 'Resolución de facturación (prefijos)', url: 'https://muisca.dian.gov.co/', desc: 'Solicitar y consultar resoluciones de numeración de facturas · Requiere Muisca', sol: true },
    ],
  },
  {
    categoria: 'Consultas RUT / NIT',
    icon: '🔍', color: C.accent,
    items: [
      { nombre: 'Consulta estado RUT / NIT', url: 'https://muisca.dian.gov.co/WebRutMuisca/DefConsultaEstadoRUT.faces', desc: 'Verificar estado, régimen y actividad de un NIT · Público sin contraseña', sol: false },
      { nombre: 'Actualizar RUT', url: 'https://muisca.dian.gov.co/', desc: 'Actualizar datos del Registro Único Tributario · Requiere Muisca', sol: true },
      { nombre: 'Grandes Contribuyentes', url: 'https://www.dian.gov.co/atencionciudadano/formulariosinstructivos/Formularios/2024/F110-2024.pdf', desc: 'Lista de Grandes Contribuyentes autorizados por DIAN · Público', sol: false },
      { nombre: 'Consulta deuda tributaria', url: 'https://muisca.dian.gov.co/', desc: 'Verificar obligaciones pendientes con la DIAN · Requiere Muisca', sol: true },
    ],
  },
  {
    categoria: 'Declaraciones Tributarias',
    icon: '📋', color: C.purple,
    items: [
      { nombre: 'F300 — Declaración de IVA', url: 'https://www.dian.gov.co/atencionciudadano/formulariosinstructivos/Formularios/', desc: 'Declaración bimestral/cuatrimestral de IVA · Requiere Muisca', sol: true },
      { nombre: 'F350 — Retención en la Fuente', url: 'https://www.dian.gov.co/atencionciudadano/formulariosinstructivos/Formularios/', desc: 'Declaración mensual de retención en la fuente · Requiere Muisca', sol: true },
      { nombre: 'F110 — Renta Personas Jurídicas', url: 'https://www.dian.gov.co/atencionciudadano/formulariosinstructivos/Formularios/2024/F110-2024.pdf', desc: 'Declaración anual de renta sociedades — vence en abril · Público instructivo', sol: false },
      { nombre: 'Calendario tributario 2026', url: 'https://www.dian.gov.co/', desc: 'Fechas de vencimiento según último dígito del NIT · Público', sol: false },
    ],
  },
  {
    categoria: 'Retención y Aportes',
    icon: '🏦', color: C.yellow,
    items: [
      { nombre: 'PILA — Aportes parafiscales', url: 'https://www.aportesenlinea.com/', desc: 'Pago de aportes AFP, EPS, ARL, CCF, SENA, ICBF via operador PILA · Requiere clave', sol: false },
      { nombre: 'Tablas de retención en la fuente 2026', url: 'https://www.dian.gov.co/', desc: 'Tarifas vigentes por concepto y cuantía mínima · Público', sol: false },
      { nombre: 'Autorretención especial en renta', url: 'https://www.dian.gov.co/', desc: 'Obligados a autorretención y tasas aplicables · Público', sol: false },
      { nombre: 'Consulta arancel (importaciones)', url: 'https://muisca.dian.gov.co/', desc: 'Arancel de aduanas para importaciones · Requiere Muisca', sol: true },
    ],
  },
  {
    categoria: 'Medios Magnéticos / Exógena',
    icon: '💾', color: C.orange,
    items: [
      { nombre: 'Información Exógena — DIAN', url: 'https://www.dian.gov.co/fizcalizacioncontrol/herramienconsulta/InformacionExogena/Paginas/default.aspx', desc: 'Formatos 1001, 1007, 1008, 1009 — reporte anual de terceros · Público', sol: false },
      { nombre: 'Prevalidador Exógena DIAN', url: 'https://www.dian.gov.co/', desc: 'Herramienta para validar archivos de medios magnéticos · Público descarga', sol: false },
      { nombre: 'Resolución Exógena vigente', url: 'https://www.dian.gov.co/', desc: 'Resolución con obligados, plazos y especificaciones técnicas · Público', sol: false },
      { nombre: 'Régimen SIMPLE — Declaración', url: 'https://muisca.dian.gov.co/', desc: 'Declaración anual SIMPLE de Tributación · Requiere Muisca', sol: true },
    ],
  },
  {
    categoria: 'Capacitación y Recursos',
    icon: '🎓', color: C.indigo,
    items: [
      { nombre: 'Estatuto Tributario Nacional', url: 'https://estatuto.co/', desc: 'ET actualizado con últimas reformas tributarias colombianas · Público', sol: false },
      { nombre: 'Concepto DIAN — Biblioteca', url: 'https://www.dian.gov.co/dian/PaginasContenido/Conceptos.aspx', desc: 'Conceptos y doctrina oficial de la DIAN · Público', sol: false },
      { nombre: 'Agendar cita DIAN virtual', url: 'https://agendamientodigital.dian.gov.co/', desc: 'Agendar cita en puntos de contacto DIAN sin filas · Público', sol: false },
      { nombre: 'Portal educativo DIAN', url: 'https://www.dian.gov.co/atencionciudadano/Paginas/EducacionT.aspx', desc: 'Capacitaciones gratuitas sobre obligaciones tributarias · Público', sol: false },
    ],
  },
];

// ─── Biblioteca tributaria colombiana ──────────────────────────────────────
const BIBLIOTECA = [
  {
    id: 'iva',
    categoria: 'IVA — Impuesto al Valor Agregado',
    icon: '💰', color: C.blue,
    articulos: [
      {
        titulo: 'IVA en Colombia: tarifas y base legal',
        resumen: 'El IVA en Colombia tiene tarifa general del 19% (Art. 468 ET). Tarifa diferencial del 5% para ciertos bienes (Art. 468-1 ET): algunos alimentos, medicina prepagada, bicicletas hasta 1.400 UVT. Excluidos del IVA: bienes de la canasta familiar básica, libros, cuadernos. El período gravable es bimestral para grandes contribuyentes y agentes retenedores, y cuatrimestral para los demás.',
        audio: 'El Impuesto al Valor Agregado en Colombia, conocido como I V A, tiene una tarifa general del diecinueve por ciento según el artículo cuatrocientos sesenta y ocho del Estatuto Tributario. Existe una tarifa diferencial del cinco por ciento para bienes como algunos alimentos procesados, la medicina prepagada y las bicicletas cuyo valor no supere las mil cuatrocientas U V T. También hay bienes completamente excluidos del I V A, como los de la canasta familiar básica: arroz, legumbres, hortalizas frescas y libros. Las declaraciones son bimestrales para grandes contribuyentes y cuatrimestrales para los demás.',
        datos: ['Tarifa general: 19% (Art. 468 ET)', 'Tarifa diferencial: 5% (Art. 468-1 ET)', 'Excluidos: canasta básica, libros (Art. 424 ET)', 'Declaración: F300 bimestral o cuatrimestral'],
      },
      {
        titulo: 'IVA descontable: requisitos en Colombia',
        resumen: 'El IVA descontable (a favor) permite restar el IVA pagado en compras del IVA generado en ventas. Requisitos: la factura debe ser electrónica con CUFE válido, el NIT del proveedor debe estar activo en DIAN, el bien/servicio debe estar vinculado a la actividad generadora de IVA, y debe estar registrado en el período correspondiente.',
        audio: 'El I V A descontable en Colombia permite al responsable del I V A restar el impuesto pagado en sus compras del I V A generado en sus ventas. Para que el I V A sea descontable, se deben cumplir cuatro requisitos fundamentales. Primero: la factura debe ser electrónica con C U F E válido registrado en la D I A N. Segundo: el N I T del proveedor debe estar activo y en el régimen de responsable de I V A. Tercero: el bien o servicio adquirido debe estar directamente vinculado con la actividad generadora de I V A. Cuarto: debe ser imputado en el período en que se registra la compra. El I V A se registra en la cuenta dos cuatro cero ocho del PUC.',
        datos: ['Cuenta PUC: 2408 IVA por pagar', 'Requiere factura electrónica con CUFE', 'Proveedor debe ser responsable de IVA', 'Imputar en el período de la compra'],
      },
      {
        titulo: 'ReteIVA: retención del IVA en Colombia',
        resumen: 'La Retención del IVA (ReteIVA) es del 15% del valor del IVA cuando el comprador es Gran Contribuyente, entidad pública, o agente retenedor autorizado por DIAN. El vendedor la sufre y puede descontarla en su declaración de IVA. Se registra en cuenta 2367 del PUC.',
        audio: 'La retención del I V A, llamada Rete I V A, equivale al quince por ciento del valor del I V A de la transacción. La practica el comprador cuando es Gran Contribuyente, entidad pública o agente retenedor especialmente designado por la D I A N. Por ejemplo, en una compra de cien pesos más diecinueve pesos de I V A, el agente retenedor retiene dos pesos con ochenta y cinco centavos, que es el quince por ciento de diecinueve. El vendedor recibe solo dieciséis pesos con quince centavos de I V A y puede usar los dos pesos con ochenta y cinco retenidos como descuento en su declaración de I V A. Se registra en la cuenta dos tres seis siete del PUC.',
        datos: ['Tarifa ReteIVA: 15% del IVA', 'La practica el Gran Contribuyente o agente retenedor', 'Cuenta PUC vendedor: 1365 (ReteIVA a favor)', 'Cuenta PUC comprador: 2367 (ReteIVA por pagar)'],
      },
    ],
  },
  {
    id: 'retefuente',
    categoria: 'Retención en la Fuente',
    icon: '📊', color: C.green,
    articulos: [
      {
        titulo: 'Retención en la fuente: conceptos principales 2026',
        resumen: 'La retención en la fuente es un mecanismo de recaudo anticipado del impuesto de renta. Los agentes de retención (empresas que declaran renta o son grandes contribuyentes) retienen un porcentaje sobre pagos a terceros. Conceptos más comunes: compras de bienes (3.5%), servicios generales (4%), honorarios persona jurídica (11%), arrendamientos (3.5%), dividendos.',
        audio: 'La retención en la fuente es un mecanismo de recaudo anticipado del impuesto de renta que practican los agentes retenedores sobre sus proveedores. Los conceptos más aplicados en dos mil veintiséis son los siguientes. Compras de bienes muebles a declarantes: tres punto cinco por ciento sobre el valor bruto, con una cuantía mínima de novecientas veintisiete mil pesos. Servicios generales a personas jurídicas: cuatro por ciento. Honorarios y comisiones a personas jurídicas: once por ciento. Arrendamiento de bienes inmuebles: tres punto cinco por ciento. Estos porcentajes se aplican solo cuando el valor del pago supera la cuantía mínima establecida por la D I A N. La retención se declara mensualmente en el Formulario trescientos cincuenta.',
        datos: ['Compras declarantes: 3.5% (cuantía mín. ~$927.000)', 'Servicios generales: 4%', 'Honorarios P.J.: 11%', 'Declaración: F350 mensual'],
      },
      {
        titulo: 'Retención en la fuente: rentas laborales 2026',
        resumen: 'Los empleados pagan retención en la fuente sobre sus salarios si superan la cuantía mínima. El empleador es agente retenedor. El procedimiento 1 calcula la retención mensual directamente; el procedimiento 2 aplica el porcentaje fijo semestral calculado en junio y diciembre. No son comparables con el RUT o NIT, aplican solo a la relación laboral.',
        audio: 'La retención en la fuente sobre rentas laborales aplica cuando el salario mensual del empleado supera la cuantía mínima determinada anualmente por la D I A N, que para dos mil veintiséis equivale aproximadamente a cuatro millones cien mil pesos mensuales. El empleador usa el Procedimiento Uno, que calcula la retención cada mes, o el Procedimiento Dos, que aplica un porcentaje fijo durante seis meses calculado en junio y diciembre. Las rentas exentas incluyen el veinticinco por ciento del salario, hasta un máximo de doscientas cuarenta U V T mensuales, y los aportes obligatorios a pensión, salud y fondo de solidaridad.',
        datos: ['Procedimiento 1: cálculo mensual directo', 'Procedimiento 2: % fijo semestral (jun/dic)', 'Renta exenta: 25% del ingreso laboral (máx. 240 UVT)', 'Deducción por dependientes: 10% (máx. 32 UVT/mes)'],
      },
      {
        titulo: 'ICA — Impuesto de Industria y Comercio',
        resumen: 'El ICA es un impuesto municipal sobre ingresos brutos por actividades comerciales, industriales o de servicios. Las tarifas varían por municipio y actividad. Bogotá: 4.14‰ a 13.8‰. Medellín: 4‰ a 10‰. Se declara bimestral o anual según el municipio. La base es el total de ingresos brutos sin deducir costos.',
        audio: 'El Impuesto de Industria y Comercio, conocido como I C A, es un tributo municipal que grava los ingresos brutos obtenidos por actividades industriales, comerciales y de servicios en el territorio de cada municipio. Las tarifas son fijadas por cada alcaldía y varían por tipo de actividad. En Bogotá oscilan entre cuatro coma catorce milésimas para actividades industriales y trece coma ocho milésimas para actividades financieras. En Medellín van de cuatro a diez milésimas. La base gravable es el total de ingresos brutos del período sin restar costos ni gastos. Se declara bimestralmente en Bogotá y anualmente en muchos municipios. El sistema calcula el I C A automáticamente según el municipio configurado para cada empresa.',
        datos: ['Bogotá: 4.14‰ a 13.8‰ según actividad', 'Medellín: 4‰ a 10‰', 'Base: ingresos brutos (sin deducir costos)', 'Declaración: bimestral Bogotá / anual otros municipios'],
      },
    ],
  },
  {
    id: 'renta',
    categoria: 'Impuesto de Renta — Colombia',
    icon: '📈', color: C.purple,
    articulos: [
      {
        titulo: 'Regímenes tributarios en Colombia 2026',
        resumen: 'En Colombia existen el Régimen Ordinario y el Régimen SIMPLE. El Régimen Ordinario aplica tarifa del 35% sobre renta líquida para personas jurídicas. El SIMPLE (Régimen Simple de Tributación) tiene tarifa unificada del 1.8% al 14.5% según ingresos y actividad, simplificando el cumplimiento. También existe el Régimen de Tributación para mega-inversiones.',
        audio: 'En Colombia, las sociedades pueden tributar bajo el Régimen Ordinario o el Régimen Simple de Tributación. El Régimen Ordinario aplica una tarifa del treinta y cinco por ciento sobre la renta líquida gravable determinada en el Formulario ciento diez de la D I A N, con declaración en abril del año siguiente. El Régimen Simple o S I M P L E ofrece una tasa unificada que va del uno punto ocho al catorce punto cinco por ciento dependiendo de los ingresos brutos y la actividad económica. El S I M P L E reemplaza el impuesto de renta, el I C A municipal y el impuesto al consumo para los sectores aplicables. Los pagos anticipados bimestrales del S I M P L E se realizan en el portal Muisca de la D I A N.',
        datos: ['Ordinario: 35% renta líquida (F110 — abril)', 'SIMPLE: 1.8% a 14.5% según ingresos y actividad', 'SIMPLE incluye renta + ICA municipal', 'Pagos anticipados SIMPLE: bimestrales Muisca'],
      },
      {
        titulo: 'Renta presuntiva y anticipo en Colombia',
        resumen: 'La renta presuntiva es el 0.5% sobre el patrimonio líquido del año anterior (Art. 188 ET). La renta declarada no puede ser inferior a la presuntiva salvo causales de exclusión. El anticipo de renta se calcula como el 25% (año 1) o 50% (año 2+) del impuesto neto más el promedio de los 2 años anteriores.',
        audio: 'La renta presuntiva en Colombia equivale al cero punto cinco por ciento del patrimonio líquido al cierre del año gravable anterior, según el artículo ciento ochenta y ocho del Estatuto Tributario. Si la renta ordinaria es inferior a la presuntiva, el contribuyente debe pagar sobre la presuntiva. Existen causales de exclusión: empresas en concordato o reorganización empresarial, proyectos de infraestructura durante construcción, y nuevas empresas en los tres primeros años. El anticipo de renta del año siguiente se calcula como el setenta y cinco por ciento del impuesto neto del año en curso para el segundo año y siguientes.',
        datos: ['Renta presuntiva: 0.5% patrimonio líquido (Art. 188 ET)', 'Anticipo año 1: 25% del impuesto neto', 'Anticipo año 2+: 75% del impuesto neto', 'Descuento: retenciones sufridas en el año'],
      },
    ],
  },
  {
    id: 'factura',
    categoria: 'Factura Electrónica DIAN',
    icon: '🧾', color: C.accent,
    articulos: [
      {
        titulo: 'Factura electrónica: estructura y obligados',
        resumen: 'La factura electrónica es obligatoria en Colombia para la mayoría de contribuyentes responsables de IVA desde 2021. Debe contener: NIT emisor y receptor, CUFE (Código Único de Factura Electrónica), firma digital, fecha, descripción de bienes/servicios, valor base, IVA, total. Se transmite en formato XML-UBL 2.1 a la DIAN antes de entrega al cliente.',
        audio: 'La factura electrónica en Colombia es obligatoria para todos los contribuyentes responsables del I V A. Debe generarse en formato X M L siguiendo el estándar U B L dos punto uno definido por la D I A N. Los elementos obligatorios son: el N I T del emisor y receptor con dígito de verificación, el C U F E que es el Código Único de Factura Electrónica generado con la clave técnica asignada por la D I A N, la firma digital con certificado autorizado, la fecha y hora de generación, la descripción detallada de bienes o servicios, la base gravable, la tarifa y valor del I V A, y el valor total a pagar. La factura se transmite a la D I A N antes o simultáneamente con su entrega al cliente.',
        datos: ['Formato: XML-UBL 2.1 DIAN', 'CUFE: identificador único de cada factura', 'Obligatorio desde 2021 para responsables IVA', 'Transmisión previa o simultánea a la DIAN'],
      },
      {
        titulo: 'Nota crédito y nota débito DIAN',
        resumen: 'La nota crédito rectifica o anula una factura electrónica (devoluciones, descuentos, errores). La nota débito aumenta el valor de una factura ya emitida (ajustes en precio, gastos adicionales). Ambas deben referenciar la factura original con su CUFE y seguir el mismo proceso de validación DIAN.',
        audio: 'La nota crédito electrónica corrige o anula total o parcialmente una factura electrónica ya emitida. Se usa para devoluciones de mercancía, descuentos posteriores a la venta y corrección de errores en el valor o en los datos del cliente. La nota débito ajusta hacia arriba el valor de una factura existente, por ejemplo si se acordaron gastos adicionales de transporte después de emitir la factura original. Ambos documentos deben referenciar obligatoriamente el C U F E de la factura original, y tienen su propio código único similar al C U F E, llamado C U D E para notas. El sistema genera y transmite estos documentos automáticamente a la D I A N en tiempo real.',
        datos: ['Nota crédito: anula o reduce valor factura', 'Nota débito: aumenta valor de factura', 'Ambas referencian CUFE de factura original', 'CUDE: código único de notas débito/crédito'],
      },
    ],
  },
  {
    id: 'nomina',
    categoria: 'Nómina y Aportes Parafiscales',
    icon: '👥', color: C.orange,
    articulos: [
      {
        titulo: 'Aportes parafiscales colombianos 2026',
        resumen: 'Los empleadores colombianos deben pagar mensualmente: AFP Pensiones (12% empleador + 4% empleado), EPS Salud (8.5% empleador + 4% empleado), ARL (0.348% a 8.7% según nivel de riesgo), CCF Caja de Compensación (4%), SENA (2%), ICBF (3%). Se liquidan via PILA (Planilla Integrada de Liquidación de Aportes).',
        audio: 'Los aportes parafiscales en Colombia se calculan sobre el salario base de cotización del empleado y deben pagarse mensualmente antes del día diez del mes siguiente. El empleador paga el doce por ciento a la A F P de pensiones y el empleado aporta el cuatro por ciento adicional descontado de su salario. Para salud, el empleador paga el ocho punto cinco por ciento a la E P S y el empleado el cuatro por ciento. El A R L o seguro de riesgos laborales lo paga completamente el empleador con tarifa según el nivel de riesgo de la actividad, que va del cero punto trescientos cuarenta y ocho por ciento para riesgo uno hasta el ocho punto siete por ciento para riesgo cinco. La Caja de Compensación Familiar recibe el cuatro por ciento, el S E N A el dos por ciento y el I C B F el tres por ciento del total de la nómina. Todos estos aportes se consolidan en la P I L A mensual.',
        datos: ['AFP Pensiones: 12% empleador + 4% empleado', 'EPS Salud: 8.5% empleador + 4% empleado', 'ARL: 0.348% a 8.7% empleador (según riesgo)', 'CCF 4% + SENA 2% + ICBF 3% empleador'],
      },
      {
        titulo: 'Prestaciones sociales: prima, cesantías y vacaciones',
        resumen: 'Prima de servicios: equivale a 15 días de salario cada 6 meses (junio y diciembre). Cesantías: 1 mes de salario por año trabajado, consignadas a fondo de cesantías antes del 14 de febrero. Intereses sobre cesantías: 12% anual sobre el saldo de cesantías (pagados directamente al empleado en enero). Vacaciones: 15 días hábiles por año trabajado.',
        audio: 'Las prestaciones sociales son derechos laborales adicionales al salario. La prima de servicios equivale a quince días de salario básico más comisiones cada seis meses: se paga en la primera quincena de junio y en la primera quincena de diciembre. Las cesantías corresponden a un mes de salario por año trabajado y el empleador debe consignarlas en el fondo de cesantías elegido por el empleado antes del catorce de febrero de cada año. Los intereses sobre cesantías equivalen al doce por ciento anual sobre el saldo de cesantías y se pagan directamente al empleado antes del treinta y uno de enero. Las vacaciones son quince días hábiles por año trabajado y pueden disfrutarse fraccionadas de común acuerdo entre empleador y empleado.',
        datos: ['Prima: 15 días salario en jun y dic', 'Cesantías: 1 mes/año → fondo antes del 14 feb', 'Intereses cesantías: 12% anual → pago directo ene', 'Vacaciones: 15 días hábiles/año trabajado'],
      },
    ],
  },
];

// ─── Componente principal ───────────────────────────────────────────────────
export const DianPortalHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'servicios' | 'biblioteca'>('servicios');
  const [openArticulo, setOpenArticulo] = useState<string>('');
  const [openCategoria, setOpenCategoria] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSound, setActiveSound] = useState('');

  const handleSpeak = (audio: string, id: string) => {
    if (isPlaying && activeSound === id) {
      stopAudio();
      setIsPlaying(false);
      setActiveSound('');
    } else {
      setIsPlaying(true);
      setActiveSound(id);
      speak(audio, () => { setIsPlaying(false); setActiveSound(''); });
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px', fontFamily: "'Segoe UI', Arial, sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 28 }}>🇨🇴</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text }}>
              Portal DIAN Colombia
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              Servicios electrónicos · Biblioteca tributaria · Normativa colombiana
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {([['servicios', '🔗 Servicios DIAN'], ['biblioteca', '📚 Biblioteca Tributaria']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 20px', borderRadius: 8,
              background: activeTab === tab ? `linear-gradient(135deg, ${C.yellow}, #d4a800)` : C.bgCard,
              color: activeTab === tab ? '#000' : C.muted,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              border: `1px solid ${activeTab === tab ? C.yellow : C.border}`,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ─── SERVICIOS DIAN ─────────────────────────────────────────────── */}
      {activeTab === 'servicios' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {DIAN_SERVICIOS.map(cat => (
            <div key={cat.categoria} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: `1px solid ${C.border}`,
                background: `${cat.color}10`,
              }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: cat.color }}>{cat.categoria}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {cat.items.map((item, i) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'block', padding: '12px 16px', textDecoration: 'none',
                      borderBottom: `1px solid ${C.border}`,
                      borderRight: i % 2 === 0 ? `1px solid ${C.border}` : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${cat.color}12`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ color: cat.color, fontSize: 12, fontWeight: 800 }}>{item.nombre}</span>
                      {item.sol && (
                        <span style={{ background: C.yellow, color: '#000', fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                          MUISCA
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: C.dim, lineHeight: 1.4 }}>{item.desc}</p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── BIBLIOTECA TRIBUTARIA ───────────────────────────────────────── */}
      {activeTab === 'biblioteca' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {BIBLIOTECA.map(cat => (
            <div key={cat.id} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenCategoria(openCategoria === cat.id ? '' : cat.id)}
                style={{
                  width: '100%', padding: '14px 16px', background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  borderBottom: openCategoria === cat.id ? `1px solid ${C.border}` : 'none',
                }}
              >
                <span style={{ fontSize: 22 }}>{cat.icon}</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: cat.color, flex: 1, textAlign: 'left' }}>{cat.categoria}</span>
                <span style={{ color: C.dim, fontSize: 14 }}>{openCategoria === cat.id ? '▲' : '▼'}</span>
              </button>

              {openCategoria === cat.id && (
                <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
                  {cat.articulos.map(art => (
                    <div key={art.titulo} style={{
                      background: C.bgRow, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden',
                    }}>
                      <button
                        onClick={() => setOpenArticulo(openArticulo === art.titulo ? '' : art.titulo)}
                        style={{
                          width: '100%', padding: '10px 14px', background: 'transparent', border: 'none',
                          display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1, textAlign: 'left' }}>{art.titulo}</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleSpeak(art.audio, art.titulo); }}
                          style={{
                            background: isPlaying && activeSound === art.titulo ? `${cat.color}33` : 'transparent',
                            border: `1px solid ${cat.color}55`, borderRadius: 6, padding: '3px 8px',
                            color: cat.color, fontSize: 11, cursor: 'pointer', fontWeight: 700,
                          }}
                        >
                          {isPlaying && activeSound === art.titulo ? '⏹ Stop' : '🔊 Escuchar'}
                        </button>
                        <span style={{ color: C.dim, fontSize: 12 }}>{openArticulo === art.titulo ? '▲' : '▼'}</span>
                      </button>

                      {openArticulo === art.titulo && (
                        <div style={{ padding: '0 14px 14px' }}>
                          <p style={{ margin: '0 0 10px', fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{art.resumen}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {art.datos.map((d, i) => (
                              <span key={i} style={{
                                background: `${cat.color}18`, color: cat.color,
                                border: `1px solid ${cat.color}33`,
                                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                              }}>{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DianPortalHub;
