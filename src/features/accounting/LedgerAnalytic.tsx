import React, { useEffect, useMemo, useState } from 'react';

type LedgerLine = {
  entry_id: string;
  entry_date: string;
  description: string;
  debit: string;
  credit: string;
  running_balance: string;
  row_hash: string;
};

type LedgerAnalyticProps = {
  accountCode: string;
  accountName?: string;
  apiBase: string;
  token: string;
  tenantId: string;
  year: number;
  month?: number;
};

export const LedgerAnalytic = ({
  accountCode,
  accountName,
  apiBase,
  token,
  tenantId,
  year,
  month,
}: LedgerAnalyticProps) => {
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!accountCode || !token) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ year: String(year) });
    if (month) params.set('month', String(month));

    fetch(`${apiBase}/reports/general-ledger/${encodeURIComponent(accountCode)}?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Id': tenantId,
        'Content-Type': 'application/json',
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setLines(Array.isArray(data.lines) ? data.lines : []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message || err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [accountCode, token, tenantId, apiBase, year, month]);

  const filtered = useMemo(
    () => lines.filter((l) => l.description.toLowerCase().includes(query.toLowerCase())),
    [lines, query],
  );

  const runningBalance = filtered.length
    ? parseFloat(filtered[filtered.length - 1].running_balance)
    : 0;

  const downloadReport = () => {
    const csvLines = [
      'fecha,descripcion,debe,haber,saldo,hash',
      ...filtered.map((l) =>
        [l.entry_date, l.description.replace(',', ' '), l.debit, l.credit, l.running_balance, l.row_hash.slice(0, 8)].join(','),
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `libro-mayor-${accountCode}-${year}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-2xl border border-slate-200 animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b bg-slate-800 text-white rounded-t-lg">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black tracking-tighter">LIBRO MAYOR: {accountCode}</h2>
            <p className="text-xs text-slate-400 font-medium">
              {accountName || accountCode} · Periodo {year}{month ? `-${String(month).padStart(2, '0')}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-slate-400">Saldo Acumulado</p>
            <h3 className={`text-2xl font-mono font-bold ${runningBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              $ {Math.abs(runningBalance).toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-50 border-b flex gap-4 text-xs">
        <input
          type="text"
          placeholder="Filtrar por descripción..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border rounded px-2 py-1"
        />
        <button className="btn-fluent-secondary bg-white" type="button" onClick={downloadReport}>
          Descargar CSV
        </button>
      </div>

      <div className="overflow-auto max-h-[600px]">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Cargando mayor analítico...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 text-sm">Error al cargar: {error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Sin movimientos para la cuenta {accountCode} en {year}.
          </div>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-slate-100 shadow-sm">
              <tr className="text-slate-600 uppercase font-bold">
                <th className="p-3 text-left">Fecha</th>
                <th className="p-3 text-left">Glosa / Concepto</th>
                <th className="p-3 text-right">Debe</th>
                <th className="p-3 text-right">Haber</th>
                <th className="p-3 text-right">Saldo</th>
                <th className="p-3 text-left">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((line) => {
                const saldo = parseFloat(line.running_balance);
                return (
                  <tr key={line.entry_id} className="hover:bg-blue-50 transition-colors cursor-pointer">
                    <td className="p-3 font-medium whitespace-nowrap">{line.entry_date}</td>
                    <td className="p-3">{line.description}</td>
                    <td className="p-3 text-right font-mono">
                      {parseFloat(line.debit) > 0
                        ? parseFloat(line.debit).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {parseFloat(line.credit) > 0
                        ? parseFloat(line.credit).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${saldo >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {saldo.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-[9px] text-slate-400 font-mono">{line.row_hash.slice(0, 10)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
