import React, { useRef, useState } from 'react';
import { Bot24Regular, Checkmark24Regular } from '@fluentui/react-icons';
import { useTenantStore } from '@/hooks/useTenantStore';
import { handleAIVisionProcess } from '@/services/MagicSalesButton';

type SalesButtonIAProps = {
  onComplete?: (data: unknown) => void;
};

const delay = (ms: number) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const SalesButtonIA = ({ onComplete }: SalesButtonIAProps) => {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'posting' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tenantId = useTenantStore((state) => state.currentCompany.id);

  const processSelectedFile = async (file: File) => {
    try {
      setMessage('');
      setSelectedFileName(file.name);
      setStatus('scanning');
      await delay(1200);

      setStatus('posting');
      const result = await handleAIVisionProcess(file, tenantId);
      setStatus('done');
      setMessage('Venta sincronizada con exito.');
      onComplete?.(result);
      setTimeout(() => setStatus('idle'), 1400);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'No se pudo procesar la factura con IA.');
    }
  };

  const handleMagicButton = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await processSelectedFile(file);
    event.target.value = '';
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
        onChange={onFileChange}
      />

      <button
        onClick={handleMagicButton}
        className={`px-6 py-3 rounded-md font-bold transition-all flex items-center gap-2 ${
          status === 'scanning' ? 'bg-purple-600 animate-pulse' : 'bg-[#0078d4]'
        } text-white`}
        type="button"
      >
        {status === 'done' ? <Checkmark24Regular /> : <Bot24Regular />}
        {status === 'idle' && 'Procesar con IA Forense'}
        {status === 'scanning' && 'IA: Analizando Pixeles...'}
        {status === 'posting' && 'IA: Generando Contabilidad...'}
        {status === 'done' && 'Venta Registrada'}
        {status === 'error' && 'Reintentar Proceso IA'}
      </button>

      {selectedFileName && (
        <p className="text-xs text-slate-500">Archivo: {selectedFileName}</p>
      )}

      {message && (
        <p className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{message}</p>
      )}
    </div>
  );
};
