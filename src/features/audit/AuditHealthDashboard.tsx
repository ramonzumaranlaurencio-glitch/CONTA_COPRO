import React from 'react';
import { Warning24Regular, ErrorCircle24Regular, CheckmarkCircle24Regular } from '@fluentui/react-icons';

export const AuditHealthDashboard = () => {
  const notify = (message: string) => {
    window.alert(message);
  };

  return (
    <div className="p-6 bg-[#f3f2f1] h-full overflow-auto">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Auditoria Preventiva IA</h2>
        <button type="button" className="btn-fluent-primary" onClick={() => notify('Escaneo global iniciado en modo demo.')}>Iniciar Escaneo Global</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border-l-4 border-red-600 p-4 shadow-md rounded-r-sm">
          <div className="flex justify-between">
            <span className="text-xs font-bold text-red-600 uppercase">Riesgo Fiscal Alto</span>
            <Warning24Regular className="text-red-600" />
          </div>
          <p className="mt-2 text-sm font-semibold">3 Proveedores No Habidos detectados</p>
          <p className="text-xs text-slate-500">Monto observado: S/ 14,200.50</p>
          <button type="button" className="mt-4 text-blue-600 text-xs font-bold hover:underline" onClick={() => notify('Detalle de riesgo fiscal en implementacion.')}>Ver detalles -&gt;</button>
        </div>

        <div className="bg-white border-l-4 border-orange-400 p-4 shadow-md rounded-r-sm">
          <span className="text-xs font-bold text-orange-500 uppercase">Detracciones</span>
          <p className="mt-2 text-sm font-semibold">12 Facturas sin constancia de deposito</p>
          <p className="text-xs text-slate-500">Riesgo de perdida de credito fiscal.</p>
        </div>

        <div className="bg-white border-l-4 border-blue-500 p-4 shadow-md rounded-r-sm">
          <span className="text-xs font-bold text-blue-500 uppercase">Proyeccion de Regimen</span>
          <p className="mt-2 text-sm font-semibold">Empresa al 85% del limite MYPE</p>
          <p className="text-xs text-slate-500">Proyeccion: cambiara a Regimen General en julio.</p>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-sm shadow-xl border border-slate-200">
        <header className="p-4 bg-slate-800 text-white font-bold">Log de Hallazgos Forenses</header>
        <div className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3 text-left">Fecha</th>
                <th className="p-3 text-left">Hallazgo</th>
                <th className="p-3 text-left">Sugerencia del Auditor IA</th>
                <th className="p-3 text-center">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-3">10/05/2026</td>
                <td><span className="font-bold">Gasto Atipico</span>: Compra en Joyas Peruanas SAC</td>
                <td className="text-slate-500 italic">Gasto no parece causal para el rubro Construccion. Verificar si es reparable.</td>
                <td className="p-3 text-center"><button type="button" className="btn-fluent-secondary text-xs" onClick={() => notify('Hallazgo marcado como excluido (demo).')}>Excluir</button></td>
              </tr>
              <tr>
                <td className="p-3">09/05/2026</td>
                <td><span className="font-bold">Factura Duplicada</span>: F001-88412</td>
                <td className="text-slate-500 italic">Detectada coincidencia por monto y proveedor con distinta serie.</td>
                <td className="p-3 text-center"><button type="button" className="btn-fluent-secondary text-xs" onClick={() => notify('Abriendo revision de factura duplicada (demo).')}>Revisar</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><CheckmarkCircle24Regular /> IA operativa</span>
        <span className="flex items-center gap-1"><ErrorCircle24Regular /> 2 alertas criticas</span>
      </div>
    </div>
  );
};
