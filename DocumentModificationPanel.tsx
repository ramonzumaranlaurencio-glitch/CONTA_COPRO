import React, { useMemo, useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody, Textarea } from '@fluentui/react-components';
import { Bot24Regular, ShieldCheckmark24Regular } from '@fluentui/react-icons';

type Direction = 'AR' | 'AP';

type ModificationPanelProps = {
  token: string;
  tenantId: string;
  direction: Direction;
  series: string;
  number: string;
  issueDate?: string;
  partnerRuc: string;
  subtotal: string;
  igv: string;
  onClose: () => void;
  onStatus: (message: string) => void;
};

const API_BASE = '/api/v1';

const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nextMonthThirdDay = (dateText?: string) => {
  const source = dateText ? new Date(`${dateText}T00:00:00`) : new Date();
  const year = source.getMonth() === 11 ? source.getFullYear() + 1 : source.getFullYear();
  const month = source.getMonth() === 11 ? 0 : source.getMonth() + 1;
  return new Date(year, month, 3);
};

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const isWeakJustification = (value: string) => {
  const normalized = value.trim().toUpperCase();
  return normalized.length < 20 || ['ERROR', 'CAMBIO', 'MODIFICAR', 'ANULAR', 'MAL', 'CORREGIR'].includes(normalized);
};

export const DocumentModificationPanel = ({
  token,
  tenantId,
  direction,
  series,
  number,
  issueDate,
  partnerRuc,
  subtotal,
  igv,
  onClose,
  onStatus,
}: ModificationPanelProps) => {
  const [motivo, setMotivo] = useState('ERROR_RUC');
  const [justificacion, setJustificacion] = useState('');
  const [proposedRuc, setProposedRuc] = useState(partnerRuc);
  const [proposedSubtotal, setProposedSubtotal] = useState(subtotal);
  const [proposedIgv, setProposedIgv] = useState(igv);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const deadline = useMemo(() => nextMonthThirdDay(issueDate), [issueDate]);
  const inWindow = useMemo(() => new Date() <= deadline, [deadline]);
  const total = useMemo(() => toNumber(proposedSubtotal) + toNumber(proposedIgv), [proposedSubtotal, proposedIgv]);
  const weakJustification = isWeakJustification(justificacion);

  const submitValidation = async () => {
    if (!token) {
      onStatus('No hay token para validar la solicitud.');
      return;
    }

    setIsSubmitting(true);
    try {
      const partnerKey = direction === 'AR' ? 'customer_ruc' : 'supplier_ruc';
      const response = await fetch(`${API_BASE}/ledger/documents/modification/validate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          direction,
          series,
          number,
          motivo,
          justificacion,
          datos_nuevos: {
            partner_ruc: proposedRuc,
            [partnerKey]: proposedRuc,
            taxable_amount: proposedSubtotal,
            tax_amount: proposedIgv,
            total_amount: total.toFixed(2),
            total: total.toFixed(2),
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }

      setResult(payload);
      onStatus(payload.accepted ? 'Solicitud viable y registrada en auditoria.' : 'Solicitud bloqueada: revisar criterio IA.');
    } catch {
      onStatus('No se pudo validar la solicitud de modificacion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const alerts = Array.isArray(result?.alerts) ? result.alerts as string[] : [];
  const blocking = Array.isArray(result?.blocking_reasons) ? result.blocking_reasons as string[] : [];

  return (
    <div style={{ display: 'grid', gap: 10, border: '1px solid #dbe4f0', borderRadius: 8, padding: 12, background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bot24Regular />
        <strong>Criterios de Cumplimiento IA</strong>
      </div>

      <MessageBar intent={inWindow ? 'success' : 'warning'}>
        <MessageBarBody>
          Plazo de Anulacion: Solo tienes hasta el 3er dia calendario del mes siguiente. Estado: {inWindow ? 'En Plazo' : 'Vencido'} ({formatDate(deadline)}).
        </MessageBarBody>
      </MessageBar>

      <Field label="Motivo de modificacion">
        <select value={motivo} onChange={(event) => setMotivo(event.target.value)} style={{ minHeight: 32, border: '1px solid #cbd5e1', borderRadius: 4, padding: '0 8px' }}>
          <option value="ERROR_RUC">Error en el RUC: requiere anulacion y nueva emision</option>
          <option value="ERROR_DESCRIPCION_MONTOS">Error en la descripcion o montos</option>
          <option value="DEVOLUCION_TOTAL_PARCIAL">Devolucion total o parcial</option>
        </select>
      </Field>

      <Field label={direction === 'AR' ? 'Nuevo RUC cliente' : 'Nuevo RUC proveedor'}>
        <Input value={proposedRuc} onChange={(_, data) => setProposedRuc(data.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="Subtotal propuesto">
          <Input value={proposedSubtotal} onChange={(_, data) => setProposedSubtotal(data.value)} />
        </Field>
        <Field label="IGV propuesto">
          <Input value={proposedIgv} onChange={(_, data) => setProposedIgv(data.value)} />
        </Field>
      </div>

      <Field label="Justificacion obligatoria">
        <Textarea value={justificacion} onChange={(_, data) => setJustificacion(data.value)} resize="vertical" />
      </Field>

      {weakJustification && (
        <MessageBar intent="warning">
          <MessageBarBody>Justificacion insuficiente para auditoria. Especifique el motivo legal.</MessageBarBody>
        </MessageBar>
      )}

      {!!result && (
        <div style={{ display: 'grid', gap: 8 }}>
          {blocking.map((item) => (
            <MessageBar key={item} intent="error"><MessageBarBody>{item}</MessageBarBody></MessageBar>
          ))}
          {alerts.map((item) => (
            <MessageBar key={item} intent="warning"><MessageBarBody>{item}</MessageBarBody></MessageBar>
          ))}
          {!!result.credit_note_draft && (
            <MessageBar intent="info">
              <MessageBarBody>Borrador de Nota de Credito generado y enviado a cola para firma.</MessageBarBody>
            </MessageBar>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button appearance="secondary" onClick={onClose}>Cerrar</Button>
        <Button appearance="primary" icon={<ShieldCheckmark24Regular />} onClick={submitValidation} disabled={isSubmitting || weakJustification}>
          {isSubmitting ? 'Validando...' : 'Enviar a Cumplimiento'}
        </Button>
      </div>
    </div>
  );
};
