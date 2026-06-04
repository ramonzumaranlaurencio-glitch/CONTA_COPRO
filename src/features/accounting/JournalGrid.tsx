import React, { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

type JournalRow = {
  id: string;
  entry_date: string;
  period: string;
  description: string;
  total_debit: string;
  total_credit: string;
  row_hash: string;
  sunat_status?: string;
  auditTrail?: unknown[];
  documents?: unknown[];
};

export const JournalGrid = ({ journalEntries = [] as JournalRow[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalRow | null>(null);
  const rows = useMemo(() => journalEntries, [journalEntries]);

  const notify = (message: string) => {
    window.alert(message);
  };

  const exportRows = () => {
    const header = 'id,fecha,periodo,descripcion,debe,haber,hash,sunat_status';
    const body = rows.map((row) => [
      row.id,
      row.entry_date,
      row.period,
      row.description.replace(',', ' '),
      row.total_debit,
      row.total_credit,
      row.row_hash,
      row.sunat_status ?? 'PENDING',
    ].join(','));
    const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'journal-grid.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 30,
  });

  return (
    <div className="h-screen flex flex-col bg-[#f3f2f1] text-[12px] text-neutral-900">
      <div className="h-10 border-b bg-white flex items-center justify-between px-2">
        <div className="flex gap-1">
          <button className="px-2 py-1 border rounded" type="button" onClick={() => notify('Creacion de asiento manual en implementacion.')}>Nuevo asiento</button>
          <button className="px-2 py-1 border rounded" type="button" onClick={() => notify('Posteo manual de asientos en implementacion.')}>Postear</button>
          <button className="px-2 py-1 border rounded" type="button" onClick={exportRows}>Exportar Medios Magnéticos DIAN</button>
          <button className="px-2 py-1 border rounded" type="button" onClick={() => notify('Escaneo de integridad lanzado (demo).')}>Escanear integridad</button>
        </div>
        <div className="text-neutral-500">Virtual scroll: {rows.length.toLocaleString()} registros</div>
      </div>

      <div className="grid grid-cols-[110px_80px_1fr_100px_100px_90px_160px] bg-neutral-200 border-b px-2 h-8 items-center font-bold">
        <span>Fecha</span><span>Periodo</span><span>Glosa</span>
        <span className="text-right">Debe</span><span className="text-right">Haber</span>
        <span>DIAN</span><span>Hash</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div ref={parentRef} className="flex-1 overflow-auto bg-white font-condensed">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              return (
                <div key={row.id} onClick={() => setSelectedEntry(row)}
                  className="grid grid-cols-[110px_80px_1fr_100px_100px_90px_160px] items-center border-b border-neutral-200 px-2 hover:bg-neutral-100 cursor-pointer"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${item.size}px`, transform: `translateY(${item.start}px)` }}>
                  <span>{row.entry_date}</span><span>{row.period}</span><span className="truncate">{row.description}</span>
                  <span className="text-right tabular-nums">{row.total_debit}</span>
                  <span className="text-right tabular-nums">{row.total_credit}</span>
                  <span>{row.sunat_status ?? 'PENDING'}</span>
                  <span className="font-mono truncate">{row.row_hash}</span>
                </div>
              );
            })}
          </div>
        </div>

        {selectedEntry && (
          <aside className="w-[480px] bg-white shadow-2xl flex flex-col border-l border-neutral-300">
            <div className="p-3 border-b bg-neutral-50 font-bold flex justify-between">
              <span>Asiento: {selectedEntry.id}</span>
              <button type="button" onClick={() => setSelectedEntry(null)}>Cerrar</button>
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              <section><h3 className="font-bold mb-1">Integridad</h3><div className="font-mono text-[11px] bg-neutral-100 p-2 break-all">{selectedEntry.row_hash}</div></section>
              <section><h3 className="font-bold mb-1">Auditoría</h3><pre className="text-[11px] bg-neutral-100 p-2 overflow-auto">{JSON.stringify(selectedEntry.auditTrail ?? [], null, 2)}</pre></section>
              <section><h3 className="font-bold mb-1">XML/PDF adjuntos</h3><div>{selectedEntry.documents?.length ?? 0} documentos</div></section>
            </div>
            <footer className="p-3 border-t"><button className="w-full rounded px-3 py-2 bg-neutral-900 text-white" type="button" onClick={() => notify('Validacion IA de asiento en implementacion.')}>Validar con IA</button></footer>
          </aside>
        )}
      </div>
    </div>
  );
};


