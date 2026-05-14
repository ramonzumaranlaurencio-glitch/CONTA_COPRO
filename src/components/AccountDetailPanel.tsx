import React from 'react';

type AccountDetailPanelProps = {
  accountCode: string;
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
};

export const AccountDetailPanel = ({ accountCode, isOpen, onClose, children }: AccountDetailPanelProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <div className="w-[450px] bg-white h-full shadow-2xl p-6 animate-slide-in">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-lg font-bold">Detalle de Cuenta: {accountCode}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded" type="button">X</button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-500 italic">Mostrando ultimos 50 movimientos...</p>
          {children}
        </div>
      </div>
    </div>
  );
};
