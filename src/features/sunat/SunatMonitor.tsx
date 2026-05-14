import React, { useEffect, useState } from 'react';
import { CheckmarkCircle24Regular, ErrorCircle24Regular } from '@fluentui/react-icons';

type SubmissionRow = {
  id: string;
  submission_type: string;
  status: string;
  cdr_code?: string | null;
  cdr_description?: string | null;
};

const API_BASE = '/api/v1';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

export const SunatMonitor = () => {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [queueInfo, setQueueInfo] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('Monitor SUNAT listo.');

  const getHeaders = async () => {
    const tokenResponse = await fetch(`${API_BASE}/auth/dev-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT_ID, user_id: 'erp.operator', role: 'ADMIN' }),
    });
    if (!tokenResponse.ok) {
      throw new Error('No se pudo generar token');
    }
    const tokenPayload = await tokenResponse.json();
    return {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'X-Tenant-Id': TENANT_ID,
      'Content-Type': 'application/json',
    };
  };

  const loadRows = async () => {
    const headers = await getHeaders();

    const response = await fetch(`${API_BASE}/tax/submissions?limit=200`, {
      headers,
    });
    if (!response.ok) {
      throw new Error('No se pudo cargar submissions');
    }
    const payload = (await response.json()) as SubmissionRow[];
    setRows(payload);
  };

  const loadQueue = async () => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE}/tax/ops/queue-status`, { headers });
    if (!response.ok) {
      throw new Error('No se pudo cargar cola SUNAT');
    }
    setQueueInfo(await response.json());
  };

  const retrySubmission = async (submissionId: string) => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`${API_BASE}/tax/submissions/${submissionId}/retry`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        throw new Error('No se pudo reintentar');
      }
      setMessage(`Submission ${submissionId} enviada a retry.`);
      await loadRows();
      await loadQueue();
    } catch {
      setMessage('Error reintentando submission SUNAT.');
    }
  };

  const reprocessSubmission = async (submissionId: string) => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`${API_BASE}/tax/submissions/${submissionId}/reprocess`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        throw new Error('No se pudo reprocesar');
      }
      setMessage(`Submission ${submissionId} puesta en PENDING.`);
      await loadRows();
    } catch {
      setMessage('Error reprocesando submission SUNAT.');
    }
  };

  useEffect(() => {
    loadRows().catch(() => setRows([]));
    loadQueue().catch(() => setQueueInfo(null));
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
        <h3 className="font-bold text-slate-700">Monitor de Envio SUNAT</h3>
        <div className="flex gap-2 items-center">
          <span className="badge-success">CONECTADO</span>
          <button
            type="button"
            className="text-blue-600 text-xs font-bold"
            onClick={() => {
              loadRows().catch(() => setRows([]));
              loadQueue().catch(() => setQueueInfo(null));
            }}
          >
            Refrescar Estados
          </button>
        </div>
      </div>
      <div className="px-4 py-2 text-xs text-slate-600 border-b">{message}</div>
      <div className="px-4 py-2 text-xs border-b">
        Cola: {queueInfo ? JSON.stringify(queueInfo) : 'Sin datos de cola.'}
      </div>

      <table className="w-full text-xs text-left">
        <thead className="bg-slate-100 uppercase text-slate-500">
          <tr>
            <th className="p-3">Comprobante</th>
            <th className="p-3">Estado SUNAT</th>
            <th className="p-3">CDR</th>
            <th className="p-3">Mensaje de Respuesta</th>
            <th className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const accepted = row.status.toUpperCase() === 'ACCEPTED';
            return (
              <tr key={row.id} className={accepted ? '' : 'bg-red-50'}>
                <td className="p-3 font-medium">{row.submission_type}</td>
                <td className="p-3">
                  {accepted ? (
                    <span className="flex items-center gap-1 text-green-600 font-bold">
                      <CheckmarkCircle24Regular /> ACEPTADO
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600 font-bold">
                      <ErrorCircle24Regular /> RECHAZADO
                    </span>
                  )}
                </td>
                <td className="p-3 text-blue-600 underline cursor-pointer italic">{row.cdr_code ?? '-'}</td>
                <td className={accepted ? 'p-3 text-slate-500' : 'p-3 text-red-700 font-semibold'}>{row.cdr_description ?? '-'}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button type="button" className="text-blue-700" onClick={() => retrySubmission(row.id)}>Retry</button>
                    <button type="button" className="text-slate-700" onClick={() => reprocessSubmission(row.id)}>Reprocess</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td className="p-3 text-slate-500" colSpan={5}>No hay submissions SUNAT registradas.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
