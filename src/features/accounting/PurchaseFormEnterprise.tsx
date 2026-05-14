import React, { useMemo, useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody, Text } from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';

type PurchaseFormData = {
  serie: string;
  number: string;
  supplierRuc: string;
  subtotal: string;
  igv: string;
  expenseAccount: string;
  costCenter: string;
};

type RucValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'unknown';

type PurchaseFormEnterpriseProps = {
  form: PurchaseFormData;
  onFormChange: (next: PurchaseFormData) => void;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
};

const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const PurchaseFormEnterprise = ({ form, onFormChange, onClose, onSubmit }: PurchaseFormEnterpriseProps) => {
  const [isAutoIgv, setIsAutoIgv] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [rucState, setRucState] = useState<RucValidationState>('idle');
  const [rucMessage, setRucMessage] = useState('Pendiente de validacion externa');

  const total = useMemo(() => toNumber(form.subtotal) + toNumber(form.igv), [form.subtotal, form.igv]);

  const updateField = (key: keyof PurchaseFormData, value: string) => {
    const next = { ...form, [key]: value };
    if (key === 'subtotal' && isAutoIgv) {
      next.igv = (toNumber(value) * 0.18).toFixed(2);
    }
    onFormChange(next);
  };

  const validateRucExternally = async () => {
    if (!/^\d{11}$/.test(form.supplierRuc)) {
      setRucState('invalid');
      setRucMessage('RUC invalido: debe tener 11 digitos.');
      return;
    }

    setRucState('validating');
    setRucMessage('Consultando servicio externo...');

    try {
      const response = await fetch(`https://api.apis.net.pe/v2/sunat/ruc?numero=${form.supplierRuc}`, {
        method: 'GET',
      });

      if (response.ok) {
        setRucState('valid');
        setRucMessage('RUC validado por servicio externo.');
        return;
      }

      setRucState('unknown');
      setRucMessage('Servicio externo no disponible. Continuar con validacion local.');
    } catch {
      setRucState('unknown');
      setRucMessage('No se pudo validar externamente. Verifica red/CORS.');
    }
  };

  const handleSubmit = async () => {
    setIsPosting(true);
    try {
      await onSubmit();
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="sheet-form">
      <Field label="Serie">
        <Input value={form.serie} onChange={(_, data) => updateField('serie', data.value)} />
      </Field>

      <Field label="Numero">
        <Input value={form.number} onChange={(_, data) => updateField('number', data.value)} />
      </Field>

      <Field label="RUC Proveedor">
        <Input value={form.supplierRuc} onChange={(_, data) => updateField('supplierRuc', data.value)} contentAfter={<Search24Regular />} />
      </Field>

      <Button appearance="secondary" onClick={validateRucExternally}>Validar RUC Externo</Button>

      <MessageBar intent={rucState === 'valid' ? 'success' : rucState === 'invalid' ? 'error' : 'info'}>
        <MessageBarBody>{rucMessage}</MessageBarBody>
      </MessageBar>

      <Field label="Cuenta gasto">
        <Input value={form.expenseAccount} onChange={(_, data) => updateField('expenseAccount', data.value)} />
      </Field>

      <Field label="Centro costo">
        <Input value={form.costCenter} onChange={(_, data) => updateField('costCenter', data.value)} />
      </Field>

      <Field label="Subtotal">
        <Input value={form.subtotal} onChange={(_, data) => updateField('subtotal', data.value)} />
      </Field>

      <Field label="IGV">
        <Input value={form.igv} onChange={(_, data) => updateField('igv', data.value)} disabled={isAutoIgv} />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={isAutoIgv}
          onChange={(event) => {
            const checked = event.target.checked;
            setIsAutoIgv(checked);
            if (checked) {
              onFormChange({ ...form, igv: (toNumber(form.subtotal) * 0.18).toFixed(2) });
            }
          }}
        />
        IGV auto-calculado 18%
      </label>

      <Text weight="semibold">Total: S/ {total.toFixed(2)}</Text>

      <div className="sheet-footer" style={{ position: 'static', borderTop: 'none', padding: 0, marginTop: 8 }}>
        <Button appearance="secondary" onClick={onClose}>Cancelar</Button>
        <button type="button" className="btn-fluent-primary" onClick={handleSubmit} disabled={isPosting}>
          {isPosting ? 'Posteando...' : 'Guardar y Postear'}
        </button>
      </div>
    </div>
  );
};
