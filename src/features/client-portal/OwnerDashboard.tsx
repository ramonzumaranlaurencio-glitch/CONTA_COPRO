import React from 'react';

export const OwnerDashboard = () => {
  return (
    <div className="p-8 bg-[#f3f2f1] min-h-screen">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Panel Gerencial: Inversiones Trujillo S.A.C.</h1>
        <p className="text-slate-500">Corte al: 10 de Mayo, 2026</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded shadow-sm border-t-4 border-green-500">
          <p className="text-xs font-bold text-slate-400 uppercase">Disponible en Caja/Bancos</p>
          <h2 className="text-3xl font-extrabold text-slate-800">S/ 45,280.00</h2>
        </div>

        <div className="bg-white p-6 rounded shadow-sm border-t-4 border-blue-500">
          <p className="text-xs font-bold text-slate-400 uppercase">Por Cobrar (Ventas)</p>
          <h2 className="text-3xl font-extrabold text-slate-800">S/ 12,100.00</h2>
        </div>

        <div className="bg-white p-6 rounded shadow-sm border-t-4 border-orange-500">
          <p className="text-xs font-bold text-slate-400 uppercase">IGV Estimado a Pagar</p>
          <h2 className="text-3xl font-extrabold text-slate-800">S/ 2,410.00</h2>
        </div>

        <div className="bg-white p-6 rounded shadow-sm border-t-4 border-red-500">
          <p className="text-xs font-bold text-slate-400 uppercase">Gastos Totales</p>
          <h2 className="text-3xl font-extrabold text-slate-800">S/ 8,900.00</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow-md h-80 mb-8">
        <h3 className="font-bold mb-4 text-slate-700">Flujo de Caja Mensual</h3>
        <div className="h-full w-full bg-slate-50 flex items-end justify-around p-4">
          <div className="w-12 bg-blue-400 h-[60%] rounded-t-sm" />
          <div className="w-12 bg-red-400 h-[40%] rounded-t-sm" />
          <div className="w-12 bg-blue-400 h-[80%] rounded-t-sm" />
          <div className="w-12 bg-red-400 h-[30%] rounded-t-sm" />
        </div>
      </div>
    </div>
  );
};
