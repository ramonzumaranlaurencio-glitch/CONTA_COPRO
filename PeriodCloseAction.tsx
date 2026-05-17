import React from 'react';
import { LockClosed24Regular } from '@fluentui/react-icons';

export const PeriodCloseAction = () => {
  const onClosePeriod = () => {
    const confirmed = window.confirm('Esta accion bloqueara el periodo contable. Deseas continuar?');
    if (confirmed) {
      window.alert('Cierre de periodo programado (demo).');
    }
  };

  return (
    <div className="p-6 bg-white border-2 border-red-100 rounded-lg shadow-inner">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-red-600 rounded-full text-white">
          <LockClosed24Regular />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Cierre de Periodo: Mayo 2026</h3>
          <p className="text-xs text-slate-500">Esta accion es irreversible y firmara digitalmente el Libro Diario.</p>
        </div>
      </div>

      <ul className="text-xs space-y-2 mb-6">
        <li className="flex items-center gap-2">✅ 452 Asientos verificados</li>
        <li className="flex items-center gap-2">✅ Diferencia de cambio calculada</li>
        <li className="flex items-center gap-2">✅ Libros PLE 5.1 y 5.2 generados</li>
      </ul>

      <button type="button" className="btn-fluent-primary bg-red-700 border-red-900 w-full" onClick={onClosePeriod}>
        Firmar y Bloquear Contabilidad
      </button>
    </div>
  );
};
