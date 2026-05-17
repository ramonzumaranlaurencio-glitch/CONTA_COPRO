import React from 'react';

export const EnterpriseShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="h-screen flex flex-col bg-[#faf9f8] text-neutral-900">
      <header className="h-12 bg-[#0f172a] text-white flex items-center justify-between px-4">
        <div className="font-bold tracking-wide">CONTA_PRO Enterprise</div>
        <input className="w-[420px] px-3 py-1 rounded text-black" placeholder="Buscar RUC, asiento, factura, hash..." />
        <div className="text-sm">Auditoría activa</div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-60 bg-white border-r">
          {['Contabilidad', 'Facturación', 'SUNAT', 'Bancos', 'Auditoría IA', 'Configuración'].map(x => (
            <div key={x} className="px-4 py-3 border-b text-sm hover:bg-neutral-100 cursor-pointer">{x}</div>
          ))}
        </aside>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
};
