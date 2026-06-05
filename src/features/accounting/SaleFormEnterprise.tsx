/* CONTA_PRO: convertido desde PurchaseFormEnterprise.tsx para ventas.
   Asiento base: Debe 1212 CxC, Haber 70xx ingresos, Haber 40111 IGV debito fiscal.
*/
import React, { useMemo, useRef, useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody, Text } from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';

export type SaleFormData = {
  serie: string;
  number: string;
  customerRuc: string;
  subtotal: string;
  igv: string;
  revenueAccount: string;
  costCenter: string;
};

type SaleItem = {
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
  igvAmount: string;
  totalLine: string;
  lineType: SaleLineType;
  requiresSupport: boolean;
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
  partidaUbigeo: string;
  llegadaDireccion: string;
  llegadaUbigeo: string;
  transportistaRuc: string;
  transportistaRazonSocial: string;
  conductorDni: string;
  conductorLicencia: string;
  placaVehiculo: string;
};

type RucValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'unknown';

type SaleLineType =
  | 'REVENUE'
  | 'TAX'
  | 'RECEIVABLE'
  | 'ROUNDING'
  | 'PRIOR_BALANCE'
  | 'ADVANCE_PAYMENT'
  | 'LATE_FEE'
  | 'WITHHOLDING'
  | 'DETRACTION'
  | 'PERCEPTION';

type ExplicitAccountLine = {
  accountCode: string;
  accountName: string;
  costCenter: string;
  debit: string;
  credit: string;
  lineType: SaleLineType;
  taxTreatment: string;
  auditNote?: string;
};

export type SaleSubmitPayload = {
  form: SaleFormData;
  customerName: string;
  issueDate: string;
  subtotal: string;
  igv: string;
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
    igvAmount: string;
    totalLine: string;
    lineType: SaleLineType;
    requiresSupport: boolean;
  }>;
  accountLines: Array<{
    accountCode: string;
    accountName: string;
    costCenter: string;
    debit: string;
    credit: string;
    lineType: SaleLineType;
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
    source: 'SALE_FORM' | 'GEMINI' | 'MANUAL';
  }>;
  guideRemission?: {
    enabled: boolean;
    serie: string;
    number: string;
    transferDate: string;
    motivoTraslado: string;
    modalidadTransporte: string;
    pesoBrutoTotal: string;
    numeroBultos: string;
    partidaDireccion: string;
    partidaUbigeo: string;
    llegadaDireccion: string;
    llegadaUbigeo: string;
    transportistaRuc: string;
    transportistaRazonSocial: string;
    conductorDni: string;
    conductorLicencia: string;
    placaVehiculo: string;
    sourceDocument: {
      serie: string;
      number: string;
      issueDate: string;
      customerRuc: string;
      customerName: string;
    };
    items: Array<{
      code: string;
      description: string;
      unit: string;
      quantity: string;
    }>;
  };
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

type SaleFormEnterpriseProps = {
  form: SaleFormData;
  onFormChange: (next: SaleFormData) => void;
  tenantId?: string;
  onClose: () => void;
  onSubmit: (payload: SaleSubmitPayload) => Promise<void> | void;
};

type GeminiSaleItem = {
  code?: string;
  product_code?: string;
  sku?: string;
  description?: string;
  product_description?: string;
  name?: string;
  unit?: string;
  quantity?: number | string;
  qty?: number | string;
  unit_price?: number | string;
  unitPrice?: number | string;
  price?: number | string;
  line_subtotal?: number | string;
  lineSubtotal?: number | string;
  subtotal?: number | string;
  taxable?: boolean;
  igv_amount?: number | string;
  igvAmount?: number | string;
  total_line?: number | string;
  totalLine?: number | string;
  line_type?: SaleLineType | string;
  lineType?: SaleLineType | string;
  deductibility?: string;
  igv_credit?: string;
  requires_support?: boolean;
  requires_review?: boolean;
  requiresReview?: boolean;
  account_code?: string;
  accountCode?: string;
  account_name?: string;
  accountName?: string;
  cost_center?: string;
  costCenter?: string;
  tax_treatment?: string;
  taxTreatment?: string;
  ai_reason?: string;
  ai_confidence?: number;
};

type GeminiSaleResponse = {
  serie?: string;
  number?: string;
  issue_date?: string;
  customer_ruc?: string;
  customer_name?: string;
  subtotal?: number | string;
  igv?: number | string;
  total?: number | string;
  total_read_from_document?: number | string;
  reconciliation_status?: string;
  reconciliation_difference?: number | string;
  cost_center?: string;
  revenue_account?: string;
  items?: GeminiSaleItem[];
  line_items?: GeminiSaleItem[];
  account_lines?: Array<{
    account_code?: string;
    account_name?: string;
    cost_center?: string;
    debit?: number | string;
    credit?: number | string;
    line_type?: SaleLineType | string;
    tax_treatment?: string;
    audit_note?: string;
  }>;
  accounts_to_upsert?: SaleSubmitPayload['accountsToUpsert'];
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
const ENGINE_VERSION = 'CONTA_PRO_SALE_AI_RULES_CO_2026_01';
const AUTO_ROUNDING_TOLERANCE = 100; // tolerance in COP

const RECEIVABLE_ACCOUNT = '1212';
const RECEIVABLE_NAME = 'Cuentas por cobrar comerciales';
const SALES_IGV_ACCOUNT = '40111';
const SALES_IGV_NAME = 'IGV débito fiscal';
const DEFAULT_SERVICE_REVENUE_ACCOUNT = '704101';
const DEFAULT_GOODS_REVENUE_ACCOUNT = '701101';
const ROUNDING_INCOME_ACCOUNT = '429595';
const ROUNDING_EXPENSE_ACCOUNT = '539595';

const toNumber = (value: string | number | undefined | null) => {
  const parsed = Number.parseFloat(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number) => value.toFixed(2);

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
  if (first === '4') return 'Tributos y aportes';
  if (first === '5') return 'Patrimonio / resultados acumulados';
  if (first === '6') return 'Gastos por naturaleza';
  if (first === '7') return 'Ingresos';
  if (first === '8') return 'Saldos intermediarios de gestión';
  if (first === '9') return 'Contabilidad analítica';
  return 'Cuenta por clasificar';
};

const accountNature = (accountCode: string): 'DEBIT' | 'CREDIT' => {
  const first = normalizeAccount(accountCode).charAt(0);
  return ['2', '3', '4', '5', '7'].includes(first) ? 'CREDIT' : 'DEBIT';
};

const normalizeCostCenter = (value?: string) => {
  const clean = String(value || DEFAULT_COST_CENTER).trim().toUpperCase().replace(/\s+/g, '-');
  return clean || DEFAULT_COST_CENTER;
};


const shouldUseCostCenter = (accountCode: string) => {
  const first = normalizeAccount(accountCode).charAt(0);
  // Ventas: se permite centro/profit center en ingresos clase 7 y analitica clase 9.
  // No se fuerza centro de costo en CxC 1212 ni IGV 40111.
  return first === '6' || first === '7' || first === '9';
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

const normalizeLineType = (value?: string): SaleLineType => {
  const clean = String(value || '').toUpperCase();
  if (clean === 'ROUNDING') return 'ROUNDING';
  if (clean === 'PRIOR_BALANCE') return 'PRIOR_BALANCE';
  if (clean === 'ADVANCE_PAYMENT') return 'ADVANCE_PAYMENT';
  if (clean === 'LATE_FEE') return 'LATE_FEE';
  if (clean === 'TAX') return 'TAX';
  if (clean === 'RECEIVABLE') return 'RECEIVABLE';
  if (clean === 'WITHHOLDING') return 'WITHHOLDING';
  if (clean === 'DETRACTION') return 'DETRACTION';
  if (clean === 'PERCEPTION') return 'PERCEPTION';
  return 'REVENUE';
};

const shouldBypassReview = (item: Pick<SaleItem, 'description' | 'code' | 'lineSubtotal' | 'accountCode' | 'lineType'>) => {
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
  return false;
};

const classifySaleItem = (description: string, customerName = '') => {
  const text = `${description} ${customerName}`.toUpperCase();

  if (isRoundingLine(description)) {
    return { accountCode: ROUNDING_INCOME_ACCOUNT, accountName: 'Ajuste por redondeo favorable', taxTreatment: 'Redondeo monetario de venta. No integra base imponible si solo es ajuste de centavos.', aiConfidence: 0.99, aiReason: 'Línea técnica de redondeo de venta.', requiresReview: false };
  }
  if (/DESCUENTO|BONIFICACION|BONIFICACIÓN|DSCTO|REBAJA|DEVOLUCION|DEVOLUCIÓN/.test(text)) {
    return { accountCode: '741101', accountName: 'Descuentos, rebajas y bonificaciones concedidos', taxTreatment: 'Descuento o devolución de venta. Revisar nota de crédito si corresponde.', aiConfidence: 0.86, aiReason: 'Descuento/bonificación/devolución detectada.', requiresReview: true };
  }
  if (/ANTICIPO|ADELANTO|PAGO\s+A\s+CUENTA|COBRO\s+ANTICIPADO/.test(text)) {
    return { accountCode: '122101', accountName: 'Anticipos de clientes', taxTreatment: 'Anticipo de cliente. Revisar devengo, comprobante y aplicación posterior.', aiConfidence: 0.82, aiReason: 'Anticipo/cobro a cuenta detectado.', requiresReview: true };
  }
  if (/MERCADERIA|MERCADERÍA|PRODUCTO|BIEN|EQUIPO|ARTICULO|ARTÍCULO|MATERIAL|SUMINISTRO|STOCK/.test(text)) {
    return { accountCode: DEFAULT_GOODS_REVENUE_ACCOUNT, accountName: 'Venta de mercaderías', taxTreatment: 'Ingreso por venta de bienes. Debe amarrar a kardex y costo de ventas si aplica.', aiConfidence: 0.92, aiReason: 'Venta de bienes/mercaderías identificada.', requiresReview: false };
  }
  if (/SERVICIO|MANTENIMIENTO|SOPORTE|CONSULTORIA|CONSULTORÍA|ASESORIA|ASESORÍA|HONORARIO|SUSCRIPCION|SUSCRIPCIÓN/.test(text)) {
    return { accountCode: DEFAULT_SERVICE_REVENUE_ACCOUNT, accountName: 'Prestación de servicios', taxTreatment: 'Ingreso por prestación de servicios gravado con IGV si corresponde; reconocer según devengo.', aiConfidence: 0.94, aiReason: 'Venta de servicios identificada.', requiresReview: false };
  }
  if (/ALQUILER|ARRENDAMIENTO|RENTA/.test(text)) {
    return { accountCode: '704102', accountName: 'Ingresos por alquileres / arrendamientos', taxTreatment: 'Ingreso por arrendamiento. Revisar contrato, devengo, IGV y detracción si corresponde.', aiConfidence: 0.90, aiReason: 'Arrendamiento/alquiler detectado.', requiresReview: false };
  }
  if (/INTERES|INTERÉS|MORA|PENALIDAD|RECARGO/.test(text)) {
    return { accountCode: '772101', accountName: 'Ingresos financieros / intereses', taxTreatment: 'Interés, mora o penalidad. Revisar afectación tributaria y sustento contractual.', aiConfidence: 0.84, aiReason: 'Interés/mora/penalidad detectada.', requiresReview: true };
  }

  return { accountCode: DEFAULT_SERVICE_REVENUE_ACCOUNT, accountName: 'Prestación de servicios por clasificar', taxTreatment: 'Ingreso por venta pendiente de clasificar. Revisar naturaleza de la operación antes de cerrar periodo.', aiConfidence: 0.60, aiReason: 'No se identificó una regla específica; se usa ingreso por servicios como fallback.', requiresReview: true };
};

const createSaleItem = (costCenter = DEFAULT_COST_CENTER): SaleItem => ({
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
  igvAmount: '0.00',
  totalLine: '0.00',
  lineType: 'REVENUE',
  requiresSupport: true,
});

export const SaleFormEnterprise = ({ form, onFormChange, tenantId, onClose, onSubmit }: SaleFormEnterpriseProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
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
    motivoTraslado: 'VENTA',
    modalidadTransporte: 'PUBLICO',
    pesoBrutoTotal: '0.00',
    numeroBultos: '1',
    partidaDireccion: '',
    partidaUbigeo: '150101',
    llegadaDireccion: '',
    llegadaUbigeo: '150101',
    transportistaRuc: '',
    transportistaRazonSocial: '',
    conductorDni: '',
    conductorLicencia: '',
    placaVehiculo: '',
  });

  const subtotalItems = useMemo(
    () => items.reduce((acc, item) => acc + toNumber(item.lineSubtotal), 0),
    [items],
  );
  const subtotal = toNumber(form.subtotal) > 0 ? toNumber(form.subtotal) : subtotalItems;
  const igv = isAutoIgv && !aiTotalReadFromDocument ? subtotal * 0.19 : toNumber(form.igv);
  const total = aiTotalReadFromDocument ? toNumber(aiTotalReadFromDocument) : subtotal + igv;

  const groupedLines = useMemo(() => {
    const map = new Map<string, { accountCode: string; accountName: string; costCenter: string; amount: number; taxTreatment: string }>();
    items.forEach((item) => {
      if (!item.accountCode) return;
      const accountCode = normalizeAccount(item.accountCode);
      const costCenter = shouldUseCostCenter(accountCode) ? normalizeCostCenter(item.costCenter || form.costCenter) : '-';
      const key = `${accountCode}|${costCenter}`;
      const current = map.get(key);
      if (current) current.amount += toNumber(item.lineSubtotal);
      else map.set(key, {
        accountCode,
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
      {
        accountCode: RECEIVABLE_ACCOUNT,
        accountName: RECEIVABLE_NAME,
        costCenter: '-',
        debit: money(total),
        credit: '0.00',
        lineType: 'RECEIVABLE' as SaleLineType,
        taxTreatment: 'Reconocimiento de cuenta por cobrar comercial por el total del comprobante emitido.',
      },
      ...groupedLines.map((line) => ({
        accountCode: line.accountCode,
        accountName: line.accountName,
        costCenter: shouldUseCostCenter(line.accountCode) ? normalizeCostCenter(line.costCenter) : '-',
        debit: '0.00',
        credit: money(line.amount),
        lineType: 'REVENUE' as SaleLineType,
        taxTreatment: line.taxTreatment,
      })),
      {
        accountCode: SALES_IGV_ACCOUNT,
        accountName: SALES_IGV_NAME,
        costCenter: '-',
        debit: '0.00',
        credit: money(igv),
        lineType: 'TAX' as SaleLineType,
        taxTreatment: 'IGV débito fiscal por venta. Se reconoce como tributo por pagar.',
      },
    ].filter((line) => toNumber(line.debit) !== 0 || toNumber(line.credit) !== 0);
  }, [explicitAccountLines, groupedLines, igv, total]);

  const accountsToUpsert = useMemo(() => {
    const map = new Map<string, SaleSubmitPayload['accountsToUpsert'][number]>();
    accountingLines.forEach((line) => {
      if (!line.accountCode) return;
      map.set(line.accountCode, {
        accountCode: line.accountCode,
        accountName: line.accountName || 'Cuenta por clasificar',
        accountClass: accountClassName(line.accountCode),
        nature: accountNature(line.accountCode),
        taxTreatment: line.taxTreatment,
        requiresReview: line.accountCode === ROUNDING_EXPENSE_ACCOUNT && line.lineType !== 'ROUNDING',
      });
    });
    map.set(SALES_IGV_ACCOUNT, {
      accountCode: SALES_IGV_ACCOUNT,
      accountName: SALES_IGV_NAME,
      accountClass: accountClassName(SALES_IGV_ACCOUNT),
      nature: 'CREDIT',
      taxTreatment: 'IGV débito fiscal por venta. Se reconoce como tributo por pagar.',
      requiresReview: false,
    });
    map.set(RECEIVABLE_ACCOUNT, {
      accountCode: RECEIVABLE_ACCOUNT,
      accountName: RECEIVABLE_NAME,
      accountClass: accountClassName(RECEIVABLE_ACCOUNT),
      nature: 'DEBIT',
      taxTreatment: 'Cuenta por cobrar comercial por comprobante emitido.',
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
    return Array.from(codes).map((code) => ({ code, name: code, source: 'SALE_FORM' as const }));
  }, [items, form.costCenter, accountingLines]);

  const updateField = (key: keyof SaleFormData, value: string) => {
    const next = { ...form, [key]: value };

    if (key === 'subtotal' && isAutoIgv) {
      next.igv = money(toNumber(value) * 0.19);
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

  const updateItem = (id: string, key: keyof SaleItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [key]: value };

        if (key === 'quantity' || key === 'unitPrice') {
          next.lineSubtotal = money(toNumber(next.quantity) * toNumber(next.unitPrice));
          next.igvAmount = next.taxable ? money(toNumber(next.lineSubtotal) * 0.19) : '0.00';
          next.totalLine = money(toNumber(next.lineSubtotal) + toNumber(next.igvAmount));
        }

        if (key === 'lineSubtotal') {
          next.igvAmount = next.taxable ? money(toNumber(value) * 0.19) : '0.00';
          next.totalLine = money(toNumber(value) + toNumber(next.igvAmount));
        }

        if (key === 'accountCode') {
          next.accountCode = normalizeAccount(value);
        }

        if (key === 'costCenter') {
          next.costCenter = normalizeCostCenter(value);
        }

        if (key === 'description') {
          const c = classifySaleItem(value, customerName);
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
                  : 'REVENUE';
          next.taxable = next.lineType === 'REVENUE';
          next.requiresSupport = c.requiresReview;
          next.igvAmount = next.taxable ? next.igvAmount : '0.00';
          next.costCenter = next.lineType === 'PRIOR_BALANCE' || next.lineType === 'ADVANCE_PAYMENT'
            ? '-'
            : normalizeCostCenter(form.costCenter || next.costCenter || DEFAULT_COST_CENTER);
        }

        return next;
      }),
    );
  };

  const addItem = () => setItems((prev) => [...prev, createSaleItem(form.costCenter)]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const applyGeminiPayload = (payload: GeminiSaleResponse) => {
    const nextSerie = payload.serie || form.serie || '';
    const nextNumber = payload.number || form.number || '';
    const nextCustomerRuc = payload.customer_ruc || form.customerRuc || '';
    const nextCustomerName = payload.customer_name || customerName || '';
    const nextCostCenter = normalizeCostCenter(payload.cost_center || form.costCenter || DEFAULT_COST_CENTER);

    const rawItems = Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.line_items)
        ? payload.line_items
        : [];

    const mappedItems = rawItems.map((raw) => {
      const description = String(raw.description || raw.product_description || raw.name || '').trim();
      const fallback = classifySaleItem(description, nextCustomerName);
      const qty = toNumber(raw.quantity ?? raw.qty ?? 1) || 1;
      const unitPrice = toNumber(raw.unit_price ?? raw.unitPrice ?? raw.price ?? 0);
      const lineSubtotal = toNumber(raw.line_subtotal ?? raw.lineSubtotal ?? raw.subtotal ?? qty * unitPrice);
      const accountCode = normalizeAccount(String(raw.account_code || raw.accountCode || fallback.accountCode));
      const aiConfidence = Number(raw.ai_confidence ?? fallback.aiConfidence);

      const lineType = normalizeLineType(String(raw.line_type || ''));
      const detectedLineType: SaleLineType = lineType !== 'REVENUE'
        ? lineType
        : isRoundingLine(description, String(raw.code || ''))
          ? 'ROUNDING'
          : isPriorDebtLine(description, String(raw.code || ''))
            ? 'PRIOR_BALANCE'
            : isAdvanceOrCreditLine(description, String(raw.code || ''))
              ? 'ADVANCE_PAYMENT'
              : isLateFeeLine(description, String(raw.code || ''))
                ? 'LATE_FEE'
                : 'REVENUE';

      const requiresSupport = Boolean(raw.requires_support ?? fallback.requiresReview);
      const requiresReview = shouldBypassReview({
        description,
        code: String(raw.code || ''),
        lineSubtotal: money(lineSubtotal),
        accountCode,
        lineType: detectedLineType,
      })
        ? false
        : Boolean(requiresSupport || aiConfidence < 0.8 || (accountCode === ROUNDING_EXPENSE_ACCOUNT && detectedLineType !== 'ROUNDING'));

      return {
        id: newId(),
        code: String(raw.code || raw.product_code || raw.sku || ''),
        description,
        unit: String(raw.unit || 'UND'),
        quantity: money(qty),
        unitPrice: money(unitPrice),
        lineSubtotal: money(lineSubtotal),
        accountCode,
        accountName: String(raw.account_name || raw.accountName || fallback.accountName),
        costCenter: detectedLineType === 'PRIOR_BALANCE' || detectedLineType === 'ADVANCE_PAYMENT'
          ? '-'
          : normalizeCostCenter(raw.cost_center || raw.costCenter || nextCostCenter),
        taxTreatment: String(raw.tax_treatment || raw.taxTreatment || fallback.taxTreatment),
        aiReason: String(raw.ai_reason || fallback.aiReason),
        aiConfidence,
        requiresReview,
        taxable: Boolean(raw.taxable ?? detectedLineType === 'REVENUE'),
        igvAmount: money(toNumber(raw.igv_amount ?? raw.igvAmount ?? (detectedLineType === 'REVENUE' ? lineSubtotal * 0.19 : 0))),
        totalLine: money(toNumber(raw.total_line ?? raw.totalLine ?? (lineSubtotal + toNumber(raw.igv_amount ?? raw.igvAmount ?? 0)))),
        lineType: detectedLineType,
        requiresSupport,
      };
    });

    const mappedAccountLines: ExplicitAccountLine[] = (payload.account_lines || []).map((raw) => ({
      accountCode: normalizeAccount(String(raw.account_code || '')),
      accountName: String(raw.account_name || 'Cuenta por clasificar'),
      costCenter: String(raw.cost_center || '-').toUpperCase(),
      debit: money(toNumber(raw.debit || 0)),
      credit: money(toNumber(raw.credit || 0)),
      lineType: normalizeLineType(String(raw.line_type || 'REVENUE')),
      taxTreatment: String(raw.tax_treatment || ''),
      auditNote: String(raw.audit_note || ''),
    })).filter((line) => line.accountCode && (toNumber(line.debit) !== 0 || toNumber(line.credit) !== 0));

    const mergedWarnings = [
      ...(payload.warnings || []),
      ...(payload.audit_metadata?.ocr_warnings || []),
      ...(payload.audit_metadata?.reconciliation_notes || []),
    ];

    const normalizedIssueDate = normalizeDate(payload.issue_date);
    if (normalizedIssueDate) setIssueDate(normalizedIssueDate);
    setCustomerName(nextCustomerName);
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
      customerRuc: nextCustomerRuc,
      subtotal: money(toNumber(payload.subtotal ?? (payload as any).taxable_base ?? mappedItems.reduce((a, i) => a + toNumber(i.lineSubtotal), 0))),
      igv: money(toNumber(payload.igv ?? mappedItems.reduce((a, i) => a + toNumber(i.igvAmount), 0))),
      revenueAccount: normalizeAccount(String(payload.revenue_account || mappedItems[0]?.accountCode || form.revenueAccount || '704101')),
      costCenter: nextCostCenter,
    });

    setIsAutoIgv(false);
    setStatus('Factura de venta leída con Gemini. Datos cargados al formulario; revise cuenta, centro de costo, guía y conciliación antes de guardar.');
  };

  const readInvoiceWithGemini = async (file: File) => {
    setIsReadingAi(true);
    setSelectedFileName(file.name);
    setStatus('Leyendo factura con Gemini pixel por pixel...');
    setAiWarnings([]);

    try {
      const currentTenantId = tenantId || localStorage.getItem('tenant_id') || '11111111-1111-1111-1111-111111111111';

      let token = localStorage.getItem('access_token') || '';
      if (!token) {
        const _u = localStorage.getItem('login_username'); const _p = localStorage.getItem('login_password');
        if (_u && _p) { const _r = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: _u, password: _p, tenant_id: currentTenantId }) }); if (_r.ok) { const _d = await _r.json() as { access_token?: string }; token = _d.access_token || ''; if (token) localStorage.setItem('access_token', token); } }
      }
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/sales/process-ia`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Tenant-Id': currentTenantId,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as GeminiSaleResponse;
      applyGeminiPayload(payload);
    } catch (error) {
      setStatus(`No se pudo leer con Gemini. ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsReadingAi(false);
    }
  };

  const validateRucExternally = async () => {
    const clean = form.customerRuc.replace(/[^0-9]/g, '');
    if (!/^\d{9,12}$/.test(clean)) {
      setRucState('invalid');
      setRucMessage('Identificador inválido. Debe tener entre 9 y 12 dígitos.');
      return;
    }
    if (clean.length === 11) {
      setRucState('validating');
      setRucMessage('Consultando servicio externo...');
      try {
        const response = await fetch(`https://api.apis.net.pe/v2/sunat/ruc?numero=${clean}`);
        if (response.ok) {
          const data = await response.json();
          setCustomerName(data.razonSocial || data.nombre || customerName);
          setRucState('valid');
          setRucMessage('RUC validado. Razón social cargada si el servicio la devolvió.');
          return;
        }
        setRucState('unknown');
        setRucMessage('SUNAT externo no disponible. Continuar con validación manual.');
      } catch {
        setRucState('unknown');
        setRucMessage('No se pudo validar externamente. Verifica red/CORS.');
      }
    } else {
      setRucState('unknown');
      setRucMessage('Identificador aceptado. Validación externa no configurada para este país.');
    }
  };

  const openGuideFromInvoice = () => {
    setGuide((prev) => ({
      ...prev,
      transferDate: issueDate || prev.transferDate,
      motivoTraslado: 'VENTA',
      numeroBultos: String(Math.max(items.length, 1)),
    }));
    setShowGuide(true);
  };

  const validateBeforeSubmit = () => {
    if (!form.serie.trim()) return 'Falta serie.';
    if (!form.number.trim()) return 'Falta número.';
    if (!issueDate.trim()) return 'Falta fecha.';
    if (!/^\d{9,12}$/.test(form.customerRuc.replace(/[^0-9]/g, ''))) return 'Identificador cliente inválido (9-12 dígitos).';
    if (!customerName.trim()) return 'Falta razón social cliente.';
    if (items.length === 0) return 'Agrega al menos un item.';
    if (total <= 0) return 'Total inválido.';

    if (showGuide) {
      if (!guide.transferDate.trim()) return 'Guía: falta fecha de traslado.';
      if (!guide.motivoTraslado.trim()) return 'Guía: falta motivo de traslado.';
      if (!guide.modalidadTransporte.trim()) return 'Guía: falta modalidad de transporte.';
      if (!guide.pesoBrutoTotal.trim() || toNumber(guide.pesoBrutoTotal) <= 0) return 'Guía: falta peso bruto total válido.';
      if (!guide.numeroBultos.trim() || toNumber(guide.numeroBultos) <= 0) return 'Guía: falta número de bultos válido.';
      if (!guide.partidaDireccion.trim()) return 'Guía: falta dirección de partida.';
      if (!guide.partidaUbigeo.trim()) return 'Guía: falta ubigeo de partida.';
      if (!guide.llegadaDireccion.trim()) return 'Guía: falta dirección de llegada.';
      if (!guide.llegadaUbigeo.trim()) return 'Guía: falta ubigeo de llegada.';

      if (guide.modalidadTransporte.toUpperCase() === 'PUBLICO') {
        if (!/^\d{11}$/.test(guide.transportistaRuc)) return 'Guía: RUC transportista inválido.';
        if (!guide.transportistaRazonSocial.trim()) return 'Guía: falta razón social del transportista.';
      } else {
        if (!/^\d{8}$/.test(guide.conductorDni)) return 'Guía: DNI conductor inválido.';
        if (!guide.conductorLicencia.trim()) return 'Guía: falta licencia del conductor.';
        if (!guide.placaVehiculo.trim()) return 'Guía: falta placa del vehículo.';
      }
    }

    const totalDebit = accountingLines.reduce((acc, line) => acc + toNumber(line.debit), 0);
    const totalCredit = accountingLines.reduce((acc, line) => acc + toNumber(line.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) return `Asiento descuadrado: Debe ${money(totalDebit)} != Haber ${money(totalCredit)}.`;

    for (const item of items) {
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
    setCustomerName('');
    setIssueDate(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
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
    onFormChange({ ...form, serie: '', number: '', customerRuc: '', subtotal: '0.00', igv: '0.00', revenueAccount: '704101', costCenter: DEFAULT_COST_CENTER });
  };

  const handleSubmit = async () => {
    const error = validateBeforeSubmit();
    if (error) {
      setStatus(error);
      return;
    }

    const firstLine = groupedLines[0];
    const nextForm: SaleFormData = {
      ...form,
      subtotal: money(subtotal),
      igv: money(igv),
      revenueAccount: firstLine?.accountCode || normalizeAccount(form.revenueAccount) || DEFAULT_SERVICE_REVENUE_ACCOUNT,
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
      costCenter: item.costCenter === '-' ? '-' : normalizeCostCenter(item.costCenter || nextForm.costCenter),
      taxTreatment: item.taxTreatment,
      aiReason: item.aiReason,
      aiConfidence: item.aiConfidence,
      requiresReview: item.requiresReview,
      taxable: item.taxable,
      igvAmount: item.igvAmount,
      totalLine: item.totalLine,
      lineType: item.lineType,
      requiresSupport: item.requiresSupport,
    }));

    const submitPayload: SaleSubmitPayload = {
      form: nextForm,
      customerName,
      issueDate,
      subtotal: money(subtotal),
      igv: money(igv),
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
      guideRemission: showGuide ? {
        enabled: true,
        ...guide,
        sourceDocument: {
          serie: nextForm.serie,
          number: nextForm.number,
          issueDate,
          customerRuc: nextForm.customerRuc,
          customerName,
        },
        items: normalizedItems.map((item) => ({
          code: item.code,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
        })),
      } : undefined,
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
        'Venta posteada. Se actualizó registro de ventas, CxC, IGV débito fiscal y asiento contable.'
      );

      // NO limpiar todavía hasta confirmar que todo funciona bien
      // clearFormLabels();
    } catch (error) {
      setStatus(
        `No se pudo guardar la venta. ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="sheet-form" style={{ display: 'grid', gap: 14, maxHeight: '82vh', overflowY: 'auto', paddingRight: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <Text weight="semibold">Factura de Venta | Motor experto contable y tributario</Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button appearance="secondary" onClick={openGuideFromInvoice}>Generar guía</Button>
          <Button appearance="secondary" onClick={() => setShowModify(true)}>Modificar</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Serie"><Input value={form.serie} onChange={(_, d) => updateField('serie', d.value)} /></Field>
        <Field label="Número"><Input value={form.number} onChange={(_, d) => updateField('number', d.value)} /></Field>
        <Field label="Fecha"><Input type="date" value={issueDate} onChange={(_, d) => setIssueDate(d.value)} /></Field>
      </div>

      <div style={{ border: '2px dashed #3b82f6', borderRadius: 12, padding: 16, background: '#f8fbff', textAlign: 'center' }}>
        <Text weight="semibold">Adjuntar factura de venta / OCR Gemini</Text>
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
        <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-fluent-primary" type="button" onClick={() => fileInputRef.current?.click()} disabled={isReadingAi}>
            {isReadingAi ? 'Leyendo con Gemini...' : 'Adjuntar factura y extraer con IA'}
          </button>
          {selectedFileName && <span style={{ fontSize: 12, color: '#334155' }}>{selectedFileName}</span>}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
          Gemini analiza la factura de venta, extrae cliente, RUC, detalle, cuentas 70xx, CxC, IGV débito fiscal, guía y criterios tributarios.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
        <Field label="RUC cliente"><Input value={form.customerRuc} onChange={(_, d) => updateField('customerRuc', d.value)} contentAfter={<Search24Regular />} /></Field>
        <Field label="Razón social cliente"><Input value={customerName} onChange={(_, d) => setCustomerName(d.value)} /></Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12 }}>
        <Button appearance="secondary" onClick={validateRucExternally}>Validar RUC Externo</Button>
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

      <section className="dashboard-card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text weight="semibold">Detalle de Factura - Ventas</Text>
          <button className="btn-fluent-primary" type="button" onClick={addItem}>+ Agregar producto</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="erp-table" style={{ width: '100%', minWidth: 1320 }}>
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

      <section className="dashboard-card" style={{ padding: 12 }}>
        <Text weight="semibold">Asiento contable sugerido</Text>
        <table className="erp-table" style={{ width: '100%', marginTop: 10 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <Field label="Cuenta ingreso fallback"><Input value={form.revenueAccount} onChange={(_, d) => updateField('revenueAccount', d.value)} /></Field>
        <Field label="Centro costo general"><Input value={form.costCenter} onChange={(_, d) => updateField('costCenter', d.value)} /></Field>
        <Field label="Subtotal"><Input value={money(subtotal)} disabled /></Field>
        <Field label="IVA"><Input value={money(igv)} disabled={isAutoIgv} onChange={(_, d) => updateField('igv', d.value)} /></Field>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <input type="checkbox" checked={isAutoIgv} onChange={(e) => setIsAutoIgv(e.target.checked)} />
        IVA auto-calculado 19%
      </label>

      <Text weight="semibold">Total: $ {money(total)}</Text>
      {aiTotalReadFromDocument && <Text size={200}>Total del comprobante leído por IA: $ {aiTotalReadFromDocument}</Text>}

      {status && <MessageBar intent={status.includes('No se pudo') || status.includes('Falta') || status.includes('requiere') ? 'error' : 'success'}><MessageBarBody>{status}</MessageBarBody></MessageBar>}

      {showGuide && (
        <section className="dashboard-card" style={{ padding: 12, border: '2px solid #93c5fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text weight="semibold">Guía de remisión remitente - Venta</Text>
            <Button appearance="secondary" onClick={() => setShowGuide(false)}>Cerrar guía</Button>
          </div>

          <Text size={200}>
            La guía se genera desde la venta. Completa traslado, punto de partida/llegada y datos del transportista o conductor.
          </Text>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
            <Field label="Serie guía">
              <Input value={guide.serie} onChange={(_, d) => setGuide((prev) => ({ ...prev, serie: d.value.toUpperCase() }))} />
            </Field>
            <Field label="Número guía">
              <Input value={guide.number} onChange={(_, d) => setGuide((prev) => ({ ...prev, number: d.value }))} />
            </Field>
            <Field label="Fecha traslado">
              <Input type="date" value={guide.transferDate} onChange={(_, d) => setGuide((prev) => ({ ...prev, transferDate: d.value }))} />
            </Field>
            <Field label="Motivo traslado">
              <Input value={guide.motivoTraslado} onChange={(_, d) => setGuide((prev) => ({ ...prev, motivoTraslado: d.value.toUpperCase() }))} />
            </Field>

            <Field label="Modalidad transporte">
              <Input value={guide.modalidadTransporte} onChange={(_, d) => setGuide((prev) => ({ ...prev, modalidadTransporte: d.value.toUpperCase() }))} placeholder="PUBLICO o PRIVADO" />
            </Field>
            <Field label="Peso bruto total">
              <Input value={guide.pesoBrutoTotal} onChange={(_, d) => setGuide((prev) => ({ ...prev, pesoBrutoTotal: d.value }))} />
            </Field>
            <Field label="Número bultos">
              <Input value={guide.numeroBultos} onChange={(_, d) => setGuide((prev) => ({ ...prev, numeroBultos: d.value }))} />
            </Field>
            <Field label="Placa vehículo">
              <Input value={guide.placaVehiculo} onChange={(_, d) => setGuide((prev) => ({ ...prev, placaVehiculo: d.value.toUpperCase() }))} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr', gap: 10, marginTop: 12 }}>
            <Field label="Dirección partida">
              <Input value={guide.partidaDireccion} onChange={(_, d) => setGuide((prev) => ({ ...prev, partidaDireccion: d.value }))} />
            </Field>
            <Field label="Ubigeo partida">
              <Input value={guide.partidaUbigeo} onChange={(_, d) => setGuide((prev) => ({ ...prev, partidaUbigeo: d.value }))} />
            </Field>
            <Field label="Dirección llegada">
              <Input value={guide.llegadaDireccion} onChange={(_, d) => setGuide((prev) => ({ ...prev, llegadaDireccion: d.value }))} />
            </Field>
            <Field label="Ubigeo llegada">
              <Input value={guide.llegadaUbigeo} onChange={(_, d) => setGuide((prev) => ({ ...prev, llegadaUbigeo: d.value }))} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 10, marginTop: 12 }}>
            <Field label="RUC transportista">
              <Input value={guide.transportistaRuc} onChange={(_, d) => setGuide((prev) => ({ ...prev, transportistaRuc: d.value.replace(/\D/g, '').slice(0, 11) }))} />
            </Field>
            <Field label="Razón social transportista">
              <Input value={guide.transportistaRazonSocial} onChange={(_, d) => setGuide((prev) => ({ ...prev, transportistaRazonSocial: d.value }))} />
            </Field>
            <Field label="DNI conductor">
              <Input value={guide.conductorDni} onChange={(_, d) => setGuide((prev) => ({ ...prev, conductorDni: d.value.replace(/\D/g, '').slice(0, 8) }))} />
            </Field>
            <Field label="Licencia conductor">
              <Input value={guide.conductorLicencia} onChange={(_, d) => setGuide((prev) => ({ ...prev, conductorLicencia: d.value.toUpperCase() }))} />
            </Field>
          </div>

          <table className="erp-table" style={{ width: '100%', marginTop: 12 }}>
            <thead>
              <tr><th>Código</th><th>Descripción</th><th>Unidad</th><th>Cantidad</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`guide-${item.id}`}>
                  <td>{item.code}</td>
                  <td>{item.description}</td>
                  <td>{item.unit}</td>
                  <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

            {showModify && (
        <section className="dashboard-card" style={{ padding: 12, border: '2px solid #fbbf24' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text weight="semibold">Solicitud de modificación controlada</Text>
            <Button appearance="secondary" onClick={() => setShowModify(false)}>Cerrar</Button>
          </div>
          <Field label="Qué se va a modificar"><Input value={modifyReason} onChange={(_, d) => setModifyReason(d.value)} placeholder="Ejemplo: cambiar cuenta, centro de costo, cliente, fecha..." /></Field>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
            Explicación / sustento tributario
            <textarea value={modifyDetail} onChange={(e) => setModifyDetail(e.target.value)} rows={4} style={{ resize: 'vertical', border: '1px solid #cbd5e1', borderRadius: 6, padding: 8 }} placeholder="Explica el motivo. Si el periodo ya fue declarado, debe sugerir nota de crédito, reversión o ajuste." />
          </label>
          <Button appearance="primary" onClick={() => setStatus('Modificación registrada para auditoría. Debe validarse antes de alterar libros o asientos.')}>Guardar explicación</Button>
        </section>
      )}

      <div className="sheet-footer" style={{ position: 'static', borderTop: 'none', padding: 0, marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button appearance="secondary" onClick={onClose}>Cancelar</Button>
        <button type="button" className="btn-fluent-primary" onClick={handleSubmit} disabled={isPosting}>{isPosting ? 'Posteando...' : 'Guardar y Postear'}</button>
      </div>
    </div>
  );
};

export default SaleFormEnterprise;

