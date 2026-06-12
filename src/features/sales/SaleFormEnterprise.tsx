import React, { useEffect, useState } from 'react';
import { MessageBar, MessageBarBody, Spinner } from '@fluentui/react-components';
import { CloudArrowUp24Regular } from '@fluentui/react-icons';
import { useAccounting } from '@/hooks/useAccounting';
import { AnimatePresence, motion } from 'framer-motion';

type SaleFormEnterpriseProps = {
  onSucess?: () => void;
};

type RucState = {
  intent: 'info' | 'success' | 'warning' | 'error';
  message: string;
};

export const SaleFormEnterprise = ({ onSucess }: SaleFormEnterpriseProps) => {
  const { postEntry, validateNIT } = useAccounting();
  const [loading, setLoading] = useState(false);
  const [nitState, setNitState] = useState<RucState>({ intent: 'info', message: 'Pendiente de validación DIAN.' });
  const [showSuccess, setShowSuccess] = useState(false);
  const [form, setForm] = useState({
    serie: 'F001',
    numero: '',
    nit: '',
    cliente: '',
    subtotal: 0,
    iva: 0,
    total: 0,
    centroCosto: 'BOG-COM',
  });

  useEffect(() => {
    const calculatedIgv = form.subtotal * 0.19;
    setForm((prev) => ({
      ...prev,
      iva: Number(calculatedIgv.toFixed(2)),
      total: Number((form.subtotal + calculatedIgv).toFixed(2)),
    }));
  }, [form.subtotal]);

  const runNitValidation = async (nit: string) => {
    const result = await validateNIT(nit);
    if (result.valid) {
      setNitState({ intent: 'success', message: `NIT válido: ${result.message}` });
      if (!form.cliente) {
        setForm((prev) => ({ ...prev, cliente: result.message }));
      }
      return;
    }
    setNitState({ intent: 'error', message: result.message });
  };

  const handlePost = async () => {
    setLoading(true);
    try {
      await postEntry({
        date: new Date().toISOString().split('T')[0],
        description: `Venta ${form.serie}-${form.numero} | Cliente: ${form.cliente || form.nit}`,
        lines: [
          { account: '130505', debit: form.total, credit: 0, cost_center: form.centroCosto },
          { account: '240805', debit: 0, credit: form.iva, cost_center: form.centroCosto },
          { account: '413505', debit: 0, credit: form.subtotal, cost_center: form.centroCosto },
        ],
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1300);
      onSucess?.();
    } catch (error) {
      setNitState({ intent: 'error', message: 'Fallo en integridad contable al postear en ledger.' });
      console.error('Fallo en integridad contable', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" style={{ fontFamily: 'Segoe UI, Inter, sans-serif', fontSize: 12 }}>
      <div className="grid grid-cols-2 gap-4">
        <section>
          <label className="text-xs font-bold text-slate-600 uppercase">Serie</label>
          <input
            className="w-full border-b-2 border-slate-300 p-2 focus:border-[#0078d4] outline-none"
            value={form.serie}
            onChange={(event) => setForm({ ...form, serie: event.target.value })}
          />
        </section>
        <section>
          <label className="text-xs font-bold text-slate-600 uppercase">Numero</label>
          <input
            className="w-full border-b-2 border-slate-300 p-2 focus:border-[#0078d4] outline-none"
            placeholder="8423"
            value={form.numero}
            onChange={(event) => setForm({ ...form, numero: event.target.value })}
          />
        </section>
      </div>

      <section>
        <label className="text-xs font-bold text-slate-600 uppercase">NIT / Cliente</label>
        <div className="flex gap-2">
          <input
            className="flex-1 border-b-2 border-slate-300 p-2 focus:border-[#0078d4] outline-none"
            placeholder="900123456-1"
            value={form.nit}
            onChange={(event) => setForm({ ...form, nit: event.target.value })}
            onBlur={(event) => runNitValidation(event.target.value)}
          />
          <button type="button" className="btn-fluent-secondary" onClick={() => runNitValidation(form.nit)}>Validar DIAN</button>
        </div>
      </section>

      <section>
        <label className="text-xs font-bold text-slate-600 uppercase">Nombre Cliente</label>
        <input
          className="w-full border-b-2 border-slate-300 p-2 focus:border-[#0078d4] outline-none"
          placeholder="Razon social"
          value={form.cliente}
          onChange={(event) => setForm({ ...form, cliente: event.target.value })}
        />
      </section>

      <MessageBar intent={nitState.intent}>
        <MessageBarBody>{nitState.message}</MessageBarBody>
      </MessageBar>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500">Subtotal</span>
          <input
            type="number"
            className="bg-transparent text-right font-bold focus:outline-none"
            value={form.subtotal}
            onChange={(event) => setForm({ ...form, subtotal: Number.parseFloat(event.target.value) || 0 })}
          />
        </div>
        <div className="flex justify-between items-center text-slate-500">
          <span className="text-sm">IVA (19%)</span>
          <span className="font-mono">$ {Math.round(form.iva).toLocaleString('es-CO')}</span>
        </div>
        <hr />
        <div className="flex justify-between items-center text-[#0078d4] font-bold text-lg">
          <span>Total Neto</span>
          <span>$ {Math.round(form.total).toLocaleString('es-CO')}</span>
        </div>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 font-semibold"
          >
            Check Office 365: asiento de venta posteado con exito.
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handlePost}
        disabled={loading || form.total === 0}
        className="btn-fluent-primary w-full flex justify-center items-center gap-2"
        type="button"
      >
        {loading ? <Spinner size="tiny" /> : <><CloudArrowUp24Regular /> Postear e Imprimir</>}
      </button>
    </div>
  );
};
