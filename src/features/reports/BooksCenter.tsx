import React, { useState } from 'react';
import { Badge, Button, Field, Input } from '@fluentui/react-components';

type Props = {
  apiBase: string;
  tenantId: string;
};

type StatusPayload = {
  period: string;
  sources: {
    sales_documents: number;
    purchase_documents: number;
    treasury_movements: number;
    inventory_balances: number;
  };
  ready: boolean;
};

type GeneratePayload = {
  package_id: string;
  period: string;
  filename: string;
  files: Array<{ filename: string; size: number }>;
  download: {
    filename: string;
    content_base64: string;
  };
};

type PackageRow = {
  package_id: string;
  period: string;
  version: number;
  status: string;
  filename: string;
  generated_at: string;
  submitted_submission_id?: string | null;
};

const downloadBase64 = (filename: string, contentBase64: string) => {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const BooksCenter = ({ apiBase, tenantId }: Props) => {
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState('5');
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [pack, setPack] = useState<GeneratePayload | null>(null);
  const [history, setHistory] = useState<PackageRow[]>([]);
  const [message, setMessage] = useState('Listo para generar libros operativos por periodo.');
  const [loading, setLoading] = useState(false);

  const requestToken = async () => {
    const response = await fetch(`${apiBase}/auth/dev-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, user_id: 'erp.operator', role: 'ADMIN' }),
    });
    if (!response.ok) {
      throw new Error('No se pudo generar token');
    }
    const payload = await response.json();
    return payload.access_token as string;
  };

  const commonHeaders = async () => {
    const token = await requestToken();
    return {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      'Content-Type': 'application/json',
    };
  };

  const checkStatus = async () => {
    setLoading(true);
    try {
      const headers = await commonHeaders();
      const response = await fetch(`${apiBase}/reports/books/status?year=${year}&month=${month}`, { headers });
      if (!response.ok) {
        throw new Error('No se pudo consultar estado');
      }
      const payload = await response.json() as StatusPayload;
      setStatus(payload);
      setMessage(`Estado del periodo ${payload.period} actualizado.`);
    } catch {
      setMessage('Error consultando estado de libros.');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const headers = await commonHeaders();
      const response = await fetch(`${apiBase}/reports/books/packages?period=${year}-${month.padStart(2, '0')}`, { headers });
      if (!response.ok) {
        throw new Error('No se pudo cargar historial');
      }
      setHistory(await response.json() as PackageRow[]);
    } catch {
      setHistory([]);
    }
  };

  const generateBooks = async () => {
    setLoading(true);
    try {
      const headers = await commonHeaders();
      const response = await fetch(`${apiBase}/reports/books/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ year: Number.parseInt(year, 10), month: Number.parseInt(month, 10) }),
      });
      if (!response.ok) {
        throw new Error('No se pudo generar libros');
      }
      const payload = await response.json() as GeneratePayload;
      setPack(payload);
      setMessage(`Libros generados: ${payload.filename}`);
      await loadHistory();
    } catch {
      setMessage('Error generando libros del periodo.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPackage = async () => {
    if (!pack) {
      return;
    }
    downloadBase64(pack.download.filename, pack.download.content_base64);
  };

  const submitSunat = async (packageId: string) => {
    try {
      const headers = await commonHeaders();
      const response = await fetch(`${apiBase}/reports/books/packages/${packageId}/submit-sunat`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        throw new Error('No se pudo enviar paquete');
      }
      const payload = await response.json();
      setMessage(`Paquete enviado a SUNAT. Submission: ${payload.submission_id}`);
      await loadHistory();
    } catch {
      setMessage('Error enviando paquete de libros a SUNAT.');
    }
  };

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong>Libros operativos por periodo</strong>
        <Badge appearance="filled">Compras</Badge>
        <Badge appearance="filled">Ventas</Badge>
        <Badge appearance="filled">Caja/Bancos</Badge>
        <Badge appearance="filled">Inventarios y Balances</Badge>
      </div>

      <section className="glass-card" style={{ padding: 12, display: 'grid', gridTemplateColumns: '120px 120px 1fr', gap: 8 }}>
        <Field label="Anio"><Input value={year} onChange={(_, d) => setYear(d.value)} /></Field>
        <Field label="Mes"><Input value={month} onChange={(_, d) => setMonth(d.value)} /></Field>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <Button appearance="secondary" disabled={loading} onClick={checkStatus}>Estado</Button>
          <Button appearance="primary" disabled={loading} onClick={generateBooks}>Generar</Button>
          <Button appearance="secondary" disabled={!pack || loading} onClick={downloadPackage}>Descargar ZIP</Button>
          <Button appearance="secondary" disabled={loading} onClick={loadHistory}>Historial</Button>
        </div>
      </section>

      <div className="status-strip">{message}</div>

      {status && (
        <section className="glass-card" style={{ padding: 12 }}>
          <strong>Estado de fuentes - {status.period}</strong>
          <ul style={{ marginTop: 8 }}>
            <li>Ventas: {status.sources.sales_documents}</li>
            <li>Compras: {status.sources.purchase_documents}</li>
            <li>Caja/Bancos: {status.sources.treasury_movements}</li>
            <li>Inventario: {status.sources.inventory_balances}</li>
          </ul>
        </section>
      )}

      {pack && (
        <section className="glass-card" style={{ padding: 12 }}>
          <strong>Paquete generado</strong>
          <div style={{ marginTop: 6 }}>ID: {pack.package_id}</div>
          <div>Archivo: {pack.filename}</div>
          <table style={{ marginTop: 8, width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Archivo</th>
                <th style={{ textAlign: 'right' }}>Bytes</th>
              </tr>
            </thead>
            <tbody>
              {pack.files.map((item) => (
                <tr key={item.filename}>
                  <td>{item.filename}</td>
                  <td style={{ textAlign: 'right' }}>{item.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="glass-card" style={{ padding: 12 }}>
        <strong>Historial de paquetes</strong>
        <table style={{ marginTop: 8, width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Periodo</th>
              <th style={{ textAlign: 'right' }}>Version</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
              <th style={{ textAlign: 'left' }}>Archivo</th>
              <th style={{ textAlign: 'left' }}>Accion</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.package_id}>
                <td>{item.period}</td>
                <td style={{ textAlign: 'right' }}>{item.version}</td>
                <td>{item.status}</td>
                <td>{item.filename}</td>
                <td>
                  <button type="button" onClick={() => submitSunat(item.package_id)}>
                    Enviar SUNAT
                  </button>
                </td>
              </tr>
            ))}
            {!history.length && (
              <tr><td colSpan={5}>Sin historial para el periodo.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};
