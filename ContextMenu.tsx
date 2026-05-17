import React from 'react';
import {
  Delete24Regular,
  DocumentCode24Regular,
  History24Regular,
  Search24Regular,
} from '@fluentui/react-icons';

type ContextMenuProps<T = unknown> = {
  x: number;
  y: number;
  rowData: T;
  onClose: () => void;
  onOpenXml: (rowData: T) => void;
  onCheckSunat: (rowData: T) => void;
  onTraceOrigin: (rowData: T) => void;
  onVoidEntry?: (rowData: T) => void;
};

export const ContextMenu = <T,>({
  x,
  y,
  rowData,
  onClose,
  onOpenXml,
  onCheckSunat,
  onTraceOrigin,
  onVoidEntry,
}: ContextMenuProps<T>) => {
  return (
    <div
      className="fixed z-[100] w-56 bg-white border border-slate-200 shadow-2xl rounded-sm py-2 animate-in fade-in zoom-in duration-100"
      style={{ top: y, left: x }}
      onMouseLeave={onClose}
    >
      <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase border-b mb-1">
        Opciones de Auditoria
      </div>
      <button className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2" onClick={() => onOpenXml(rowData)} type="button">
        <DocumentCode24Regular style={{ fontSize: 14 }} className="text-blue-600" /> Ver Factura XML
      </button>
      <button className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2" onClick={() => onCheckSunat(rowData)} type="button">
        <Search24Regular style={{ fontSize: 14 }} className="text-orange-600" /> Consultar RUC en SUNAT
      </button>
      <button className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2" onClick={() => onTraceOrigin(rowData)} type="button">
        <History24Regular style={{ fontSize: 14 }} className="text-green-600" /> Rastrear Origen (Hash)
      </button>
      <div className="border-t my-1" />
      <button
        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
        onClick={() => onVoidEntry?.(rowData)}
        type="button"
      >
        <Delete24Regular style={{ fontSize: 14 }} /> Anular Asiento
      </button>
    </div>
  );
};
