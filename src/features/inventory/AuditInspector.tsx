import React from 'react';

type InspectorTab = 'atomic' | 'hash' | 'ai';

export type InventorySubaccount = {
  code: string;
  name: string;
  amount: number;
  weight: number;
};

export type InventoryAuditRecord = {
  id: string;
  date: string;
  document: string;
  movementType: 'ENTRY' | 'EXIT';
  amount: number;
  quantity: number;
  unitCost: number;
  balanceQty: number;
  balanceCost: number;
  integrityPayload: string;
  trend7d: number[];
  subaccounts: InventorySubaccount[];
  cashIn: number;
  cashOut: number;
};

type IntegritySnapshot = {
  hash: string;
  valid: boolean;
};

type AuditInspectorProps = {
  selected: InventoryAuditRecord | null;
  integrity: IntegritySnapshot | null;
};

const money = (value: number) =>
  value.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const buildRecommendation = (row: InventoryAuditRecord) => {
  const netFlow = row.cashIn - row.cashOut;
  if (netFlow < -row.amount * 0.2) {
    return 'Riesgo alto de tension de caja: priorizar cobranzas y fraccionar reposicion en 2 ciclos.';
  }
  if (netFlow < 0) {
    return 'Flujo de caja negativo controlado: revisar plazos de pago y rotacion de inventario lento.';
  }
  if (netFlow < row.amount * 0.08) {
    return 'Flujo neutral: mantener politica de compras actual y monitorear costo promedio semanal.';
  }
  return 'Flujo saludable: habilitar recompra automatica para productos de alta rotacion.';
};

export const AuditInspector = ({ selected, integrity }: AuditInspectorProps) => {
  const [activeTab, setActiveTab] = React.useState<InspectorTab>('atomic');

  React.useEffect(() => {
    setActiveTab('atomic');
  }, [selected?.id]);

  if (!selected) {
    return (
      <aside className="hidden lg:block lg:w-[30%] shrink-0 p-5 lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-3rem)]">
        <div className="h-full rounded-2xl bg-white p-6 shadow-2xl shadow-ent-elevated border border-slate-200 border-t-4 border-t-blue-600 overflow-y-auto">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Audit Inspector</h3>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] font-bold text-slate-500">SIN SELECCION</span>
          </div>
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
            Selecciona una fila para ver el hash de inmutabilidad, las subcuentas y la recomendacion de flujo de caja.
          </div>
        </div>
      </aside>
    );
  }

  const netFlow = selected.cashIn - selected.cashOut;

  return (
    <aside className="hidden lg:block lg:w-[30%] shrink-0 p-5 lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-3rem)]">
      <div className="h-full rounded-2xl bg-white p-6 shadow-2xl shadow-ent-elevated border border-slate-200 border-t-4 border-t-blue-600 overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Audit Inspector</h3>
              <p className="mt-1 text-[11px] text-slate-500">Detalle analitico del movimiento seleccionado</p>
            </div>
            <span className={`text-[10px] font-mono px-2 py-1 rounded border ${integrity?.valid ? 'text-green-600 bg-green-50 border-green-200' : 'text-rose-600 bg-rose-50 border-rose-200'}`}>
              {integrity?.valid ? 'HASH OK' : 'HASH ERR'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-ent-inner">
            <p className="text-[9px] font-black uppercase text-slate-400">Documento</p>
            <p className="font-semibold text-slate-800">{selected.document}</p>
            <p className="text-[11px] text-slate-500">{selected.date} · {selected.movementType}</p>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('atomic')}
              className={`rounded-md border px-3 py-2 text-left font-semibold transition ${activeTab === 'atomic' ? 'border-blue-700 bg-blue-700 text-white shadow-[0_2px_0_0_#1e3a8a]' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700'}`}
            >
              Detalle Atómico
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hash')}
              className={`rounded-md border px-3 py-2 text-left font-semibold transition ${activeTab === 'hash' ? 'border-blue-700 bg-blue-700 text-white shadow-[0_2px_0_0_#1e3a8a]' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700'}`}
            >
              Trazabilidad Hash
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`rounded-md border px-3 py-2 text-left font-semibold transition ${activeTab === 'ai' ? 'border-blue-700 bg-blue-700 text-white shadow-[0_2px_0_0_#1e3a8a]' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-700'}`}
            >
              Recomendaciones IA
            </button>
          </div>

          {activeTab === 'atomic' && (
            <>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'CANTIDAD', val: selected.quantity.toFixed(2), color: 'text-slate-900' },
                  { label: 'COSTO UNIT.', val: money(selected.unitCost), color: 'text-slate-900' },
                  { label: 'SALDO QTY', val: selected.balanceQty.toFixed(2), color: 'text-blue-600' },
                  { label: 'SALDO COSTO', val: money(selected.balanceCost), color: 'text-blue-600' },
                ].map((item, i) => (
                  <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-inner shadow-ent-inner">
                    <p className="text-[9px] font-black text-slate-400 mb-1">{item.label}</p>
                    <p className={`text-sm font-mono font-bold ${item.color}`}>{item.val}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-tighter">Desglose de Subcuentas</h4>
                <div className="space-y-2">
                  {selected.subaccounts.map((item, index) => (
                    <div key={item.code} className="flex justify-between text-xs p-2 rounded-2xl transition-colors border border-slate-100 bg-white shadow-ent-inner hover:bg-slate-50">
                      <span className="text-slate-600">{item.code} - {item.name}</span>
                      <span className="font-bold text-slate-900">{item.weight.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'hash' && (
            <>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-ent-inner">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">SHA-256 Inmutabilidad</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-800">{integrity?.hash ?? 'Calculando hash...'}</p>
                <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${integrity?.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {integrity?.valid ? 'VALIDADO' : 'NO VALIDO'}
                </span>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-ent-inner">
                <p className="font-semibold text-slate-700">Payload firmado</p>
                <p className="mt-2 break-all font-mono text-[10px] leading-5">{selected.integrityPayload}</p>
              </div>
            </>
          )}

          {activeTab === 'ai' && (
            <div className="mt-6 rounded-2xl border border-blue-800 bg-gradient-to-b from-blue-950 to-blue-900 p-4 text-blue-100 shadow-sm">
              <h4 className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-300">Recomendacion IA (Flujo de Caja)</h4>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-md border border-blue-700/70 bg-blue-900/60 p-2">
                  <p className="text-blue-300">Ingreso</p>
                  <p className="font-mono font-bold text-white">{money(selected.cashIn)}</p>
                </div>
                <div className="rounded-md border border-blue-700/70 bg-blue-900/60 p-2">
                  <p className="text-blue-300">Salida</p>
                  <p className="font-mono font-bold text-white">{money(selected.cashOut)}</p>
                </div>
                <div className="rounded-md border border-blue-700/70 bg-blue-900/60 p-2">
                  <p className="text-blue-300">Neto</p>
                  <p className={`font-mono font-bold ${netFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(netFlow)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-blue-50">{buildRecommendation(selected)}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
