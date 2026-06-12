import React, { useMemo, useRef, useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody, Text } from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';

export type PurchaseFormData = {
  serie: string;
  number: string;
  supplierNit: string;
  subtotal: string;
  iva: string;
  expenseAccount: string;
  costCenter: string;
  currency: string;
};

type PurchaseItem = {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  lineSubtotal: string;
  accountCode: string;
  accountName: string;
  costCenter: string;
  taxTreatment: string;
  aiReason: string;
  aiConfidence: number;
  requiresReview: boolean;
  taxable: boolean;
  ivaAmount: string;
  totalLine: string;
  lineType: AccountingLineType;
  requiresSupport: boolean;
  isInventory?: boolean;
  itemClass?: string | null;
  catalogCode?: string | null;
  catalogNat?: string | null;
  catalogRub?: string | null;
  catalogTk?: string | null;
  catalogMatch?: boolean;
  gastoAccount?: string | null;
};

type GuideForm = {
  serie: string;
  number: string;
  transferDate: string;
  motivoTraslado: string;
  modalidadTransporte: string;
  pesoBrutoTotal: string;
  numeroBultos: string;
  partidaDireccion: string;
  partidaDane: string;
  llegadaDireccion: string;
  llegadaDane: string;
  transportistaNit: string;
  transportistaRazonSocial: string;
  conductorCedula: string;
  conductorLicencia: string;
  placaVehiculo: string;
};

type RucValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'unknown';

type AccountingLineType =
  | 'EXPENSE_OR_ASSET'
  | 'TAX'
  | 'PAYABLE'
  | 'ROUNDING'
  | 'PRIOR_BALANCE'
  | 'ADVANCE_PAYMENT'
  | 'LATE_FEE'
  | 'WITHHOLDING'
  | 'RETE_FUENTE'
  | 'RETE_IVA'
  | 'INFO_ONLY';

type ExplicitAccountLine = {
  accountCode: string;
  accountName: string;
  costCenter: string;
  debit: string;
  credit: string;
  lineType: AccountingLineType;
  taxTreatment: string;
  auditNote?: string;
};

export type PurchaseSubmitPayload = {
  form: PurchaseFormData;
  supplierName: string;
  issueDate: string;
  subtotal: string;
  iva: string;
  total: string;
  items: Array<{
    code: string;
    description: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    lineSubtotal: string;
    accountCode: string;
    accountName: string;
    costCenter: string;
    taxTreatment: string;
    aiReason: string;
    aiConfidence: number;
    requiresReview: boolean;
    taxable: boolean;
    ivaAmount: string;
    totalLine: string;
    lineType: AccountingLineType;
    requiresSupport: boolean;
  }>;
  accountLines: Array<{
    accountCode: string;
    accountName: string;
    costCenter: string;
    debit: string;
    credit: string;
    lineType: AccountingLineType;
    taxTreatment: string;
    auditNote?: string;
  }>;
  accountsToUpsert: Array<{
    accountCode: string;
    accountName: string;
    accountClass: string;
    nature: 'DEBIT' | 'CREDIT';
    taxTreatment: string;
    requiresReview: boolean;
  }>;
  costCentersToUpsert: Array<{
    code: string;
    name: string;
    source: 'PURCHASE_FORM' | 'GEMINI' | 'MANUAL';
  }>;
  auditMetadata: {
    source: 'MANUAL' | 'GEMINI';
    selectedFileName: string;
    aiWarnings: string[];
    modifyReason: string;
    modifyDetail: string;
    engineVersion: string;
    totalReadFromDocument?: string;
    reconciliationStatus?: string;
    reconciliationDifference?: string;
    accountingWarnings?: string[];
    taxWarnings?: string[];
    legalWarnings?: string[];
  };
};

type PurchaseFormEnterpriseProps = {
  form: PurchaseFormData;
  onFormChange: (next: PurchaseFormData) => void;
  tenantId?: string;
  onClose: () => void;
  onSubmit: (payload: PurchaseSubmitPayload) => Promise<void> | void;
};

type GeminiPurchaseItem = {
  code?: string;
  description?: string;
  unit?: string;
  quantity?: number | string;
  unit_price?: number | string;
  line_subtotal?: number | string;
  taxable?: boolean;
  iva_amount?: number | string;
  total_line?: number | string;
  line_type?: AccountingLineType | string;
  deductibility?: string;
  iva_credit?: string;
  requires_support?: boolean;
  account_code?: string;
  account_name?: string;
  cost_center?: string;
  tax_treatment?: string;
  ai_reason?: string;
  ai_confidence?: number;
  is_inventory?: boolean;
  item_class?: string | null;
  catalog_code?: string | null;
  catalog_nat?: string | null;
  catalog_rub?: string | null;
  catalog_tk?: string | null;
  catalog_match?: boolean;
  gasto_account?: string | null;
};

type GeminiPurchaseResponse = {
  serie?: string;
  number?: string;
  issue_date?: string;
  supplier_nit?: string;
  supplier_ruc?: string;
  supplier_name?: string;
  subtotal?: number | string;
  iva?: number | string;
  total?: number | string;
  total_read_from_document?: number | string;
  reconciliation_status?: string;
  reconciliation_difference?: number | string;
  cost_center?: string;
  expense_account?: string;
  items?: GeminiPurchaseItem[];
  account_lines?: Array<{
    account_code?: string;
    account_name?: string;
    cost_center?: string;
    debit?: number | string;
    credit?: number | string;
    line_type?: AccountingLineType | string;
    tax_treatment?: string;
    audit_note?: string;
  }>;
  currency?: string;
  accounts_to_upsert?: PurchaseSubmitPayload['accountsToUpsert'];
  cost_centers_to_upsert?: Array<{ code: string; name?: string; parent_code?: string }>;
  audit_metadata?: {
    document_quality?: string;
    ocr_warnings?: string[];
    tax_warnings?: string[];
    legal_warnings?: string[];
    accounting_warnings?: string[];
    reconciliation_notes?: string[];
    requires_human_review?: boolean;
    review_reason?: string;
  };
  warnings?: string[];
};

const API_BASE = '/api/v1';
const DEFAULT_COST_CENTER = 'BOG-ADM';
const ENGINE_VERSION = 'CONTA_COLPRO_PURCHASE_AI_RULES_CO_2026_01';
const AUTO_ROUNDING_TOLERANCE = 100; // tolerance in COP

const toNumber = (value: string | number | undefined | null): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let s = String(value ?? '0').replace(/[$\s]/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const parsed = Number.parseFloat(s);
  return Number.isFinite(parsed) ? parsed : 0;
};

// COP Colombia — punto como separador de miles (es-CO)
const money = (value: number): string =>
  Number.isFinite(value)
    ? Math.round(value).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '0';
const formatCOP = (value: number) =>
  `$ ${Math.round(value).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const newId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`;
};

const normalizeDate = (value?: string) => {
  if (!value) return '';
  const clean = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return '';
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

const normalizeAccount = (value: string) => String(value || '').replace(/\D/g, '').slice(0, 10);

const accountClassName = (accountCode: string) => {
  const first = normalizeAccount(accountCode).charAt(0);
  if (first === '1') return 'Activo';
  if (first === '2') return 'Pasivo';
  if (first === '3') return 'Patrimonio';
  if (first === '4') return 'Ingresos';
  if (first === '5') return 'Gastos';
  if (first === '6') return 'Costos de ventas y servicios';
  if (first === '7') return 'Costos de producción';
  if (first === '8') return 'Cuentas de orden deudoras';
  if (first === '9') return 'Cuentas de orden acreedoras';
  return 'Cuenta por clasificar';
};

const accountNature = (accountCode: string): 'DEBIT' | 'CREDIT' => {
  const first = normalizeAccount(accountCode).charAt(0);
  // PUC Colombia: Pasivo(2), Patrimonio(3), Ingresos(4), Orden acreedoras(9) = CREDIT
  return ['2', '3', '4', '9'].includes(first) ? 'CREDIT' : 'DEBIT';
};

const normalizeCostCenter = (value?: string) => {
  const clean = String(value || DEFAULT_COST_CENTER).trim().toUpperCase().replace(/\s+/g, '-');
  return clean || DEFAULT_COST_CENTER;
};


const isRoundingLine = (description: string, code = '') => {
  const text = `${code} ${description}`.toUpperCase();
  return /REDONDEO|ROUNDING|AJUSTE\s+MONEDA|DIFERENCIA\s+DE\s+REDONDEO|REDONDEO\s+MES/.test(text);
};

const isPriorDebtLine = (description: string, code = '') => {
  const text = `${code} ${description}`.toUpperCase();
  return /DEUDA\s+ANT|DEUDA\s+ANTERIOR|SALDO\s+ANTERIOR|SALDO\s+VENCIDO|RECIBO\s+ANTERIOR|PENDIENTE\s+DE\s+PAGO|CARGO\s+ANTERIOR/.test(text);
};

const isAdvanceOrCreditLine = (description: string, code = '') => {
  const text = `${code} ${description}`.toUpperCase();
  return /PAGO\s+A\s+CUENTA|ABONO|SALDO\s+A\s+FAVOR|CREDITO\s+ANTERIOR|CRÉDITO\s+ANTERIOR|COMPENSACION|COMPENSACIÓN/.test(text);
};

const isLateFeeLine = (description: string, code = '') => {
  const text = `${code} ${description}`.toUpperCase();
  return /MORA|INTERES|INTERÉS|PENALIDAD|RECARGO|CARGO\s+POR\s+ATRASO/.test(text);
};

const normalizeLineType = (value?: string): AccountingLineType => {
  const clean = String(value || '').toUpperCase();
  if (clean === 'ROUNDING') return 'ROUNDING';
  if (clean === 'PRIOR_BALANCE') return 'PRIOR_BALANCE';
  if (clean === 'ADVANCE_PAYMENT') return 'ADVANCE_PAYMENT';
  if (clean === 'LATE_FEE') return 'LATE_FEE';
  if (clean === 'TAX') return 'TAX';
  if (clean === 'PAYABLE') return 'PAYABLE';
  if (clean === 'WITHHOLDING') return 'WITHHOLDING';
  if (clean === 'RETE_FUENTE') return 'RETE_FUENTE';
  if (clean === 'RETE_IVA') return 'RETE_IVA';
  if (clean === 'INFO_ONLY') return 'INFO_ONLY';
  return 'EXPENSE_OR_ASSET';
};

const shouldBypassReview = (item: Pick<PurchaseItem, 'description' | 'code' | 'lineSubtotal' | 'accountCode' | 'lineType'>) => {
  const amount = Math.abs(toNumber(item.lineSubtotal));
  if ((item.lineType === 'ROUNDING' || isRoundingLine(item.description, item.code)) && amount <= AUTO_ROUNDING_TOLERANCE) {
    return true;
  }
  if ((item.lineType === 'PRIOR_BALANCE' || isPriorDebtLine(item.description, item.code)) && normalizeAccount(item.accountCode)) {
    return true;
  }
  if ((item.lineType === 'ADVANCE_PAYMENT' || isAdvanceOrCreditLine(item.description, item.code)) && normalizeAccount(item.accountCode)) {
    return true;
  }
  if (item.lineType === 'INFO_ONLY') return true;
  return false;
};

const classifyPurchaseItem = (description: string, providerName = '') => {
  const text = `${description} ${providerName}`.toUpperCase();

  if (isRoundingLine(description)) {
    return { accountCode: '519099', accountName: 'Ajuste por redondeo', costCenter: DEFAULT_COST_CENTER, taxTreatment: 'Diferencia de redondeo. No genera IVA ni base gravable. Reconcilia el total impreso.', aiConfidence: 0.99, aiReason: 'Línea técnica de redondeo.', requiresReview: false };
  }
  if (isPriorDebtLine(description)) {
    return { accountCode: '280505', accountName: 'Deuda anterior servicios públicos', costCenter: '-', taxTreatment: 'Saldo anterior. No representa gasto nuevo ni genera nuevo IVA descontable.', aiConfidence: 0.96, aiReason: 'Saldo anterior incluido en el recibo.', requiresReview: false };
  }
  if (isAdvanceOrCreditLine(description)) {
    return { accountCode: '220505', accountName: 'Proveedores / pago a cuenta', costCenter: '-', taxTreatment: 'Abono o pago a cuenta. No es gasto nuevo y no genera IVA (Art. 485 ET).', aiConfidence: 0.96, aiReason: 'Abono, crédito o pago a cuenta.', requiresReview: false };
  }
  if (isLateFeeLine(description)) {
    return { accountCode: '519020', accountName: 'Moras, recargos e intereses', costCenter: DEFAULT_COST_CENTER, taxTreatment: 'Interés de mora (Art. 1617 CC). IVA sujeto a revisión. Deducible Art. 107 ET.', aiConfidence: 0.86, aiReason: 'Mora, recargo o penalidad.', requiresReview: true };
  }

  // PUC Colombia — Decreto 2649/1993 — cuentas 51xxxx gastos operacionales
  if (/AGUA|ALCANTARILLADO|TRIPLE A|AAA|EPM AGUA|LUZ|ELECTRICIDAD|CODENSA|EPM|CELSIA|ENERGIA|GAS|SURTIGAS|VANTI|INTERNET|TELEFON|CLARO|MOVISTAR|TIGO|ETB|CARGO FIJO/.test(text)) {
    return { accountCode: '513515', accountName: 'Servicios públicos domiciliarios', costCenter: 'BOG-ADM', taxTreatment: 'IVA descontable Art. 485 ET si uso empresarial. Agua/gas residencial: IVA 0% Art. 424 ET. CREG/CRA regulados.', aiConfidence: 0.95, aiReason: 'Servicio público identificado.', requiresReview: false };
  }
  if (/ASESORIA|CONSULTORIA|CONSULTOR|SERVICIO PROFESIONAL|HONORARIO|AUDITORIA|LEGAL|CONTABLE/.test(text)) {
    return { accountCode: '513550', accountName: 'Honorarios profesionales', costCenter: 'BOG-ADM', taxTreatment: 'ReteFuente 10-11% Art. 383 ET. ReteIVA 15% Art. 437-2 ET. Deducible Art. 107 ET.', aiConfidence: 0.91, aiReason: 'Honorarios o consultoría.', requiresReview: false };
  }
  if (/FLETE|TRANSPORTE|DELIVERY|COURIER|MOVILIDAD|TRASLADO|CARGA|ENVIO/.test(text)) {
    return { accountCode: '513530', accountName: 'Transporte, fletes y acarreos', costCenter: 'BOG-ALM', taxTreatment: 'ReteFuente 3.5% transporte Art. 385 ET. IVA descontable si uso empresarial.', aiConfidence: 0.9, aiReason: 'Gasto de transporte/flete.', requiresReview: false };
  }
  if (/MANTENIMIENTO|REPARACION|SOPORTE|TECNICO|SERVICIO TECNICO/.test(text)) {
    return { accountCode: '513540', accountName: 'Mantenimiento y reparaciones', costCenter: 'BOG-ADM', taxTreatment: 'Gasto deducible Art. 107 ET. IVA descontable. Distinguir mejora (capitalizar) vs reparación (gasto).', aiConfidence: 0.88, aiReason: 'Mantenimiento o reparación.', requiresReview: false };
  }
  if (/UTILES|SUMINISTRO|MATERIAL|LIMPIEZA|OFICINA|PAPEL|TONER|TINTA/.test(text)) {
    return { accountCode: '513555', accountName: 'Papelería y útiles de oficina', costCenter: 'BOG-ADM', taxTreatment: 'Gasto operativo deducible Art. 107 ET. IVA descontable Art. 485 ET.', aiConfidence: 0.87, aiReason: 'Suministros de oficina.', requiresReview: false };
  }
  if (/PUBLICIDAD|MARKETING|ANUNCIO|CAMPAÑA|DISEÑO|REDES/.test(text)) {
    return { accountCode: '513565', accountName: 'Publicidad y propaganda', costCenter: 'BOG-COM', taxTreatment: 'Deducible si acredita necesidad comercial Art. 107 ET. IVA descontable Art. 485 ET.', aiConfidence: 0.88, aiReason: 'Publicidad o marketing.', requiresReview: false };
  }
  if (/ALQUILER|ARRENDAMIENTO|RENTA|LOCAL|OFICINA/.test(text)) {
    return { accountCode: '513545', accountName: 'Arrendamientos', costCenter: 'BOG-ADM', taxTreatment: 'ReteFuente 3.5% Art. 385 ET. IVA 19% si arrendador es persona jurídica. Bancarización >$1M Art. 771-5 ET.', aiConfidence: 0.9, aiReason: 'Arrendamiento.', requiresReview: false };
  }
  if (/LAPTOP|COMPUTADORA|IMPRESORA|MAQUINA|EQUIPO|MOBILIARIO|ACTIVO|VEHICULO/.test(text)) {
    return { accountCode: '152005', accountName: 'Maquinaria y equipo (activo fijo)', costCenter: 'BOG-ADM', taxTreatment: 'Capitalizar si supera política PPE (NIC 16 / Sección 17 NIIF). Depreciar Art. 137 ET.', aiConfidence: 0.82, aiReason: 'Posible activo fijo PPE.', requiresReview: true };
  }
  if (/SOFTWARE|SERVIDOR|NUBE|HOSTING|SISTEMA|LICENCIA/.test(text)) {
    return { accountCode: '513525', accountName: 'Telecomunicaciones y tecnología', costCenter: 'TI-CORE', taxTreatment: 'Gasto TI deducible Art. 107 ET. Software: amortizar cuenta 160505 si >1 año.', aiConfidence: 0.88, aiReason: 'Gasto de tecnología/sistemas.', requiresReview: false };
  }
  if (/NOMINA|CAPACITACION|PERSONAL|RRHH|DOTACION/.test(text)) {
    return { accountCode: '510506', accountName: 'Sueldos y salarios', costCenter: 'RRHH', taxTreatment: 'Gasto de personal deducible CST/Ley 100. ReteFuente Art. 383 ET si corresponde.', aiConfidence: 0.87, aiReason: 'Gasto de personal.', requiresReview: false };
  }
  if (/MERCADERIA|PRODUCTO PARA VENTA|INVENTARIO|STOCK/.test(text)) {
    return { accountCode: '143505', accountName: 'Mercancías en almacén (inventario)', costCenter: 'BOG-ALM', taxTreatment: 'Afecta inventario/kardex PUC 143505. Costo promedio o PEPS (Sección 13 NIIF). IVA descontable Art. 485 ET.', aiConfidence: 0.86, aiReason: 'Mercadería/inventario.', requiresReview: false };
  }

  return { accountCode: '519099', accountName: 'Otros gastos operacionales', costCenter: DEFAULT_COST_CENTER, taxTreatment: 'Revisar causalidad Art. 107 ET antes de postear. IVA descontable si cumple Art. 485 ET.', aiConfidence: 0.55, aiReason: 'Sin regla específica. Requiere clasificación manual.', requiresReview: true };
};

const createItem = (costCenter = DEFAULT_COST_CENTER): PurchaseItem => ({
  id: newId(),
  code: '',
  description: '',
  unit: 'UND',
  quantity: '1.00',
  unitPrice: '0.00',
  lineSubtotal: '0.00',
  accountCode: '',
  accountName: '',
  costCenter: normalizeCostCenter(costCenter),
  taxTreatment: '',
  aiReason: '',
  aiConfidence: 0,
  requiresReview: true,
  taxable: true,
  ivaAmount: '0.00',
  totalLine: '0.00',
  lineType: 'EXPENSE_OR_ASSET',
  requiresSupport: true,
});

export const PurchaseFormEnterprise = ({ form, onFormChange, tenantId, onClose, onSubmit }: PurchaseFormEnterpriseProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
  const [isAutoIgv, setIsAutoIgv] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [isReadingAi, setIsReadingAi] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [rucState, setRucState] = useState<RucValidationState>('idle');
  const [rucMessage, setRucMessage] = useState('Pendiente de validación externa');
  const [status, setStatus] = useState('');
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [explicitAccountLines, setExplicitAccountLines] = useState<ExplicitAccountLine[]>([]);
  const [aiTotalReadFromDocument, setAiTotalReadFromDocument] = useState('');
  const [aiReconciliationStatus, setAiReconciliationStatus] = useState('');
  const [aiReconciliationDifference, setAiReconciliationDifference] = useState('');
  const [aiTaxWarnings, setAiTaxWarnings] = useState<string[]>([]);
  const [aiLegalWarnings, setAiLegalWarnings] = useState<string[]>([]);
  const [aiAccountingWarnings, setAiAccountingWarnings] = useState<string[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [showModify, setShowModify] = useState(false);
  const [modifyReason, setModifyReason] = useState('');
  const [modifyDetail, setModifyDetail] = useState('');

  const [guide, setGuide] = useState<GuideForm>({
    serie: 'T001',
    number: '',
    transferDate: '',
    motivoTraslado: 'COMPRA',
    modalidadTransporte: 'PUBLICO',
    pesoBrutoTotal: '0.00',
    numeroBultos: '1',
    partidaDireccion: '',
    partidaDane: '11001',
    llegadaDireccion: '',
    llegadaDane: '11001',
    transportistaNit: '',
    transportistaRazonSocial: '',
    conductorCedula: '',
    conductorLicencia: '',
    placaVehiculo: '',
  });

  const subtotalItems = useMemo(
    () => items.reduce((acc, item) => acc + (item.lineType === 'INFO_ONLY' ? 0 : toNumber(item.lineSubtotal)), 0),
    [items],
  );
  const subtotal = toNumber(form.subtotal) > 0 ? toNumber(form.subtotal) : subtotalItems;
  const iva = isAutoIgv && !aiTotalReadFromDocument ? subtotal * 0.19 : toNumber(form.iva);
  const total = aiTotalReadFromDocument ? toNumber(aiTotalReadFromDocument) : subtotal + iva;

  const groupedLines = useMemo(() => {
    const map = new Map<string, { accountCode: string; accountName: string; costCenter: string; amount: number; taxTreatment: string }>();
    items.forEach((item) => {
      if (!item.accountCode) return;
      if (item.lineType === 'INFO_ONLY') return;
      const costCenter = normalizeCostCenter(item.costCenter || form.costCenter);
      const key = `${normalizeAccount(item.accountCode)}|${costCenter}`;
      const current = map.get(key);
      if (current) current.amount += toNumber(item.lineSubtotal);
      else map.set(key, {
        accountCode: normalizeAccount(item.accountCode),
        accountName: item.accountName,
        costCenter,
        amount: toNumber(item.lineSubtotal),
        taxTreatment: item.taxTreatment,
      });
    });
    return Array.from(map.values());
  }, [items, form.costCenter]);

  const accountingLines = useMemo<ExplicitAccountLine[]>(() => {
    if (explicitAccountLines.length > 0) {
      return explicitAccountLines;
    }

    return [
      ...groupedLines.map((line) => ({
        accountCode: line.accountCode,
        accountName: line.accountName,
        costCenter: normalizeCostCenter(line.costCenter),
        debit: money(line.amount),
        credit: '0.00',
        lineType: 'EXPENSE_OR_ASSET' as AccountingLineType,
        taxTreatment: line.taxTreatment,
      })),
      {
        accountCode: '2408',
        accountName: 'IVA descontable (Art. 485 ET)',
        costCenter: '-',
        debit: money(iva),
        credit: '0.00',
        lineType: 'TAX' as AccountingLineType,
        taxTreatment: 'Crédito fiscal condicionado a comprobante válido, causalidad, fehaciencia y anotación oportuna',
      },
      {
        accountCode: '220505',
        accountName: 'Cuentas por pagar comerciales',
        costCenter: '-',
        debit: '0.00',
        credit: money(total),
        lineType: 'PAYABLE' as AccountingLineType,
        taxTreatment: 'Obligación comercial por comprobante de compra',
      },
    ].filter((line) => toNumber(line.debit) !== 0 || toNumber(line.credit) !== 0);
  }, [explicitAccountLines, groupedLines, iva, total]);

  const accountsToUpsert = useMemo(() => {
    const map = new Map<string, PurchaseSubmitPayload['accountsToUpsert'][number]>();
    accountingLines.forEach((line) => {
      if (!line.accountCode) return;
      map.set(line.accountCode, {
        accountCode: line.accountCode,
        accountName: line.accountName || 'Cuenta por clasificar',
        accountClass: accountClassName(line.accountCode),
        nature: accountNature(line.accountCode),
        taxTreatment: line.taxTreatment,
        requiresReview: line.accountCode === '659101' && line.lineType !== 'ROUNDING',
      });
    });
    map.set('2408', {
      accountCode: '2408',
      accountName: 'IVA descontable (Art. 485 ET)',
      accountClass: accountClassName('2408'),
      nature: 'DEBIT',
      taxTreatment: 'Crédito fiscal condicionado a comprobante válido, fehaciencia, causalidad y anotación oportuna',
      requiresReview: false,
    });
    map.set('220505', {
      accountCode: '220505',
      accountName: 'Cuentas por pagar comerciales',
      accountClass: accountClassName('220505'),
      nature: 'CREDIT',
      taxTreatment: 'Obligación comercial por comprobante pendiente de pago',
      requiresReview: false,
    });
    return Array.from(map.values());
  }, [accountingLines]);

  const costCentersToUpsert = useMemo(() => {
    const codes = new Set<string>();
    items.forEach((item) => {
      const cc = normalizeCostCenter(item.costCenter || form.costCenter);
      if (cc !== '-') codes.add(cc);
    });
    accountingLines.forEach((line) => {
      const cc = normalizeCostCenter(line.costCenter || form.costCenter);
      if (line.costCenter !== '-' && cc !== '-') codes.add(cc);
    });
    if (codes.size === 0) codes.add(normalizeCostCenter(form.costCenter));
    return Array.from(codes).map((code) => ({ code, name: code, source: 'PURCHASE_FORM' as const }));
  }, [items, form.costCenter, accountingLines]);

  const updateField = (key: keyof PurchaseFormData, value: string) => {
    const next = { ...form, [key]: value };

    if (key === 'subtotal' && isAutoIgv) {
      next.iva = money(toNumber(value) * 0.19);
    }

    if (key === 'costCenter') {
      const previousGeneralCostCenter = normalizeCostCenter(form.costCenter);
      const nextCostCenter = normalizeCostCenter(value);

      setItems((prev) =>
        prev.map((item) => {
          const itemCostCenter = normalizeCostCenter(item.costCenter);
          const shouldUpdate =
            !item.costCenter ||
            itemCostCenter === DEFAULT_COST_CENTER ||
            itemCostCenter === previousGeneralCostCenter;

          return shouldUpdate ? { ...item, costCenter: nextCostCenter } : item;
        }),
      );
    }

    onFormChange(next);
  };

  const updateItem = (id: string, key: keyof PurchaseItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [key]: value };

        if (key === 'quantity' || key === 'unitPrice') {
          next.lineSubtotal = money(toNumber(next.quantity) * toNumber(next.unitPrice));
        }

        if (key === 'accountCode') {
          next.accountCode = normalizeAccount(value);
        }

        if (key === 'costCenter') {
          next.costCenter = normalizeCostCenter(value);
        }

        if (key === 'description') {
          const c = classifyPurchaseItem(value, supplierName);
          next.accountCode = c.accountCode;
          next.accountName = c.accountName;
          next.taxTreatment = c.taxTreatment;
          next.aiReason = c.aiReason;
          next.aiConfidence = c.aiConfidence;
          next.requiresReview = c.requiresReview;
          next.lineType = isRoundingLine(value)
            ? 'ROUNDING'
            : isPriorDebtLine(value)
              ? 'PRIOR_BALANCE'
              : isAdvanceOrCreditLine(value)
                ? 'ADVANCE_PAYMENT'
                : isLateFeeLine(value)
                  ? 'LATE_FEE'
                  : 'EXPENSE_OR_ASSET';
          next.taxable = next.lineType === 'EXPENSE_OR_ASSET';
          next.requiresSupport = c.requiresReview;
          next.ivaAmount = next.taxable ? next.ivaAmount : '0.00';
          // Distribuir al centro de costo correcto según el tipo de gasto (OBLIGATORIO)
          next.costCenter = next.lineType === 'PRIOR_BALANCE' || next.lineType === 'ADVANCE_PAYMENT'
            ? '-'
            : normalizeCostCenter(c.costCenter || form.costCenter || next.costCenter || DEFAULT_COST_CENTER);
        }

        return next;
      }),
    );
  };

  const addItem = () => setItems((prev) => [...prev, createItem(form.costCenter)]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const applyGeminiPayload = (payload: GeminiPurchaseResponse) => {
    const nextSerie = payload.serie || form.serie || '';
    const nextNumber = payload.number || form.number || '';
    const nextSupplierRuc = payload.supplier_nit || payload.supplier_ruc || form.supplierNit || '';
    const nextSupplierName = payload.supplier_name || supplierName || '';
    const nextCostCenter = normalizeCostCenter(payload.cost_center || form.costCenter || DEFAULT_COST_CENTER);

    const mappedItems = (payload.items || []).map((raw) => {
      const description = String(raw.description || '');
      const fallback = classifyPurchaseItem(description, nextSupplierName);
      const qty = toNumber(raw.quantity || 1);
      const unitPrice = toNumber(raw.unit_price || 0);
      const lineSubtotal = toNumber(raw.line_subtotal || qty * unitPrice);
      const accountCode = normalizeAccount(String(raw.account_code || fallback.accountCode));
      const aiConfidence = Number(raw.ai_confidence ?? fallback.aiConfidence);

      const lineType = normalizeLineType(String(raw.line_type || ''));
      const detectedLineType = lineType !== 'EXPENSE_OR_ASSET'
        ? lineType
        : isRoundingLine(description, String(raw.code || ''))
          ? 'ROUNDING'
          : isPriorDebtLine(description, String(raw.code || ''))
            ? 'PRIOR_BALANCE'
            : isAdvanceOrCreditLine(description, String(raw.code || ''))
              ? 'ADVANCE_PAYMENT'
              : isLateFeeLine(description, String(raw.code || ''))
                ? 'LATE_FEE'
                : 'EXPENSE_OR_ASSET';

      const requiresSupport = Boolean(raw.requires_support ?? fallback.requiresReview);
      const requiresReview = shouldBypassReview({
        description,
        code: String(raw.code || ''),
        lineSubtotal: money(lineSubtotal),
        accountCode,
        lineType: detectedLineType as AccountingLineType,
      })
        ? false
        : Boolean(requiresSupport || aiConfidence < 0.8 || (accountCode === '659101' && detectedLineType !== 'ROUNDING'));

      const accPrefix = accountCode.slice(0, 2);
      const isInventoryByAccount = accPrefix === '14' || accPrefix === '15';
      return {
        id: newId(),
        code: String(raw.code || ''),
        description,
        unit: String(raw.unit || 'UND'),
        quantity: money(qty),
        unitPrice: money(unitPrice),
        lineSubtotal: money(lineSubtotal),
        accountCode,
        accountName: String(raw.account_name || fallback.accountName),
        costCenter: detectedLineType === 'PRIOR_BALANCE' || detectedLineType === 'ADVANCE_PAYMENT'
          ? '-'
          : normalizeCostCenter(raw.cost_center || nextCostCenter),
        taxTreatment: String(raw.tax_treatment || fallback.taxTreatment),
        aiReason: String(raw.ai_reason || fallback.aiReason),
        aiConfidence,
        requiresReview,
        taxable: Boolean(raw.taxable ?? detectedLineType === 'EXPENSE_OR_ASSET'),
        ivaAmount: money(toNumber(raw.iva_amount || 0)),
        totalLine: money(toNumber(raw.total_line || lineSubtotal)),
        lineType: detectedLineType as AccountingLineType,
        requiresSupport,
        isInventory: Boolean(raw.is_inventory ?? isInventoryByAccount),
        itemClass: String(raw.item_class || (isInventoryByAccount ? 'MERCADERIA' : '')) || null,
        catalogCode: raw.catalog_code ? String(raw.catalog_code) : null,
        catalogNat: raw.catalog_nat ? String(raw.catalog_nat) : null,
        catalogRub: raw.catalog_rub ? String(raw.catalog_rub) : null,
        catalogTk: raw.catalog_tk ? String(raw.catalog_tk) : null,
        catalogMatch: Boolean(raw.catalog_match ?? false),
        gastoAccount: raw.gasto_account ? String(raw.gasto_account) : null,
      };
    });

    const mappedAccountLines: ExplicitAccountLine[] = (payload.account_lines || []).map((raw) => ({
      accountCode: normalizeAccount(String(raw.account_code || '')),
      accountName: String(raw.account_name || 'Cuenta por clasificar'),
      costCenter: String(raw.cost_center || '-').toUpperCase(),
      debit: money(toNumber(raw.debit || 0)),
      credit: money(toNumber(raw.credit || 0)),
      lineType: normalizeLineType(String(raw.line_type || 'EXPENSE_OR_ASSET')),
      taxTreatment: String(raw.tax_treatment || ''),
      auditNote: String(raw.audit_note || ''),
    })).filter((line) => line.accountCode && (toNumber(line.debit) !== 0 || toNumber(line.credit) !== 0));

    const mergedWarnings = [
      ...(payload.warnings || []),
      ...(payload.audit_metadata?.ocr_warnings || []),
      ...(payload.audit_metadata?.reconciliation_notes || []),
    ];

    setIssueDate(normalizeDate(payload.issue_date));
    setSupplierName(nextSupplierName);
    setItems(mappedItems);
    setExplicitAccountLines(mappedAccountLines);
    setAiTotalReadFromDocument(money(toNumber(payload.total_read_from_document || payload.total || 0)));
    setAiReconciliationStatus(String(payload.reconciliation_status || ''));
    setAiReconciliationDifference(money(toNumber(payload.reconciliation_difference || 0)));
    setAiTaxWarnings(payload.audit_metadata?.tax_warnings || []);
    setAiLegalWarnings(payload.audit_metadata?.legal_warnings || []);
    setAiAccountingWarnings(payload.audit_metadata?.accounting_warnings || []);
    setAiWarnings(mergedWarnings);

    onFormChange({
      ...form,
      serie: nextSerie,
      number: nextNumber,
      supplierNit: nextSupplierRuc,
      subtotal: money(toNumber(payload.subtotal ?? mappedItems.reduce((a, i) => a + toNumber(i.lineSubtotal), 0))),
      iva: money(toNumber(payload.iva ?? mappedItems.reduce((a, i) => a + toNumber(i.ivaAmount), 0))),
      expenseAccount: normalizeAccount(String(payload.expense_account || mappedItems[0]?.accountCode || form.expenseAccount || '659101')),
      costCenter: nextCostCenter,
      currency: String(payload.currency || 'COP'),
    });

    setIsAutoIgv(false);
    setStatus('Factura leída con Gemini. El total del comprobante manda; revise cuenta, centro de costo y conciliación antes de guardar.');
  };

  const readInvoiceWithGemini = async (file: File) => {
    setIsReadingAi(true);
    setSelectedFileName(file.name);
    setStatus('Leyendo factura con Gemini pixel por pixel...');
    setAiWarnings([]);

    try {
      const currentTenantId = tenantId || localStorage.getItem('tenant_id') || '11111111-1111-1111-1111-111111111111'

      let token = localStorage.getItem('access_token') || '';
      if (!token) {
        const _u = localStorage.getItem('login_username');
        const _p = localStorage.getItem('login_password');
        if (_u && _p) {
          const _r = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: _u, password: _p, tenant_id: currentTenantId }) });
          if (_r.ok) { const _d = await _r.json() as { access_token?: string }; token = _d.access_token || ''; if (token) localStorage.setItem('access_token', token); }
        }
      }
      const formData = new FormData();
      formData.append('file', file);

      const geminiKey = localStorage.getItem('user_gemini_api_key') || '';
      const response = await fetch(`${API_BASE}/purchases/process-ia`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Tenant-Id': currentTenantId,
          ...(geminiKey ? { 'X-Gemini-Key': geminiKey } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as GeminiPurchaseResponse;
      applyGeminiPayload(payload);
    } catch (error) {
      setStatus(`No se pudo leer con Gemini. ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsReadingAi(false);
    }
  };

  const validateRucExternally = async () => {
    if (!/^\d{9,12}$/.test(form.supplierNit.replace(/[^0-9]/g, ''))) {
      setRucState('invalid');
      setRucMessage('NIT inválido: debe tener entre 9 y 12 dígitos.');
      return;
    }
    setRucState('validating');
    setRucMessage('Consultando servicio externo...');
    try {
      const nit = form.supplierNit.replace(/[\.\-]/g, '');
      const response = await fetch(`https://api.datos.gov.co/resource/swrg-pj5c.json?nit=${nit}`);
      if (response.ok) {
        const data = await response.json();
        const nombre = data?.[0]?.nombre_contribuyente || data?.[0]?.razon_social || '';
        if (nombre) setSupplierName(nombre);
        setRucState('valid');
        setRucMessage('NIT validado en DIAN. Razón social cargada.');
        return;
      }
      setRucState('unknown');
      setRucMessage('DIAN no disponible. Continuar con validación manual.');
    } catch {
      setRucState('unknown');
      setRucMessage('No se pudo validar externamente. Verifica red/CORS.');
    }
  };

  const openGuideFromInvoice = () => {
    setGuide((prev) => ({
      ...prev,
      transferDate: issueDate || prev.transferDate,
      motivoTraslado: 'COMPRA',
      numeroBultos: String(Math.max(items.length, 1)),
    }));
    setShowGuide(true);
  };

  const validateBeforeSubmit = () => {
    if (!form.serie.trim()) return 'Falta serie.';
    if (!form.number.trim()) return 'Falta número.';
    if (!issueDate.trim()) return 'Falta fecha.';
    if (!/^\d{9,12}$/.test(form.supplierNit.replace(/[\.\-]/g, ''))) return 'NIT proveedor inválido (9-12 dígitos).';
    if (!supplierName.trim()) return 'Falta razón social proveedor.';
    if (items.length === 0) return 'Agrega al menos un item.';
    if (total <= 0) return 'Total inválido.';
    const totalDebit = accountingLines.reduce((acc, line) => acc + toNumber(line.debit), 0);
    const totalCredit = accountingLines.reduce((acc, line) => acc + toNumber(line.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) return `Asiento descuadrado: Debe ${money(totalDebit)} != Haber ${money(totalCredit)}.`;

    for (const item of items) {
      if (item.lineType === 'INFO_ONLY') continue;
      if (!item.description.trim()) return 'Hay un item sin descripción.';
      if (!normalizeAccount(item.accountCode)) return `Item ${item.description}: falta cuenta contable.`;
      if (item.costCenter !== '-' && !normalizeCostCenter(item.costCenter)) return `Item ${item.description}: falta centro de costo.`;

      if (shouldBypassReview(item)) {
        continue;
      }

      if (item.requiresReview && !modifyDetail.trim()) {
        return `Item ${item.description}: requiere revisión contable. Usa Modificar y registra sustento.`;
      }
    }
    return '';
  };

  const clearFormLabels = () => {
    setItems([]);
    setSupplierName('');
    setIssueDate(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
    setStatus('');
    setModifyReason('');
    setModifyDetail('');
    setAiWarnings([]);
    setSelectedFileName('');
    setExplicitAccountLines([]);
    setAiTotalReadFromDocument('');
    setAiReconciliationStatus('');
    setAiReconciliationDifference('');
    setAiTaxWarnings([]);
    setAiLegalWarnings([]);
    setAiAccountingWarnings([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onFormChange({ ...form, serie: '', number: '', supplierNit: '', subtotal: '0.00', iva: '0.00', expenseAccount: '', costCenter: DEFAULT_COST_CENTER, currency: 'COP' });
  };

  const handleSubmit = async () => {
    const error = validateBeforeSubmit();
    if (error) {
      setStatus(error);
      return;
    }

    const firstLine = groupedLines[0];
    const nextForm: PurchaseFormData = {
      ...form,
      subtotal: money(subtotal),
      iva: money(iva),
      expenseAccount: firstLine?.accountCode || normalizeAccount(form.expenseAccount) || '519099',
      costCenter: firstLine?.costCenter || normalizeCostCenter(form.costCenter),
    };

    const normalizedItems = items.map((item) => ({
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineSubtotal: item.lineSubtotal,
      accountCode: normalizeAccount(item.accountCode),
      accountName: item.accountName,
      costCenter: normalizeCostCenter(item.costCenter || nextForm.costCenter),
      taxTreatment: item.taxTreatment,
      aiReason: item.aiReason,
      aiConfidence: item.aiConfidence,
      requiresReview: item.requiresReview,
      taxable: item.taxable,
      ivaAmount: item.ivaAmount,
      totalLine: item.totalLine,
      lineType: item.lineType,
      requiresSupport: item.requiresSupport,
      isInventory: item.isInventory ?? false,
      itemClass: item.itemClass ?? null,
      catalogCode: item.catalogCode ?? null,
      catalogNat: item.catalogNat ?? null,
      catalogRub: item.catalogRub ?? null,
      catalogTk: item.catalogTk ?? null,
      catalogMatch: item.catalogMatch ?? false,
      gastoAccount: item.gastoAccount ?? null,
    }));

    const submitPayload: PurchaseSubmitPayload = {
      form: nextForm,
      supplierName,
      issueDate,
      subtotal: money(subtotal),
      iva: money(iva),
      total: money(total),
      items: normalizedItems,
      accountLines: accountingLines.map((line) => ({
        accountCode: line.accountCode,
        accountName: line.accountName,
        costCenter: line.costCenter,
        debit: line.debit,
        credit: line.credit,
        lineType: line.lineType,
        taxTreatment: line.taxTreatment,
        auditNote: line.auditNote,
      })),
      accountsToUpsert,
      costCentersToUpsert,
      auditMetadata: {
        source: selectedFileName ? 'GEMINI' : 'MANUAL',
        selectedFileName,
        aiWarnings,
        modifyReason,
        modifyDetail,
        engineVersion: ENGINE_VERSION,
        totalReadFromDocument: aiTotalReadFromDocument || money(total),
        reconciliationStatus: aiReconciliationStatus,
        reconciliationDifference: aiReconciliationDifference,
        accountingWarnings: aiAccountingWarnings,
        taxWarnings: aiTaxWarnings,
        legalWarnings: aiLegalWarnings,
      },
    };

    onFormChange(nextForm);
    setIsPosting(true);

      try {
    await onSubmit(submitPayload);

    setStatus(
      'Compra posteada. Se actualizó registro de compras, centro de costos y asiento contable.'
    );

    // NO limpiar todavía hasta confirmar que todo funciona bien
    // clearFormLabels();
  } catch (error) {
    setStatus(
      `No se pudo guardar la compra. ${
        error instanceof Error ? error.message : 'Error desconocido'
      }`
    );
  } finally {
    setIsPosting(false);
  }
  };

  return (
    <div className="sheet-form pro-form pro-purchase-form">
      <div className="pro-form-header">
        <div>
          <Text weight="semibold">Factura de Compra</Text>
          <p>Motor experto contable, tributario, OCR Gemini y control de sustento.</p>
        </div>
        <div className="pro-header-actions">
          <Button appearance="secondary" onClick={openGuideFromInvoice}>Generar guía</Button>
          <Button appearance="secondary" onClick={() => setShowModify(true)}>Modificar</Button>
        </div>
      </div>

      <div className="pro-form-grid three">
        <Field label="Serie"><Input value={form.serie} onChange={(_, d) => updateField('serie', d.value)} /></Field>
        <Field label="Número"><Input value={form.number} onChange={(_, d) => updateField('number', d.value)} /></Field>
        <Field label="Fecha"><Input type="date" value={issueDate} onChange={(_, d) => setIssueDate(d.value)} /></Field>
      </div>

      <div className="pro-upload-card">
        <Text weight="semibold">Adjuntar factura / OCR Gemini</Text>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readInvoiceWithGemini(file);
          }}
        />
        <div className="pro-upload-actions">
          <button className="btn-fluent-primary" type="button" onClick={() => fileInputRef.current?.click()} disabled={isReadingAi}>
            {isReadingAi ? 'Leyendo con Gemini...' : 'Adjuntar imagen/PDF y leer con IA'}
          </button>
          {selectedFileName && <span>{selectedFileName}</span>}
        </div>
        <div className="pro-help-text">
          Gemini analiza imagen/PDF, extrae datos, clasifica cuenta contable, centro de costo y criterio tributario.
        </div>
      </div>

      <div className="pro-form-grid customer">
        <Field label="NIT proveedor"><Input value={form.supplierNit} onChange={(_, d) => updateField('supplierNit', d.value)} contentAfter={<Search24Regular />} /></Field>
        <Field label="Razón social proveedor"><Input value={supplierName} onChange={(_, d) => setSupplierName(d.value)} /></Field>
      </div>

      <div className="pro-validation-row">
        <Button appearance="secondary" onClick={validateRucExternally}>Validar NIT DIAN</Button>
        <MessageBar intent={rucState === 'valid' ? 'success' : rucState === 'invalid' ? 'error' : 'info'}><MessageBarBody>{rucMessage}</MessageBarBody></MessageBar>
      </div>

      {aiWarnings.length > 0 && (
        <MessageBar intent="warning"><MessageBarBody>{aiWarnings.join(' | ')}</MessageBarBody></MessageBar>
      )}
      {(aiTaxWarnings.length > 0 || aiLegalWarnings.length > 0 || aiAccountingWarnings.length > 0) && (
        <MessageBar intent="warning">
          <MessageBarBody>
            {[...aiTaxWarnings, ...aiLegalWarnings, ...aiAccountingWarnings].join(' | ')}
          </MessageBarBody>
        </MessageBar>
      )}
      {aiTotalReadFromDocument && (
        <MessageBar intent={aiReconciliationStatus === 'OK' ? 'success' : 'warning'}>
          <MessageBarBody>
            Total leído del comprobante: $ {aiTotalReadFromDocument}
            {aiReconciliationStatus ? ` | Conciliación: ${aiReconciliationStatus}` : ''}
            {aiReconciliationDifference && aiReconciliationDifference !== '0.00' ? ` | Diferencia: ${aiReconciliationDifference}` : ''}
          </MessageBarBody>
        </MessageBar>
      )}

      <section className="dashboard-card pro-section">
        <div className="pro-section-header">
          <Text weight="semibold">Detalle de Factura - Compras</Text>
          <button className="btn-fluent-primary" type="button" onClick={addItem}>+ Agregar producto</button>
        </div>

        <div className="pro-table-wrap">
          <table className="erp-table pro-input-table wide">
            <thead>
              <tr>
                <th>Código</th><th>Descripción</th><th>Unidad</th><th>Cant.</th><th>P. Unit.</th><th>Subtotal</th><th>Cuenta</th><th>Nombre cuenta</th><th>Centro costo</th><th>Criterio tributario</th><th>IA</th><th>Acc.</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center', padding: 18, color: '#64748b' }}>Sin items. Agrega una línea o usa OCR Gemini.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td><input value={item.code} onChange={(e) => updateItem(item.id, 'code', e.target.value)} style={{ width: 80 }} /></td>
                  <td><input value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} style={{ width: 220 }} /></td>
                  <td><input value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} style={{ width: 60 }} /></td>
                  <td><input value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} style={{ width: 70, textAlign: 'right' }} /></td>
                  <td><input value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} style={{ width: 85, textAlign: 'right' }} /></td>
                  <td><input value={item.lineSubtotal} onChange={(e) => updateItem(item.id, 'lineSubtotal', e.target.value)} style={{ width: 85, textAlign: 'right' }} /></td>
                  <td><input value={item.accountCode} onChange={(e) => updateItem(item.id, 'accountCode', e.target.value)} style={{ width: 80 }} /></td>
                  <td><input value={item.accountName} onChange={(e) => updateItem(item.id, 'accountName', e.target.value)} style={{ width: 170 }} /></td>
                  <td><input value={item.costCenter} onChange={(e) => updateItem(item.id, 'costCenter', e.target.value)} style={{ width: 90 }} /></td>
                  <td><input value={item.taxTreatment} onChange={(e) => updateItem(item.id, 'taxTreatment', e.target.value)} style={{ width: 240 }} /></td>
                  <td title={item.aiReason}>{Math.round(item.aiConfidence * 100)}%</td>
                  <td><Button appearance="secondary" onClick={() => removeItem(item.id)}>X</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboard-card pro-section">
        <Text weight="semibold">Asiento contable sugerido</Text>
        <table className="erp-table pro-ledger-table">
          <thead><tr><th>Cuenta</th><th>Descripción</th><th>Centro costo</th><th>Debe</th><th>Haber</th></tr></thead>
          <tbody>
            {accountingLines.map((line, index) => (
              <tr key={`${line.accountCode}-${line.costCenter}-${index}`}>
                <td>{line.accountCode}</td>
                <td>{line.accountName}</td>
                <td>{line.costCenter}</td>
                <td style={{ textAlign: 'right' }}>{line.debit}</td>
                <td style={{ textAlign: 'right' }}>{line.credit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="pro-form-grid four">
        <Field label="Cuenta fallback"><Input value={form.expenseAccount} onChange={(_, d) => updateField('expenseAccount', d.value)} /></Field>
        <Field label="Centro costo general"><Input value={form.costCenter} onChange={(_, d) => updateField('costCenter', d.value)} /></Field>
        <Field label="Subtotal"><Input value={money(subtotal)} disabled /></Field>
        <Field label="IVA"><Input value={money(iva)} disabled={isAutoIgv} onChange={(_, d) => updateField('iva', d.value)} /></Field>
      </div>

      <label className="pro-checkline">
        <input type="checkbox" checked={isAutoIgv} onChange={(e) => setIsAutoIgv(e.target.checked)} />
        IVA auto-calculado 19% (Art. 468 ET Colombia)
      </label>

      <div className="pro-total-banner">
        <span>Total a pagar</span>
        <strong>$ {money(total)}</strong>
      </div>
      {aiTotalReadFromDocument && <Text size={200}>Total del comprobante leído por IA: $ {aiTotalReadFromDocument}</Text>}

      {status && <MessageBar intent={status.includes('No se pudo') || status.includes('Falta') || status.includes('requiere') ? 'error' : 'success'}><MessageBarBody>{status}</MessageBarBody></MessageBar>}

      {showGuide && (
        <section className="dashboard-card" style={{ padding: 12, border: '2px solid #93c5fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text weight="semibold">Guía de remisión generada desde factura</Text>
            <Button appearance="secondary" onClick={() => setShowGuide(false)}>Cerrar guía</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
            {Object.entries(guide).map(([key, value]) => (
              <Field key={key} label={key}><Input value={value} onChange={(_, d) => setGuide((prev) => ({ ...prev, [key]: d.value }))} /></Field>
            ))}
          </div>
          <Text size={200}>Los items de la factura se usarán como detalle base de la guía. Completa datos de traslado, conductor y vehículo.</Text>
        </section>
      )}

      {showModify && (
        <section className="dashboard-card" style={{ padding: 12, border: '2px solid #fbbf24' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text weight="semibold">Solicitud de modificación controlada</Text>
            <Button appearance="secondary" onClick={() => setShowModify(false)}>Cerrar</Button>
          </div>
          <Field label="Qué se va a modificar"><Input value={modifyReason} onChange={(_, d) => setModifyReason(d.value)} placeholder="Ejemplo: cambiar cuenta, centro de costo, proveedor, fecha..." /></Field>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
            Explicación / sustento tributario
            <textarea value={modifyDetail} onChange={(e) => setModifyDetail(e.target.value)} rows={4} style={{ resize: 'vertical', border: '1px solid #cbd5e1', borderRadius: 6, padding: 8 }} placeholder="Explica el motivo. Si el periodo ya fue declarado, debe sugerir nota de crédito, reversión o ajuste." />
          </label>
          <Button appearance="primary" onClick={() => setStatus('Modificación registrada para auditoría. Debe validarse antes de alterar libros o asientos.')}>Guardar explicación</Button>
        </section>
      )}

      <div className="sheet-footer pro-action-bar">
        <Button appearance="secondary" onClick={onClose}>Cancelar</Button>
        <button type="button" className="btn-fluent-primary" onClick={handleSubmit} disabled={isPosting}>{isPosting ? 'Posteando...' : 'Guardar y Postear'}</button>
      </div>
    </div>
  );
};

export default PurchaseFormEnterprise;

