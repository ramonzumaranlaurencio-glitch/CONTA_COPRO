import React from 'react';
import { PanelSection } from './PanelSection';
import { PanelsGrid } from './PanelsGrid';
import { Info24Regular, Warning24Regular, CheckmarkCircle24Regular, DocumentText24Regular, Settings24Regular, Pulse24Regular } from '@fluentui/react-icons';

export const DashboardPageLayout = () => {
  return (
    <div className="main-layout min-h-screen">
      {/* Sticky Header */}
      <div className="command-bar sticky top-0 z-40">
        <button className="btn-fluent-primary" type="button">+ Nueva Operación</button>
        <button className="btn-fluent-secondary" type="button">Exportar</button>
        <div className="command-divider" />
        <button className="btn-fluent-ghost" type="button">Auditoria IA</button>
      </div>

      {/* Content Wrapper */}
      <div className="px-6 py-8 space-y-8">
        {/* Title Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard Enterprise</h1>
          <p className="text-slate-600">Gestión integral de operaciones y compliance</p>
        </div>

        {/* Metrics Grid */}
        <PanelsGrid columns={4} gap="md">
          {[
            { label: 'Caja', value: 'S/ 482,900', icon: '💰' },
            { label: 'CXC', value: 'S/ 1,284,320', icon: '📊' },
            { label: 'CXP', value: 'S/ 712,008', icon: '💳' },
            { label: 'IGV', value: 'S/ 86,240', icon: '🧾' },
          ].map((metric) => (
            <div key={metric.label} className="panel-card">
              <div className="panel-body">
                <div className="text-center">
                  <div className="text-3xl mb-2">{metric.icon}</div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{metric.label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-2">{metric.value}</p>
                </div>
              </div>
            </div>
          ))}
        </PanelsGrid>

        {/* Main Content Grid */}
        <PanelsGrid columns={2} gap="md">
          {/* Panel 1: Libros Electronicos */}
          <PanelSection
            title="Libros Electronicos - PLE 5.1/5.2"
            subtitle="Periodo: Mayo 2026"
            icon={<DocumentText24Regular />}
            action={<button className="btn-fluent-secondary text-xs">Generar PLE</button>}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                <div>
                  <p className="font-semibold text-sm">Libro Diario (5.1)</p>
                  <p className="text-xs text-slate-500">342 asientos detectados ✓</p>
                </div>
                <span className="status-ok">OK</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                <div>
                  <p className="font-semibold text-sm">Libro Simplificado (5.2)</p>
                  <p className="text-xs text-slate-500">Listo para exportación</p>
                </div>
                <button className="btn-fluent-secondary text-xs">Descargar ZIP</button>
              </div>
            </div>
          </PanelSection>

          {/* Panel 2: SUNAT Monitor */}
          <PanelSection
            title="Monitor de Envio SUNAT"
            subtitle="Estado de las comunicaciones"
            icon={<Pulse24Regular />}
            variant="warning"
          >
            <div className="space-y-3">
              <div className="alert alert-info">
                <div className="alert-icon">ℹ️</div>
                <div className="alert-text">
                  <h4>Backend no disponible</h4>
                  <p>Modo local operativo - Datos de demo</p>
                </div>
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Caja</span>
                  <span className="detail-value numeric">S/ 482,900</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">CXC</span>
                  <span className="detail-value numeric">S/ 1,284,320</span>
                </div>
              </div>
            </div>
          </PanelSection>

          {/* Panel 3: Auditoria Preventiva */}
          <PanelSection
            title="Auditoria Preventiva IA"
            subtitle="Escaneo de riesgos y compliance"
            icon={<CheckmarkCircle24Regular />}
            action={<button className="btn-fluent-primary text-xs">INICIAR ESCANEO</button>}
          >
            <div className="space-y-3">
              <div className="alert alert-danger">
                <div className="alert-icon">⚠️</div>
                <div className="alert-text">
                  <h4>Riesgo Fiscal Alto</h4>
                  <p>3 Proveedores No Habidos detectados - S/ 14,200.50</p>
                </div>
              </div>
              <div className="alert alert-warning">
                <div className="alert-icon">⚡</div>
                <div className="alert-text">
                  <h4>Detracciones Pendientes</h4>
                  <p>12 Facturas sin constancia de depósito</p>
                </div>
              </div>
            </div>
          </PanelSection>

          {/* Panel 4: Configuracion */}
          <PanelSection
            title="Configuracion del Sistema"
            subtitle="Parametros y preferencias"
            icon={<Settings24Regular />}
          >
            <div className="space-y-3">
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
                  <span className="stat-value">2026-05-01</span>
                  <span className="stat-label">Fecha Cierre</span>
                </div>
              </div>
              <button className="btn-fluent-secondary w-full">Actualizar Parametros</button>
            </div>
          </PanelSection>
        </PanelsGrid>

        {/* Full Width Section */}
        <PanelSection
          title="Ultimas Operaciones"
          subtitle="Asientos más recientes del periodo"
          action={<button className="btn-fluent-secondary text-xs">Ver Todo</button>}
        >
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th className="text-right">Debe</th>
                  <th className="text-right">Haber</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>2026-05-10</td>
                  <td>Venta F001-8421 cliente corporativo</td>
                  <td className="text-right">18,880.00</td>
                  <td className="text-right">0.00</td>
                  <td><span className="status-ok">OK</span></td>
                </tr>
                <tr>
                  <td>2026-05-09</td>
                  <td>Depreciacion servidores nube</td>
                  <td className="text-right">4,200.00</td>
                  <td className="text-right">0.00</td>
                  <td><span className="status-ok">OK</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </PanelSection>
      </div>
    </div>
  );
};
