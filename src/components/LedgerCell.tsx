import React from 'react';
import { Open24Regular } from '@fluentui/react-icons';

type LedgerCellProps = {
  value: React.ReactNode;
  type?: 'amount' | 'text';
  onClick?: () => void;
};

export const LedgerCell = ({ value, type = 'text', onClick }: LedgerCellProps) => {
  return (
    <td
      className="p-3 border-b text-xs cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-all group"
      onClick={onClick}
    >
      <div className="flex justify-between items-center gap-2">
        <span className={type === 'amount' ? 'font-mono' : 'font-medium'}>
          {value}
        </span>
        <Open24Regular style={{ fontSize: 12 }} className="opacity-0 group-hover:opacity-100" />
      </div>
    </td>
  );
};
