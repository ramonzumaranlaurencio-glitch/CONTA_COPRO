import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Checkbox, Field, Input, Textarea } from '@fluentui/react-components';
import {
  Add24Regular,
  ArrowClockwise24Regular,
  ArrowDownload24Regular,
  Bot24Regular,
  BuildingBank24Regular,
  CalendarLtr24Regular,
  ClipboardTask24Regular,
  CloudArrowUp24Regular,
  Database24Regular,
  DocumentTable24Regular,
  Home24Regular,
  LockClosed24Regular,
  Money24Regular,
  PersonMoney24Regular,
  Receipt24Regular,
  Search24Regular,
  ShieldCheckmark24Regular,
  SlideSettings24Regular,
  Wallet24Regular,
} from '@fluentui/react-icons';
import { SidePanel } from '../../components/ui/SidePanel';
import { SaleFormEnterprise, type SaleFormData, type SaleSubmitPayload } from './SaleFormEnterprise';
import { TenantSelector } from '../../components/layout/TenantSelector';
import { MassiveUpload } from './MassiveUpload';
import { PurchaseFormEnterprise, type PurchaseSubmitPayload } from './PurchaseFormEnterprise';
import { CompliancePanel } from '../sunat/CompliancePanel';
import { SunatMonitor } from '../sunat/SunatMonitor';
import { AuditHealthDashboard } from '../audit/AuditHealthDashboard';
import { PayrollGrid } from '../payroll/PayrollGrid';
import { AssetRegister } from '../assets/AssetRegister';
import { FinancialDashboard } from '../reports/FinancialDashboard';
import { BooksCenter } from '../reports/BooksCenter';
import { OwnerDashboard } from '../client-portal/OwnerDashboard';
import ApexLogixCore from '../inventory/EnterpriseFulfillmentCommandCenter';

import { PeriodCloseAction } from './PeriodCloseAction';
import DashboardEnterprise from '../../components/DashboardEnterprise';
import AccountingLivePanel, { type AccountingMovement } from '../../components/AccountingLivePanel';
import AccountDetailPanel from '../../components/AccountDetailPanel';
import { LedgerAnalytic } from './LedgerAnalytic';
import { hasFeature, type Plan } from '../../config/planFeatures';

type JournalLineDetail = {
  id?: string;
  account_code?: string;
  account_name?: string;
  cost_center?: string;
  debit?: string;
  credit?: string;
  partner_ruc?: string;
  document_type?: string;
  document_series?: string;
  document_number?: string;
};

type JournalRow = {
  id: string;
  entryId?: string;
  date: string;
  period: string;
  description: string;
  account: string;
  accountName?: string;
  costCenter: string;
  debit: string;
  credit: string;
  status: string;
  hash: string;
  previousHash?: string;
  sourceModule: string;
  partnerRuc?: string;
  documentType?: string;
  documentSeries?: string;
  documentNumber?: string;
  lines?: JournalLineDetail[];
};

type PanelType = 'VENTA' | 'COMPRA' | 'CHECKLIST' | null;

type PurchaseForm = {
  serie: string;
  number: string;
  supplierRuc: string;
  subtotal: string;
  igv: string;
  expenseAccount: string;
  costCenter: string;
};


type ChecklistState = {
  conciliacionBancos: boolean;
  validarIgv: boolean;
  provisionCxC: boolean;
  cdrPendientes: boolean;
  cierreAnual: boolean;
};

type Filters = {
  date: string;
  period: string;
  description: string;
  account: string;
  costCenter: string;
  status: string;
  sourceModule: string;
};

type ValidatorStatus = 'OK' | 'DESCUADRADO' | 'CC_REQUERIDO';

type EntrySummary = {
  entryId: string;
  date: string;
  period: string;
  description: string;
  sourceModule: string;
  status: string;
  hash: string;
  previousHash?: string;
  totalDebit: number;
  totalCredit: number;
  variance: number;
  validatorStatus: ValidatorStatus;
  missingCostCenters: string[];
  lines: JournalRow[];
};

type EnrichedRow = JournalRow & {
  validatorStatus: ValidatorStatus;
  variance: number;
  missingCostCenter: boolean;
};

type DisplayRow =
  | { kind: 'GROUP'; summary: EntrySummary; expanded: boolean }
  | { kind: 'LINE'; row: EnrichedRow };

type QuickFilters = {
  missingCostCenter: boolean;
  unbalanced: boolean;
  manualOnly: boolean;
};

const API_BASE = '/api/v1';
const HR_API_BASE = API_BASE;
const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'erp.operator';
const MAX_JOURNAL_ROWS = 3000;
const MAX_RENDER_ROWS = 1200;
const USE_DEMO_ROWS = false;
const _today = new Date();
const DEFAULT_PERIOD = { year: _today.getFullYear(), month: _today.getMonth() + 1 };

const getTenantId = () => {
  const current = localStorage.getItem('tenant_id');
  if (current !== TENANT_ID) {
    localStorage.setItem('tenant_id', TENANT_ID);
  }
  return TENANT_ID;
};

const tokenTenantId = (value?: string | null) => {
  try {
    const payload = String(value || '').split('.')[1];
    if (!payload) return '';
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
    return String(decoded.tenant_id || '');
  } catch {
    return '';
  }
};

const periodFromIsoDate = (value?: string | null) => {
  const match = /^(\d{4})-(\d{2})/.exec(String(value || ''));
  if (!match) return DEFAULT_PERIOD;
  return { year: Number(match[1]), month: Number(match[2]) };
};

const moduleLabel = (module?: string) => {
  const value = String(module || '').toUpperCase();

  if (value === 'PURCHASING') return 'COMPRAS';
  if (value === 'BILLING') return 'VENTAS';
  if (value === 'ACCOUNTING') return 'CONTABILIDAD';
  if (value === 'TREASURY') return 'TESORERIA';
  if (value === 'INVENTORY' || value === 'INVENTORY_COGS') return 'INVENTARIO';
  if (value === 'PAYROLL') return 'PLANILLAS';
  if (value === 'ASSETS') return 'ACTIVOS';

  return value || 'CONTABILIDAD';
};

const statusLabel = (status?: string) => {
  const value = String(status || '').toUpperCase();

  if (value === 'POSTED') return 'POSTEADO';
  if (value === 'PENDING') return 'PENDIENTE';
  if (value === 'REVIEW') return 'REVISION';
  if (value === 'SUNAT') return 'SUNAT';

  return value || 'PENDIENTE';
};

const formatMoney = (value: string | number | undefined | null) => {
  const amount = toNumber(value);
  return amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};


const seedRows: JournalRow[] = [
  { id: 'JE-2026-000184', date: '2026-05-10', period: '2026-05', description: 'Venta F001-8421 cliente enterprise', account: '1212', costCenter: 'LIM-COM', debit: '18,880.00', credit: '0.00', status: 'SUNAT', hash: '9b82c5f0f6e4142a', sourceModule: 'VENTAS' },
  { id: 'JE-2026-000183', date: '2026-05-10', period: '2026-05', description: 'IGV venta F001-8421', account: '4011', costCenter: 'LIM-COM', debit: '0.00', credit: '2,880.00', status: 'SUNAT', hash: '715ece7f3a0a920b', sourceModule: 'VENTAS' },
  { id: 'JE-2026-000182', date: '2026-05-09', period: '2026-05', description: 'Depreciacion servidores nube', account: '681', costCenter: 'TI-CORE', debit: '4,200.00', credit: '0.00', status: 'POSTED', hash: '71dcb0bc69c0db87', sourceModule: 'ACTIVOS' },
  { id: 'JE-2026-000181', date: '2026-05-09', period: '2026-05', description: 'Diferencia de cambio cartera USD', account: '676', costCenter: 'FIN-TES', debit: '930.40', credit: '0.00', status: 'POSTED', hash: 'ebc76550a47cb24d', sourceModule: 'TESORERIA' },
  { id: 'JE-2026-000180', date: '2026-05-08', period: '2026-05', description: 'Provision cobranza dudosa', account: '684', costCenter: 'FIN-CXC', debit: '1,540.00', credit: '0.00', status: 'REVIEW', hash: 'b41c9e310a946145', sourceModule: 'CXC/CXP' },
];

const emptyJournalRow: JournalRow = {
  id: 'EMPTY-JOURNAL-SELECTION',
  date: '',
  period: '',
  description: 'Sin asientos devueltos por la base de datos para el periodo consultado',
  account: 'N/A',
  costCenter: '-',
  debit: '0.00',
  credit: '0.00',
  status: 'SIN_DATOS',
  hash: '',
  sourceModule: 'BASE_DATOS',
};


const railItems = [
  { id: 'dashboard',      label: 'Dashboard',       icon: Home24Regular,           feature: null },
  { id: 'contabilidad',   label: 'Contabilidad',    icon: DocumentTable24Regular,  feature: null },
  { id: 'libros',         label: 'Libros',           icon: ClipboardTask24Regular,  feature: null },
  { id: 'ventas',         label: 'Ventas',           icon: Receipt24Regular,        feature: null },
  { id: 'compras',        label: 'Compras',          icon: Money24Regular,          feature: null },
  { id: 'tesoreria',      label: 'Tesoreria',        icon: Wallet24Regular,         feature: null },
  { id: 'cxcxp',          label: 'CXC/CXP',          icon: BuildingBank24Regular,   feature: null },
  { id: 'inventario',     label: 'Inventario',       icon: Database24Regular,       feature: 'inventory' },
  { id: 'planillas',      label: 'Planillas',        icon: PersonMoney24Regular,    feature: 'payroll' },
  { id: 'integraciones',  label: 'Integraciones',    icon: Database24Regular,       feature: 'integrations' },
  { id: 'owner',          label: 'Owner Portal',     icon: Database24Regular,       feature: 'advanced_bi' },
  { id: 'config',         label: 'Configuracion',    icon: SlideSettings24Regular,  feature: null },
];

const toNumber = (value: string | number | undefined | null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = String(value ?? '0').replace(/[^0-9,.\-]/g, '');
  const normalized = raw.includes(',') && !raw.includes('.') ? raw.replace(',', '.') : raw.replace(/,/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const VARIANCE_TOLERANCE = 0.05;
const ACCOUNT_CLASSES_NEEDING_CC = new Set(['6', '9']);

const requiresCostCenter = (accountCode: string | undefined | null) => {
  const first = String(accountCode || '').trim().charAt(0);
  return ACCOUNT_CLASSES_NEEDING_CC.has(first);
};

const isCostCenterEmpty = (cc: string | undefined | null) => {
  const value = String(cc || '').trim().toUpperCase();
  return value === '' || value === '-' || value === 'N/A' || value === 'NA';
};

const validatorBadge = (status: ValidatorStatus, variance: number) => {
  if (status === 'OK') return { label: 'VALIDADO', symbol: '✓', cls: 'ok' };
  if (status === 'DESCUADRADO') return { label: `DESC ${variance.toFixed(2)}`, symbol: '✖', cls: 'descuadrado' };
  return { label: 'CC FALTA', symbol: '⚠', cls: 'cc_requerido' };
};

const toCsv = (data: Array<Record<string, unknown>>) => {
  if (!data.length) {
    return 'sin datos';
  }
  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];
  for (const item of data) {
    lines.push(headers.map((header) => `"${String(item[header] ?? '').split('"').join('""')}"`).join(','));
  }
  return lines.join('\n');
};  

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const parseBackendError = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    const detail = json?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    if (json?.message) return json.message;
  } catch { /* not JSON */ }
  if (text) return text.slice(0, 300);
  return `Error HTTP ${response.status}`;
};

export const EnterpriseWorkspace = () => {

  const [rows, setRows] = useState<JournalRow[]>(USE_DEMO_ROWS ? seedRows : []);
  const [selectedRow, setSelectedRow] = useState<JournalRow>(USE_DEMO_ROWS ? seedRows[0] : emptyJournalRow);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [railExpanded, setRailExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [statusMessage, setStatusMessage] = useState('Inicializando CONTA_PRO Enterprise...');
  const [aiMessage, setAiMessage] = useState('Motor IA en espera');
  const [copilotQuestion, setCopilotQuestion] = useState('Detecta riesgos SUNAT y diferencias materiales de mayo 2026.');
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [selectedView, setSelectedView] = useState('dashboard');
  
const currentPlan = (() => {
  try {
    const token = localStorage.getItem('access_token') || '';
    if (!token) return 'BASIC';
    const payload = token.split('.')[1];
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const decoded = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
    return (decoded.plan as Plan) || 'BASIC';
  } catch {
    return 'BASIC';
  }
})();
const [accountDetailOpen, setAccountDetailOpen] = useState(false);
  const bootstrapRanRef = useRef(false);

  const [saleForm, setSaleForm] = useState<SaleFormData>({
    serie: 'F001',
    number: '',
    customerRuc: '',
    subtotal: '',
    igv: '',
    revenueAccount: '704101',
    costCenter: 'LIM-COM',
  });

  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>({
    serie: 'F001',
    number: '',
    supplierRuc: '',
    subtotal: '',
    igv: '',
    expenseAccount: '601101',
    costCenter: 'LIM-ADM',
  });


  const [checklist, setChecklist] = useState<ChecklistState>({
    conciliacionBancos: true,
    validarIgv: false,
    provisionCxC: false,
    cdrPendientes: true,
    cierreAnual: false,
  });

  const [filters, setFilters] = useState<Filters>({
    date: '',
    period: '',
    description: '',
    account: '',
    costCenter: '',
    status: '',
    sourceModule: '',
  });

  const [viewMode, setViewMode] = useState<'FLAT' | 'GROUPED'>('FLAT');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({
    missingCostCenter: false,
    unbalanced: false,
    manualOnly: false,
  });

  const toggleEntryExpansion = (entryId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const totals = useMemo(() => ({
    entries: rows.length,
    locked: rows.filter((row) => row.status !== 'REVIEW').length,
  }), [rows]);

  const computedMetrics = useMemo<[string, string][]>(() => {
    const modUp = (r: JournalRow) => String(r.sourceModule ?? '').toUpperCase();
    const ventas = rows.filter(r => modUp(r) === 'BILLING' || modUp(r) === 'VENTAS');
    const compras = rows.filter(r => modUp(r) === 'PURCHASING' || modUp(r) === 'COMPRAS');
    const igvRows = rows.filter(r => String(r.account ?? '').startsWith('40'));

    const sumCredit = (arr: JournalRow[]) => arr.reduce((s, r) => s + toNumber(r.credit), 0);
    const sumDebit = (arr: JournalRow[]) => arr.reduce((s, r) => s + toNumber(r.debit), 0);
    const f = (v: number) => `S/ ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const empty = rows.length === 0;

    return [
      ['Ventas', empty ? '—' : f(sumCredit(ventas))],
      ['Compras', empty ? '—' : f(sumDebit(compras))],
      ['IGV neto', empty ? '—' : f(sumCredit(igvRows) - sumDebit(igvRows))],
      ['Asientos', empty ? '—' : String(rows.length)],
      ['Periodo', `${DEFAULT_PERIOD.year}-${String(DEFAULT_PERIOD.month).padStart(2, '0')}`],
    ];
  }, [rows]);

  const entriesIndex = useMemo(() => {
    const map = new Map<string, EntrySummary>();
    for (const row of rows) {
      const key = row.entryId ?? row.id;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          entryId: key,
          date: row.date,
          period: row.period,
          description: row.description,
          sourceModule: row.sourceModule,
          status: row.status,
          hash: row.hash,
          previousHash: row.previousHash,
          totalDebit: 0,
          totalCredit: 0,
          variance: 0,
          validatorStatus: 'OK',
          missingCostCenters: [],
          lines: [],
        };
        map.set(key, entry);
      }
      entry.lines.push(row);
      entry.totalDebit += toNumber(row.debit);
      entry.totalCredit += toNumber(row.credit);
      if (requiresCostCenter(row.account) && isCostCenterEmpty(row.costCenter)) {
        entry.missingCostCenters.push(row.account);
      }
    }
    for (const entry of map.values()) {
      entry.variance = Math.round((entry.totalDebit - entry.totalCredit) * 100) / 100;
      if (Math.abs(entry.variance) > VARIANCE_TOLERANCE) {
        entry.validatorStatus = 'DESCUADRADO';
      } else if (entry.missingCostCenters.length > 0) {
        entry.validatorStatus = 'CC_REQUERIDO';
      } else {
        entry.validatorStatus = 'OK';
      }
    }
    return map;
  }, [rows]);

  const entriesStats = useMemo(() => {
    let ok = 0;
    let desc = 0;
    let ccReq = 0;
    for (const entry of entriesIndex.values()) {
      if (entry.validatorStatus === 'OK') ok++;
      else if (entry.validatorStatus === 'DESCUADRADO') desc++;
      else if (entry.validatorStatus === 'CC_REQUERIDO') ccReq++;
    }
    return { total: entriesIndex.size, ok, desc, ccReq };
  }, [entriesIndex]);

  const filteredRowsEnhanced = useMemo<EnrichedRow[]>(() => {
    const contains = (value: string, needle: string) => value.toLowerCase().includes(needle.toLowerCase());
    const result: EnrichedRow[] = [];
    for (const row of rows) {
      const summary = entriesIndex.get(row.entryId ?? row.id);
      const validatorStatus = summary?.validatorStatus ?? 'OK';
      const variance = summary?.variance ?? 0;
      const missingCC = requiresCostCenter(row.account) && isCostCenterEmpty(row.costCenter);

      if (!contains(row.date, filters.date)) continue;
      if (!contains(row.period, filters.period)) continue;
      if (!contains(row.description, filters.description)) continue;
      if (!contains(row.account, filters.account)) continue;
      if (!contains(row.costCenter, filters.costCenter)) continue;
      if (!contains(row.status, filters.status)) continue;
      if (!contains(row.sourceModule, filters.sourceModule)) continue;

      if (quickFilters.missingCostCenter && !missingCC) continue;
      if (quickFilters.unbalanced && validatorStatus !== 'DESCUADRADO') continue;
      if (quickFilters.manualOnly) {
        const mod = String(row.sourceModule || '').toUpperCase();
        if (mod !== 'CONTABILIDAD' && mod !== 'MANUAL' && mod !== 'AJUSTES') continue;
      }

      result.push({ ...row, validatorStatus, variance, missingCostCenter: missingCC });
    }
    return result;
  }, [rows, filters, quickFilters, entriesIndex]);

  const filteredRows = filteredRowsEnhanced;

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (viewMode === 'FLAT') {
      return filteredRowsEnhanced.slice(0, MAX_RENDER_ROWS).map((row) => ({ kind: 'LINE' as const, row }));
    }
    const seen = new Set<string>();
    const result: DisplayRow[] = [];
    for (const row of filteredRowsEnhanced) {
      const key = row.entryId ?? row.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const summary = entriesIndex.get(key);
      if (!summary) continue;
      const expanded = expandedEntries.has(key);
      result.push({ kind: 'GROUP', summary, expanded });
      if (expanded) {
        for (const line of summary.lines) {
          const missingCC = requiresCostCenter(line.account) && isCostCenterEmpty(line.costCenter);
          result.push({
            kind: 'LINE',
            row: { ...line, validatorStatus: summary.validatorStatus, variance: summary.variance, missingCostCenter: missingCC },
          });
        }
      }
      if (result.length >= MAX_RENDER_ROWS) break;
    }
    return result;
  }, [filteredRowsEnhanced, viewMode, expandedEntries, entriesIndex]);

  const visibleRows = useMemo(() => filteredRowsEnhanced.slice(0, MAX_RENDER_ROWS), [filteredRowsEnhanced]);

  const selectedSummary = useMemo(() => {
    if (!selectedRow) return undefined;
    return entriesIndex.get(selectedRow.entryId ?? selectedRow.id);
  }, [selectedRow, entriesIndex]);

  const accountingMovements = useMemo<AccountingMovement[]>(() => {
    return rows.map((row) => {
      const summary = entriesIndex.get(row.entryId ?? row.id);
      const missingCostCenter = requiresCostCenter(row.account) && isCostCenterEmpty(row.costCenter);
      const risk: AccountingMovement['risk'] =
        summary?.validatorStatus === 'DESCUADRADO' || missingCostCenter
          ? 'ALTO'
          : row.status === 'REVIEW'
            ? 'MEDIO'
            : 'BAJO';

      return {
        id: row.id,
        date: row.date,
        period: row.period,
        glosa: row.description,
        account: row.account,
        accountName: row.accountName || row.account,
        costCenter: row.costCenter,
        debit: toNumber(row.debit),
        credit: toNumber(row.credit),
        module: row.sourceModule,
        status: row.status,
        hash: row.hash,
        risk,
      };
    });
  }, [rows, entriesIndex]);

  const authHeaders = (bearerToken: string, tenantId = TENANT_ID) => ({
    Authorization: `Bearer ${bearerToken}`,
    'X-Tenant-Id': tenantId,
    'Content-Type': 'application/json',
  });

  const requestDevToken = async () => {
    const response = await fetch(`${API_BASE}/auth/dev-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: getTenantId(), user_id: USER_ID, role: 'ADMIN' }),
    });
    if (!response.ok) {
      throw new Error('No se pudo generar token dev');
    }
    const payload = await response.json();
    return payload.access_token as string;
  };

  const getValidToken = async (candidate?: string | null) => {
    const tenantId = getTenantId();
    if (candidate && tokenTenantId(candidate) === tenantId) {
      return candidate;
    }
    const generated = await requestDevToken();
    setToken(generated);
    return generated;
  };

  const buildJournalUrl = (period: typeof DEFAULT_PERIOD | null) => {
    const params = new URLSearchParams({ limit: String(MAX_JOURNAL_ROWS) });
    if (period) {
      params.set('year', String(period.year));
      params.set('month', String(period.month));
    }
    return `${API_BASE}/ledger/journal?${params.toString()}`;
  };

  const loadJournal = async (bearerToken: string, period: typeof DEFAULT_PERIOD | null = null) => {
    const tenantId = getTenantId();
    const endpoint = buildJournalUrl(period);
    const response = await fetch(endpoint, {
      headers: authHeaders(bearerToken, tenantId),
    });

    if (!response.ok) {
      throw new Error('No se pudo consultar libro diario');
    }

    const payload = await response.json();
    const payloadRows = Array.isArray(payload) ? payload.slice(0, MAX_JOURNAL_ROWS) : [];

    const mapped = payloadRows.flatMap((item: any, entryIndex: number) => {
      const lines: JournalLineDetail[] = Array.isArray(item.lines) ? (item.lines as JournalLineDetail[]) : [];
      const base = {
        entryId: item.id ?? `JE-${entryIndex + 1}`,
        date: item.entry_date ?? '2026-05-01',
        period: item.period || String(item.entry_date ?? '').slice(0, 7) || (
          period ? `${period.year}-${String(period.month).padStart(2, '0')}` : ''
        ),
        description: item.description || 'Sin descripcion',
        status: statusLabel(item.sunat_status ?? item.status),
        hash: item.row_hash ?? 'sin-hash',
        previousHash: item.previous_hash,
        sourceModule: moduleLabel(item.source_module),
        lines,
      };

      if (lines.length === 0) {
        return [{
          ...base,
          id: String(base.entryId),
          account: item.account_code ?? item.account ?? item.expense_account ?? 'N/A',
          accountName: item.account_name ?? '',
          costCenter: item.cost_center ?? item.costCenter ?? 'N/A',
          debit: formatMoney(item.total_debit ?? '0.00'),
          credit: formatMoney(item.total_credit ?? '0.00'),
        }];
      }

      return lines.map((line, lineIndex) => ({
        ...base,
        id: `${base.entryId}-${lineIndex}`,
        account: line.account_code || 'N/A',
        accountName: line.account_name || '',
        costCenter: line.cost_center || '-',
        debit: formatMoney(line.debit ?? '0.00'),
        credit: formatMoney(line.credit ?? '0.00'),
        partnerRuc: line.partner_ruc,
        documentType: line.document_type,
        documentSeries: line.document_series,
        documentNumber: line.document_number,
      }));
    });

    mapped.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const resultRows = mapped.length > 0 || !USE_DEMO_ROWS ? mapped : seedRows;

    console.info('CONTA_PRO SELECT /ledger/journal despues de cargar:', {
      endpoint,
      tenant_id: tenantId,
      period: period ?? 'TODOS',
      rows: resultRows.length,
      sample: resultRows.slice(0, 5),
      demo_mode: USE_DEMO_ROWS && mapped.length === 0,
    });

    setRows(resultRows);
    setSelectedRow(resultRows[0] ?? emptyJournalRow);

    if (Array.isArray(payload) && payload.length > MAX_JOURNAL_ROWS) {
      setStatusMessage(`Libro diario truncado a ${MAX_JOURNAL_ROWS} asientos para proteger rendimiento.`);
    }

    return resultRows;
  };

  useEffect(() => {
    if (bootstrapRanRef.current) {
      return;
    }
    bootstrapRanRef.current = true;

    let cancelled = false;
    const bootstrap = async () => {
      try {
        const generatedToken = await requestDevToken();
        if (cancelled) {
          return;
        }
        setToken(generatedToken);
        await loadJournal(generatedToken);
        setStatusMessage('Conectado: SPA enterprise operando con API real.');
        setAiMessage('Motor IA: Gemini-ready + pgvector-ready.');
      } catch {
        if (cancelled) {
          return;
        }
        const fallbackRows = USE_DEMO_ROWS ? seedRows : [];
        setRows(fallbackRows);
        setSelectedRow(fallbackRows[0] ?? emptyJournalRow);
        setStatusMessage(
          USE_DEMO_ROWS
            ? 'Backend no disponible. Modo local operativo.'
            : 'Backend no disponible. No se muestran datos de prueba; revise conexion/API para ver datos persistidos.'
        );
        setAiMessage('Motor IA sin conexion.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (token && tokenTenantId(token) !== getTenantId()) {
      void getValidToken(null);
    }
  }, [token]);

   
  const postSale = async (salePayload: SaleSubmitPayload) => {
    const tenantId = getTenantId();

    try {
      const formSource = salePayload.form;
      const subtotal = toNumber(salePayload.subtotal ?? formSource.subtotal);
      const igv = toNumber(salePayload.igv ?? formSource.igv);
      const total = toNumber(salePayload.total ?? subtotal + igv);
      const entryDate = salePayload.issueDate || new Date().toISOString().slice(0, 10);
      const postingPeriod = periodFromIsoDate(entryDate);

      const payload = {
        tenant_id: tenantId,
        year: postingPeriod.year,
        month: postingPeriod.month,
        invoice_id: `${formSource.serie}-${formSource.number}`,
        customer_ruc: formSource.customerRuc,
        customer_name: salePayload.customerName,
        entry_date: entryDate,
        doc_type: '01',
        serie: formSource.serie,
        number: formSource.number,
        subtotal,
        igv,
        total,
        currency: 'PEN',
        revenue_account: formSource.revenueAccount || salePayload.accountLines[0]?.accountCode || '704101',
        cost_center: formSource.costCenter || salePayload.accountLines[0]?.costCenter || 'LIM-COM',
        line_items: salePayload.items.map((item) => ({
          product_code: item.code,
          description: item.description,
          unit: item.unit,
          quantity: toNumber(item.quantity),
          unit_price: toNumber(item.unitPrice),
          line_subtotal: toNumber(item.lineSubtotal),
        })),
        audit_metadata: {
          ...salePayload.auditMetadata,
          items: salePayload.items,
          account_lines: salePayload.accountLines,
          accounts_to_upsert: salePayload.accountsToUpsert,
          cost_centers_to_upsert: salePayload.costCentersToUpsert,
          guide_remission: salePayload.guideRemission,
        },
      };

      console.log('CONTA_PRO salePayload:', salePayload);
      console.log('CONTA_PRO invoice payload:', payload);

      const saleToken = await getValidToken(token);

      if (!saleToken) {
        throw new Error('No hay token de seguridad para registrar venta.');
      }

      const response = await fetch(`${API_BASE}/ledger/invoice`, {
        method: 'POST',
        headers: authHeaders(saleToken, tenantId),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMsg = await parseBackendError(response);
        console.error('Error invoice:', errorMsg);
        throw new Error(errorMsg);
      }

      const postedMessage = `Venta ${formSource.serie}-${formSource.number} posteada con cuentas y centros de costo.`;
      setStatusMessage(postedMessage);
      setToken(saleToken);

      try {
        await loadJournal(saleToken);
        setActivePanel(null);
        setSelectedView('contabilidad');
      } catch (journalError) {
        console.warn('CONTA_PRO loadJournal after sale warning:', journalError);
        setStatusMessage(
          `${postedMessage} Pendiente refrescar Libro Diario: ${
            journalError instanceof Error ? journalError.message : 'error desconocido'
          }`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al postear venta.';
      console.error('CONTA_PRO postSale error:', error);
      setStatusMessage(`No se pudo postear venta. ${message}`);
      throw error;
    }
  };

  const postPurchase = async (purchasePayload?: PurchaseSubmitPayload) => {
    const tenantId = getTenantId();

    try {
      const formSource = purchasePayload?.form ?? purchaseForm;
      const subtotal = toNumber(purchasePayload?.subtotal ?? formSource.subtotal);
      const igv = toNumber(purchasePayload?.igv ?? formSource.igv);
      const total = toNumber(purchasePayload?.total ?? subtotal + igv);
      const entryDate = purchasePayload?.issueDate || new Date().toISOString().slice(0, 10);
      const postingPeriod = periodFromIsoDate(entryDate);

      const items = purchasePayload?.items ?? [];
      const accountLines = purchasePayload?.accountLines ?? [];
      const accountsToUpsert = purchasePayload?.accountsToUpsert ?? [];
      const costCentersToUpsert = purchasePayload?.costCentersToUpsert ?? [];
      const auditMetadata = purchasePayload?.auditMetadata ?? {
        source: 'MANUAL',
        selectedFileName: '',
        aiWarnings: [],
        modifyReason: '',
        modifyDetail: '',
        engineVersion: 'CONTA_PRO_PURCHASE_FALLBACK',
      };

      const payload = {
        tenant_id: tenantId,
        year: postingPeriod.year,
        month: postingPeriod.month,
        purchase_id: `${formSource.serie}-${formSource.number}`,
        supplier_ruc: formSource.supplierRuc,
        supplier_name: purchasePayload?.supplierName ?? '',
        issue_date: entryDate,
        entry_date: entryDate,
        doc_type: '01',
        serie: formSource.serie,
        number: formSource.number,
        subtotal,
        igv,
        total,
        currency: 'PEN',
        expense_account: formSource.expenseAccount || accountLines[0]?.accountCode || '659101',
        cost_center: formSource.costCenter || accountLines[0]?.costCenter || 'LIM-ADM',

        items: items.map((item) => ({
          code: item.code,
          description: item.description,
          unit: item.unit,
          quantity: toNumber(item.quantity),
          unit_price: toNumber(item.unitPrice),
          line_subtotal: toNumber(item.lineSubtotal),
          account_code: item.accountCode,
          account_name: item.accountName,
          cost_center: item.costCenter,
          tax_treatment: item.taxTreatment,
          ai_reason: item.aiReason,
          ai_confidence: item.aiConfidence,
        })),

        line_items: items.map((item) => ({
          product_code: item.code,
          description: item.description,
          unit: item.unit,
          quantity: toNumber(item.quantity),
          unit_price: toNumber(item.unitPrice),
          line_subtotal: toNumber(item.lineSubtotal),
          account_code: item.accountCode,
          account_name: item.accountName,
          cost_center: item.costCenter,
          tax_treatment: item.taxTreatment,
        })),

        account_lines: accountLines.map((line) => ({
          account_code: line.accountCode,
          account_name: line.accountName,
          cost_center: line.costCenter,
          debit: toNumber(line.debit),
          credit: toNumber(line.credit),
          line_type: line.lineType,
          tax_treatment: line.taxTreatment,
        })),

        accounts_to_upsert: accountsToUpsert,
        cost_centers_to_upsert: costCentersToUpsert,
        audit_metadata: auditMetadata,
      };

      console.log('CONTA_PRO purchasePayload:', purchasePayload);
      console.log('CONTA_PRO purchase-invoice payload:', payload);

      const tokenResponse = await fetch(`${API_BASE}/auth/dev-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: USER_ID,
          role: 'ADMIN',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(await tokenResponse.text());
      }

      const tokenPayload = await tokenResponse.json();
      const purchaseToken = tokenPayload.access_token;

      if (!purchaseToken) {
        throw new Error('No hay token de seguridad para registrar compra.');
      }

      const response = await fetch(`${API_BASE}/ledger/purchase-invoice`, {
        method: 'POST',
        headers: authHeaders(purchaseToken, tenantId),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMsg = await parseBackendError(response);
        console.error('Error purchase-invoice:', errorMsg);
        throw new Error(errorMsg);
      }

      const postedMessage = `Compra ${formSource.serie}-${formSource.number} posteada con cuentas y centros de costo.`;
      setStatusMessage(postedMessage);
      setToken(purchaseToken);

      // CONTA_PRO FIX V15:
      // La compra ya fue posteada. Si falla refrescar el Libro Diario,
      // no convertirlo en error de compra ni cerrar la tabla.
      try {
        await loadJournal(purchaseToken);
        setActivePanel(null);
        setSelectedView('contabilidad');
      } catch (journalError) {
        console.warn('CONTA_PRO loadJournal after purchase warning:', journalError);
        setStatusMessage(
          `${postedMessage} Pendiente refrescar Libro Diario: ${
            journalError instanceof Error ? journalError.message : 'error desconocido'
          }`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al postear compra.';
      console.error('CONTA_PRO postPurchase error:', error);
      setStatusMessage(`No se pudo postear compra. ${message}`);
      throw error;
    }
  };

  const exportExcel = () => {
    const csv = toCsv(filteredRowsEnhanced.map((row) => ({
      asiento: row.id,
      fecha: row.date,
      periodo: row.period,
      glosa: row.description,
      cuenta: row.account,
      cc: row.costCenter,
      debe: row.debit,
      haber: row.credit,
      estado: row.status,
      modulo: row.sourceModule,
      hash: row.hash,
    })));
    downloadFile('libro-diario-2026-05.csv', csv, 'text/csv;charset=utf-8;');
    setStatusMessage('Exportacion Excel (CSV) completada.');
  };

  const exportPdf = () => {
    const preview = window.open('', '_blank', 'width=980,height=720');
    if (!preview) {
      setStatusMessage('La ventana de exportacion PDF fue bloqueada por el navegador.');
      return;
    }

    const lines = filteredRowsEnhanced.slice(0, 30).map((row) => `<tr><td>${row.date}</td><td>${row.period}</td><td>${row.description}</td><td style="text-align:right">${row.debit}</td><td style="text-align:right">${row.credit}</td></tr>`).join('');

    preview.document.write(`
      <html>
        <head><title>Reporte Diario</title></head>
        <body style="font-family:Segoe UI,Arial,sans-serif;padding:20px;">
          <h1>CONTA_PRO Enterprise - Libro Diario</h1>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead><tr><th style="border:1px solid #ddd;padding:6px;text-align:left">Fecha</th><th style="border:1px solid #ddd;padding:6px;text-align:left">Periodo</th><th style="border:1px solid #ddd;padding:6px;text-align:left">Glosa</th><th style="border:1px solid #ddd;padding:6px;text-align:right">Debe</th><th style="border:1px solid #ddd;padding:6px;text-align:right">Haber</th></tr></thead>
            <tbody>${lines}</tbody>
          </table>
        </body>
      </html>
    `);
    preview.document.close();
    preview.focus();
    preview.print();
    setStatusMessage('Vista PDF lista para imprimir/guardar.');
  };

  const runAi = async (mode: 'anomalies' | 'preclosure' | 'copilot') => {
    if (!token) {
      setAiMessage('No hay token para ejecutar IA.');
      return;
    }

    setIsRunningAi(true);

    try {
      let endpoint = `${API_BASE}/ai/anomalies?year=2026&month=5`;
      let body: string | undefined;

      if (mode === 'preclosure') {
        endpoint = `${API_BASE}/ai/audit/pre-closure?year=2026&month=5`;
      }

      if (mode === 'copilot') {
        endpoint = `${API_BASE}/ai/copilot`;
        body = JSON.stringify({ question: copilotQuestion });
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(token),
        body,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = await response.json();
      setAiMessage(`Respuesta IA: ${JSON.stringify(payload).slice(0, 320)}`);
    } catch {
      setAiMessage('Error del motor IA. Revisa Gemini/pgvector/credenciales.');
    } finally {
      setIsRunningAi(false);
    }
  };

  const panelTitle = activePanel === 'VENTA'
    ? 'Registro de Ventas'
    : activePanel === 'COMPRA'
      ? 'Registro de Compras'
      : 'Checklist de Cierre';

  const refreshJournal = async () => {
    try {
      const currentToken = await getValidToken(token);
      await loadJournal(currentToken);
      setStatusMessage('Asientos actualizados desde backend.');
    } catch (error) {
      console.warn('CONTA_PRO refreshJournal warning:', error);
      const fallbackRows = USE_DEMO_ROWS ? seedRows : [];
      setRows(fallbackRows);
      setSelectedRow(fallbackRows[0] ?? emptyJournalRow);
      setStatusMessage(
        USE_DEMO_ROWS
          ? 'Backend no disponible. Modo local operativo.'
          : `No se pudo refrescar desde backend. No se muestran datos de prueba. ${
              error instanceof Error ? error.message : 'Error desconocido'
            }`
      );
    }
  };

  const renderPrimaryView = () => {
    if (selectedView === 'dashboard') {
      return <DashboardEnterprise rows={rows} />;
    }
    if (selectedView === 'owner') {
      return <OwnerDashboard />;
    }
    if (selectedView === 'inventario') {
      return (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ApexLogixCore apiBase={API_BASE} token={token} tenantId={getTenantId()} onStatus={setStatusMessage} onJournalPosted={refreshJournal} />
        </div>
      );
    }
    if (selectedView === 'libros') {
      return <BooksCenter apiBase={API_BASE} tenantId={TENANT_ID} />;
    }
    if (selectedView === 'ventas') {
      return <MassiveUpload />;
    }
    if (selectedView === 'integraciones') {
      return <SunatMonitor />;
    }
    if (selectedView === 'config') {
      return <CompliancePanel />;
    }
    if (selectedView === 'tesoreria') {
      return <AssetRegister />;
    }
    if (selectedView === 'cxcxp') {
      return <FinancialDashboard />;
    }
    if (selectedView === 'planillas') {
      return <PayrollGrid apiBase={HR_API_BASE} token={token} tenantId={getTenantId()} onStatus={setStatusMessage} onJournalPosted={refreshJournal} />;
    }
    if (selectedView === 'compras') {
      return <AuditHealthDashboard />;
    }

    if (selectedView === 'contabilidad') {
      return (
        <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
          <AccountingLivePanel
            movements={accountingMovements}
            loading={loading}
            selectedMovementId={selectedRow.id}
            statusMessage={statusMessage}
            aiMessage={aiMessage}
            onRefresh={() => void refreshJournal()}
            onExportCsv={exportExcel}
            onRunAudit={() => void runAi('anomalies')}
            onSelectMovement={(movement) => {
              const row = rows.find((item) => item.id === movement.id);
              if (row) {
                setSelectedRow(row);
              }
            }}
          />
        </div>
      );
    }
    
    if (selectedView === 'contabilidad') {
        return (
    
        <div className="p-4 bg-[#e0e5ec] h-full overflow-auto">
          <PeriodCloseAction />
          <div className="mt-4 unified-accounting-view">
            <section className="grid-shell enterprise-neo-card unified-accounting-main">
              <div className="enterprise-toolbar">
                <div className="enterprise-toolbar-modes">
                  <Button
                    size="small"
                    appearance={viewMode === 'FLAT' ? 'primary' : 'subtle'}
                    onClick={() => setViewMode('FLAT')}
                  >Desagregada</Button>
                  <Button
                    size="small"
                    appearance={viewMode === 'GROUPED' ? 'primary' : 'subtle'}
                    onClick={() => setViewMode('GROUPED')}
                  >Agrupada por asiento</Button>
                </div>
                <div className="enterprise-toolbar-quickfilters">
                  <Checkbox
                    label="Solo 6/9 sin CC"
                    checked={quickFilters.missingCostCenter}
                    onChange={(_, data) => setQuickFilters((p) => ({ ...p, missingCostCenter: !!data.checked }))}
                  />
                  <Checkbox
                    label="Solo descuadrados"
                    checked={quickFilters.unbalanced}
                    onChange={(_, data) => setQuickFilters((p) => ({ ...p, unbalanced: !!data.checked }))}
                  />
                  <Checkbox
                    label="Solo manuales"
                    checked={quickFilters.manualOnly}
                    onChange={(_, data) => setQuickFilters((p) => ({ ...p, manualOnly: !!data.checked }))}
                  />
                </div>
                <div className="enterprise-toolbar-stats">
                  <span>Asientos: <strong>{entriesStats.total}</strong></span>
                  <span className="status-ok-text">✓ {entriesStats.ok}</span>
                  <span className="status-desc-text">✖ {entriesStats.desc}</span>
                  <span className="status-ccreq-text">⚠ {entriesStats.ccReq}</span>
                </div>
              </div>

              <div className="grid-header-row sticky-top enterprise-table-header">
                <span>Fecha</span>
                <span>Periodo</span>
                <span>Glosa</span>
                <span>Cuenta</span>
                <span>CC</span>
                <span>Debe</span>
                <span>Haber</span>
                <span>Estado</span>
                <span>Modulo</span>
                <span>Hash</span>
              </div>

              <div className="grid-header-row filters sticky-filters">
                <Input size="small" value={filters.date} onChange={(_, data) => setFilters((prev) => ({ ...prev, date: data.value }))} />
                <Input size="small" value={filters.period} onChange={(_, data) => setFilters((prev) => ({ ...prev, period: data.value }))} />
                <Input size="small" value={filters.description} onChange={(_, data) => setFilters((prev) => ({ ...prev, description: data.value }))} />
                <Input size="small" value={filters.account} onChange={(_, data) => setFilters((prev) => ({ ...prev, account: data.value }))} />
                <Input size="small" value={filters.costCenter} onChange={(_, data) => setFilters((prev) => ({ ...prev, costCenter: data.value }))} />
                <span />
                <span />
                <Input size="small" value={filters.status} onChange={(_, data) => setFilters((prev) => ({ ...prev, status: data.value }))} />
                <Input size="small" value={filters.sourceModule} onChange={(_, data) => setFilters((prev) => ({ ...prev, sourceModule: data.value }))} />
                <span />
              </div>

              {loading ? (
                <div className="grid-skeleton">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="skeleton-row" />
                  ))}
                </div>
              ) : (
                <div className="grid-body erp-scroll">
                  {displayRows.map((entry, idx) => {
                    if (entry.kind === 'GROUP') {
                      const s = entry.summary;
                      const badge = validatorBadge(s.validatorStatus, s.variance);
                      return (
                        <button
                          key={`grp-${s.entryId}`}
                          type="button"
                          className={`grid-row grid-row-group row-status-${badge.cls}`}
                          onClick={() => toggleEntryExpansion(s.entryId)}
                          title={s.validatorStatus === 'DESCUADRADO' ? `Varianza S/ ${s.variance.toFixed(2)}` : ''}
                        >
                          <span>{entry.expanded ? '▼' : '▶'} {s.date}</span>
                          <span>{s.period}</span>
                          <span className="truncate"><strong>{s.entryId.slice(0, 8)}</strong> · {s.description}</span>
                          <span>—</span>
                          <span>—</span>
                          <span className="money">{formatMoney(s.totalDebit.toFixed(2))}</span>
                          <span className="money">{formatMoney(s.totalCredit.toFixed(2))}</span>
                          <span className={`validator-badge validator-${badge.cls}`}>{badge.symbol} {badge.label}</span>
                          <span>{s.sourceModule}</span>
                          <span className="hash truncate">{(s.hash || '').slice(0, 12)}</span>
                        </button>
                      );
                    }
                    const row = entry.row;
                    const badge = validatorBadge(row.validatorStatus, row.variance);
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className={`grid-row enterprise-row-hover row-status-${badge.cls} ${idx % 2 === 1 ? 'alt' : ''} ${row.id === selectedRow.id ? 'selected' : ''}`}
                        onClick={() => setSelectedRow(row)}
                      >
                        <span>{row.date}</span>
                        <span>{row.period}</span>
                        <span className="truncate">{row.description}</span>
                        <span title={row.accountName || row.account}>{row.account}</span>
                        <span className={row.missingCostCenter ? 'cc-warning' : ''}>{row.costCenter}</span>
                        <span className="money">{row.debit}</span>
                        <span className="money">{row.credit}</span>
                        <span>{row.status}</span>
                        <span>{row.sourceModule}</span>
                        <span className="hash truncate">{row.hash}</span>
                      </button>
                    );
                  })}
                  {displayRows.length === 0 && (
                    <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>
                      Sin asientos devueltos por la base de datos para el periodo consultado.
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="enterprise-neo-card unified-accounting-side">
              <h3 className="unified-analytic-title">DETALLE ANALITICO</h3>
              <div className="unified-analytic-box">
                {selectedRow.id !== emptyJournalRow.id ? (
                  <div className="unified-analytic-content">
                    {selectedSummary && (() => {
                      const badge = validatorBadge(selectedSummary.validatorStatus, selectedSummary.variance);
                      return (
                        <div className={`validator-panel validator-${badge.cls}`}>
                          <strong>{badge.symbol} {badge.label}</strong>
                          <span>Debe total: <b className="money">{formatMoney(selectedSummary.totalDebit.toFixed(2))}</b></span>
                          <span>Haber total: <b className="money">{formatMoney(selectedSummary.totalCredit.toFixed(2))}</b></span>
                          <span>Varianza: <b className="money">{selectedSummary.variance.toFixed(2)}</b></span>
                          {selectedSummary.missingCostCenters.length > 0 && (
                            <span className="cc-warning">CC faltante en: {Array.from(new Set(selectedSummary.missingCostCenters)).join(', ')}</span>
                          )}
                        </div>
                      );
                    })()}
                    <p><strong>Asiento:</strong> {selectedRow.entryId || selectedRow.id}</p>
                    <p><strong>Fecha:</strong> {selectedRow.date}</p>
                    <p><strong>Periodo:</strong> {selectedRow.period}</p>
                    <p><strong>Glosa:</strong> {selectedRow.description}</p>
                    <p><strong>Cuenta:</strong> {selectedRow.account} {selectedRow.accountName ? `- ${selectedRow.accountName}` : ''}</p>
                    <p><strong>CC:</strong> {selectedRow.costCenter}</p>
                    <p><strong>Estado:</strong> {selectedRow.status}</p>
                    <p><strong>Modulo:</strong> {selectedRow.sourceModule}</p>
                    <p><strong>Debe:</strong> {selectedRow.debit}</p>
                    <p><strong>Haber:</strong> {selectedRow.credit}</p>
                    {selectedRow.documentSeries && selectedRow.documentNumber && (
                      <p><strong>Documento:</strong> {selectedRow.documentSeries}-{selectedRow.documentNumber}</p>
                    )}
                    {selectedRow.partnerRuc && <p><strong>RUC:</strong> {selectedRow.partnerRuc}</p>}

                    <div className="forensic-section">
                      <strong>Integridad criptografica</strong>
                      <p className="unified-hash-line"><span className="hash-label">Anterior:</span> <span className="hash">{(selectedRow.previousHash || '').slice(0, 24) || '—'}</span></p>
                      <p className="unified-hash-line"><span className="hash-label">Actual:</span> <span className="hash">{(selectedRow.hash || '').slice(0, 24) || '—'}</span></p>
                      <span className="chain-badge">⛓ Cadena hash-link verificable</span>
                    </div>

                    {selectedSummary && selectedSummary.lines.length > 0 && (
                      <div className="t-contable">
                        <strong>T-Contable</strong>
                        <div className="t-contable-grid">
                          <div className="t-contable-col">
                            <div className="t-contable-head">DEBE</div>
                            {selectedSummary.lines.filter((l) => toNumber(l.debit) > 0).map((line, idx) => (
                              <div className="t-contable-line" key={`d-${idx}`}>
                                <span>{line.account} {line.accountName ? `· ${line.accountName.slice(0, 28)}` : ''}</span>
                                <span className="money">{line.debit}</span>
                              </div>
                            ))}
                            <div className="t-contable-total"><span>Total Debe</span><span className="money">{formatMoney(selectedSummary.totalDebit.toFixed(2))}</span></div>
                          </div>
                          <div className="t-contable-col">
                            <div className="t-contable-head">HABER</div>
                            {selectedSummary.lines.filter((l) => toNumber(l.credit) > 0).map((line, idx) => (
                              <div className="t-contable-line" key={`h-${idx}`}>
                                <span>{line.account} {line.accountName ? `· ${line.accountName.slice(0, 28)}` : ''}</span>
                                <span className="money">{line.credit}</span>
                              </div>
                            ))}
                            <div className="t-contable-total"><span>Total Haber</span><span className="money">{formatMoney(selectedSummary.totalCredit.toFixed(2))}</span></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRow.lines && selectedRow.lines.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <strong>Lineas del asiento</strong>
                        <table className="erp-table" style={{ width: '100%', marginTop: 8, fontSize: 11 }}>
                          <thead>
                            <tr>
                              <th>Cuenta</th>
                              <th>Descripcion</th>
                              <th>CC</th>
                              <th>Debe</th>
                              <th>Haber</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRow.lines.map((line, index) => {
                              const needsCC = requiresCostCenter(line.account_code) && isCostCenterEmpty(line.cost_center);
                              return (
                                <tr key={`${line.account_code}-${index}`}>
                                  <td>{line.account_code || 'N/A'}</td>
                                  <td>{line.account_name || ''}</td>
                                  <td className={needsCC ? 'cc-warning' : ''}>{line.cost_center || '-'}</td>
                                  <td style={{ textAlign: 'right' }} className="money">{formatMoney(line.debit ?? '0.00')}</td>
                                  <td style={{ textAlign: 'right' }} className="money">{formatMoney(line.credit ?? '0.00')}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="unified-empty-note">Seleccione un movimiento para ver el HASH de inmutabilidad.</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      );
    }

    return (
      <section className="grid-shell">
        <div className="grid-header-row sticky-top">
          <span>Fecha</span>
          <span>Periodo</span>
          <span>Glosa</span>
          <span>Cuenta</span>
          <span>CC</span>
          <span>Debe</span>
          <span>Haber</span>
          <span>Estado</span>
          <span>Modulo</span>
          <span>Hash</span>
        </div>

        <div className="grid-header-row filters sticky-filters">
          <Input size="small" value={filters.date} onChange={(_, data) => setFilters((prev) => ({ ...prev, date: data.value }))} />
          <Input size="small" value={filters.period} onChange={(_, data) => setFilters((prev) => ({ ...prev, period: data.value }))} />
          <Input size="small" value={filters.description} onChange={(_, data) => setFilters((prev) => ({ ...prev, description: data.value }))} />
          <Input size="small" value={filters.account} onChange={(_, data) => setFilters((prev) => ({ ...prev, account: data.value }))} />
          <Input size="small" value={filters.costCenter} onChange={(_, data) => setFilters((prev) => ({ ...prev, costCenter: data.value }))} />
          <span />
          <span />
          <Input size="small" value={filters.status} onChange={(_, data) => setFilters((prev) => ({ ...prev, status: data.value }))} />
          <Input size="small" value={filters.sourceModule} onChange={(_, data) => setFilters((prev) => ({ ...prev, sourceModule: data.value }))} />
          <span />
        </div>

        {loading ? (
          <div className="grid-skeleton">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="skeleton-row" />
            ))}
          </div>
        ) : (
          <div className="grid-body erp-scroll">
            {visibleRows.map((row, idx) => (
              <button
                key={row.id}
                type="button"
                className={`grid-row ${idx % 2 === 1 ? 'alt' : ''} ${row.id === selectedRow.id ? 'selected' : ''}`}
                onClick={() => setSelectedRow(row)}
              >
                <span>{row.date}</span>
                <span>{row.period}</span>
                <span className="truncate">{row.description}</span>
                <span>{row.account}</span>
                <span>{row.costCenter}</span>
                <span className="money">{row.debit}</span>
                <span className="money">{row.credit}</span>
                <span>{row.status}</span>
                <span>{row.sourceModule}</span>
                <span className="hash truncate">{row.hash}</span>
              </button>
            ))}
            {visibleRows.length === 0 && (
              <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>
                Sin asientos devueltos por la base de datos para el periodo consultado.
              </div>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="enterprise-shell">
      <header className="enterprise-topbar">
        <div className="brand-wrap">
          <BuildingBank24Regular />
          <strong>CONTA_PRO Enterprise</strong>
          <Badge appearance="filled" color="brand">SPA Enterprise</Badge>
          <TenantSelector />
        </div>
        <Input contentBefore={<Search24Regular />} placeholder="Buscar RUC, asiento, hash, XML" className="top-search" />
        <div className="top-right-badges">
          <Badge appearance="outline" icon={<LockClosed24Regular />}>Tenant aislado</Badge>
          <Badge appearance="outline" icon={<ShieldCheckmark24Regular />}>Auditoria activa</Badge>
        </div>
      </header>

      <div className="enterprise-body">
        <aside
          className={`nav-rail sidebar-container ${railExpanded ? 'expanded' : ''}`}
          onMouseEnter={() => setRailExpanded(true)}
          onMouseLeave={() => setRailExpanded(false)}
        >
          {railItems.map((item) => {
          const Icon = item.icon;
          const locked = item.feature ? !hasFeature(currentPlan, item.feature as any) : false;

          if (locked) {
            return (
              <div
                key={item.id}
                className="rail-item nav-link locked"
                title="Disponible en plan superior"
                style={{ opacity: 0.45, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <LockClosed24Regular style={{ color: '#475569' }} />
                <span className="rail-label" style={{ color: '#475569' }}>{item.label}</span>
              </div>
            );
          }

          return (
            <button
              key={item.id}
              className={`rail-item nav-link ${selectedView === item.id ? 'active' : ''}`}
              type="button"
              onClick={() => {
                if (typeof setSelectedView !== 'undefined') setSelectedView(item.id);
                }}
              title={item.label}
            >
              <Icon />
              <span className="rail-label">{item.label}</span>
            </button>
          );
        })}
        </aside>

        <main className="workspace-main">
          {selectedView !== 'contabilidad' && (
          <div className="command-bar">
            <div className="command-group">
              <button className="btn-fluent-primary" type="button" onClick={() => setActivePanel('VENTA')}>
                <Add24Regular />
                <span>Registrar Venta</span>
              </button>
              <button className="btn-fluent-primary" type="button" onClick={() => setActivePanel('COMPRA')}>
                <Money24Regular />
                <span>Registrar Compra</span>
              </button>
            </div>

            <div className="command-divider" />

            <div className="command-group">
              <button className="pro-btn soft" type="button" onClick={exportExcel}>
                <ArrowDownload24Regular />
                <span>Excel</span>
              </button>
              <button className="pro-btn soft" type="button" onClick={exportPdf}>
                <ClipboardTask24Regular />
                <span>PDF</span>
              </button>
              <button className="pro-btn soft" type="button" onClick={() => setActivePanel('CHECKLIST')}>
                <CalendarLtr24Regular />
                <span>Checklist</span>
              </button>
            </div>

            <div className="command-divider" />

            <div className="command-group">
              <button className="pro-btn soft" type="button" onClick={() => runAi('anomalies')}>
                <Bot24Regular />
                <span>Anomalias IA</span>
              </button>
              <button className="pro-btn soft" type="button" onClick={() => runAi('preclosure')}>
                <CloudArrowUp24Regular />
                <span>Pre-cierre IA</span>
              </button>
            </div>

            <div className="command-divider" />

            <button className="icon-btn" type="button" onClick={refreshJournal}>
              <ArrowClockwise24Regular />
            </button>
          </div>
          )}

          {selectedView !== 'contabilidad' && <div className="status-strip">{statusMessage}</div>}

          {selectedView !== 'contabilidad' && (
          <section className="metric-strip">
            {computedMetrics.map(([label, value]) => (
              <article key={label} className="metric-card">
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
          )}

          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderPrimaryView()}
          </div>

          {selectedView !== 'contabilidad' && (
          <footer className="assistant-bar">
            <div className="assistant-title">
              <Bot24Regular />
              <strong>Motor IA</strong>
              <span>{aiMessage}</span>
            </div>
            <div className="assistant-actions">
              <Input value={copilotQuestion} onChange={(_, data) => setCopilotQuestion(data.value)} placeholder="Pregunta al copiloto..." />
              <Button appearance="primary" onClick={() => runAi('copilot')} disabled={isRunningAi}>Ejecutar</Button>
              {selectedView === 'contabilidad' && (
                <Button appearance="secondary" onClick={() => setAccountDetailOpen(true)}>
                  Ver mayor analitico
                </Button>
              )}
            </div>
          </footer>
          )}
        </main>
      </div>

      <SidePanel
        isOpen={activePanel !== null}
        onClose={() => setActivePanel(null)}
        title={panelTitle}
        footer={null}
      >
        {activePanel === 'VENTA' && (
          <SaleFormEnterprise
            form={saleForm}
            onFormChange={setSaleForm}
            tenantId={getTenantId()}
            onClose={() => setActivePanel(null)}
            onSubmit={postSale}
          />
        )}

        {activePanel === 'COMPRA' && (
          <PurchaseFormEnterprise
            form={purchaseForm}
            onFormChange={setPurchaseForm}
            tenantId={getTenantId()}
            onClose={() => setActivePanel(null)}
            onSubmit={postPurchase}
          />
        )}

        {activePanel === 'CHECKLIST' && (
          <div className="sheet-form">
            <Checkbox label="Conciliacion bancaria completada" checked={checklist.conciliacionBancos} onChange={(_, data) => setChecklist((prev) => ({ ...prev, conciliacionBancos: !!data.checked }))} />
            <Checkbox label="Validacion IGV y detracciones" checked={checklist.validarIgv} onChange={(_, data) => setChecklist((prev) => ({ ...prev, validarIgv: !!data.checked }))} />
            <Checkbox label="Provision CxC 90+ dias" checked={checklist.provisionCxC} onChange={(_, data) => setChecklist((prev) => ({ ...prev, provisionCxC: !!data.checked }))} />
            <Checkbox label="CDR pendientes revisados" checked={checklist.cdrPendientes} onChange={(_, data) => setChecklist((prev) => ({ ...prev, cdrPendientes: !!data.checked }))} />
            <Checkbox label="Pre-cierre anual documentado" checked={checklist.cierreAnual} onChange={(_, data) => setChecklist((prev) => ({ ...prev, cierreAnual: !!data.checked }))} />
            <Field label="Notas del controlador">
              <Textarea resize="vertical" defaultValue="Checklist de cierre listo para auditoria." />
            </Field>
            <div className="sheet-footer" style={{ position: 'static', borderTop: 'none', padding: 0 }}>
              <Button appearance="secondary" onClick={() => setActivePanel(null)}>Cerrar</Button>
              <button type="button" className="btn-fluent-primary" onClick={() => setActivePanel(null)}>Guardar Checklist</button>
            </div>
          </div>
        )}
      </SidePanel>

      <AccountDetailPanel
        accountCode={selectedRow.account}
        isOpen={accountDetailOpen}
        onClose={() => setAccountDetailOpen(false)}
      >
        <LedgerAnalytic accountCode={selectedRow.account} />
      </AccountDetailPanel>
    </div>
 );
 };


