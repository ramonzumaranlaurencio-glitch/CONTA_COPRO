import React, { useMemo, useState } from 'react';
import { MetricCard } from './MetricCard';
import { AssetTablePremium } from '@/features/assets/AssetTablePremium';
import { SidePanel } from './ui/SidePanel';

type ReceivableRow = {
  accountCode: string;
  accountName: string;
  majorCode: string;
  pendingInvoices: number;
  analytic: number;
};

type AnalyticMovement = {
  date: string;
  voucher: string;
  glosa: string;
  debit: number;
  credit: number;
  balance: number;
  hashOk: boolean;
};

const receivableRows: ReceivableRow[] = [
  { accountCode: '12.1.1', accountName: 'Facturas por Cobrar', majorCode: '121100', pendingInvoices: 96, analytic: 300000 },
  { accountCode: '12.1.2', accountName: 'Facturas por Cobrar - Retail', majorCode: '121200', pendingInvoices: 22, analytic: 56000 },
  { accountCode: '12.1.3', accountName: 'Cobranza Dudosa', majorCode: '129100', pendingInvoices: 15, analytic: 25000 },
  { accountCode: '12.1.4', accountName: 'Cobranza Judicial', majorCode: '129200', pendingInvoices: 4, analytic: 18500 },
];

const movementMatrix: Record<string, AnalyticMovement[]> = {
  '12.1.1': [
    { date: '2026-05-10', voucher: 'V-000542', glosa: 'Venta F001-8421 cliente corporativo', debit: 18880, credit: 0, balance: 18880, hashOk: true },
    { date: '2026-05-12', voucher: 'V-000550', glosa: 'Cobro parcial cliente corporativo', debit: 0, credit: 8880, balance: 10000, hashOk: true },
    { date: '2026-05-16', voucher: 'V-000559', glosa: 'Nota de credito por pronto pago', debit: 0, credit: 320, balance: 9680, hashOk: true },
  ],
  '12.1.2': [
    { date: '2026-05-05', voucher: 'V-000501', glosa: 'Venta retail lote mayo semana 1', debit: 22600, credit: 0, balance: 22600, hashOk: true },
    { date: '2026-05-08', voucher: 'V-000518', glosa: 'Cobranza retail recaudacion caja', debit: 0, credit: 9200, balance: 13400, hashOk: true },
  ],
  '12.1.3': [
    { date: '2026-05-03', voucher: 'AJ-000102', glosa: 'Provision cobranza dudosa cartera 61-90', debit: 11800, credit: 0, balance: 11800, hashOk: true },
    { date: '2026-05-18', voucher: 'AJ-000109', glosa: 'Reclasificacion cartera sin respuesta', debit: 13200, credit: 0, balance: 25000, hashOk: true },
  ],
  '12.1.4': [
    { date: '2026-05-06', voucher: 'AJ-000095', glosa: 'Traslado expediente a cobranza judicial', debit: 6000, credit: 0, balance: 6000, hashOk: true },
    { date: '2026-05-22', voucher: 'AJ-000114', glosa: 'Costas judiciales provisionadas', debit: 12500, credit: 0, balance: 18500, hashOk: true },
  ],
};

export const DashboardEnterprise = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ReceivableRow>(receivableRows[0]);

  const notify = (message: string) => {
    window.alert(message);
  };

  const exportSummary = () => {
    const csv = [
      'indicador,valor',
      'Caja,482900',
      'Cuentas por Cobrar,1284320',
      'Cuentas por Pagar,712008',
      'IGV,86240',
      'Resultado,392600',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'dashboard-resumen.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openAuditDrawer = (row: ReceivableRow) => {
    setSelectedAccount(row);
    setDrawerOpen(true);
  };

  const movements = useMemo(() => movementMatrix[selectedAccount.accountCode] ?? [], [selectedAccount.accountCode]);

  const totalDebit = useMemo(() => movements.reduce((acc, item) => acc + item.debit, 0), [movements]);

  const totalCredit = useMemo(() => movements.reduce((acc, item) => acc + item.credit, 0), [movements]);

  const panelTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: '#334155',
  };

  const panelHintStyle: React.CSSProperties = {
    margin: '6px 0 0 0',
    fontSize: 11,
    color: '#64748b',
  };

  const tableCellRight: React.CSSProperties = {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'Consolas, "Courier New", monospace',
  };

  return (
    <div className="main-layout min-h-screen">
      <div className="command-bar">
        <button className="btn-fluent-primary" type="button" onClick={() => notify('Panel de nueva venta en implementacion.')}>+ Nueva Venta</button>
        <button className="btn-fluent-secondary" type="button" onClick={exportSummary}>Exportar Excel</button>
        <button className="btn-fluent-secondary" type="button" onClick={() => openAuditDrawer(selectedAccount)}>Exportar PDF</button>
        <div className="command-divider" />
        <button className="btn-fluent-ghost" type="button" onClick={() => openAuditDrawer(selectedAccount)}>Auditoria IA</button>
      </div>

      <div style={{ padding: 24 }}>
        <div
          style={{
            display: 'grid',
            gap: 14,
            marginBottom: 20,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <MetricCard title="Caja" value="S/ 482,900" color="blue" trend="+2.4%" />
          <MetricCard title="Cuentas por Cobrar" value="S/ 1,284,320" color="green" trend="+1.6%" />
          <MetricCard title="Cuentas por Pagar" value="S/ 712,008" color="red" trend="-0.8%" />
          <MetricCard title="IGV" value="S/ 86,240" color="orange" trend="+0.9%" />
          <MetricCard title="Resultado" value="S/ 392,600" color="indigo" trend="+3.2%" />
        </div>

        <div className="dashboard-card overflow-hidden">
          <div
            style={{
              padding: '12px 14px',
              background: 'linear-gradient(180deg, #f8fbff 0%, #edf4fc 100%)',
              borderBottom: '1px solid #dbe3ed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 style={panelTitleStyle}>Cuentas por Cobrar</h3>
              <p style={panelHintStyle}>Click en una fila para abrir el informe de auditoria analitica</p>
            </div>
            <button className="btn-fluent-secondary" type="button" onClick={() => openAuditDrawer(selectedAccount)}>Informe analitico</button>
          </div>
          <div className="erp-scroll" style={{ overflowX: 'auto', padding: 10 }}>
            <table className="erp-table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Nombre</th>
                <th>Cod Mayor</th>
                <th style={{ textAlign: 'right' }}>Facturas</th>
                <th style={{ textAlign: 'right' }}>Analitico</th>
              </tr>
            </thead>
            <tbody>
              {receivableRows.map((row) => (
                <tr
                  key={row.accountCode}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openAuditDrawer(row)}
                >
                  <td style={{ fontWeight: 700, color: '#334155' }}>{row.accountCode}</td>
                  <td style={{ fontWeight: 700, color: '#1d4ed8' }}>{row.accountName}</td>
                  <td style={{ fontFamily: 'Consolas, "Courier New", monospace', fontSize: 11, color: '#475569' }}>{row.majorCode}</td>
                  <td style={tableCellRight}>{row.pendingInvoices.toLocaleString('en-US')}</td>
                  <td className="money">{row.analytic.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="dashboard-card overflow-hidden">
          <div
            style={{
              padding: '12px 14px',
              background: 'linear-gradient(180deg, #f8fbff 0%, #edf4fc 100%)',
              borderBottom: '1px solid #dbe3ed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <h3 style={panelTitleStyle}>Control de Activos Fijos</h3>
            <button className="btn-fluent-secondary" type="button" onClick={() => notify('Formulario de activos en implementacion.')}>+ Agregar Activo</button>
          </div>
          <div className="erp-scroll" style={{ overflowX: 'auto', padding: 10 }}>
            <table className="erp-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>CODIGO</th>
                <th>DESCRIPCION</th>
                <th style={{ textAlign: 'right' }}>COSTO ORIG.</th>
                <th style={{ textAlign: 'right' }}>DEP. ACUM.</th>
                <th style={{ textAlign: 'right' }}>VALOR NETO</th>
                <th style={{ textAlign: 'center' }}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontFamily: 'Consolas, "Courier New", monospace', fontSize: 11 }}>ACT-2026-001</td>
                <td style={{ fontWeight: 700, color: '#334155' }}>Camioneta Hilux 4x4 (Placa ABC-123)</td>
                <td style={tableCellRight}>120,000.00</td>
                <td style={{ ...tableCellRight, color: '#b91c1c', fontWeight: 700 }}>2,000.00</td>
                <td className="money">118,000.00</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ padding: '4px 8px', background: '#dcfce7', color: '#15803d', borderRadius: 999, fontSize: 10, fontWeight: 800 }}>OPERATIVO</span>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>

        <div className="dashboard-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <h3 style={panelTitleStyle}>Datos Maestros de Inventario</h3>
              <p style={panelHintStyle}>Articulo de referencia para auditoria de kardex y valorizacion</p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: '#fee2e2', padding: '4px 9px', fontSize: 10, fontWeight: 800, color: '#b91c1c' }}>Stock Critico</span>
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            <div style={{ borderRadius: 8, border: '1px solid #dbe3ed', background: '#fff', padding: 10 }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>Articulo</p>
              <p style={{ margin: '6px 0 0 0', fontWeight: 800, color: '#1f2937', fontSize: 13 }}>HP Color Laser Jet</p>
            </div>
            <div style={{ borderRadius: 8, border: '1px solid #dbe3ed', background: '#fff', padding: 10 }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>Codigo de barra</p>
              <p style={{ margin: '6px 0 0 0', fontFamily: 'Consolas, "Courier New", monospace', fontWeight: 800, color: '#1f2937', fontSize: 13 }}>A00004</p>
            </div>
            <div style={{ borderRadius: 8, border: '1px solid #dbe3ed', background: '#fff', padding: 10 }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>Precio unitario</p>
              <p style={{ margin: '6px 0 0 0', fontFamily: 'Consolas, "Courier New", monospace', fontWeight: 800, color: '#1f2937', fontSize: 13 }}>2,500.00</p>
            </div>
            <div style={{ borderRadius: 8, border: '1px solid #dbe3ed', background: '#fff', padding: 10 }}>
              <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>Stock real</p>
              <p style={{ margin: '6px 0 0 0', fontFamily: 'Consolas, "Courier New", monospace', fontWeight: 800, color: '#1f2937', fontSize: 13 }}>10</p>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: '#d1fae5', padding: '4px 8px', fontSize: 10, fontWeight: 800, color: '#047857' }}>Habido</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: '#dbeafe', padding: '4px 8px', fontSize: 10, fontWeight: 800, color: '#1d4ed8' }}>Activo</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: '#fef3c7', padding: '4px 8px', fontSize: 10, fontWeight: 800, color: '#b45309' }}>Reorden sugerido</span>
          </div>
        </div>

        <AssetTablePremium />
      </div>

      <SidePanel
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`Informe de Auditoria Analitica: ${selectedAccount.accountCode}`}
      >
        <div className="audit-drawer-meta">
          <p>Cuenta seleccionada</p>
          <strong>{selectedAccount.accountName}</strong>
          <span>Mayor: {selectedAccount.majorCode}</span>
        </div>

        <div className="audit-drawer-table-wrap">
          <table className="audit-drawer-table erp-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Voucher</th>
                <th>Debe</th>
                <th>Haber</th>
                <th>Saldo</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((item) => (
                <tr key={`${item.voucher}-${item.date}`}>
                  <td>{item.date}</td>
                  <td title={item.glosa}>{item.voucher}</td>
                  <td className="money">{item.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="money">{item.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="money strong">{item.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="hash">{item.hashOk ? 'LOCK' : 'WARN'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="audit-drawer-summary">
          <div>
            <span>Total Debe</span>
            <strong>{totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div>
            <span>Total Haber</span>
            <strong>{totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div>
            <span>Saldo</span>
            <strong>{(totalDebit - totalCredit).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <section className="audit-recommendation">
          <h4>Observaciones y Recomendaciones IA</h4>
          <ul>
            <li>Se observa concentracion de cartera en tramo 61-90 dias (Cta 12.1.3).</li>
            <li>Aplicar recordatorios automaticos y bloqueo de nueva venta para clientes sin respuesta.</li>
            <li>Ejecutar conciliacion de cobranzas para reducir saldo vencido antes del cierre de mayo.</li>
          </ul>
        </section>
      </SidePanel>
    </div>
  );
};
