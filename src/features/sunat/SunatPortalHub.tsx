/**
 * SunatPortalHub — Portal SUNAT completo
 * Acceso a trámites · Biblioteca tributaria completa · Audio natural Google
 * Todos los planes (sunat:true)
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
      voices.find(v => v.lang === 'es-PE') ||
      voices.find(v => v.lang.startsWith('es'));

    const utter = new SpeechSynthesisUtterance(text);
    if (voice) utter.voice = voice;
    utter.lang = 'es-PE'; utter.rate = 0.91; utter.pitch = 0.88; utter.volume = 0.85;
    if (onEnd) utter.onend = onEnd;
    currentUtterance = utter;
    window.speechSynthesis.speak(utter);
  };

  if (window.speechSynthesis.getVoices().length > 0) doSpeak();
  else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak(); }; }
};

const stopAudio = () => { window.speechSynthesis?.cancel(); currentUtterance = null; };

// ─── Datos: Servicios SUNAT ────────────────────────────────────────────────
const SUNAT_SERVICIOS = [
  {
    categoria: 'Operaciones en Línea',
    icon: '🔐', color: C.blue,
    items: [
      { nombre: 'Portal SOL — Operaciones en Línea', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Declaraciones, pagos, consultas con clave SOL' },
      { nombre: 'Declaraciones y Pagos (PDT)', url: 'https://www.sunat.gob.pe/declaracPagos/index.html', desc: 'PDT 621 IGV-Renta, PDT 617, PDT 601 planillas' },
      { nombre: 'Clave SOL — Registro y recuperación', url: 'https://www.sunat.gob.pe/sol.html', desc: 'Obtener o recuperar tu clave de acceso' },
      { nombre: 'SUNAT Operaciones en Línea (Empresas)', url: 'https://e-menu.sunat.gob.pe/', desc: 'Panel principal para empresas y negocios' },
    ],
  },
  {
    categoria: 'Comprobantes Electrónicos',
    icon: '📄', color: C.green,
    items: [
      { nombre: 'Consulta validez CPE', url: 'https://ww1.sunat.gob.pe/ol-ti-itconsvalicpe/ConsValiCpe.htm', desc: 'Verificar si una factura electrónica es válida' },
      { nombre: 'SIRE — Registro de Ventas e Ingresos', url: 'https://www.sunat.gob.pe/ol-ti-itcpe/ChequeoSesionRecaudacion.html', desc: 'Sistema de Registro de Ventas e Ingresos SUNAT' },
      { nombre: 'SEE del Contribuyente', url: 'https://e-menu.sunat.gob.pe/', desc: 'Emitir facturas, boletas, notas desde SUNAT' },
      { nombre: 'Consulta de facturas emitidas', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Ver el historial de comprobantes emitidos' },
    ],
  },
  {
    categoria: 'Consultas y Padrón',
    icon: '🔍', color: C.accent,
    items: [
      { nombre: 'Consulta RUC', url: 'https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp', desc: 'Estado, régimen, condición del RUC' },
      { nombre: 'Consulta de deuda tributaria', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Estado de deudas con SUNAT (requiere clave SOL)' },
      { nombre: 'Padrón de contribuyentes', url: 'https://www.sunat.gob.pe/padronContribuyentes.html', desc: 'Consulta de buenos contribuyentes' },
      { nombre: 'Consulta de expedientes', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Estado de trámites y expedientes en SUNAT' },
    ],
  },
  {
    categoria: 'Libros Electrónicos PLE',
    icon: '📚', color: C.purple,
    items: [
      { nombre: 'PLE — Programa de Libros Electrónicos', url: 'https://www.sunat.gob.pe/comprobantespago/ple.html', desc: 'Descargar e instalar el programa PLE' },
      { nombre: 'PLES — Módulo de envío', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Enviar los libros electrónicos generados' },
      { nombre: 'Cronograma PLE', url: 'https://www.sunat.gob.pe/legislacion/superin/2016/375.pdf', desc: 'Obligados y plazos de afiliación a libros electrónicos' },
      { nombre: 'Validador de libros electrónicos', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Verificar estructura de archivos PLE antes de enviar' },
    ],
  },
  {
    categoria: 'Detracciones y Retenciones',
    icon: '🏦', color: C.yellow,
    items: [
      { nombre: 'SPOT — Sistema Detracciones', url: 'https://www.sunat.gob.pe/descarga/cartillasOrient/SPOT.pdf', desc: 'Consulta y depósito de detracciones' },
      { nombre: 'Consulta saldo cuenta detracciones', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Saldo disponible en cuenta del Banco de la Nación' },
      { nombre: 'Sistema de Retenciones', url: 'https://www.sunat.gob.pe/legislacion/comprob/retencion.html', desc: 'Agentes de retención y percepción del IGV' },
      { nombre: 'Liberación de fondos detracciones', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Solicitar liberación del saldo de detracciones' },
    ],
  },
  {
    categoria: 'Trámites y Orientación',
    icon: '📋', color: C.orange,
    items: [
      { nombre: 'TUPA — Procedimientos administrativos', url: 'https://www.sunat.gob.pe/institucional/publicaciones/tupa.html', desc: 'Todos los trámites, requisitos y plazos SUNAT' },
      { nombre: 'Orientación tributaria', url: 'https://www.sunat.gob.pe/orientacion.html', desc: 'Guías, manuales y orientación al contribuyente' },
      { nombre: 'Aplazamiento/fraccionamiento deudas', url: 'https://www.sunat.gob.pe/operatividadEnLinea/', desc: 'Solicitar refinanciamiento de deudas tributarias' },
      { nombre: 'Mesa de partes virtual', url: 'https://www.sunat.gob.pe/MPVirtual/', desc: 'Presentar documentos y escritos sin ir a SUNAT' },
    ],
  },
];

// ─── Biblioteca tributaria ──────────────────────────────────────────────────
const BIBLIOTECA = [
  {
    id: 'igv',
    categoria: 'IGV — Impuesto General a las Ventas',
    icon: '💰', color: C.blue,
    articulos: [
      {
        titulo: 'IGV: Base legal y tasa vigente',
        resumen: 'El Impuesto General a las Ventas (IGV) en Perú tiene una tasa del 18%, compuesta por el 16% de IGV más el 2% del Impuesto de Promoción Municipal (IPM). Es un impuesto al valor agregado que grava la venta de bienes, prestación de servicios, contratos de construcción, importación de bienes e importación de servicios.',
        audio: 'El Impuesto General a las Ventas, conocido como I G V, tiene una tasa total del dieciocho por ciento en Perú. Esta tasa se compone del dieciséis por ciento de I G V más el dos por ciento del Impuesto de Promoción Municipal. Grava la venta de bienes muebles, la prestación de servicios, los contratos de construcción y la importación de bienes y servicios. La base legal se encuentra en el Texto Único Ordenado de la Ley del I G V, aprobado por Decreto Supremo cero cincuenta y cinco guión noventa y nueve guión E F.',
        datos: ['Tasa: 18% (16% IGV + 2% IPM)', 'Base legal: D.S. 055-99-EF (TUO IGV)', 'Declaración: PDT 621 mensual', 'Vence: según último dígito RUC'],
      },
      {
        titulo: 'Crédito fiscal del IGV: requisitos',
        resumen: 'El crédito fiscal del IGV permite descontar el IGV de las compras del IGV de las ventas. Para ser válido, el comprobante debe ser emitido por un contribuyente habido, el gasto debe ser causal (vinculado al negocio), el comprobante debe estar anotado en el Registro de Compras dentro del plazo (máximo 12 meses), y la operación debe ser fehaciente (real y sustentada).',
        audio: 'El crédito fiscal del I G V tiene cuatro requisitos fundamentales que el contador debe verificar siempre. Primero: el proveedor debe ser un contribuyente habido y activo según SUNAT. Segundo: el gasto debe cumplir el principio de causalidad, es decir, debe estar vinculado con la actividad generadora de renta. Tercero: el comprobante debe anotarse en el Registro de Compras máximo doce meses después de la fecha de emisión. Cuarto: la operación debe ser fehaciente, con contratos, guías de remisión u otros sustentos que demuestren que la operación realmente ocurrió. Si falla cualquiera de estos cuatro requisitos, SUNAT puede desconocer el crédito fiscal.',
        datos: ['Requisito 1: Proveedor habido y activo', 'Requisito 2: Causalidad del gasto', 'Requisito 3: Anotación oportuna (máx. 12 meses)', 'Requisito 4: Fehaciencia de la operación'],
      },
      {
        titulo: 'Operaciones exoneradas e inafectas del IGV',
        resumen: 'Las operaciones exoneradas están listadas en los Apéndices I y II del TUO del IGV. Las inafectas no están dentro del campo de aplicación del impuesto. Ejemplos exonerados: alimentos de primera necesidad, servicios educativos, servicios de transporte interprovincial. Ejemplos inafectos: exportaciones, transferencias de empresas.',
        audio: 'En el I G V peruano existen dos grupos importantes de operaciones que no generan impuesto. Las operaciones exoneradas están en los Apéndices Primero y Segundo del T U O del I G V. Incluyen alimentos de primera necesidad como arroz, azúcar, aceite y leche, así como servicios educativos y transporte interprovincial de pasajeros. Las operaciones inafectas son aquellas que no están dentro del campo de aplicación del impuesto, como las exportaciones de bienes y servicios, que tienen tasa cero y permiten solicitar devolución del I G V pagado en las compras.',
        datos: ['Apéndice I: bienes exonerados', 'Apéndice II: servicios exonerados', 'Exportaciones: tasa 0% con derecho a devolución', 'Base: Art. 1° TUO del IGV'],
      },
    ],
  },
  {
    id: 'renta',
    categoria: 'Impuesto a la Renta',
    icon: '📊', color: C.green,
    articulos: [
      {
        titulo: 'Regímenes tributarios en Perú 2026',
        resumen: 'Existen 4 regímenes: NRUS (Nuevo RUS) para los más pequeños con cuotas fijas de S/20 o S/50; RER (Régimen Especial de Renta) con tasa de 1.5% sobre ingresos netos; MYPE Tributario con tasa de 10% hasta las primeras 15 UIT de utilidades y 29.5% sobre el exceso; Régimen General para empresas grandes con tasa del 29.5%.',
        audio: 'Perú tiene cuatro regímenes tributarios para empresas y negocios. El Nuevo R U S, o N R U S, es para los más pequeños con ingresos hasta noventa y seis mil soles anuales. Pagan una cuota fija mensual de veinte o cincuenta soles según categoría, y no están obligados a llevar contabilidad completa. El R E R o Régimen Especial paga el uno coma cinco por ciento de los ingresos netos mensuales. El Régimen M Y P E Tributario aplica el diez por ciento sobre las primeras quince Unidades Impositivas Tributarias de utilidades y el veintinueve coma cinco por ciento sobre el exceso. El Régimen General aplica la tasa del veintinueve coma cinco por ciento sobre la renta neta anual y está obligado a llevar contabilidad completa.',
        datos: ['NRUS: cuota S/20 o S/50/mes', 'RER: 1.5% ingresos netos mensual', 'MYPE: 10% hasta 15 UIT, 29.5% exceso', 'General: 29.5% renta neta anual'],
      },
      {
        titulo: 'Pagos a cuenta del Impuesto a la Renta',
        resumen: 'Los contribuyentes del régimen general deben realizar pagos a cuenta mensuales. El método de coeficiente aplica el ratio utilidad/ingresos del año anterior. El método de porcentaje aplica la tasa del 1.5% sobre los ingresos netos del mes. Se elige el mayor de ambos. Se declaran en el PDT 621 junto con el IGV.',
        audio: 'Los pagos a cuenta del Impuesto a la Renta son adelantos mensuales obligatorios para el Régimen General. Hay dos métodos de cálculo. El método del coeficiente multiplica los ingresos del mes por el coeficiente obtenido dividiendo el impuesto calculado entre los ingresos netos del año anterior. El método del porcentaje aplica el uno coma cinco por ciento sobre los ingresos netos del mes. El contribuyente usa el que resulte mayor. Estos pagos se declaran mensualmente en el P D T seiscientos veintiuno junto con el I G V. Al final del año, se resta lo pagado a cuenta del impuesto anual calculado en la declaración jurada anual.',
        datos: ['Método coeficiente: imp.anterior/ingresos anterior', 'Método porcentaje: 1.5% ingresos netos', 'Se aplica el mayor de ambos', 'Declaración: PDT 621 mensual'],
      },
      {
        titulo: 'Renta de quinta categoría: trabajadores',
        resumen: 'Los trabajadores en planilla tributan por renta de quinta categoría. La empresa retiene y paga el impuesto. Se aplica la escala: hasta 5 UIT exonerado; de 5 a 20 UIT: 8%; de 20 a 35 UIT: 14%; de 35 a 45 UIT: 17%; más de 45 UIT: 30%. La UIT 2026 es S/5,350.',
        audio: 'La renta de quinta categoría aplica a los trabajadores en planilla. La empresa actúa como agente de retención y paga el impuesto al fisco en nombre del trabajador. La escala progresiva para el año dos mil veintiséis con una U I T de cinco mil trescientos cincuenta soles es la siguiente: hasta cinco U I T, equivalentes a veintiseis mil setecientos cincuenta soles, está exonerado de impuesto. De cinco a veinte U I T paga el ocho por ciento. De veinte a treinta y cinco U I T paga el catorce por ciento. De treinta y cinco a cuarenta y cinco U I T paga el diecisiete por ciento. Y por encima de cuarenta y cinco U I T paga el treinta por ciento. La retención se distribuye en doce meses más una treceava parte en julio y otra en diciembre.',
        datos: ['UIT 2026: S/ 5,350', 'Hasta 5 UIT (S/26,750): exonerado', '5 a 20 UIT: 8%', '20 a 35 UIT: 14%', '35 a 45 UIT: 17%', 'Más 45 UIT: 30%'],
      },
    ],
  },
  {
    id: 'detracciones',
    categoria: 'Detracciones SPOT',
    icon: '🏦', color: C.yellow,
    articulos: [
      {
        titulo: '¿Qué es el sistema de detracciones SPOT?',
        resumen: 'El SPOT (Sistema de Pago de Obligaciones Tributarias) obliga al comprador de ciertos bienes o servicios a depositar un porcentaje del precio de venta en una cuenta especial del Banco de la Nación a nombre del proveedor. Este dinero solo puede usarse para pagar tributos y contribuciones al proveedor.',
        audio: 'El sistema S P O T, que significa Sistema de Pago de Obligaciones Tributarias, obliga al comprador de ciertos bienes y servicios a depositar un porcentaje del precio de venta en una cuenta especial del Banco de la Nación, a nombre del proveedor. Por ejemplo, si compras servicios de transporte de bienes por cien soles, debes depositar cuatro soles en la cuenta de detracciones del transportista antes de que sea el décimo cuarto del mes siguiente. El proveedor solo puede usar ese dinero para pagar impuestos, contribuciones a ESSALUD y ONP, y multas tributarias. Si el proveedor no usa el dinero en cuatro meses, puede solicitar la liberación de fondos. La infracción por no depositar a tiempo tiene una multa del cien por ciento del monto no depositado.',
        datos: ['Administrado por SUNAT', 'Depósito en Banco de la Nación', 'Solo para pagar tributos del proveedor', 'Liberación: si no se usa en 4 meses'],
      },
      {
        titulo: 'Tasas de detracciones 2026 más comunes',
        resumen: 'Las tasas más aplicadas son: Servicios de transporte de bienes (4%), Arrendamiento de bienes (12%), Mantenimiento y reparación de bienes muebles (12%), Servicios de publicidad (12%), Servicios de asesoría y consultoría (12%), Contratos de construcción (4%), Intermediación laboral (12%), Demás servicios gravados con IGV (12%).',
        audio: 'Las tasas de detracciones más comunes en dos mil veintiséis son las siguientes. Servicios de transporte de bienes por carretera: cuatro por ciento. Arrendamiento de bienes muebles e inmuebles: doce por ciento. Mantenimiento y reparación de bienes muebles: doce por ciento. Publicidad: doce por ciento. Asesorías y consultorías profesionales: doce por ciento. Contratos de construcción: cuatro por ciento. Intermediación laboral y tercerización: doce por ciento. Para los demás servicios gravados con I G V que no tienen tasa específica, se aplica el doce por ciento. Recuerda que el depósito lo hace el comprador o usuario del servicio, no el proveedor.',
        datos: ['Transporte de bienes: 4%', 'Arrendamiento: 12%', 'Consultoría/asesoría: 12%', 'Construcción: 4%', 'Demás servicios IGV: 12%'],
      },
    ],
  },
  {
    id: 'comprobantes',
    categoria: 'Comprobantes de Pago',
    icon: '🧾', color: C.accent,
    articulos: [
      {
        titulo: 'Tipos de comprobantes de pago',
        resumen: 'Los principales comprobantes son: Factura (operaciones B2B con empresa o persona con RUC), Boleta de venta (consumidores finales), Recibo por Honorarios (cuarta categoría), Liquidación de compra (cuando el proveedor no tiene RUC), Nota de débito (aumenta el importe de una operación), Nota de crédito (reduce el importe o anula).',
        audio: 'Los tipos de comprobantes de pago reconocidos por SUNAT son los siguientes. La factura se emite en operaciones entre empresas o cuando el comprador tiene R U C y necesita sustentar gasto o costo. La boleta de venta se entrega a consumidores finales personas naturales. El recibo por honorarios lo emiten los profesionales independientes de cuarta categoría. La liquidación de compra se usa cuando el proveedor es una persona natural sin R U C, por ejemplo un agricultor. La nota de crédito reduce o anula el importe de una operación ya emitida. La nota de débito aumenta el importe. Desde dos mil dieciocho, la mayoría de empresas están obligadas a emitir comprobantes electrónicos a través del sistema del contribuyente o el sistema de SUNAT.',
        datos: ['Factura: B2B con RUC', 'Boleta: consumidor final', 'Rec. Honorarios: 4ta categoría', 'Nota crédito: reduce/anula', 'Nota débito: aumenta importe'],
      },
      {
        titulo: 'Comprobantes electrónicos: obligaciones 2026',
        resumen: 'Desde 2023, prácticamente todos los contribuyentes están obligados a emitir comprobantes electrónicos. Los sistemas disponibles son: SEE del Contribuyente (propio del negocio), SEE de OSE (Operador de Servicios Electrónicos), y SEE desde SOL (portal SUNAT, gratuito). Las facturas y boletas deben enviarse a SUNAT en el momento de emisión.',
        audio: 'En dos mil veintiséis, prácticamente todos los contribuyentes peruanos están obligados a emitir comprobantes electrónicos. Existen tres sistemas para hacerlo. El S E E del Contribuyente es el sistema propio de la empresa, integrado con su software contable o E R P. El S E E a través de un O S E, que es un Operador de Servicios Electrónicos autorizado por SUNAT. Y el S E E desde S O L, que es el portal web de SUNAT y es completamente gratuito. Las facturas electrónicas se envían a SUNAT en tiempo real y el comprador recibe una copia en su correo electrónico. Una factura electrónica rechazada por SUNAT no tiene validez tributaria.',
        datos: ['SEE Contribuyente: sistema propio', 'SEE-OSE: operador autorizado', 'SEE-SOL: portal SUNAT (gratis)', 'Envío en tiempo real a SUNAT'],
      },
    ],
  },
  {
    id: 'infracciones',
    categoria: 'Infracciones y Sanciones',
    icon: '⚠️', color: C.red,
    articulos: [
      {
        titulo: 'Infracciones más comunes del artículo 174°',
        resumen: 'Art. 174° TUO Código Tributario: No emitir comprobante (multa: 1 UIT o cierre), emitir comprobante que no reúne requisitos (multa: 50% UIT), usar máquina registradora no declarada (50% UIT), emitir comprobante sin clave electrónica cuando se está obligado (1 UIT o cierre).',
        audio: 'El artículo ciento setenta y cuatro del Código Tributario sanciona infracciones relacionadas con la emisión de comprobantes de pago. No emitir comprobante cuando se está obligado tiene una multa de una U I T, equivalente a cinco mil trescientos cincuenta soles en dos mil veintiséis, o el cierre del local. Emitir comprobante que no cumple los requisitos mínimos tiene una multa del cincuenta por ciento de la U I T. Usar máquinas registradoras no declaradas a SUNAT también tiene una multa del cincuenta por ciento de la U I T. No emitir comprobante electrónico cuando se está obligado a hacerlo tiene la misma sanción que no emitir: una U I T o cierre. Recuerda que la primera infracción detectada puede acogerse a gradualidad para reducir la multa.',
        datos: ['No emitir: 1 UIT o cierre', 'Comp. sin requisitos: 50% UIT', 'UIT 2026: S/ 5,350', 'Gradualidad: rebaja la primera vez'],
      },
      {
        titulo: 'Infracciones más comunes del artículo 175° y 176°',
        resumen: 'Art. 175°: No llevar libros contables (0.6% ingresos), llevarlos atrasados (0.3% ingresos), no conservarlos por el período legal (0.3% ingresos). Art. 176°: No declarar dentro del plazo (1 UIT o 50% UIT), presentar declaración con datos falsos (50% del tributo omitido), no incluir ingresos en la declaración (50% del tributo).',
        audio: 'El artículo ciento setenta y cinco sanciona infracciones relacionadas con los libros contables. No llevar libros y registros obligatorios tiene una multa del cero coma seis por ciento de los ingresos netos del año. Llevarlos con más de diez días de atraso tiene una multa del cero coma tres por ciento de los ingresos. El artículo ciento setenta y seis sanciona las declaraciones. No presentar la declaración mensual dentro del plazo tiene una multa de una U I T para el Régimen General y del cincuenta por ciento de la U I T para el R E R. Presentar declaraciones con datos falsos u omitir ingresos tiene una multa equivalente al cincuenta por ciento del tributo omitido. Todas estas multas pueden reducirse con el régimen de gradualidad si el contribuyente subsana voluntariamente antes de que SUNAT lo detecte.',
        datos: ['No llevar libros: 0.6% ingresos', 'Libros atrasados: 0.3% ingresos', 'No declarar: 1 UIT (RG) / 50%UIT (RER)', 'Datos falsos: 50% tributo omitido'],
      },
      {
        titulo: 'Régimen de gradualidad: cómo reducir multas',
        resumen: 'El régimen de gradualidad permite reducir multas tributarias entre 90% y 50% según la oportunidad de subsanación. Si se subsana antes de que SUNAT notifique: 90% de rebaja. Si se subsana después de notificado pero antes del inicio de la fiscalización: 80%. Si se subsana durante la fiscalización: 70%. Si se subsana después de la resolución: 60%.',
        audio: 'El régimen de gradualidad es el mecanismo que permite a los contribuyentes reducir significativamente las multas tributarias. Si subsanas la infracción voluntariamente y antes de que SUNAT te notifique, obtienes un noventa por ciento de descuento sobre la multa. Si subsanas después de recibir la notificación de SUNAT pero antes de que inicie la fiscalización, el descuento es del ochenta por ciento. Si subsanas durante el proceso de fiscalización, el descuento es del setenta por ciento. Y si subsanas después de que SUNAT emite la resolución de multa, el descuento es del sesenta por ciento. Para acceder a la gradualidad debes pagar el tributo omitido más los intereses moratorios junto con la multa ya rebajada.',
        datos: ['Antes de notificación: 90% rebaja', 'Después notificación: 80% rebaja', 'Durante fiscalización: 70% rebaja', 'Después resolución: 60% rebaja'],
      },
    ],
  },
  {
    id: 'calendario',
    categoria: 'Calendario Tributario',
    icon: '📅', color: C.indigo,
    articulos: [
      {
        titulo: 'Vencimientos mensuales según último dígito RUC',
        resumen: 'Las declaraciones mensuales (PDT 621) vencen según el último dígito del RUC. Generalmente: dígito 0: día 14, dígito 1: día 15, dígito 2: día 16, dígito 3: día 17, dígito 4: día 18, dígito 5: día 19, dígito 6 y 7: día 20, dígito 8 y 9: día 21. Buenos contribuyentes tienen días adicionales. Si cae en feriado o fin de semana, se traslada al siguiente día hábil.',
        audio: 'El vencimiento de las declaraciones mensuales del P D T seiscientos veintiuno depende del último dígito del número de R U C de la empresa. Para el año dos mil veintiséis, los plazos generales son los siguientes: si el R U C termina en cero, vence el catorce de cada mes. Si termina en uno, el quince. Si termina en dos, el dieciséis. Si termina en tres, el diecisiete. Si termina en cuatro, el dieciocho. Si termina en cinco, el diecinueve. Si termina en seis o siete, el veinte. Si termina en ocho o nueve, el veintiuno. Los contribuyentes reconocidos como Buenos Contribuyentes por SUNAT tienen hasta cinco días adicionales. Cuando la fecha cae en sábado, domingo o feriado nacional, el vencimiento se traslada al siguiente día hábil.',
        datos: ['RUC 0: día 14', 'RUC 1: día 15', 'RUC 2-5: días 16-19', 'RUC 6-7: día 20', 'RUC 8-9: día 21', 'Buenos Contribuyentes: +5 días'],
      },
      {
        titulo: 'Declaración anual del Impuesto a la Renta',
        resumen: 'La declaración jurada anual del IR se presenta en marzo de cada año para el ejercicio anterior. El cronograma sigue el mismo criterio del último dígito RUC. Los formularios son: PDT 702 (persona jurídica), PDT 703 (persona natural 1ra y 2da categoría), PDT 704 (persona natural 3ra categoría). Se puede presentar de forma virtual desde SUNAT Operaciones en Línea.',
        audio: 'La declaración jurada anual del Impuesto a la Renta se presenta durante el mes de marzo del año siguiente al ejercicio gravable. Por ejemplo, la declaración del año dos mil veinticinco se presenta en marzo de dos mil veintiséis. El cronograma de vencimientos sigue el mismo orden del último dígito del R U C. Para personas jurídicas o empresas en Régimen General se usa el P D T setecientos dos. Para personas naturales con rentas de primera y segunda categoría se usa el P D T setecientos tres. Para personas naturales con negocio en tercera categoría se usa el P D T setecientos cuatro. Si el resultado es un impuesto a pagar, debe cancelarse en la misma fecha del vencimiento. Si hay saldo a favor, puede solicitarse devolución o aplicarse a futuros pagos.',
        datos: ['Presentación: marzo del año siguiente', 'PDT 702: personas jurídicas', 'PDT 703: persona natural 1ra/2da', 'PDT 704: persona natural 3ra', 'Cronograma: por último dígito RUC'],
      },
    ],
  },
  {
    id: 'pcge',
    categoria: 'PCGE — Plan Contable',
    icon: '📒', color: C.purple,
    articulos: [
      {
        titulo: 'Estructura del PCGE 2020 actualizado',
        resumen: 'El Plan Contable General Empresarial (PCGE) vigente en Perú tiene 9 elementos: 1-Activo, 2-Pasivo, 3-Patrimonio, 4-Pasivo diferido/tributos, 5-Capital, 6-Gastos por naturaleza, 7-Ingresos, 8-Saldos intermediarios de gestión, 9-Contabilidad analítica.',
        audio: 'El Plan Contable General Empresarial de Perú, conocido como P C G E, fue actualizado en dos mil veinte y tiene nueve elementos principales. El elemento uno corresponde al Activo, que incluye el efectivo, cuentas por cobrar, inventarios e inmuebles. El elemento dos es el Pasivo, con las obligaciones financieras y comerciales. El elemento tres es el Patrimonio neto. El elemento cuatro incluye los Tributos y aportes al sistema de pensiones. El elemento cinco es el Patrimonio o resultados acumulados. El elemento seis son los Gastos por naturaleza, donde se registran todos los costos y gastos del negocio. El elemento siete son los Ingresos. El elemento ocho son los Saldos intermediarios de gestión. Y el elemento nueve es la Contabilidad analítica de explotación o centros de costo.',
        datos: ['1: Activo', '2: Pasivo', '3: Patrimonio', '4: Tributos', '6: Gastos por naturaleza', '7: Ingresos', '9: Analítica/Centros de costo'],
      },
      {
        titulo: 'Cuentas más usadas en contabilidad empresarial',
        resumen: 'Las cuentas de uso frecuente son: 10 (Efectivo y equivalentes), 12 (Cuentas por cobrar), 20 (Mercaderías), 40 (Tributos), 42 (Cuentas por pagar comerciales), 60 (Compras), 69 (Costo de ventas), 70 (Ventas), 636 (Servicios básicos), 401111 (IGV por pagar), 40111 (IGV crédito fiscal).',
        audio: 'Las cuentas contables más utilizadas en el día a día de una empresa peruana son las siguientes. La cuenta diez corresponde a Efectivo y equivalentes, donde se registra el dinero en caja y bancos. La cuenta doce son las Cuentas por cobrar comerciales, que representan las ventas pendientes de cobro. La cuenta veinte son las Mercaderías para las empresas comerciales. La cuenta cuarenta uno once corresponde al I G V por pagar que surge de las ventas. La cuenta cuarenta cero ciento once es el I G V crédito fiscal de las compras. La cuenta cuarenta y dos son las Cuentas por pagar comerciales a proveedores. La cuenta sesenta son las Compras de bienes. La cuenta sesenta y nueve es el Costo de Ventas. La cuenta setenta registra las Ventas e ingresos. Y la cuenta seiscientos treinta y seis son los Servicios prestados por terceros, como luz, agua e internet.',
        datos: ['10: Caja y bancos', '12: CxC comerciales', '40111: IGV crédito fiscal', '40111: IGV por pagar', '42: CxP comerciales', '60: Compras', '70: Ventas'],
      },
    ],
  },
];

// ─── Componente ─────────────────────────────────────────────────────────────
type Tab = 'ACCESO' | 'BIBLIOTECA' | 'CONSULTA_RUC';

export const SunatPortalHub: React.FC = () => {
  const [tab, setTab] = useState<Tab>('ACCESO');
  const [catActiva, setCatActiva] = useState('igv');
  const [artActivo, setArtActivo] = useState('');
  const [playingId, setPlayingId] = useState('');
  const [rucQuery, setRucQuery] = useState('');
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
            <h1 style={{ margin:0, fontSize:16, fontWeight:900, color:C.text }}>Portal SUNAT — Acceso y Biblioteca Tributaria</h1>
            <p style={{ margin:'2px 0 0', fontSize:11, color:C.muted }}>Trámites · Servicios en línea · Biblioteca completa con lectura en audio</p>
          </div>
        </div>
        <button type="button" onClick={() => openSunat('https://www.sunat.gob.pe')} style={{
          padding:'8px 18px', background:'linear-gradient(135deg,#c0392b,#e74c3c)',
          border:'none', borderRadius:9, color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer',
          fontFamily:"'Segoe UI', Arial, sans-serif",
        }}>
          🌐 Ir a SUNAT.gob.pe →
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, padding:'0 16px', background:C.bgCard, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {([
          { id:'ACCESO',       label:'🔐 Acceso a Trámites'   },
          { id:'BIBLIOTECA',   label:'📚 Biblioteca Tributaria' },
          { id:'CONSULTA_RUC', label:'🔍 Consulta RUC'         },
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
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              {SUNAT_SERVICIOS.map(cat => (
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
                        <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{item.nombre}</div>
                        <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:`${C.yellow}10`, border:`1px solid ${C.yellow}33`, borderRadius:10, padding:'12px 18px' }}>
              <p style={{ margin:0, fontSize:12, color:C.muted }}>
                <strong style={{ color:C.yellow }}>ℹ️ Nota:</strong> Los enlaces abren el portal oficial de SUNAT en una nueva pestaña.
                SUNAT no permite embeber su sitio directamente. Para operar en SOL necesitas tu{' '}
                <strong style={{ color:C.accent }}>Clave SOL</strong> (usuario y contraseña SUNAT).
              </p>
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

        {/* ═══ CONSULTA RUC ═══ */}
        {tab === 'CONSULTA_RUC' && (
          <div style={{ maxWidth:700 }}>
            <h2 style={{ margin:'0 0 6px', fontSize:15, fontWeight:800, color:C.text }}>🔍 Consulta de RUC</h2>
            <p style={{ margin:'0 0 16px', fontSize:12, color:C.muted }}>Consulta directamente en el padrón de SUNAT el estado, régimen y condición del RUC.</p>

            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <input value={rucQuery} onChange={e => setRucQuery(e.target.value.replace(/\D/g,'').slice(0,11))}
                placeholder="Ingresa el RUC (11 dígitos)"
                style={{ flex:1, padding:'10px 14px', background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, fontSize:14, outline:'none', fontFamily:"'Segoe UI', Arial, sans-serif" }} />
              <button type="button"
                onClick={() => openSunat(`https://e-consultaruc.sunat.gob.pe/cl-ti-itmrconsruc/FrameCriterioBusquedaWeb.jsp`)}
                style={{ padding:'10px 20px', background:`linear-gradient(135deg,${C.blue},${C.accent})`, border:'none', borderRadius:9, color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:"'Segoe UI', Arial, sans-serif" }}>
                Consultar en SUNAT →
              </button>
            </div>

            {/* Info sobre la consulta */}
            <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px', marginBottom:16 }}>
              <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:700, color:C.text }}>¿Qué información entrega SUNAT al consultar un RUC?</p>
              {[
                { campo:'Estado del contribuyente', desc:'ACTIVO = puede emitir comprobantes válidos · BAJA = no puede operar' },
                { campo:'Condición del domicilio', desc:'HABIDO = dirección verificada · NO HABIDO = no ubicable por SUNAT' },
                { campo:'Régimen tributario', desc:'NRUS / RER / MYPE Tributario / Régimen General' },
                { campo:'Tipo de contribuyente', desc:'Persona Natural / Persona Jurídica / etc.' },
                { campo:'Fecha de inscripción', desc:'Cuándo se registró ante SUNAT' },
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
                <strong style={{ color:C.green }}> HABIDO</strong> en SUNAT.
                Si el proveedor es NO HABIDO al momento de la operación, SUNAT puede desconocer el crédito fiscal aunque el comprobante sea electrónico y válido.
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
