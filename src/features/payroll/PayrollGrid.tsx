import React, { useEffect, useMemo, useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody, Textarea } from '@fluentui/react-components';
import { Bot24Regular, DocumentPdf24Regular, PeopleTeam24Regular, ShieldCheckmark24Regular } from '@fluentui/react-icons';

type WorkerForm = {
  nombres: string;
  apellidos: string;
  dni: string;
  fecha_nacimiento: string;
  fecha_inicio_contrato: string;
  fecha_fin_contrato: string;
  direccion_domicilio: string;
  direccion_reniec: string;
  telefono: string;
  email: string;
  profesion: string;
  experiencia: string;
  estudios_realizados: string;
  cargo_postulado: string;
  sueldo_pactado: string;
  pension_system: string;
  habilidades_clave: string;
  // Nuevos campos solicitados
  regimen_laboral: string;
  area_centro_costo: string;
  estado_trabajador: 'ACTIVO' | 'CESADO' | 'SUSPENDIDO';
  asignacion_familiar: string;
  horas_extras: string;
  bonificaciones: string;
  comisiones: string;
  gratificaciones: string;
  cts: string;
  utilidades: string;
  afp_onp_monto: string;
  renta_quinta: string;
  adelantos: string;
  prestamos: string;
  faltas_tardanzas: string;
  essalud: string;
  sctr: string;
  vida_ley: string;
  dias_trabajados: string;
  vacaciones_pendientes: string;
};

type WorkerRow = WorkerForm & {
  id: string;
  worker_code: string;
  compliance_status: string;
  created_at: string;
  cv_metadata?: CvMetadata;
};

type PayrollGridProps = {
  apiBase?: string;
  token?: string;
  tenantId?: string;
  onStatus?: (message: string) => void;
  onJournalPosted?: () => void | Promise<void>;
};

type PayrollView = 'registro' | 'cv' | 'requisitos' | 'contrato' | 'boleta';

type RequirementStatus = 'PENDIENTE' | 'OBSERVADO' | 'APROBADO';

type RequirementItem = {
  id: string;
  category: string;
  name: string;
  note: string;
  required: boolean;
};

type RequirementRecord = RequirementItem & {
  status: RequirementStatus;
  evidence: string;
  source: 'IA_CV' | 'MANUAL' | 'ADJUNTO' | 'SISTEMA';
  fileName?: string;
  updatedAt: string;
};

type CvMetadata = {
  alerts?: string[];
  requirements?: RequirementRecord[];
  source_file?: string;
  extracted_at?: string;
  local_requirement_database_id?: string;
  [key: string]: unknown;
};

type RequirementDatabaseEntry = {
  id: string;
  tenantId: string;
  dni: string;
  fullName: string;
  sourceFile: string;
  requirements: RequirementRecord[];
  workerDraft: Partial<WorkerForm>;
  textPreview: string;
  workerId?: string;
  createdAt: string;
  updatedAt: string;
};

const emptyForm: WorkerForm = {
  nombres: '',
  apellidos: '',
  dni: '',
  fecha_nacimiento: '',
  fecha_inicio_contrato: '',
  fecha_fin_contrato: '',
  direccion_domicilio: '',
  direccion_reniec: '',
  telefono: '',
  email: '',
  profesion: '',
  experiencia: '',
  estudios_realizados: '',
  cargo_postulado: '',
  sueldo_pactado: '0.00',
  pension_system: 'AFP',
  habilidades_clave: '',
  regimen_laboral: '728',
  area_centro_costo: 'LIM-ADM',
  estado_trabajador: 'ACTIVO',
  asignacion_familiar: '0.00',
  horas_extras: '0.00',
  bonificaciones: '0.00',
  comisiones: '0.00',
  gratificaciones: '0.00',
  cts: '0.00',
  utilidades: '0.00',
  afp_onp_monto: '0.00',
  renta_quinta: '0.00',
  adelantos: '0.00',
  prestamos: '0.00',
  faltas_tardanzas: '0.00',
  essalud: '0.00',
  sctr: '0.00',
  vida_ley: '0.00',
  dias_trabajados: '30',
  vacaciones_pendientes: '0',
};

const payrollViews: Array<{ id: PayrollView; label: string }> = [
  { id: 'registro', label: 'Registro' },
  { id: 'cv', label: 'Hoja de vida IA' },
  { id: 'requisitos', label: 'Requisitos' },
  { id: 'contrato', label: 'Contrato' },
  { id: 'boleta', label: 'Boleta de pago' },
];

const hiringRequirements: RequirementItem[] = [
  { id: 'copia_dni_vigente', category: 'Identidad', name: 'Copia DNI vigente', note: 'Ambas caras, clara y legible', required: true },
  { id: 'foto_tamano_carne', category: 'Identidad', name: 'Foto tamano carne', note: 'Fondo blanco para ficha interna', required: true },
  { id: 'ficha_datos_personales', category: 'Identidad', name: 'Ficha de datos personales', note: 'Formato interno de la empresa', required: true },
  { id: 'hoja_vida_documentada', category: 'Academico', name: 'Hoja de vida documentada', note: 'CV actualizado y sustentado', required: true },
  { id: 'constancia_diploma_estudios', category: 'Academico', name: 'Constancia o diploma de estudios', note: 'Segun puesto y perfil requerido', required: true },
  { id: 'certificados_laborales_anteriores', category: 'Laboral', name: 'Certificados laborales anteriores', note: 'Experiencia declarada por el trabajador', required: false },
  { id: 'antecedentes_policiales', category: 'Legal', name: 'Antecedentes policiales', note: 'Emision no mayor a 90 dias', required: true },
  { id: 'antecedentes_penales', category: 'Legal', name: 'Antecedentes penales', note: 'Emision no mayor a 90 dias', required: true },
  { id: 'antecedentes_judiciales', category: 'Legal', name: 'Antecedentes judiciales', note: 'Segun politica del puesto', required: true },
  { id: 'declaracion_jurada_domicilio', category: 'Laboral', name: 'Declaracion jurada de domicilio', note: 'Direccion actual y trazabilidad RENIEC', required: true },
  { id: 'ficha_afp_onp', category: 'Laboral', name: 'Ficha AFP / ONP', note: 'Sistema pensionario y CUSPP si aplica', required: true },
  { id: 'cuenta_bancaria_haberes', category: 'Laboral', name: 'Cuenta bancaria de haberes', note: 'CCI o cuenta sueldo validada', required: true },
];

const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DEV_USER_ID = '22222222-2222-2222-2222-222222222222';

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

const createRequirementRecords = (): RequirementRecord[] => {
  const now = new Date().toISOString();
  return hiringRequirements.map((item) => ({
    ...item,
    status: 'PENDIENTE',
    evidence: 'Pendiente de lectura o adjunto.',
    source: 'SISTEMA',
    updatedAt: now,
  }));
};

const mergeRequirementRecords = (records: unknown): RequirementRecord[] => {
  const now = new Date().toISOString();
  const incoming = Array.isArray(records) ? records : [];
  return hiringRequirements.map((item) => {
    const found = incoming.find((entry) => (
      typeof entry === 'object'
      && entry !== null
      && 'id' in entry
      && String((entry as { id?: unknown }).id) === item.id
    )) as Partial<RequirementRecord> | undefined;
    const status = found?.status === 'APROBADO' || found?.status === 'OBSERVADO' || found?.status === 'PENDIENTE'
      ? found.status
      : 'PENDIENTE';
    const source = found?.source === 'IA_CV' || found?.source === 'MANUAL' || found?.source === 'ADJUNTO' || found?.source === 'SISTEMA'
      ? found.source
      : 'SISTEMA';

    return {
      ...item,
      status,
      evidence: String(found?.evidence || 'Pendiente de lectura o adjunto.'),
      source,
      fileName: found?.fileName,
      updatedAt: String(found?.updatedAt || now),
    };
  });
};

const requirementStatusMeta = (status: RequirementStatus) => {
  if (status === 'APROBADO') {
    return { label: 'Aprobado', className: 'ready' };
  }
  if (status === 'OBSERVADO') {
    return { label: 'Observado', className: 'alert' };
  }
  return { label: 'Pendiente', className: 'pending' };
};

const summarizeRequirements = (records: RequirementRecord[]) => {
  const approved = records.filter((item) => item.status === 'APROBADO').length;
  const observed = records.filter((item) => item.status === 'OBSERVADO').length;
  const pending = records.filter((item) => item.status === 'PENDIENTE').length;
  const requiredPending = records
    .filter((item) => item.required && item.status !== 'APROBADO')
    .map((item) => item.name);

  return {
    total: records.length,
    approved,
    observed,
    pending,
    required_pending: requiredPending,
  };
};

const buildRequirementRecordsFromExtraction = (
  backendRequirements: unknown,
  worker: Record<string, unknown>,
  fileName: string,
  previous: RequirementRecord[],
): RequirementRecord[] => {
  const merged = mergeRequirementRecords(backendRequirements);
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const now = new Date().toISOString();
  const fullName = `${String(worker.nombres || '')} ${String(worker.apellidos || '')}`.trim();

  return merged.map((item) => {
    const manual = previousById.get(item.id);
    if (manual?.status === 'APROBADO' && manual.source !== 'IA_CV') {
      return manual;
    }

    let next = { ...item, fileName, updatedAt: now };
    if (!backendRequirements || !Array.isArray(backendRequirements)) {
      if (item.id === 'ficha_datos_personales') {
        next = {
          ...next,
          status: fullName && worker.dni ? 'APROBADO' : 'OBSERVADO',
          evidence: `Datos detectados: ${fullName || 'sin nombre'}, DNI ${String(worker.dni || 'pendiente')}.`,
          source: 'IA_CV',
        };
      }
      if (item.id === 'hoja_vida_documentada') {
        next = {
          ...next,
          status: worker.experiencia || worker.profesion ? 'APROBADO' : 'OBSERVADO',
          evidence: `CV leido: ${String(worker.profesion || worker.cargo_postulado || 'cargo pendiente')}; experiencia: ${String(worker.experiencia || 'pendiente')}.`,
          source: 'IA_CV',
        };
      }
      if (item.id === 'copia_dni_vigente' && worker.dni) {
        next = { ...next, status: 'OBSERVADO', evidence: `DNI detectado en CV: ${String(worker.dni)}.`, source: 'IA_CV' };
      }
      if (item.id === 'constancia_diploma_estudios' && worker.estudios_realizados) {
        next = { ...next, status: 'OBSERVADO', evidence: String(worker.estudios_realizados), source: 'IA_CV' };
      }
      if (item.id === 'certificados_laborales_anteriores' && worker.experiencia) {
        next = { ...next, status: 'OBSERVADO', evidence: String(worker.experiencia), source: 'IA_CV' };
      }
      if (item.id === 'declaracion_jurada_domicilio' && worker.direccion_domicilio) {
        next = { ...next, status: 'OBSERVADO', evidence: String(worker.direccion_domicilio), source: 'IA_CV' };
      }
      if (item.id === 'ficha_afp_onp' && worker.pension_system) {
        next = { ...next, status: 'OBSERVADO', evidence: `Sistema pensionario detectado: ${String(worker.pension_system)}.`, source: 'IA_CV' };
      }
      if (item.id === 'cuenta_bancaria_haberes' && (worker.cci || worker.cuenta_bancaria)) {
        next = { ...next, status: 'OBSERVADO', evidence: `Cuenta/CCI detectada: ${String(worker.cci || worker.cuenta_bancaria)}.`, source: 'IA_CV' };
      }
    }
    return next;
  });
};

const fallbackWorkers: WorkerRow[] = [
  {
    ...emptyForm,
    id: 'demo-worker',
    worker_code: 'TRB-DEMO-001',
    nombres: 'Juan Alberto',
    apellidos: 'Perez Ramos',
    dni: '77441122',
    fecha_inicio_contrato: '2026-05-11',
    fecha_fin_contrato: '2027-05-11',
    direccion_domicilio: 'Av. Larco 123',
    direccion_reniec: 'Av. Larco 123',
    telefono: '999888777',
    email: 'juan.perez@demo.pe',
    profesion: 'Ingeniero Senior',
    experiencia: '8 anos de experiencia',
    cargo_postulado: 'Ingeniero Senior',
    sueldo_pactado: '5000.00',
    pension_system: 'AFP',
    habilidades_clave: 'SAP, Excel',
    compliance_status: 'READY',
    created_at: '2026-05-11T00:00:00',
  },
];

const downloadBase64Pdf = (filename: string, base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const downloadBase64File = (filename: string, base64: string, mimeType: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const toPayrollNumber = (value: string | number | undefined | null) => {
  const parsed = Number.parseFloat(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPEN = (value: number) =>
  `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const normalizeWorkerStatus = (value: unknown): WorkerForm['estado_trabajador'] => {
  const normalized = String(value ?? 'ACTIVO').toUpperCase();
  if (normalized === 'CESADO' || normalized === 'SUSPENDIDO') {
    return normalized;
  }
  return 'ACTIVO';
};

const complianceMeta = (status?: string) => {
  const normalized = String(status || 'PENDING').toUpperCase();
  if (normalized === 'READY' || normalized === 'APROBADO') {
    return { label: 'Aprobado', className: 'ready' };
  }
  if (normalized === 'ALERT' || normalized === 'OBSERVADO') {
    return { label: 'Observado', className: 'alert' };
  }
  return { label: 'Pendiente', className: 'pending' };
};

export const PayrollGrid = ({ apiBase = '/api/v1', token = '', tenantId = '', onStatus, onJournalPosted }: PayrollGridProps) => {
  const effectiveTenantId = tenantId || DEFAULT_TENANT_ID;
  const [runtimeToken, setRuntimeToken] = useState('');
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [workers, setWorkers] = useState<WorkerRow[]>(fallbackWorkers);
  const [selectedWorker, setSelectedWorker] = useState<WorkerRow | null>(fallbackWorkers[0]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [requirementRecords, setRequirementRecords] = useState<RequirementRecord[]>(() => createRequirementRecords());
  const [requirementDatabase, setRequirementDatabase] = useState<RequirementDatabaseEntry[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploadingLegalDocs, setIsUploadingLegalDocs] = useState(false);
  const [isValidatingIdentity, setIsValidatingIdentity] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPostingPayroll, setIsPostingPayroll] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [areaFilter, setAreaFilter] = useState('TODAS');
  const [activePayrollView, setActivePayrollView] = useState<PayrollView>('registro');
  const [contractType, setContractType] = useState('PLAZO INDETERMINADO');
  const effectiveToken = token || runtimeToken;
  const requirementStorageKey = `conta_pro_hr_requirements_${effectiveTenantId}`;

  const jsonHeaders = (bearerToken = effectiveToken) => ({
    Authorization: `Bearer ${bearerToken}`,
    'X-Tenant-Id': effectiveTenantId,
    'Content-Type': 'application/json',
  });

  const requestDevToken = async () => {
    const response = await fetch(`${apiBase}/auth/dev-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: effectiveTenantId, user_id: DEV_USER_ID, role: 'ADMIN' }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const payload = await response.json();
    const generated = String(payload.access_token || '');
    if (!generated) {
      throw new Error('Token dev vacio');
    }
    setRuntimeToken(generated);
    return generated;
  };

  const ensureToken = async () => {
    if (token && tokenTenantId(token) === effectiveTenantId) {
      return token;
    }
    if (runtimeToken && tokenTenantId(runtimeToken) === effectiveTenantId) {
      return runtimeToken;
    }
    return requestDevToken();
  };

  const filteredWorkers = useMemo(() => {
    const needle = filter.toLowerCase();
    return workers.filter((worker) => {
      const matchesText = `${worker.nombres} ${worker.apellidos} ${worker.dni} ${worker.cargo_postulado} ${worker.area_centro_costo}`
        .toLowerCase()
        .includes(needle);
      const matchesStatus = statusFilter === 'TODOS' || worker.estado_trabajador === statusFilter;
      const matchesArea = areaFilter === 'TODAS' || worker.area_centro_costo === areaFilter;
      return matchesText && matchesStatus && matchesArea;
    });
  }, [areaFilter, filter, statusFilter, workers]);

  const workerAreas = useMemo(() => (
    Array.from(new Set(workers.map((worker) => worker.area_centro_costo).filter(Boolean))).sort()
  ), [workers]);

  const payrollSummary = useMemo(() => {
    const active = workers.filter((worker) => worker.estado_trabajador === 'ACTIVO').length;
    const pending = workers.filter((worker) => complianceMeta(worker.compliance_status).className !== 'ready').length;
    const monthlyPayroll = workers.reduce((total, worker) => total + toPayrollNumber(worker.sueldo_pactado), 0);

    return {
      total: workers.length,
      active,
      pending,
      monthlyPayroll,
    };
  }, [workers]);

  const requirementSummary = useMemo(() => {
    return summarizeRequirements(requirementRecords);
  }, [requirementRecords]);

  const selectedRequirementRecords = useMemo(() => {
    return requirementRecords;
  }, [requirementRecords]);

  const selectedRequirementSummary = useMemo(() => (
    summarizeRequirements(selectedRequirementRecords)
  ), [selectedRequirementRecords]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(requirementStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setRequirementDatabase(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRequirementDatabase([]);
    }
  }, [requirementStorageKey]);

  const updateField = (key: keyof WorkerForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveRequirementDatabase = (updater: (previous: RequirementDatabaseEntry[]) => RequirementDatabaseEntry[]) => {
    setRequirementDatabase((previous) => {
      const next = updater(previous).slice(0, 100);
      localStorage.setItem(requirementStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const persistRequirementDraft = (
    worker: Record<string, unknown>,
    records: RequirementRecord[],
    sourceFile: string,
    textPreview: string,
  ) => {
    const now = new Date().toISOString();
    const dni = String(worker.dni || form.dni || '').trim();
    const fullName = `${String(worker.nombres || form.nombres || '')} ${String(worker.apellidos || form.apellidos || '')}`.trim();
    const id = dni ? `cv-${dni}` : `cv-${now}`;

    saveRequirementDatabase((previous) => {
      const existing = previous.find((entry) => entry.id === id);
      const entry: RequirementDatabaseEntry = {
        id,
        tenantId: effectiveTenantId,
        dni,
        fullName,
        sourceFile,
        requirements: records,
        workerDraft: { ...form, ...worker } as Partial<WorkerForm>,
        textPreview,
        workerId: existing?.workerId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      return [entry, ...previous.filter((item) => item.id !== id)];
    });
    return id;
  };

  const loadWorkers = async () => {
    try {
      const bearerToken = await ensureToken();
      const response = await fetch(`${apiBase}/hr/workers`, { headers: jsonHeaders(bearerToken) });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      if (Array.isArray(payload) && payload.length) {
        const mapItem = (item: Record<string, unknown>): WorkerRow => ({
          ...emptyForm,
          nombres: String(item.nombres ?? ''),
          apellidos: String(item.apellidos ?? ''),
          dni: String(item.dni ?? ''),
          fecha_nacimiento: String(item.fecha_nacimiento ?? ''),
          fecha_inicio_contrato: String(item.fecha_inicio_contrato ?? ''),
          fecha_fin_contrato: String(item.fecha_fin_contrato ?? ''),
          direccion_domicilio: String(item.direccion_domicilio ?? ''),
          direccion_reniec: String(item.direccion_reniec ?? ''),
          telefono: String(item.telefono ?? ''),
          email: String(item.email ?? ''),
          profesion: String(item.profesion ?? ''),
          experiencia: String(item.experiencia ?? ''),
          estudios_realizados: String(item.estudios_realizados ?? ''),
          cargo_postulado: String(item.cargo_postulado ?? ''),
          sueldo_pactado: String(item.sueldo_pactado ?? '0.00'),
          pension_system: String(item.pension_system ?? 'AFP'),
          habilidades_clave: Array.isArray(item.habilidades_clave) ? (item.habilidades_clave as string[]).join(', ') : String(item.habilidades_clave ?? ''),
          regimen_laboral: String(item.regimen_laboral ?? '728'),
          area_centro_costo: String(item.area_centro_costo ?? 'LIM-ADM'),
          estado_trabajador: normalizeWorkerStatus(item.estado_trabajador),
          asignacion_familiar: String(item.asignacion_familiar ?? '0.00'),
          horas_extras: String(item.horas_extras ?? '0.00'),
          bonificaciones: String(item.bonificaciones ?? '0.00'),
          comisiones: String(item.comisiones ?? '0.00'),
          gratificaciones: String(item.gratificaciones ?? '0.00'),
          cts: String(item.cts ?? '0.00'),
          utilidades: String(item.utilidades ?? '0.00'),
          afp_onp_monto: String(item.afp_onp_monto ?? '0.00'),
          renta_quinta: String(item.renta_quinta ?? '0.00'),
          adelantos: String(item.adelantos ?? '0.00'),
          prestamos: String(item.prestamos ?? '0.00'),
          faltas_tardanzas: String(item.faltas_tardanzas ?? '0.00'),
          essalud: String(item.essalud ?? '0.00'),
          sctr: String(item.sctr ?? '0.00'),
          vida_ley: String(item.vida_ley ?? '0.00'),
          dias_trabajados: String(item.dias_trabajados ?? '30'),
          vacaciones_pendientes: String(item.vacaciones_pendientes ?? '0'),
          id: String(item.worker_id ?? item.id ?? crypto.randomUUID()),
          worker_code: String(item.worker_code ?? ''),
          compliance_status: String(item.compliance_status ?? 'READY'),
          created_at: String(item.created_at ?? ''),
          cv_metadata: typeof item.cv_metadata === 'object' && item.cv_metadata !== null ? item.cv_metadata as CvMetadata : undefined,
        });
        const mapped = payload.map(mapItem);
        setWorkers(mapped);
        setSelectedWorker(mapped[0]);
        setRequirementRecords(mergeRequirementRecords(mapped[0]?.cv_metadata?.requirements));
      }
    } catch {
      onStatus?.('Planillas en modo local: no se pudo cargar trabajadores.');
    }
  };

  useEffect(() => {
    void loadWorkers();
  }, [token, tenantId]);

  const extractCv = async (file: File | null) => {
    if (!file) {
      return;
    }
    setIsExtracting(true);
    const body = new FormData();
    body.append('file', file);
    if (form.direccion_reniec.trim()) {
      body.append('reniec_address', form.direccion_reniec.trim());
    }
    try {
      const bearerToken = await ensureToken();
      const response = await fetch(`${apiBase}/hr/cv/extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'X-Tenant-Id': effectiveTenantId,
        },
        body,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      const batch = Array.isArray(payload.workers_batch) ? payload.workers_batch : [];
      const worker = (payload.worker || (batch[0]?.worker ?? {})) as Record<string, unknown>;
      const nextRequirements = buildRequirementRecordsFromExtraction(
        worker.requirements,
        worker,
        file.name,
        requirementRecords,
      );
      const requirementDatabaseId = persistRequirementDraft(
        worker,
        nextRequirements,
        file.name,
        String(payload.text_preview || ''),
      );
      setForm((prev) => ({
        ...prev,
        nombres: String(worker.nombres || ''),
        apellidos: String(worker.apellidos || ''),
        dni: String(worker.dni || ''),
        fecha_nacimiento: String(worker.fecha_nacimiento || ''),
        fecha_inicio_contrato: prev.fecha_inicio_contrato,
        fecha_fin_contrato: prev.fecha_fin_contrato,
        direccion_domicilio: String(worker.direccion_domicilio || ''),
        direccion_reniec: prev.direccion_reniec,
        telefono: String(worker.telefono || ''),
        email: String(worker.email || ''),
        profesion: String(worker.profesion || ''),
        experiencia: String(worker.experiencia || ''),
        estudios_realizados: String(worker.estudios_realizados || ''),
        cargo_postulado: String(worker.cargo_postulado || worker.profesion || ''),
        sueldo_pactado: String(worker.sueldo_pactado || '0.00'),
        pension_system: String(worker.pension_system || prev.pension_system || 'AFP'),
        habilidades_clave: Array.isArray(worker.habilidades_clave) ? worker.habilidades_clave.join(', ') : '',
      }));
      setRequirementRecords(nextRequirements);
      const batchAlerts = batch.length > 1
        ? [`Deteccion masiva: ${batch.length} candidatos encontrados en un solo PDF.`]
        : [];
      setAlerts([...(payload.warnings || []), ...batchAlerts, ...((worker.alerts as string[] | undefined) || [])]);
      if (batch.length > 1) {
        const topCodes = batch.slice(0, 5).map((item: { worker_code?: string }) => item.worker_code).filter(Boolean).join(', ');
        onStatus?.(`IA detecto ${batch.length} hojas de vida. Se cargo el primer perfil y la base de requisitos ${requirementDatabaseId}. Codigos: ${topCodes}`);
      } else {
        onStatus?.('CV procesado por IA-OCR; formulario y requisitos autocompletados.');
      }
    } catch {
      onStatus?.('No se pudo procesar el CV.');
    } finally {
      setIsExtracting(false);
    }
  };

  const uploadLegalDocuments = async (files: FileList | null) => {
    if (!files || !files.length) {
      return;
    }
    setIsUploadingLegalDocs(true);
    const body = new FormData();
    Array.from(files).forEach((file) => body.append('files', file));
    try {
      const bearerToken = await ensureToken();
      const response = await fetch(`${apiBase}/hr/legal-library/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'X-Tenant-Id': effectiveTenantId,
        },
        body,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      const count = Number(payload.indexed_documents || 0);
      onStatus?.(`Libreria legal cargada: ${count} documento(s) indexado(s) en RAG.`);
      const extraWarnings = Array.isArray(payload.warnings) ? payload.warnings : [];
      if (extraWarnings.length) {
        setAlerts((prev) => [...prev, ...extraWarnings]);
      }
    } catch {
      onStatus?.('No se pudo cargar la libreria legal.');
    } finally {
      setIsUploadingLegalDocs(false);
    }
  };

  const validateIdentity = async () => {
    if (!form.dni) {
      onStatus?.('Ingrese DNI para validar identidad.');
      return;
    }
    setIsValidatingIdentity(true);
    try {
      const bearerToken = await ensureToken();
      const response = await fetch(`${apiBase}/hr/identity/validate`, {
        method: 'POST',
        headers: jsonHeaders(bearerToken),
        body: JSON.stringify({
          dni: form.dni,
          nombres: form.nombres,
          apellidos: form.apellidos,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      const identityWarnings = Array.isArray(payload.warnings) ? payload.warnings : [];
      setAlerts((prev) => [...prev, ...identityWarnings]);
      onStatus?.(payload.status === 'OK' ? 'Identidad validada.' : 'Validacion con alertas; revise observaciones.');
    } catch {
      onStatus?.('No se pudo validar identidad.');
    } finally {
      setIsValidatingIdentity(false);
    }
  };

  const selectWorker = (worker: WorkerRow) => {
    const {
      id: _id,
      worker_code: _workerCode,
      compliance_status: _complianceStatus,
      created_at: _createdAt,
      cv_metadata: metadata,
      ...workerForm
    } = worker;

    setSelectedWorker(worker);
    setForm({ ...emptyForm, ...workerForm });
    setRequirementRecords(mergeRequirementRecords(metadata?.requirements));
    setAlerts(Array.isArray(metadata?.alerts) ? metadata.alerts : []);
  };

  const updateRequirement = (requirementId: string, update: Partial<RequirementRecord>) => {
    const now = new Date().toISOString();
    setRequirementRecords((previous) => previous.map((item) => (
      item.id === requirementId ? { ...item, ...update, updatedAt: now } : item
    )));
  };

  const attachRequirementFile = (requirementId: string, file: File | null) => {
    if (!file) {
      return;
    }
    updateRequirement(requirementId, {
      status: 'OBSERVADO',
      evidence: `Documento adjunto: ${file.name}`,
      source: 'ADJUNTO',
      fileName: file.name,
    });
    onStatus?.(`Requisito actualizado con adjunto: ${file.name}`);
  };

  const approveRequirement = (requirementId: string) => {
    const current = requirementRecords.find((item) => item.id === requirementId);
    updateRequirement(requirementId, {
      status: 'APROBADO',
      evidence: current?.evidence || 'Aprobado manualmente.',
      source: 'MANUAL',
    });
  };

  const saveWorker = async () => {

    setIsSaving(true);
    try {
      const bearerToken = await ensureToken();
      const metadata: CvMetadata = {
        alerts,
        requirements: requirementRecords,
        source: 'PayrollGrid',
        extracted_at: new Date().toISOString(),
        local_requirement_database_id: requirementDatabase.find((entry) => entry.dni && entry.dni === form.dni)?.id,
      };
      const response = await fetch(`${apiBase}/hr/workers`, {
        method: 'POST',
        headers: jsonHeaders(bearerToken),
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          ...form,
          fecha_nacimiento: form.fecha_nacimiento || null,
          fecha_inicio_contrato: form.fecha_inicio_contrato || null,
          fecha_fin_contrato: form.fecha_fin_contrato || null,
          sueldo_pactado: Number.parseFloat(form.sueldo_pactado || '0') || 0,
          habilidades_clave: form.habilidades_clave.split(',').map((item) => item.trim()).filter(Boolean),
          cv_metadata: metadata,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const saved = await response.json();
      saveRequirementDatabase((previous) => previous.map((entry) => (
        entry.dni && entry.dni === form.dni ? { ...entry, workerId: String(saved.id || ''), updatedAt: new Date().toISOString() } : entry
      )));
      onStatus?.('Trabajador guardado y validado.');
      setForm(emptyForm);
      setAlerts([]);
      setRequirementRecords(createRequirementRecords());
      await loadWorkers();
    } catch {
      onStatus?.('No se pudo guardar trabajador. Revise DNI/campos obligatorios.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateContract = async () => {
    if (!selectedWorker) {
      onStatus?.('Seleccione un trabajador de la lista para generar el contrato.');
      return;
    }
    setIsGenerating(true);
    try {
      const bearerToken = await ensureToken();
      const response = await fetch(`${apiBase}/hr/contracts/generate`, {
        method: 'POST',
        headers: jsonHeaders(bearerToken),
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          worker_id: selectedWorker.id ?? selectedWorker.worker_code,
          tipo_contrato: contractType,
          start_date: form.fecha_inicio_contrato || null,
          end_date: form.fecha_fin_contrato || null,
          pension_system: form.pension_system || null,
          requirements: selectedRequirementRecords,
          requirement_summary: selectedRequirementSummary,
          include_annex_package: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      downloadBase64Pdf(payload.filename || 'contrato-laboral.pdf', payload.pdf_base64);
      if (payload.package_zip_base64) {
        downloadBase64File(payload.package_filename || 'paquete-contratacion.zip', payload.package_zip_base64, 'application/zip');
      }
      const alertText = Array.isArray(payload.compliance_alerts) && payload.compliance_alerts.length
        ? ` Alertas: ${payload.compliance_alerts.join(' | ')}`
        : '';
      onStatus?.(`Contrato y anexos generados. Estado: ${payload.status}. Vence T-Registro: ${payload.t_registro_due}.${alertText}`);
    } catch {
      onStatus?.('No se pudo generar contrato PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const postPayrollJournal = async () => {
    setIsPostingPayroll(true);
    try {
      const bearerToken = await ensureToken();
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const entryDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const response = await fetch(`${apiBase}/hr/payroll/journal`, {
        method: 'POST',
        headers: jsonHeaders(bearerToken),
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          year,
          month,
          entry_date: entryDate,
          cost_center: form.area_centro_costo || selectedWorker?.area_centro_costo || 'LIM-ADM',
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      await onJournalPosted?.();
      onStatus?.(
        payload.already_posted
          ? `Planilla ${payload.period} ya estaba grabada en Libro Diario.`
          : `Planilla ${payload.period} grabada en Libro Diario: ${String(payload.id || '').slice(0, 8)}.`
      );
    } catch (error) {
      onStatus?.(`No se pudo postear planilla al Libro Diario. ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsPostingPayroll(false);
    }
  };

  const totals = useMemo(() => {
    const ingresos = 
      toPayrollNumber(form.sueldo_pactado) + 
      toPayrollNumber(form.asignacion_familiar) + 
      toPayrollNumber(form.horas_extras) + 
      toPayrollNumber(form.bonificaciones) +
      toPayrollNumber(form.comisiones) +
      toPayrollNumber(form.gratificaciones);
    
    const descuentos = 
      toPayrollNumber(form.afp_onp_monto) + 
      toPayrollNumber(form.renta_quinta) + 
      toPayrollNumber(form.adelantos) + 
      toPayrollNumber(form.prestamos) +
      toPayrollNumber(form.faltas_tardanzas);

    return { ingresos, descuentos, neto: ingresos - descuentos };
  }, [form]);

  return (
    <div className="hr-workspace">
      <section className="hr-hero">
        <div>
          <span className="hr-kicker">Planillas IA + Derecho Laboral Peruano</span>
          <h2>Planillas | Registro_Personal_V1</h2>
          <p>Alta de trabajador, captura de CV, validacion de datos personales y contratos con soporte legal RAG.</p>
        </div>
        <div className="hr-hero-actions">
          <Button appearance="primary" onClick={postPayrollJournal} disabled={isPostingPayroll || payrollSummary.monthlyPayroll <= 0}>
            {isPostingPayroll ? 'Posteando...' : 'Postear planilla'}
          </Button>
          <label className="hr-hero-upload">
            <input
              type="file"
              accept=".pdf,image/*,.txt"
              onChange={(event) => {
                void extractCv(event.target.files?.[0] || null);
                event.currentTarget.value = '';
                setActivePayrollView('cv');
              }}
            />
            <DocumentPdf24Regular />
            <span>{isExtracting ? 'Procesando hoja de vida...' : 'Adjuntar hoja de vida'}</span>
          </label>
          <div className="hr-hero-badge"><ShieldCheckmark24Regular /> Ley 29733 activa</div>
        </div>
      </section>

      <section className="hr-summary-grid" aria-label="Resumen de planillas">
        <article className="hr-summary-card total">
          <span>Total trabajadores</span>
          <strong>{payrollSummary.total}</strong>
        </article>
        <article className="hr-summary-card active">
          <span>Activos</span>
          <strong>{payrollSummary.active}</strong>
        </article>
        <article className="hr-summary-card pending">
          <span>Pendientes</span>
          <strong>{payrollSummary.pending}</strong>
        </article>
        <article className="hr-summary-card payroll">
          <span>Planilla mensual</span>
          <strong>{formatPEN(payrollSummary.monthlyPayroll)}</strong>
        </article>
      </section>

      <nav className="hr-module-tabs" aria-label="Ventanas de planillas">
        {payrollViews.map((view) => (
          <button
            key={view.id}
            type="button"
            className={activePayrollView === view.id ? 'active' : ''}
            onClick={() => setActivePayrollView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {activePayrollView === 'registro' && (
      <div className="hr-grid">
        <section className="hr-panel">
          <div className="hr-panel-title">
            <Bot24Regular />
            <div>
              <strong>Registro de trabajador</strong>
              <span>Datos laborales, remuneracion y validacion documental.</span>
            </div>
          </div>

          <div className="hr-upload-row">
            <label className="hr-upload">
              <input
                type="file"
                accept=".pdf,image/*,.txt"
                onChange={(event) => {
                  void extractCv(event.target.files?.[0] || null);
                  event.currentTarget.value = '';
                }}
              />
              <DocumentPdf24Regular />
              <span>{isExtracting ? 'Procesando CV...' : 'Adjuntar CV'}</span>
            </label>

            <label className="hr-upload">
              <input
                type="file"
                accept=".pdf,.txt"
                multiple
                onChange={(event) => {
                  void uploadLegalDocuments(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <DocumentPdf24Regular />
              <span>{isUploadingLegalDocs ? 'Indexando PDFs legales...' : 'Plantillas legales'}</span>
            </label>
          </div>

          {alerts.map((alert) => (
            <MessageBar key={alert} intent="warning"><MessageBarBody>{alert}</MessageBarBody></MessageBar>
          ))}

          <div className="hr-form-section">
            <div className="hr-section-divider">Datos personales</div>
            <div className="hr-form-grid">
              <Field label="Nombres"><Input value={form.nombres} onChange={(_, data) => updateField('nombres', data.value)} /></Field>
              <Field label="Apellidos"><Input value={form.apellidos} onChange={(_, data) => updateField('apellidos', data.value)} /></Field>
              <Field label="DNI"><Input value={form.dni} onChange={(_, data) => updateField('dni', data.value)} /></Field>
              <Field label="Fecha nacimiento"><Input type="date" value={form.fecha_nacimiento} onChange={(_, data) => updateField('fecha_nacimiento', data.value)} /></Field>
              <Field label="Telefono"><Input value={form.telefono} onChange={(_, data) => updateField('telefono', data.value)} /></Field>
              <Field label="Correo"><Input value={form.email} onChange={(_, data) => updateField('email', data.value)} /></Field>
            </div>
          </div>

          <div className="hr-form-section">
            <div className="hr-section-divider">Datos laborales</div>
            <div className="hr-form-grid">
              <Field label="Cargo"><Input value={form.cargo_postulado} onChange={(_, data) => updateField('cargo_postulado', data.value)} /></Field>
              <Field label="Area / centro costo"><Input value={form.area_centro_costo} onChange={(_, data) => updateField('area_centro_costo', data.value)} /></Field>
              <Field label="Regimen"><Input value={form.regimen_laboral} onChange={(_, data) => updateField('regimen_laboral', data.value)} /></Field>
              <Field label="Estado">
                <select value={form.estado_trabajador} onChange={(event) => updateField('estado_trabajador', event.target.value)} className="erp-input">
                  <option value="ACTIVO">Activo</option>
                  <option value="CESADO">Cesado</option>
                  <option value="SUSPENDIDO">Suspendido</option>
                </select>
              </Field>
              <Field label="Inicio contrato"><Input type="date" value={form.fecha_inicio_contrato} onChange={(_, data) => updateField('fecha_inicio_contrato', data.value)} /></Field>
              <Field label="Fin contrato"><Input type="date" value={form.fecha_fin_contrato} onChange={(_, data) => updateField('fecha_fin_contrato', data.value)} /></Field>
              <Field label="Dias trabajados"><Input value={form.dias_trabajados} onChange={(_, data) => updateField('dias_trabajados', data.value)} /></Field>
              <Field label="Vacaciones pendientes"><Input value={form.vacaciones_pendientes} onChange={(_, data) => updateField('vacaciones_pendientes', data.value)} /></Field>
            </div>
          </div>

          <div className="hr-form-section">
            <div className="hr-section-divider">Remuneraciones y beneficios</div>
            <div className="hr-form-grid">
              <Field label="Sueldo basico"><Input value={form.sueldo_pactado} onChange={(_, data) => updateField('sueldo_pactado', data.value)} /></Field>
              <Field label="Asignacion familiar"><Input value={form.asignacion_familiar} onChange={(_, data) => updateField('asignacion_familiar', data.value)} /></Field>
              <Field label="Horas extras"><Input value={form.horas_extras} onChange={(_, data) => updateField('horas_extras', data.value)} /></Field>
              <Field label="Bonificaciones"><Input value={form.bonificaciones} onChange={(_, data) => updateField('bonificaciones', data.value)} /></Field>
              <Field label="Comisiones"><Input value={form.comisiones} onChange={(_, data) => updateField('comisiones', data.value)} /></Field>
              <Field label="Gratificaciones"><Input value={form.gratificaciones} onChange={(_, data) => updateField('gratificaciones', data.value)} /></Field>
              <Field label="CTS"><Input value={form.cts} onChange={(_, data) => updateField('cts', data.value)} /></Field>
              <Field label="Utilidades"><Input value={form.utilidades} onChange={(_, data) => updateField('utilidades', data.value)} /></Field>
            </div>
          </div>

          <div className="hr-form-section">
            <div className="hr-section-divider">Descuentos y aportes</div>
            <div className="hr-form-grid">
              <Field label="Sistema pensionario"><Input value={form.pension_system} onChange={(_, data) => updateField('pension_system', data.value)} /></Field>
              <Field label="Monto AFP/ONP"><Input value={form.afp_onp_monto} onChange={(_, data) => updateField('afp_onp_monto', data.value)} /></Field>
              <Field label="Renta quinta"><Input value={form.renta_quinta} onChange={(_, data) => updateField('renta_quinta', data.value)} /></Field>
              <Field label="Adelantos"><Input value={form.adelantos} onChange={(_, data) => updateField('adelantos', data.value)} /></Field>
              <Field label="Prestamos"><Input value={form.prestamos} onChange={(_, data) => updateField('prestamos', data.value)} /></Field>
              <Field label="Faltas / tardanzas"><Input value={form.faltas_tardanzas} onChange={(_, data) => updateField('faltas_tardanzas', data.value)} /></Field>
              <Field label="EsSalud"><Input value={form.essalud} onChange={(_, data) => updateField('essalud', data.value)} /></Field>
              <Field label="SCTR"><Input value={form.sctr} onChange={(_, data) => updateField('sctr', data.value)} /></Field>
              <Field label="Vida Ley"><Input value={form.vida_ley} onChange={(_, data) => updateField('vida_ley', data.value)} /></Field>
            </div>
          </div>

          <div className="hr-results-panel">
            <div className="hr-result-item">
              <span>Total Ingresos</span>
              <strong>{formatPEN(totals.ingresos)}</strong>
            </div>
            <div className="hr-result-item">
              <span>Total Descuentos</span>
              <strong>{formatPEN(totals.descuentos)}</strong>
            </div>
            <div className="hr-result-item highlighted">
              <span>Neto a Pagar</span>
              <strong>{formatPEN(totals.neto)}</strong>
            </div>
          </div>

          <div className="hr-form-section">
            <div className="hr-section-divider">Contacto, experiencia y competencias</div>
            <div className="hr-textarea-grid">
              <Field label="Direccion domicilio">
                <Textarea value={form.direccion_domicilio} onChange={(_, data) => updateField('direccion_domicilio', data.value)} resize="vertical" />
              </Field>
              <Field label="Direccion RENIEC">
                <Textarea value={form.direccion_reniec} onChange={(_, data) => updateField('direccion_reniec', data.value)} resize="vertical" />
              </Field>
              <Field label="Experiencia">
                <Textarea value={form.experiencia} onChange={(_, data) => updateField('experiencia', data.value)} resize="vertical" />
              </Field>
              <Field label="Estudios realizados">
                <Textarea value={form.estudios_realizados} onChange={(_, data) => updateField('estudios_realizados', data.value)} resize="vertical" />
              </Field>
              <Field label="Habilidades clave">
                <Textarea value={form.habilidades_clave} onChange={(_, data) => updateField('habilidades_clave', data.value)} resize="vertical" />
              </Field>
            </div>
          </div>

          <div className="hr-actions">
            <Button appearance="secondary" onClick={validateIdentity} disabled={isValidatingIdentity || !form.dni}>
              {isValidatingIdentity ? 'Validando DNI...' : 'Validar Identidad'}
            </Button>
            <Button appearance="secondary" onClick={() => setForm(emptyForm)}>Limpiar</Button>
            <button type="button" className="btn-fluent-primary" onClick={saveWorker} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar y Validar'}
            </button>
          </div>
        </section>

        <section className="hr-panel">
          <div className="hr-panel-title">
            <PeopleTeam24Regular />
            <div>
              <strong>Control de Trabajadores</strong>
              <span>Lista de gestion con semaforo de cumplimiento y datos clave.</span>
            </div>
          </div>

          <div className="hr-filter-bar">
            <Input placeholder="Buscar por DNI, cargo, area o nombre" value={filter} onChange={(_, data) => setFilter(data.value)} />
            <select className="erp-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="TODOS">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="CESADO">Cesados</option>
              <option value="SUSPENDIDO">Suspendidos</option>
            </select>
            <select className="erp-input" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
              <option value="TODAS">Todas las areas</option>
              {workerAreas.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          <div className="hr-table-wrap">
            <table className="erp-table hr-workers-table">
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>DNI</th>
                  <th>Cargo</th>
                  <th>Area</th>
                  <th>Sueldo</th>
                  <th>Req.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((worker) => {
                  const meta = complianceMeta(worker.compliance_status);
                  const workerRequirements = mergeRequirementRecords(worker.cv_metadata?.requirements);
                  const workerReqSummary = summarizeRequirements(workerRequirements);
                  return (
                    <tr key={worker.id ?? worker.worker_code} onClick={() => selectWorker(worker)} className={selectedWorker?.id === worker.id ? 'hr-selected-row' : ''}>
                      <td>
                        <span className="hr-worker-cell">
                          <strong>{worker.nombres} {worker.apellidos}</strong>
                          <small>{worker.worker_code || 'Sin codigo'}</small>
                        </span>
                      </td>
                      <td>{worker.dni || '-'}</td>
                      <td>{worker.cargo_postulado || '-'}</td>
                      <td>{worker.area_centro_costo || '-'}</td>
                      <td className="money">{formatPEN(toPayrollNumber(worker.sueldo_pactado))}</td>
                      <td>
                        <span className={`hr-status ${workerReqSummary.required_pending.length ? 'alert' : 'ready'}`}>
                          {workerReqSummary.approved}/{workerReqSummary.total}
                        </span>
                      </td>
                      <td>
                        <span className={`hr-worker-state ${worker.estado_trabajador.toLowerCase()}`}>{worker.estado_trabajador}</span>
                        <span className={`hr-status ${meta.className}`}>{meta.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {filteredWorkers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="hr-empty-row">No hay trabajadores para los filtros seleccionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="hr-profile-card">
            <div>
              <span>Perfil seleccionado</span>
              <strong>{selectedWorker ? `${selectedWorker.nombres} ${selectedWorker.apellidos}` : 'Sin seleccion'}</strong>
              <p>{selectedWorker?.cargo_postulado || 'Seleccione un trabajador para generar contrato.'}</p>
            </div>
            {selectedWorker && (
              <dl className="hr-profile-meta">
                <div><dt>DNI</dt><dd>{selectedWorker.dni || '-'}</dd></div>
                <div><dt>Area</dt><dd>{selectedWorker.area_centro_costo || '-'}</dd></div>
                <div><dt>Pension</dt><dd>{selectedWorker.pension_system || '-'}</dd></div>
                <div><dt>Sueldo</dt><dd>{formatPEN(toPayrollNumber(selectedWorker.sueldo_pactado))}</dd></div>
              </dl>
            )}
            {selectedWorker && (
              <div className="hr-profile-requirements">
                <div className="hr-profile-requirements-head">
                  <span>Requisitos etiquetados para contrato</span>
                  <strong>{selectedRequirementSummary.approved}/{selectedRequirementSummary.total}</strong>
                </div>
                <div className="hr-requirement-chip-list">
                  {selectedRequirementRecords.map((item) => {
                    const status = requirementStatusMeta(item.status);
                    return (
                      <span key={item.id} className={`hr-requirement-chip ${status.className}`} title={item.evidence}>
                        <b>{item.category}</b>
                        {item.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <button type="button" className="btn-fluent-primary" onClick={generateContract} disabled={!selectedWorker || isGenerating}>
              {isGenerating ? 'Enviando expediente...' : 'Enviar info y generar contrato PDF'}
            </button>
          </div>
        </section>
      </div>
      )}

      {activePayrollView === 'cv' && (
        <section className="hr-window">
          <div className="hr-window-main">
            <div className="hr-panel-title">
              <Bot24Regular />
              <div>
                <strong>Extractor de hoja de vida IA</strong>
                <span>Lectura documental, prellenado del trabajador y control de alertas.</span>
              </div>
            </div>
            <label className="hr-cv-dropzone">
              <input
                type="file"
                accept=".pdf,image/*,.txt"
                onChange={(event) => {
                  void extractCv(event.target.files?.[0] || null);
                  event.currentTarget.value = '';
                }}
              />
              <DocumentPdf24Regular />
              <strong>{isExtracting ? 'Procesando hoja de vida...' : 'Arrastra o adjunta hoja de vida'}</strong>
              <span>PDF, imagen o TXT. Se autocompletan identidad, contacto, experiencia y habilidades.</span>
            </label>
            <div className="hr-cv-preview-grid">
              <article><span>Trabajador detectado</span><strong>{form.nombres || form.apellidos ? `${form.nombres} ${form.apellidos}` : 'Pendiente de lectura'}</strong></article>
              <article><span>DNI</span><strong>{form.dni || '-'}</strong></article>
              <article><span>Cargo sugerido</span><strong>{form.cargo_postulado || '-'}</strong></article>
              <article><span>Habilidades</span><strong>{form.habilidades_clave || '-'}</strong></article>
              <article><span>Requisitos IA</span><strong>{requirementSummary.approved} aprobados / {requirementSummary.observed} observados</strong></article>
            </div>
          </div>
          <aside className="hr-window-side">
            <strong>Alertas de lectura</strong>
            {alerts.length > 0 ? alerts.map((alert) => (
              <MessageBar key={alert} intent="warning"><MessageBarBody>{alert}</MessageBarBody></MessageBar>
            )) : <p>Sin alertas. Adjunta una hoja de vida para iniciar el analisis.</p>}
            <button type="button" className="btn-fluent-primary" onClick={() => setActivePayrollView('registro')}>
              Revisar formulario de alta
            </button>
          </aside>
        </section>
      )}

      {activePayrollView === 'requisitos' && (
        <section className="hr-window">
          <div className="hr-window-main">
            <div className="hr-panel-title">
              <ShieldCheckmark24Regular />
              <div>
                <strong>Expediente de contratacion</strong>
                <span>Checklist documentario peruano con semaforo de aprobacion.</span>
              </div>
            </div>
            <div className="hr-requirement-summary">
              <div><span>Total</span><strong>{requirementSummary.total}</strong></div>
              <div><span>Aprobados</span><strong>{requirementSummary.approved}</strong></div>
              <div><span>Pendientes</span><strong>{requirementSummary.pending}</strong></div>
              <div><span>Observados</span><strong>{requirementSummary.observed}</strong></div>
            </div>
            <div className="hr-requirement-list">
              {requirementRecords.map((item) => {
                const status = requirementStatusMeta(item.status);
                return (
                <article key={`${item.category}-${item.name}`} className="hr-requirement-card">
                  <div>
                    <span className="hr-requirement-category">{item.category}</span>
                    <strong>{item.name}</strong>
                    <p>{item.note}</p>
                    <p className="hr-requirement-evidence">{item.evidence}</p>
                  </div>
                  <div className="hr-requirement-actions">
                    {item.required && <span className="hr-status alert">Obligatorio</span>}
                    <span className={`hr-status ${status.className}`}>{status.label}</span>
                    <label className="btn-fluent-secondary hr-requirement-upload">
                      <input
                        type="file"
                        accept=".pdf,image/*,.txt"
                        onChange={(event) => {
                          attachRequirementFile(item.id, event.target.files?.[0] || null);
                          event.currentTarget.value = '';
                        }}
                      />
                      Adjuntar
                    </label>
                    <button type="button" className="btn-fluent-secondary" onClick={() => approveRequirement(item.id)}>Aprobar</button>
                  </div>
                </article>
                );
              })}
            </div>
          </div>
          <aside className="hr-window-side">
            <strong>Control legal</strong>
            <p>Base local: {requirementDatabase.length} expediente(s). Pendientes obligatorios: {requirementRecords.filter((item) => item.required && item.status !== 'APROBADO').length}.</p>
            <label className="hr-upload">
              <input
                type="file"
                accept=".pdf,.txt"
                multiple
                onChange={(event) => {
                  void uploadLegalDocuments(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <DocumentPdf24Regular />
              <span>{isUploadingLegalDocs ? 'Indexando...' : 'Adjuntar sustentos'}</span>
            </label>
          </aside>
        </section>
      )}

      {activePayrollView === 'contrato' && (
        <section className="hr-window">
          <div className="hr-window-main">
            <div className="hr-panel-title">
              <DocumentPdf24Regular />
              <div>
                <strong>Generador de contrato de trabajo</strong>
                <span>Contrato laboral con datos del trabajador, anexos y paquete documentario.</span>
              </div>
            </div>
            <div className="hr-contract-layout">
              <div className="hr-form-section">
                <div className="hr-section-divider">Parametros del contrato</div>
                <div className="hr-form-grid">
                  <Field label="Tipo de contrato">
                    <select className="erp-input" value={contractType} onChange={(event) => setContractType(event.target.value)}>
                      <option value="PLAZO INDETERMINADO">Plazo indeterminado</option>
                      <option value="PLAZO FIJO">Plazo fijo</option>
                      <option value="PART TIME">Part time</option>
                      <option value="PRACTICAS PREPROFESIONALES">Practicas preprofesionales</option>
                    </select>
                  </Field>
                  <Field label="Fecha de ingreso"><Input type="date" value={form.fecha_inicio_contrato} onChange={(_, data) => updateField('fecha_inicio_contrato', data.value)} /></Field>
                  <Field label="Fecha fin"><Input type="date" value={form.fecha_fin_contrato} onChange={(_, data) => updateField('fecha_fin_contrato', data.value)} /></Field>
                  <Field label="Lugar de trabajo"><Input value={form.area_centro_costo} onChange={(_, data) => updateField('area_centro_costo', data.value)} /></Field>
                </div>
              </div>
              <div className="hr-contract-preview">
                <span>Trabajador</span>
                <strong>{selectedWorker ? `${selectedWorker.nombres} ${selectedWorker.apellidos}` : `${form.nombres} ${form.apellidos}` || 'Sin seleccion'}</strong>
                <p>{form.cargo_postulado || selectedWorker?.cargo_postulado || 'Cargo pendiente'} | {formatPEN(toPayrollNumber(form.sueldo_pactado || selectedWorker?.sueldo_pactado))}</p>
                <ul>
                  <li>Regimen laboral: {form.regimen_laboral}</li>
                  <li>Sistema pensionario: {form.pension_system}</li>
                  <li>Centro de costo: {form.area_centro_costo}</li>
                  <li>Incluye anexos, ficha T-Registro y validaciones legales.</li>
                </ul>
              </div>
            </div>
          </div>
          <aside className="hr-window-side">
            <strong>Acciones de contrato</strong>
            <p>Selecciona un trabajador de la tabla o completa el registro para generar el contrato.</p>
            <button type="button" className="btn-fluent-primary" onClick={generateContract} disabled={!selectedWorker || isGenerating}>
              {isGenerating ? 'Enviando expediente...' : 'Enviar expediente y generar anexos'}
            </button>
          </aside>
        </section>
      )}

      {activePayrollView === 'boleta' && (
        <section className="hr-window hr-payslip-window">
          <div className="hr-payslip">
            <header>
              <div>
                <strong>BOLETA DE PAGO</strong>
                <span>Periodo mayo 2026</span>
              </div>
              <div>
                <strong>EMPRESA EJEMPLO S.A.C.</strong>
                <span>RUC: 20123456789</span>
              </div>
            </header>
            <section className="hr-payslip-meta">
              <div><span>Trabajador</span><strong>{selectedWorker ? `${selectedWorker.nombres} ${selectedWorker.apellidos}` : `${form.nombres} ${form.apellidos}` || 'Sin seleccion'}</strong></div>
              <div><span>DNI</span><strong>{form.dni || selectedWorker?.dni || '-'}</strong></div>
              <div><span>Cargo</span><strong>{form.cargo_postulado || selectedWorker?.cargo_postulado || '-'}</strong></div>
              <div><span>Pension</span><strong>{form.pension_system || selectedWorker?.pension_system || '-'}</strong></div>
            </section>
            <section className="hr-payslip-columns">
              <article>
                <h3>Ingresos</h3>
                <p><span>Sueldo basico</span><strong>{formatPEN(toPayrollNumber(form.sueldo_pactado || selectedWorker?.sueldo_pactado))}</strong></p>
                <p><span>Asignacion familiar</span><strong>{formatPEN(toPayrollNumber(form.asignacion_familiar))}</strong></p>
                <p><span>Horas extras</span><strong>{formatPEN(toPayrollNumber(form.horas_extras))}</strong></p>
                <p><span>Bonificaciones</span><strong>{formatPEN(toPayrollNumber(form.bonificaciones))}</strong></p>
                <footer><span>Total ingresos</span><strong>{formatPEN(totals.ingresos)}</strong></footer>
              </article>
              <article>
                <h3>Descuentos</h3>
                <p><span>AFP / ONP</span><strong>{formatPEN(toPayrollNumber(form.afp_onp_monto))}</strong></p>
                <p><span>Renta quinta</span><strong>{formatPEN(toPayrollNumber(form.renta_quinta))}</strong></p>
                <p><span>Adelantos</span><strong>{formatPEN(toPayrollNumber(form.adelantos))}</strong></p>
                <p><span>Faltas / tardanzas</span><strong>{formatPEN(toPayrollNumber(form.faltas_tardanzas))}</strong></p>
                <footer><span>Total descuentos</span><strong>{formatPEN(totals.descuentos)}</strong></footer>
              </article>
            </section>
            <div className="hr-payslip-net">
              <span>Neto a pagar</span>
              <strong>{formatPEN(totals.neto)}</strong>
            </div>
          </div>
          <aside className="hr-window-side">
            <strong>Asiento PCGE sugerido</strong>
            <p>62 Gastos de personal | 40 Tributos | 41 Remuneraciones por pagar | 79 Cargas imputables.</p>
            <button type="button" className="btn-fluent-primary">Imprimir / PDF</button>
          </aside>
        </section>
      )}
    </div>
  );
};
