import React from 'react';
import { Button } from '@fluentui/react-components';

type InvoiceLineItem = {
  productCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  lineSubtotal: string;
};

type InvoiceItemsTableProps = {
  title: string;
  lineItems: InvoiceLineItem[];
  isReadMode: boolean;
  itemsSubtotal: number;
  onUpdateLineItem: (index: number, key: keyof InvoiceLineItem, value: string) => void;
  onAddLineItem: () => void;
  onRemoveLineItem: (index: number) => void;
  onOpenProductPanel: (index: number) => void;
  onProductCodeBlur?: (index: number, code: string) => void;
};

export const InvoiceItemsTable: React.FC<InvoiceItemsTableProps> = ({
  title,
  lineItems,
  isReadMode,
  itemsSubtotal,
  onUpdateLineItem,
  onAddLineItem,
  onRemoveLineItem,
  onOpenProductPanel,
  onProductCodeBlur,
}) => {
  return (
    <div
      style={{
        width: '100%',
        background: '#f9fafb',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(15, 84, 140, 0.12)',
        padding: 10,
        margin: '14px 0',
        border: '1px solid #dbe3ed',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#0f548c', paddingBottom: 12, borderBottom: '3px solid #0078d4' }}>
        📄 {title}
      </div>

      <div style={{ overflowX: 'hidden', minWidth: 0, marginBottom: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff', minWidth: 0, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '34%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'linear-gradient(180deg, #0078d4 0%, #005a9e 100%)', color: '#fff', fontWeight: 700, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.4px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.1)' }}>
              <th style={{ padding: 6, textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Código</th>
              <th style={{ padding: 6, textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Descripción</th>
              <th style={{ padding: 6, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Unidad</th>
              <th style={{ padding: 6, textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Cantidad</th>
              <th style={{ padding: 6, textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.1)' }}>P. Unitario</th>
              <th style={{ padding: 6, textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Subtotal</th>
              <th style={{ padding: 6, textAlign: 'center' }}>Acc.</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr
                key={`item-${index}`}
                style={{
                  height: 48,
                  background: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                  borderBottom: '1px solid #e5e7eb',
                  transition: 'all 0.2s ease',
                  boxShadow: index % 2 === 0 ? 'inset 0 0 0 1px rgba(0,120,212,0.05)' : 'none',
                }}
              >
                <td style={{ padding: 4, borderRight: '1px solid #e5e7eb' }}>
                  <input
                    style={{
                      width: '100%',
                      fontSize: 12,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: isReadMode ? '#f3f4f6' : '#fff',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                    }}
                    value={item.productCode}
                    onChange={(event) => onUpdateLineItem(index, 'productCode', event.target.value)}
                    onBlur={() => onProductCodeBlur?.(index, item.productCode)}
                    disabled={isReadMode}
                    placeholder="Código"
                  />
                </td>
                <td style={{ padding: 4, borderRight: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      style={{
                        flex: 1,
                        fontSize: 12,
                        padding: 6,
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: isReadMode ? '#f3f4f6' : '#fff',
                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s',
                      }}
                      value={item.description}
                      onChange={(event) => onUpdateLineItem(index, 'description', event.target.value)}
                      disabled={isReadMode}
                      placeholder="Descripción"
                    />
                    {!isReadMode && (
                      <Button
                        appearance="secondary"
                        size="small"
                        onClick={() => onOpenProductPanel(index)}
                        style={{ whiteSpace: 'nowrap', minWidth: 28, height: 28, padding: 0 }}
                      >
                        📋
                      </Button>
                    )}
                  </div>
                </td>
                <td style={{ padding: 4, borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <input
                    style={{
                      width: '100%',
                      fontSize: 12,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: isReadMode ? '#f3f4f6' : '#fff',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      textAlign: 'center',
                    }}
                    value={item.unit}
                    onChange={(event) => onUpdateLineItem(index, 'unit', event.target.value)}
                    disabled={isReadMode}
                    placeholder="UND"
                  />
                </td>
                <td style={{ padding: 4, borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input
                    style={{
                      width: '100%',
                      fontSize: 12,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: isReadMode ? '#f3f4f6' : '#fff',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      textAlign: 'right',
                    }}
                    value={item.quantity}
                    onChange={(event) => onUpdateLineItem(index, 'quantity', event.target.value)}
                    disabled={isReadMode}
                    placeholder="0.00"
                  />
                </td>
                <td style={{ padding: 4, borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input
                    style={{
                      width: '100%',
                      fontSize: 12,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: isReadMode ? '#f3f4f6' : '#fff',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      textAlign: 'right',
                      color: '#1e40af',
                      fontWeight: 500,
                    }}
                    value={item.unitPrice}
                    onChange={(event) => onUpdateLineItem(index, 'unitPrice', event.target.value)}
                    disabled={isReadMode}
                    placeholder="0.00"
                  />
                </td>
                <td style={{ padding: 4, borderRight: '1px solid #e5e7eb', textAlign: 'right' }}>
                  <input
                    style={{
                      width: '100%',
                      fontSize: 13,
                      fontWeight: 700,
                      padding: 6,
                      borderRadius: 6,
                      border: '1px solid #bfdbfe',
                      background: '#f0f9ff',
                      boxShadow: 'inset 0 1px 2px rgba(30,64,175,0.1)',
                      textAlign: 'right',
                      color: '#1e40af',
                    }}
                    value={item.lineSubtotal}
                    disabled
                  />
                </td>
                <td style={{ padding: 2, textAlign: 'center' }}>
                  <Button
                    appearance="secondary"
                    onClick={() => onRemoveLineItem(index)}
                    disabled={isReadMode || lineItems.length <= 1}
                    style={{
                      minWidth: 24,
                      height: 24,
                      padding: 0,
                      borderRadius: 6,
                      background: isReadMode || lineItems.length <= 1 ? '#e5e7eb' : '#fee2e2',
                      border: 'none',
                      color: isReadMode || lineItems.length <= 1 ? '#9ca3af' : '#dc2626',
                      fontWeight: 'bold',
                      fontSize: 11,
                    }}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '2px solid #dbe3ed' }}>
        <Button
          appearance="primary"
          onClick={onAddLineItem}
          disabled={isReadMode}
          style={{
            fontSize: 14,
            padding: '10px 20px',
            borderRadius: 8,
            background: isReadMode ? '#e5e7eb' : 'linear-gradient(180deg, #2196f3 0%, #0078d4 100%)',
            color: isReadMode ? '#9ca3af' : '#fff',
            fontWeight: 600,
            boxShadow: isReadMode ? 'none' : '0 4px 0 #005a9e, 0 8px 12px rgba(15,84,140,0.2)',
            border: 'none',
            cursor: isReadMode ? 'not-allowed' : 'pointer',
          }}
        >
          ➕ Agregar producto
        </Button>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f548c', paddingRight: 10 }}>
          Subtotal Items: <span style={{ color: '#0078d4' }}>S/ {itemsSubtotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
