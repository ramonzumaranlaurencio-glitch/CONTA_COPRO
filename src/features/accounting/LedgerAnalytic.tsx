import React, { useMemo, useState } from 'react';

type LedgerAnalyticEntry = {
  id: string;
  date: string;
  voucher: string;
  glosa: string;
  hash: string;
  debe: number;
  haber: number;
};

type LedgerAnalyticProps = {
  accountCode: string;
  entries?: LedgerAnalyticEntry[];
};

const seedEntries: LedgerAnalyticEntry[] = [
  {
    id: '1',
    date: '2026-05-10',
    voucher: 'V-000542',
    glosa: 'Venta F001-8421 cliente enterprise',
    hash: '9b82c5f',
    debe: 18880,
    haber: 0,
  },
  {
    id: '2',
    date: '2026-05-10',
    voucher: 'V-000543',
    glosa: 'Cobranza parcial cliente enterprise',
    hash: 'ab91f4d',
    debe: 0,
    haber: 5000,
  },
];

export const LedgerAnalytic = ({ accountCode, entries = seedEntries }: LedgerAnalyticProps) => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => entries.filter((entry) => entry.glosa.toLowerCase().includes(query.toLowerCase())), [entries, query]);

  let running = 0;
  const rowsWithBalance = rows.map((entry) => {
    running += entry.debe - entry.haber;
    return { ...entry, saldo: running };
  });

  const runningBalance = rowsWithBalance.length ? rowsWithBalance[rowsWithBalance.length - 1].saldo : 0;

  const downloadReport = () => {
    const lines = [
      'fecha,voucher,glosa,debe,haber,saldo',
      ...rowsWithBalance.map((entry) => [
        entry.date,
        entry.voucher,
        entry.glosa.replaceAll(',', ' '),
        entry.debe.toFixed(2),
        entry.haber.toFixed(2),
        entry.saldo.toFixed(2),
      ].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `libro-mayor-${accountCode}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-2xl border border-slate-200 animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b bg-slate-800 text-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black tracking-tighter">LIBRO MAYOR: {accountCode}</h2>
            <p className="text-xs text-slate-400 font-medium">Analisis de movimientos - Periodo 2026</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-slate-400">Saldo Actualizado</p>
            <h3 className="text-2xl font-mono font-bold text-green-400">S/ {runningBalance.toLocaleString('es-PE', { maximumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-50 border-b flex gap-4 text-xs">
        <input type="date" className="border rounded px-2 py-1 outline-none focus:ring-2 ring-blue-500" />
        <input type="text" placeholder="Filtrar por glosa..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 border rounded px-2 py-1" />
        <button className="btn-fluent-secondary bg-white" type="button" onClick={downloadReport}>Descargar Reporte</button>
      </div>

      <div className="overflow-auto max-h-[600px]">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 bg-slate-100 shadow-sm">
            <tr className="text-slate-600 uppercase font-bold">
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3 text-left">Voucher</th>
              <th className="p-3 text-left">Glosa / Concepto</th>
              <th className="p-3 text-right">Debe</th>
              <th className="p-3 text-right">Haber</th>
              <th className="p-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rowsWithBalance.map((entry) => (
              <tr key={entry.id} className="hover:bg-blue-50 transition-colors cursor-pointer group">
                <td className="p-3 font-medium">{entry.date}</td>
                <td className="p-3 text-blue-600 font-bold">{entry.voucher}</td>
                <td className="p-3">
                  {entry.glosa}
                  <div className="text-[9px] text-slate-400 font-normal">ID Hash: {entry.hash}...</div>
                </td>
                <td className="p-3 text-right font-mono">{entry.debe.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="p-3 text-right font-mono">{entry.haber.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="p-3 text-right font-mono font-bold">{entry.saldo.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
