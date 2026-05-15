import React, { useMemo, useState } from 'react';
import { MetricCard } from './MetricCard';
import { PanelSection, PanelsGrid, PageLayout } from './layout';
import { DocumentText24Regular, Pulse24Regular, CheckmarkCircle24Regular, Settings24Regular, CheckmarkCircle24Filled } from '@fluentui/react-icons';

type ReceivableRow = {
  accountCode: string;
  accountName: string;
  majorCode: string;
  pendingInvoices: number;
  analytic: number;
};

const receivableRows: ReceivableRow[] = [
  { accountCode: '12.1.1', accountName: 'Facturas por Cobrar', majorCode: '121100', pendingInvoices: 96, analytic: 300000 },
  { accountCode: '12.1.2', accountName: 'Facturas por Cobrar - Retail', majorCode: '121200', pendingInvoices: 22, analytic: 56000 },
  { accountCode: '12.1.3', accountName: 'Cobranza Dudosa', majorCode: '129100', pendingInvoices: 15, analytic: 25000 },
  { accountCode: '12.1.4', accountName: 'Cobranza Judicial', majorCode: '129200', pendingInvoices: 4, analytic: 18500 },
];

const recentOperations = [
  { date: '2026-05-10', desc: 'Venta F001-8421 cliente corporativo', debit: 18880, credit: 0, status: 'OK' },
  { date: '2026-05-09', desc: 'Depreciacion servidores nube', debit: 4200, credit: 0, status: 'OK' },
  { date: '2026-05-08', desc: 'Provision cobranza dudosa', debit: 1540, credit: 0, status: 'REVIEW' },
];

export const DashboardEnterprisePremium = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ReceivableRow>(receivableRows[0]);

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

  return (
    <PageLayout
      title="Dashboard Enterprise"
      subtitle="Gestión integral de operaciones y compliance"
      action={
        <div className="flex gap-2">
          <button className="btn-fluent-primary text-sm">+ Nueva Venta</button>
          <button className="btn-fluent-secondary text-sm" onClick={exportSummary}>Exportar</button>
        </div>
      }
    >
      {/* Metrics Row */}
      <PanelsGrid columns={5} gap="md">
        <MetricCard title="Caja" value="S/ 482,900" color="blue" trend="+2.4%" />
        <MetricCard title="Cuentas por Cobrar" value="S/ 1,284,320" color="green" trend="+1.6%" />
        <MetricCard title="Cuentas por Pagar" value="S/ 712,008" color="red" trend="-0.8%" />
        <MetricCard title="IGV" value="S/ 86,240" color="orange" trend="+0.9%" />
        <MetricCard title="Resultado" value="S/ 392,600" color="indigo" trend="+3.2%" />
      </PanelsGrid>

      {/* Main Content Grid */}
      <PanelsGrid columns={2} gap="lg">
        {/* Panel 1: Libros Electronicos */}
        <PanelSection
          title="Libros Electronicos - PLE 5.1/5.2"
          subtitle="Periodo: Mayo 2026 - 342 asientos"
          icon={<DocumentText24Regular />}
          action={<button className="btn-fluent-primary text-xs">Generar PLE</button>}
          variant="success"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-900">Libro Diario (5.1)</p>
                <p className="text-xs text-slate-500">342 asientos detectados - Hash de integridad OK</p>
              </div>
              <span className="status-ok ml-3">OK</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-900">Libro Simplificado (5.2)</p>
                <p className="text-xs text-slate-500">Formato para exportación listo</p>
              </div>
              <button className="btn-fluent-secondary text-xs whitespace-nowrap ml-3">Descargar ZIP</button>
            </div>
          </div>
        </PanelSection>

        {/* Panel 2: SUNAT Monitor */}
        <PanelSection
          title="Monitor de Envio SUNAT"
          subtitle="Estado de comunicaciones con SUNAT"
          icon={<Pulse24Regular />}
          variant="warning"
        >
          <div className="space-y-4">
            <div className="alert alert-info">
              <div className="alert-icon">ℹ️</div>
              <div className="alert-text">
                <h4>Backend no disponible</h4>
                <p>Modo local operativo - Datos en formato demo</p>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Estado</span>
                <span className="detail-value">Conectado</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ultimos 24h</span>
                <span className="detail-value">12 ops</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Certificado</span>
                <span className="detail-value">Vigente</span>
              </div>
            </div>
          </div>
        </PanelSection>

        {/* Panel 3: Auditoria IA */}
        <PanelSection
          title="Auditoria Preventiva IA"
          subtitle="Análisis de riesgos y compliance automático"
          icon={<CheckmarkCircle24Regular />}
          action={<button className="btn-fluent-primary text-xs">INICIAR ESCANEO</button>}
        >
          <div className="space-y-3">
            <div className="alert alert-danger">
              <div className="alert-icon">⚠️</div>
              <div className="alert-text">
                <h4>Riesgo Fiscal Alto</h4>
                <p>3 Proveedores No Habidos detectados - Monto: S/ 14,200.50</p>
              </div>
            </div>
            <div className="alert alert-warning">
              <div className="alert-icon">⚡</div>
              <div className="alert-text">
                <h4>Detracciones Pendientes</h4>
                <p>12 Facturas sin constancia de depósito</p>
              </div>
            </div>
            <div className="alert alert-info">
              <div className="alert-icon">ℹ️</div>
              <div className="alert-text">
                <h4>Proyección de Régimen</h4>
                <p>Empresa al 85% del límite MYPE - Cambio proyectado en julio</p>
              </div>
            </div>
          </div>
        </PanelSection>

        {/* Panel 4: Configuracion */}
        <PanelSection
          title="Configuracion del Sistema"
          subtitle="Parámetros y preferencias operativas"
          icon={<Settings24Regular />}
        >
          <div className="space-y-4">
            <div className="stats-row">
              <div className="stat-item">
                <span className="stat-value">F001-08100</span>
                <span className="stat-label">Serie Actual</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">1.20</span>
                <span className="stat-label">Factor IGV</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">2026-05-31</span>
                <span className="stat-label">Cierre Periodo</span>
              </div>
            </div>
            <button className="btn-fluent-secondary w-full">Actualizar Parámetros</button>
          </div>
        </PanelSection>
      </PanelsGrid>

      {/* Cuentas por Cobrar - Full Width */}
      <PanelSection
        title="Cuentas por Cobrar - Cartera Activa"
        subtitle="Análisis de facturas pendientes de cobro por cuenta"
      >
        <div className="overflow-x-auto">
          <table className="erp-table w-full text-sm">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Nombre</th>
                <th style={{ textAlign: 'right' }}>Facturas</th>
                <th style={{ textAlign: 'right' }}>Analítico</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {receivableRows.map((row) => (
                <tr key={row.accountCode} style={{ cursor: 'pointer' }}>
                  <td className="font-semibold text-slate-900">{row.accountCode}</td>
                  <td className="text-blue-600 font-semibold">{row.accountName}</td>
                  <td style={{ textAlign: 'right' }} className="font-mono">{row.pendingInvoices}</td>
                  <td className="money">{row.analytic.toLocaleString('es-PE')}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn-fluent-secondary text-xs">Detalles</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelSection>

      {/* Ultimas Operaciones */}
      <PanelSection
        title="Ultimas Operaciones Registradas"
        subtitle="Asientos más recientes del período"
        action={<button className="btn-fluent-secondary text-xs">Ver Todo</button>}
      >
        <div className="overflow-x-auto">
          <table className="erp-table w-full text-sm">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Debe</th>
                <th style={{ textAlign: 'right' }}>Haber</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentOperations.map((op, idx) => (
                <tr key={idx}>
                  <td>{op.date}</td>
                  <td className="truncate">{op.desc}</td>
                  <td style={{ textAlign: 'right' }} className="money">{op.debit.toLocaleString('es-PE')}</td>
                  <td style={{ textAlign: 'right' }} className="money">{op.credit.toLocaleString('es-PE')}</td>
                  <td style={{ textAlign: 'center' }}>
                    {op.status === 'OK' ? (
                      <span className="status-ok">OK</span>
                    ) : (
                      <span style={{ padding: '4px 8px', background: '#fef3c7', color: '#b45309', borderRadius: 999, fontSize: 10, fontWeight: 800 }}>REVIEW</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelSection>
    </PageLayout>
  );
};
