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
  cargo_postulado: string;
  sueldo_pactado: string;
  pension_system: string;
  habilidades_clave: string;
};

type WorkerRow = WorkerForm & {
  id: string;
  worker_code: string;
  compliance_status: string;
  created_at: string;
};

type PayrollGridProps = {
  apiBase?: string;
  token?: string;
  tenantId?: string;
  onStatus?: (message: string) => void;
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
  cargo_postulado: '',
  sueldo_pactado: '0.00',
  pension_system: 'AFP',
  habilidades_clave: '',
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

export const PayrollGrid = ({ apiBase = '/api/v1', token = '', tenantId = '', onStatus }: PayrollGridProps) => {
  // Para el servidor HR local no se valida token; usamos fallback para no bloquear funciones
  const effectiveToken = token || 'local-dev-token';
  const effectiveTenantId = tenantId || '11111111-1111-1111-1111-111111111111';
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [workers, setWorkers] = useState<WorkerRow[]>(fallbackWorkers);
  const [selectedWorker, setSelectedWorker] = useState<WorkerRow | null>(fallbackWorkers[0]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploadingLegalDocs, setIsUploadingLegalDocs] = useState(false);
  const [isValidatingIdentity, setIsValidatingIdentity] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filter, setFilter] = useState('');

  const headers = useMemo(() => ({
    Authorization: `Bearer ${effectiveToken}`,
    'X-Tenant-Id': effectiveTenantId,
    'Content-Type': 'application/json',
  }), [effectiveToken, effectiveTenantId]);

  const filteredWorkers = useMemo(() => {
    const needle = filter.toLowerCase();
    return workers.filter((worker) =>
      `${worker.nombres} ${worker.apellidos} ${worker.dni} ${worker.cargo_postulado}`.toLowerCase().includes(needle),
    );
  }, [filter, workers]);

  const updateField = (key: keyof WorkerForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const loadWorkers = async () => {
    try {
      const response = await fetch(`${apiBase}/hr/workers`, { headers });
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
          cargo_postulado: String(item.cargo_postulado ?? ''),
          sueldo_pactado: String(item.sueldo_pactado ?? '0.00'),
          pension_system: String(item.pension_system ?? 'AFP'),
          habilidades_clave: Array.isArray(item.habilidades_clave) ? (item.habilidades_clave as string[]).join(', ') : String(item.habilidades_clave ?? ''),
          id: String(item.worker_id ?? item.id ?? crypto.randomUUID()),
          worker_code: String(item.worker_code ?? ''),
          compliance_status: String(item.compliance_status ?? 'READY'),
          created_at: String(item.created_at ?? ''),
        });
        const mapped = payload.map(mapItem);
        setWorkers(mapped);
        setSelectedWorker(mapped[0]);
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
      const response = await fetch(`${apiBase}/hr/cv/extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tenantId,
        },
        body,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      const batch = Array.isArray(payload.workers_batch) ? payload.workers_batch : [];
      const worker = payload.worker || (batch[0]?.worker ?? {});
      setForm({
        nombres: worker.nombres || '',
        apellidos: worker.apellidos || '',
        dni: worker.dni || '',
        fecha_nacimiento: worker.fecha_nacimiento || '',
        fecha_inicio_contrato: form.fecha_inicio_contrato,
        fecha_fin_contrato: form.fecha_fin_contrato,
        direccion_domicilio: worker.direccion_domicilio || '',
        direccion_reniec: form.direccion_reniec,
        telefono: worker.telefono || '',
        email: worker.email || '',
        profesion: worker.profesion || '',
        experiencia: worker.experiencia || '',
        cargo_postulado: worker.cargo_postulado || worker.profesion || '',
        sueldo_pactado: worker.sueldo_pactado || '0.00',
        pension_system: form.pension_system || 'AFP',
        habilidades_clave: Array.isArray(worker.habilidades_clave) ? worker.habilidades_clave.join(', ') : '',
      });
      const batchAlerts = batch.length > 1
        ? [`Deteccion masiva: ${batch.length} candidatos encontrados en un solo PDF.`]
        : [];
      setAlerts([...(payload.warnings || []), ...batchAlerts, ...(worker.alerts || [])]);
      if (batch.length > 1) {
        const topCodes = batch.slice(0, 5).map((item: { worker_code?: string }) => item.worker_code).filter(Boolean).join(', ');
        onStatus?.(`IA detecto ${batch.length} hojas de vida. Se cargo el primer perfil en formulario. Codigos: ${topCodes}`);
      } else {
        onStatus?.('CV procesado por IA-OCR y formulario autocompletado.');
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
      const response = await fetch(`${apiBase}/hr/legal-library/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
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
      const response = await fetch(`${apiBase}/hr/identity/validate`, {
        method: 'POST',
        headers,
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

  const saveWorker = async () => {

    setIsSaving(true);
    try {
      const response = await fetch(`${apiBase}/hr/workers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          ...form,
          fecha_nacimiento: form.fecha_nacimiento || null,
          sueldo_pactado: Number.parseFloat(form.sueldo_pactado || '0') || 0,
          habilidades_clave: form.habilidades_clave.split(',').map((item) => item.trim()).filter(Boolean),
          cv_metadata: { alerts },
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      onStatus?.('Trabajador guardado y validado.');
      setForm(emptyForm);
      setAlerts([]);
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
      const response = await fetch(`${apiBase}/hr/contracts/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenant_id: effectiveTenantId,
          worker_id: selectedWorker.id ?? selectedWorker.worker_code,
          tipo_contrato: 'PLAZO INDETERMINADO',
          start_date: form.fecha_inicio_contrato || null,
          end_date: form.fecha_fin_contrato || null,
          pension_system: form.pension_system || null,
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

  return (
    <div className="hr-workspace">
      <section className="hr-hero">
        <div>
          <span className="hr-kicker">Planillas IA + Derecho Laboral Peruano</span>
          <h2>Planillas | Registro_Personal_V1</h2>
          <p>Alta de trabajador, captura de CV, validacion de datos personales y contratos con soporte legal RAG.</p>
        </div>
        <div className="hr-hero-badge"><ShieldCheckmark24Regular /> Ley 29733 activa</div>
      </section>

      <div className="hr-grid">
        <section className="hr-panel">
          <div className="hr-panel-title">
            <Bot24Regular />
            <div>
              <strong>Lectura de Hoja de Vida</strong>
              <span>IA-OCR autocompleta las celdas del formulario.</span>
            </div>
          </div>

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
            <span>{isUploadingLegalDocs ? 'Indexando PDFs legales...' : 'Adjuntar Plantillas Legales (RAG)'}</span>
          </label>

          {alerts.map((alert) => (
            <MessageBar key={alert} intent="warning"><MessageBarBody>{alert}</MessageBarBody></MessageBar>
          ))}

          <div className="hr-form-grid">
            <Field label="Nombres"><Input value={form.nombres} onChange={(_, data) => updateField('nombres', data.value)} /></Field>
            <Field label="Apellidos"><Input value={form.apellidos} onChange={(_, data) => updateField('apellidos', data.value)} /></Field>
            <Field label="DNI"><Input value={form.dni} onChange={(_, data) => updateField('dni', data.value)} /></Field>
            <Field label="Fecha nacimiento"><Input type="date" value={form.fecha_nacimiento} onChange={(_, data) => updateField('fecha_nacimiento', data.value)} /></Field>
            <Field label="Inicio contrato"><Input type="date" value={form.fecha_inicio_contrato} onChange={(_, data) => updateField('fecha_inicio_contrato', data.value)} /></Field>
            <Field label="Fin contrato"><Input type="date" value={form.fecha_fin_contrato} onChange={(_, data) => updateField('fecha_fin_contrato', data.value)} /></Field>
            <Field label="Telefono"><Input value={form.telefono} onChange={(_, data) => updateField('telefono', data.value)} /></Field>
            <Field label="Correo"><Input value={form.email} onChange={(_, data) => updateField('email', data.value)} /></Field>
            <Field label="Profesion"><Input value={form.profesion} onChange={(_, data) => updateField('profesion', data.value)} /></Field>
            <Field label="Cargo postulado"><Input value={form.cargo_postulado} onChange={(_, data) => updateField('cargo_postulado', data.value)} /></Field>
            <Field label="Sueldo pactado"><Input value={form.sueldo_pactado} onChange={(_, data) => updateField('sueldo_pactado', data.value)} /></Field>
            <Field label="Sistema pensionario"><Input value={form.pension_system} onChange={(_, data) => updateField('pension_system', data.value)} /></Field>
            <Field label="Habilidades clave"><Input value={form.habilidades_clave} onChange={(_, data) => updateField('habilidades_clave', data.value)} /></Field>
          </div>

          <Field label="Direccion domicilio">
            <Textarea value={form.direccion_domicilio} onChange={(_, data) => updateField('direccion_domicilio', data.value)} resize="vertical" />
          </Field>
          <Field label="Direccion RENIEC (referencia)">
            <Textarea value={form.direccion_reniec} onChange={(_, data) => updateField('direccion_reniec', data.value)} resize="vertical" />
          </Field>
          <Field label="Experiencia">
            <Textarea value={form.experiencia} onChange={(_, data) => updateField('experiencia', data.value)} resize="vertical" />
          </Field>

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
              <span>Lista de gestion con semaforo de cumplimiento.</span>
            </div>
          </div>

          <Input placeholder="Filtrar por DNI, cargo o nombre" value={filter} onChange={(_, data) => setFilter(data.value)} />

          <div className="hr-table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Trabajador</th>
                  <th>DNI</th>
                  <th>Cargo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id ?? worker.worker_code} onClick={() => setSelectedWorker(worker)} className={selectedWorker?.id === worker.id ? 'hr-selected-row' : ''}>
                    <td>{worker.nombres} {worker.apellidos}</td>
                    <td>{worker.dni}</td>
                    <td>{worker.cargo_postulado}</td>
                    <td><span className={`hr-status ${worker.compliance_status === 'ALERT' ? 'alert' : 'ready'}`}>{worker.compliance_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="hr-profile-card">
            <span>Perfil seleccionado</span>
            <strong>{selectedWorker ? `${selectedWorker.nombres} ${selectedWorker.apellidos}` : 'Sin seleccion'}</strong>
            <p>{selectedWorker?.cargo_postulado || 'Seleccione un trabajador para generar contrato.'}</p>
            <button type="button" className="btn-fluent-primary" onClick={generateContract} disabled={!selectedWorker || isGenerating}>
              {isGenerating ? 'Generando...' : 'Generar Contrato PDF'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
