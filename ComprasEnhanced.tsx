import React, { useState } from 'react';
import { 
  DocumentRegular,
  Warning24Regular,
  CheckmarkCircle24Regular,
  ShieldCheckmark24Regular,
  Dismiss24Regular,
  ArrowRight24Regular,
} from '@fluentui/react-icons';

export const ComprasEnhanced = () => {
  const [selectedFinding, setSelectedFinding] = useState<number | null>(null);

  const findings = [
    {
      id: 1,
      date: '10/05/2026',
      finding: 'Gasto Atipico',
      description: 'Compra en Joyas Peruanas SAC',
      suggestion: 'Gasto no parece causal para el rubro Construccion. Verificar si es reparable.',
      severity: 'warning',
      icon: '⚠️',
    },
    {
      id: 2,
      date: '09/05/2026',
      finding: 'Factura Duplicada',
      description: 'F001-88412',
      suggestion: 'Detectada coincidencia por monto y proveedor con distinta serie.',
      severity: 'critical',
      icon: '🔴',
    },
  ];

  const stats = [
    { label: 'Compras Procesadas', value: '342', color: 'blue', icon: '📊' },
    { label: 'Facturas Verificadas', value: '98%', color: 'green', icon: '✅' },
    { label: 'Alertas Activas', value: '12', color: 'orange', icon: '⚠️' },
    { label: 'Riesgo Fiscal', value: '3', color: 'red', icon: '🔴' },
  ];

  return (
    <div className="main-layout min-h-screen">
      {/* Header Premium */}
      <div className="command-bar">
        <h2 className="text-lg font-bold text-white">Compras & Proveedores</h2>
        <button className="btn-fluent-primary">+ Registrar Compra</button>
        <button className="btn-fluent-secondary">Importar CSV</button>
        <div className="command-divider" />
        <button className="btn-fluent-ghost">Auditoria IA</button>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-8">
        {/* Stats Cards - 4 Columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="panel-card overflow-hidden group hover:shadow-xl transition-all"
            >
              <div className={`h-1 bg-gradient-to-r ${
                stat.color === 'blue' ? 'from-blue-400 to-blue-600' :
                stat.color === 'green' ? 'from-green-400 to-green-600' :
                stat.color === 'orange' ? 'from-orange-400 to-orange-600' :
                'from-red-400 to-red-600'
              }`} />
              
              <div className="panel-body">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-2xl">{stat.icon}</div>
                  <div className="text-3xl font-black text-slate-900">
                    {stat.value}
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Auditoria Preventiva - Full Width */}
        <div className="panel-card">
          <div className="panel-header flex items-center gap-3">
            <ShieldCheckmark24Regular className="text-xl text-green-300" />
            <div>
              <h3>Auditoria Preventiva IA</h3>
              <p>Análisis automático de facturas y compliance de proveedores</p>
            </div>
            <button className="btn-fluent-primary ml-auto">
              INICIAR ESCANEO GLOBAL
            </button>
          </div>

          <div className="panel-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Risk Card 1 */}
              <div className="border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-red-100/30 p-4 rounded-r-lg">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-2xl">🔴</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-red-900">RIESGO FISCAL ALTO</p>
                    <p className="text-xs text-red-700 mt-1">3 Proveedores No Habidos</p>
                  </div>
                </div>
                <p className="text-xs text-red-600 font-semibold">Monto: S/ 14,200.50</p>
                <button className="text-xs text-red-700 font-bold hover:underline mt-2">
                  Ver detalles →
                </button>
              </div>

              {/* Risk Card 2 */}
              <div className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-orange-100/30 p-4 rounded-r-lg">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-2xl">⚡</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-orange-900">DETRACCIONES</p>
                    <p className="text-xs text-orange-700 mt-1">12 Facturas Pendientes</p>
                  </div>
                </div>
                <p className="text-xs text-orange-600 font-semibold">Sin constancia de depósito</p>
                <button className="text-xs text-orange-700 font-bold hover:underline mt-2">
                  Resolver →
                </button>
              </div>

              {/* Risk Card 3 */}
              <div className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/30 p-4 rounded-r-lg">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-2xl">ℹ️</span>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-blue-900">PROYECCION</p>
                    <p className="text-xs text-blue-700 mt-1">Régimen MYPE</p>
                  </div>
                </div>
                <p className="text-xs text-blue-600 font-semibold">85% del límite - Julio 2026</p>
                <button className="text-xs text-blue-700 font-bold hover:underline mt-2">
                  Plan acción →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hallazgos Forenses - Full Width */}
        <div className="panel-card">
          <div className="panel-header flex items-center gap-3">
            <Warning24Regular className="text-xl text-orange-300" />
            <div>
              <h3>Log de Hallazgos Forenses</h3>
              <p>Detección automática de anomalías y riesgos de compliance</p>
            </div>
          </div>

          <div className="panel-body">
            <div className="space-y-3">
              {findings.map((finding) => (
                <div
                  key={finding.id}
                  onClick={() => setSelectedFinding(selectedFinding === finding.id ? null : finding.id)}
                  className={`border-l-4 rounded-r-lg p-4 cursor-pointer transition-all ${
                    finding.severity === 'critical'
                      ? 'border-l-red-500 bg-gradient-to-br from-red-50/50 to-red-50/20 hover:bg-red-50'
                      : 'border-l-orange-500 bg-gradient-to-br from-orange-50/50 to-orange-50/20 hover:bg-orange-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl mt-1">{finding.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-slate-900">
                            {finding.finding}
                          </span>
                          <span className="text-xs px-2 py-1 bg-slate-800 text-white rounded-full font-bold">
                            {finding.date}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 font-mono">
                          {finding.description}
                        </p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-xl">
                      {selectedFinding === finding.id ? '▼' : '▶'}
                    </span>
                  </div>

                  {selectedFinding === finding.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200 bg-slate-900/5 -m-4 p-4 rounded-b-lg">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                        💡 Sugerencia del Auditor IA
                      </p>
                      <p className="text-sm text-slate-700 italic">
                        {finding.suggestion}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button className="btn-fluent-primary text-xs">
                          Resolver Ahora
                        </button>
                        <button className="btn-fluent-secondary text-xs">
                          Marcar como Revisado
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metricas de Cumplimiento */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Proveedores por Categoria */}
          <div className="panel-card">
            <div className="panel-header flex items-center gap-3">
              <DocumentRegular className="text-xl" />
              <div>
                <h3>Proveedores por Categoría</h3>
                <p>Distribución de compras activas</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="space-y-2">
                {[
                  { name: 'Materias Primas', count: 45, color: 'bg-blue-500' },
                  { name: 'Servicios', count: 32, color: 'bg-green-500' },
                  { name: 'Insumos', count: 28, color: 'bg-purple-500' },
                  { name: 'Otros', count: 15, color: 'bg-orange-500' },
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                      <span className="text-xs font-bold text-slate-500">{item.count}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${item.color} h-full rounded-full`}
                        style={{ width: `${(item.count / 45) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Estado de Documentos */}
          <div className="panel-card">
            <div className="panel-header flex items-center gap-3">
              <CheckmarkCircle24Regular className="text-xl" />
              <div>
                <h3>Estado de Documentos</h3>
                <p>Completitud de información por proveedor</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="space-y-3">
                {[
                  { label: 'RUC Verificado', value: 98, color: 'green' },
                  { label: 'SUNAT Verificado', value: 95, color: 'green' },
                  { label: 'Datos Fiscales Completos', value: 87, color: 'orange' },
                  { label: 'Referencias de Banco', value: 72, color: 'orange' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-12 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        item.color === 'green' ? 'bg-gradient-to-r from-green-400 to-green-600' :
                        'bg-gradient-to-r from-orange-400 to-orange-600'
                      }`}>
                        {item.value}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
