import React, { useMemo, useState } from 'react';
import { Button, Field, Input, MessageBar, MessageBarBody, Text } from '@fluentui/react-components';
import { CheckmarkCircle24Filled, Search24Regular } from '@fluentui/react-icons';
import { AnimatePresence, motion } from 'framer-motion';

type SaleFormEnterpriseProps = {
  token: string;
  tenantId: string;
  onClose: () => void;
  onPosted: () => Promise<void>;
  onStatus: (message: string) => void;
};

type RucValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'unknown';

const API_BASE = '/api/v1';

const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const SaleFormEnterprise = ({ token, tenantId, onClose, onPosted, onStatus }: SaleFormEnterpriseProps) => {
  const [serie, setSerie] = useState('F001');
  const [number, setNumber] = useState('8422');
  const [customerRuc, setCustomerRuc] = useState('20123456789');
  const [subtotal, setSubtotal] = useState('16000.00');
  const [igv, setIgv] = useState('2880.00');
  const [costCenter, setCostCenter] = useState('LIM-COM');
  const [isPosting, setIsPosting] = useState(false);
  const [isAutoIgv, setIsAutoIgv] = useState(true);
  const [rucState, setRucState] = useState<RucValidationState>('idle');
  const [rucMessage, setRucMessage] = useState('Pendiente de validacion externa');
  const [showSuccess, setShowSuccess] = useState(false);

  const total = useMemo(() => toNumber(subtotal) + toNumber(igv), [subtotal, igv]);

  const validateRucExternally = async () => {
    if (!/^\d{11}$/.test(customerRuc)) {
      setRucState('invalid');
      setRucMessage('RUC invalido: debe tener 11 digitos.');
      return;
    }

    setRucState('validating');
    setRucMessage('Consultando servicio externo...');

    try {
      const response = await fetch(`https://api.apis.net.pe/v2/sunat/ruc?numero=${customerRuc}`, {
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

  const postToLedgerOrchestrator = async () => {
    if (!token) {
      onStatus('No hay token de seguridad para registrar venta.');
      return;
    }

    setIsPosting(true);

    try {
      const payload = {
        tenant_id: tenantId,
        year: 2026,
        month: 5,
        invoice_id: `${serie}-${number}`,
        customer_ruc: customerRuc,
        doc_type: '01',
        serie,
        number,
        subtotal: toNumber(subtotal),
        igv: toNumber(igv),
        total,
        currency: 'PEN',
        cost_center: costCenter,
      };

      const response = await fetch(`${API_BASE}/ledger/invoice`, {
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

      setShowSuccess(true);
      onStatus(`Venta ${serie}-${number} posteada con hash inmutable.`);
      await onPosted();
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 900);
    } catch {
      onStatus('No se pudo postear la venta. Revisa parametros del comprobante.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="sheet-form">
      <Field label="Serie">
        <Input value={serie} onChange={(_, data) => setSerie(data.value)} />
      </Field>

      <Field label="Numero">
        <Input value={number} onChange={(_, data) => setNumber(data.value)} />
      </Field>

      <Field label="RUC Cliente">
        <Input value={customerRuc} onChange={(_, data) => setCustomerRuc(data.value)} contentAfter={<Search24Regular />} />
      </Field>

      <Button appearance="secondary" onClick={validateRucExternally}>Validar RUC Externo</Button>

      <MessageBar intent={rucState === 'valid' ? 'success' : rucState === 'invalid' ? 'error' : 'info'}>
        <MessageBarBody>{rucMessage}</MessageBarBody>
      </MessageBar>

      <Field label="Subtotal">
        <Input
          value={subtotal}
          onChange={(_, data) => {
            setSubtotal(data.value);
            if (isAutoIgv) {
              const nextIgv = toNumber(data.value) * 0.18;
              setIgv(nextIgv.toFixed(2));
            }
          }}
        />
      </Field>

      <Field label="IGV">
        <Input value={igv} onChange={(_, data) => setIgv(data.value)} disabled={isAutoIgv} />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={isAutoIgv}
          onChange={(event) => {
            const checked = event.target.checked;
            setIsAutoIgv(checked);
            if (checked) {
              const nextIgv = toNumber(subtotal) * 0.18;
              setIgv(nextIgv.toFixed(2));
            }
          }}
        />
        IGV auto-calculado 18%
      </label>

      <Field label="Centro de costo">
        <Input value={costCenter} onChange={(_, data) => setCostCenter(data.value)} />
      </Field>

      <Text weight="semibold">Total: S/ {total.toFixed(2)}</Text>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.86 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              border: '1px solid #bbf7d0',
              background: '#f0fdf4',
              borderRadius: 6,
            }}
          >
            <CheckmarkCircle24Filled primaryFill="#16a34a" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Venta posteada con exito</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sheet-footer" style={{ position: 'static', borderTop: 'none', padding: 0, marginTop: 8 }}>
        <Button appearance="secondary" onClick={onClose}>Cancelar</Button>
        <button type="button" className="btn-fluent-primary" onClick={postToLedgerOrchestrator} disabled={isPosting}>
          {isPosting ? 'Posteando...' : 'Guardar y Postear'}
        </button>
      </div>
    </div>
  );
};
