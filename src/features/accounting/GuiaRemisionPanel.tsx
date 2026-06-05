import React, { useMemo, useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody } from '@fluentui/react-components';

type GuiaLineItem = {
  productCode: string;
  description: string;
  unit: string;
  quantity: string;
};

type GuiaRemisionPanelProps = {
  token?: string;
  tenantId?: string;
  source: {
    serie: string;
    number: string;
    issueDate?: string;
    partnerRuc: string;
    lineItems: GuiaLineItem[];
  };
  onClose: () => void;
  onSaved?: () => void;
};

type GuiaData = {
  serie: string;
  number: string;
  issueDate: string;
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
  destinatarioRuc: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const API_BASE = '/api/v1';

const nextGuideNumber = () => {
  const n = Number(localStorage.getItem('guiaRemisionCounter') || '1');
  localStorage.setItem('guiaRemisionCounter', String(n + 1));
  return String(n).padStart(8, '0');
};

const pdfEscape = (value: string) => value.replace(/[()\\]/g, '');

export const GuiaRemisionPanel: React.FC<GuiaRemisionPanelProps> = ({ token, tenantId, source, onClose, onSaved }) => {
  const [editable, setEditable] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<GuiaData>({
    serie: 'T001',
    number: nextGuideNumber(),
    issueDate: source.issueDate || today(),
    transferDate: source.issueDate || today(),
    motivoTraslado: 'VENTA',
    modalidadTransporte: 'PRIVADO',
    pesoBrutoTotal: '0.00',
    numeroBultos: '1',
    partidaDireccion: 'ALMACEN PRINCIPAL',
    partidaUbigeo: '150101',
    llegadaDireccion: 'DIRECCION CLIENTE',
    llegadaUbigeo: '150101',
    transportistaRuc: '',
    transportistaRazonSocial: '',
    conductorDni: '',
    conductorLicencia: '',
    placaVehiculo: '',
    destinatarioRuc: source.partnerRuc,
  });

  const guiaId = useMemo(() => `${data.serie}-${data.number}`, [data.serie, data.number]);

  const update = (key: keyof GuiaData, value: string) => setData((prev) => ({ ...prev, [key]: value }));

  const saveGuide = async () => {
    if (!data.transportistaRuc || !data.transportistaRazonSocial || !data.placaVehiculo) {
      setMessage('Completa NIT, razon social y placa del transportista para guardar la remesa.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        direction: 'AR',
        source_document: `${source.serie}-${source.number}`,
        ...data,
        line_items: source.lineItems,
      };

      if (token && tenantId) {
        const response = await fetch(`${API_BASE}/ledger/documents/guide/save`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-Id': tenantId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
      } else {
        localStorage.setItem(`guia:${guiaId}`, JSON.stringify(payload));
      }
      setEditable(false);
      setMessage(`Guia ${guiaId} guardada${token && tenantId ? ' en documentos' : ''}.`);
      onSaved?.();
    } catch {
      setMessage('No se pudo guardar la guia.');
    } finally {
      setSaving(false);
    }
  };

  const printGuide = () => {
    if (!data.transportistaRuc || !data.transportistaRazonSocial || !data.placaVehiculo) {
      setMessage('Completa datos del transportista antes de imprimir.');
      return;
    }
    const rows = source.lineItems
      .slice(0, 12)
      .map((item) => `(${pdfEscape(item.productCode)} ${pdfEscape(item.description)} ${pdfEscape(item.unit)} ${pdfEscape(item.quantity)}) Tj 0 -16 Td`)
      .join('\n');

    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 2400 >>
stream
BT
/F1 11 Tf
40 810 Td
(GUIA DE REMISION REMITENTE ${pdfEscape(guiaId)}) Tj
0 -20 Td
(Comprobante origen: ${pdfEscape(source.serie)}-${pdfEscape(source.number)}) Tj
0 -20 Td
(Fecha Emision: ${pdfEscape(data.issueDate)}  Fecha Traslado: ${pdfEscape(data.transferDate)}) Tj
0 -20 Td
(Motivo: ${pdfEscape(data.motivoTraslado)}  Modalidad: ${pdfEscape(data.modalidadTransporte)}) Tj
0 -20 Td
(Destinatario NIT: ${pdfEscape(data.destinatarioRuc)}) Tj
0 -20 Td
(Transportista: ${pdfEscape(data.transportistaRazonSocial)} NIT: ${pdfEscape(data.transportistaRuc)}) Tj
0 -20 Td
(Placa: ${pdfEscape(data.placaVehiculo)}  Licencia: ${pdfEscape(data.conductorLicencia)}  Cédula: ${pdfEscape(data.conductorDni)}) Tj
0 -20 Td
(Origen: ${pdfEscape(data.partidaDireccion)} DANE ${pdfEscape(data.partidaUbigeo)}) Tj
0 -20 Td
(Destino: ${pdfEscape(data.llegadaDireccion)} DANE ${pdfEscape(data.llegadaUbigeo)}) Tj
0 -25 Td
(DETALLE DE BIENES) Tj
0 -16 Td
(CODIGO DESCRIPCION UND CANTIDAD) Tj
0 -16 Td
${rows}
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000068 00000 n
0000000126 00000 n
0000000272 00000 n
0000002760 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
2830
%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    setTimeout(() => iframe.contentWindow?.print(), 400);
    setMessage(`Imprimiendo guia ${guiaId}...`);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ width: 'min(96vw, 1200px)', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #dbe3ed' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: '#0f548c' }}>Remesa de Mercancías</h3>
          <Button appearance="secondary" onClick={onClose}>Cerrar</Button>
        </div>

        {message && (
          <MessageBar intent="info">
            <MessageBarBody>{message}</MessageBarBody>
          </MessageBar>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
          <Field label="Serie guia"><Input value={data.serie} onChange={(_, d) => update('serie', d.value)} disabled={!editable} /></Field>
          <Field label="Numero guia"><Input value={data.number} onChange={(_, d) => update('number', d.value)} disabled={!editable} /></Field>
          <Field label="Fecha emision"><Input type="date" value={data.issueDate} onChange={(_, d) => update('issueDate', d.value)} disabled={!editable} /></Field>
          <Field label="Fecha traslado"><Input type="date" value={data.transferDate} onChange={(_, d) => update('transferDate', d.value)} disabled={!editable} /></Field>

          <Field label="Motivo traslado">
            <select value={data.motivoTraslado} onChange={(e) => update('motivoTraslado', e.target.value)} disabled={!editable} style={{ minHeight: 36, border: '1px solid #cbd5e1', borderRadius: 6 }}>
              <option value="VENTA">Venta</option>
              <option value="COMPRA">Compra</option>
              <option value="TRASLADO_INTERNO">Traslado interno</option>
              <option value="DEVOLUCION">Devolucion</option>
            </select>
          </Field>

          <Field label="Modalidad transporte">
            <select value={data.modalidadTransporte} onChange={(e) => update('modalidadTransporte', e.target.value)} disabled={!editable} style={{ minHeight: 36, border: '1px solid #cbd5e1', borderRadius: 6 }}>
              <option value="PRIVADO">Privado</option>
              <option value="PUBLICO">Publico</option>
            </select>
          </Field>

          <Field label="Peso bruto total (kg)"><Input value={data.pesoBrutoTotal} onChange={(_, d) => update('pesoBrutoTotal', d.value)} disabled={!editable} /></Field>
          <Field label="Numero bultos"><Input value={data.numeroBultos} onChange={(_, d) => update('numeroBultos', d.value)} disabled={!editable} /></Field>
          <Field label="NIT destinatario"><Input value={data.destinatarioRuc} onChange={(_, d) => update('destinatarioRuc', d.value)} disabled={!editable} /></Field>

          <Field label="Origen (dirección)"><Input value={data.partidaDireccion} onChange={(_, d) => update('partidaDireccion', d.value)} disabled={!editable} /></Field>
          <Field label="Código DANE origen"><Input value={data.partidaUbigeo} onChange={(_, d) => update('partidaUbigeo', d.value)} disabled={!editable} /></Field>
          <Field label="Destino (dirección)"><Input value={data.llegadaDireccion} onChange={(_, d) => update('llegadaDireccion', d.value)} disabled={!editable} /></Field>
          <Field label="Código DANE destino"><Input value={data.llegadaUbigeo} onChange={(_, d) => update('llegadaUbigeo', d.value)} disabled={!editable} /></Field>

          <Field label="NIT transportista"><Input value={data.transportistaRuc} onChange={(_, d) => update('transportistaRuc', d.value)} disabled={!editable} /></Field>
          <Field label="Razón social transportista"><Input value={data.transportistaRazonSocial} onChange={(_, d) => update('transportistaRazonSocial', d.value)} disabled={!editable} /></Field>
          <Field label="Cédula conductor"><Input value={data.conductorDni} onChange={(_, d) => update('conductorDni', d.value)} disabled={!editable} /></Field>
          <Field label="Licencia conductor"><Input value={data.conductorLicencia} onChange={(_, d) => update('conductorLicencia', d.value)} disabled={!editable} /></Field>
          <Field label="Placa vehiculo"><Input value={data.placaVehiculo} onChange={(_, d) => update('placaVehiculo', d.value)} disabled={!editable} /></Field>
        </div>

        <div style={{ marginTop: 14, border: '1px solid #dbe3ed', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: 10, background: '#f0f9ff', fontWeight: 700, color: '#0f548c' }}>Detalle para guia</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Codigo</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Descripcion</th>
                <th style={{ padding: 8, textAlign: 'center' }}>Unidad</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {source.lineItems.map((item, idx) => (
                <tr key={`${item.productCode}-${idx}`}>
                  <td style={{ padding: 8, borderTop: '1px solid #e5e7eb' }}>{item.productCode}</td>
                  <td style={{ padding: 8, borderTop: '1px solid #e5e7eb' }}>{item.description}</td>
                  <td style={{ padding: 8, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ padding: 8, borderTop: '1px solid #e5e7eb', textAlign: 'right' }}>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <Button appearance="secondary" onClick={() => setEditable(true)}>Modificar</Button>
          <Button appearance="primary" onClick={saveGuide} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          <Button appearance="primary" onClick={printGuide}>Imprimir</Button>
        </div>
      </div>
    </div>
  );
};
