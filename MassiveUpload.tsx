import React, { useRef } from 'react';
import { ArrowUpload24Regular } from '@fluentui/react-icons';
import { SalesButtonIA } from '@/components/SalesButtonIA';

export const MassiveUpload = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const total = event.target.files?.length ?? 0;
    window.alert(total > 0 ? `${total} archivo(s) seleccionado(s).` : 'No se seleccionaron archivos.');
  };

  return (
    <div className="p-8 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 flex flex-col items-center justify-center">
      <div className="bg-blue-600 p-4 rounded-full mb-4 shadow-lg">
        <ArrowUpload24Regular className="text-white text-3xl" />
      </div>
      <h3 className="text-lg font-bold text-slate-700">Importador Masivo de Comprobantes</h3>
      <p className="text-sm text-slate-500 mb-6">Arrastra tus archivos XML de SUNAT aqui para contabilizarlos automaticamente.</p>

      <button type="button" className="btn-fluent-primary" onClick={openFilePicker}>
        Seleccionar Archivos
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xml"
        className="hidden"
        onChange={onFilesSelected}
      />

      <div className="mt-4">
        <SalesButtonIA />
      </div>

      <div className="w-full mt-8 space-y-2">
        <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
          <span>Procesando facturas...</span>
          <span>75%</span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div className="bg-blue-600 h-full w-[75%] transition-all" />
        </div>
      </div>
    </div>
  );
};
