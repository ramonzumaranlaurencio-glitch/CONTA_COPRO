import React from 'react';

type InteractiveCellProps = {
  children: React.ReactNode;
  onClick?: () => void;
};

export const InteractiveCell = ({ children, onClick }: InteractiveCellProps) => (
  <td
    onClick={onClick}
    className="px-4 py-2 text-xs border-b cursor-pointer hover:text-blue-600 hover:bg-blue-50/50 transition-all font-medium border-l-2 border-l-transparent hover:border-l-blue-600"
  >
    {children}
  </td>
);

type RowData = {
  id: string;
  cuenta: string;
  debe: number;
  haber: number;
};

type InteractiveTableProps = {
  rows: RowData[];
  handleAccountClick: (accountCode: string) => void;
  handleAmountClick: (id: string) => void;
};

const formatCurrency = (amount: number) => amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const InteractiveTable = ({ rows, handleAccountClick, handleAmountClick }: InteractiveTableProps) => {
  return (
    <table className="w-full text-xs">
      <thead className="bg-slate-100 border-b">
        <tr>
          <th className="px-4 py-2 text-left">Cuenta</th>
          <th className="px-4 py-2 text-right">Debe</th>
          <th className="px-4 py-2 text-right">Haber</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <InteractiveCell onClick={() => handleAccountClick(row.cuenta)}>
              {row.cuenta}
            </InteractiveCell>
            <InteractiveCell onClick={() => handleAmountClick(row.id)}>
              <span className="font-mono">{formatCurrency(row.debe)}</span>
            </InteractiveCell>
            <InteractiveCell onClick={() => handleAmountClick(row.id)}>
              <span className="font-mono">{formatCurrency(row.haber)}</span>
            </InteractiveCell>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
