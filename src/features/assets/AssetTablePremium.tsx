import React from 'react';

export const AssetTablePremium = () => {
  const notify = (message: string) => {
    window.alert(message);
  };

  return (
  <div className="glass-card overflow-hidden mt-6">
    <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
      <h3 className="text-sm font-bold text-slate-700">REGISTRO DE ACTIVOS ESTRATEGICOS</h3>
      <div className="flex gap-2">
        <button className="px-3 py-1 text-xs bg-slate-100 rounded hover:bg-slate-200" type="button" onClick={() => notify('Filtro avanzado de activos en implementacion.')}>Filtrar</button>
        <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded shadow-md" type="button" onClick={() => notify('Registro de nuevo activo en implementacion.')}>+ Nuevo</button>
      </div>
    </div>

    <table className="w-full">
      <thead className="bg-slate-50/50">
        <tr>
          <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Identificador</th>
          <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Activo</th>
          <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Valor Libros</th>
          <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Estado</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        <tr className="hover:bg-blue-50/30 transition-colors cursor-pointer">
          <td className="px-6 py-4 text-xs font-mono text-blue-600">ACT-2026-001</td>
          <td className="px-6 py-4">
            <div className="text-sm font-bold text-slate-700">Camioneta Hilux 4x4</div>
            <div className="text-[10px] text-slate-400">Placa: ABC-123 | Asignado a: Logistica</div>
          </td>
          <td className="px-6 py-4 text-right">
            <span className="text-sm font-bold">S/ 118,000.00</span>
          </td>
          <td className="px-6 py-4 text-center">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Operativo
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  );
};
