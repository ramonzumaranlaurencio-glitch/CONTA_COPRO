/**
 * Business Intelligence Hub - "Los Ojos de la Empresa"
 * Dashboard profesional de dirección ejecutiva
 */

import React, { useState, useEffect } from 'react';
import { WarningFilled24Filled, TrendingUp24Filled, AlertUrgent24Filled, CheckmarkCircle24Filled, ArrowUp20Filled, ArrowDown20Filled } from '@fluentui/react-icons';

interface KPI {
  label: string;
  value: string;
  trend: number;
  status: 'critical' | 'warning' | 'normal' | 'excellent';
  description: string;
  icon: string;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  action?: string;
  actionUrl?: string;
}

interface Anomaly {
  type: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  suggestedAction: string;
}

export const BusinessIntelligenceHub: React.FC = () => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'alerts' | 'anomalies' | 'forecast' | 'benchmarks'>('overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const mockKpis: KPI[] = [
      {
        label: 'Flujo de Caja',
        value: 'S/ 482,900',
        trend: 12.5,
        status: 'excellent',
        description: 'Vs. mes anterior',
        icon: '💰',
      },
      {
        label: 'Margen Operativo',
        value: '18.7%',
        trend: 3.1,
        status: 'excellent',
        description: 'Vs. sector (15%)',
        icon: '📈',
      },
      {
        label: 'CXC (Cartera)',
        value: 'S/ 1.28M',
        trend: -5.2,
        status: 'warning',
        description: '32 días promedio',
        icon: '💳',
      },
      {
        label: 'Deuda/Patrimonio',
        value: '0.42x',
        trend: -2.3,
        status: 'normal',
        description: 'Meta: <0.50',
        icon: '⚖️',
      },
      {
        label: 'Cumplimiento SUNAT',
        value: '100%',
        trend: 0,
        status: 'excellent',
        description: 'Integridad garantizada',
        icon: '✅',
      },
      {
        label: 'Stock Activo',
        value: 'S/ 680K',
        trend: 2.1,
        status: 'normal',
        description: 'Rotación: 8.2x',
        icon: '📦',
      },
    ];
    setKpis(mockKpis);
  }, []);

  useEffect(() => {
    const mockAlerts: Alert[] = [
      {
        id: '1',
        severity: 'critical',
        title: '🚨 Detracciones Pendientes',
        description: '12 facturas sin CDR - Riesgo de multa SUNAT',
        timestamp: 'Hace 2h',
        action: 'Resolver',
      },
      {
        id: '2',
        severity: 'critical',
        title: '🔴 Período sin Cierre',
        description: 'Abril 2026 sigue abierto - Requiere firma inmediata',
        timestamp: 'Hace 6h',
        action: 'Firmar',
      },
      {
        id: '3',
        severity: 'warning',
        title: '⚠️ CXP Vencidas',
        description: '8 facturas vencidas por S/ 245,000',
        timestamp: 'Hoy',
        action: 'Pagar',
      },
      {
        id: '4',
        severity: 'warning',
        title: '📉 Diferencia de Cambio',
        description: 'USD subió 3.2% - Revisar posición en dólares',
        timestamp: 'Ayer',
      },
    ];
    setAlerts(mockAlerts);
  }, []);

  useEffect(() => {
    const mockAnomalies: Anomaly[] = [
      {
        type: 'Fraude Potencial',
        description: 'RUC 20789456123 sin padrón SUNAT - S/ 180,000 en 3 facturas',
        impact: 'high',
        confidence: 100,
        suggestedAction: 'ACCIÓN INMEDIATA: Bloquear proveedor y verificar en SUNAT',
      },
      {
        type: 'Duplicación',
        description: 'Facturas F001-8420 y F001-8421 - Montos idénticos S/ 42,500',
        impact: 'high',
        confidence: 94,
        suggestedAction: 'Contactar proveedor - Posible facturación doble',
      },
      {
        type: 'Gasto Anómalo',
        description: 'Software Licencias: S/ 85,000 (3x promedio mensual)',
        impact: 'medium',
        confidence: 87,
        suggestedAction: 'Validar contrato - ¿Es facturación agrupada o compra única?',
      },
    ];
    setAnomalies(mockAnomalies);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 25%, #2d5a7b 50%, #1e293b 75%, #0f172a 100%)' }}>
      {/* HEADER - Premium Executive Dashboard */}
      <div className="px-8 py-8 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">🔍 LOS OJOS DE LA EMPRESA</h1>
            <p className="text-base opacity-90">Dashboard Ejecutivo | Inteligencia de Negocios Integral</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition flex items-center gap-2 backdrop-blur-sm border border-white/20"
          >
            {refreshing ? '⟳ Actualizando...' : '🔄 Refrescar'}
          </button>
        </div>
        <div className="flex gap-6 text-sm opacity-80">
          <span>📅 Período: Mayo 2026</span>
          <span>✓ Última actualización: Hace 2 min</span>
          <span>📊 3,247 asientos auditados</span>
        </div>
      </div>

      {/* TAB NAVIGATION - Premium Style */}
      <div className="px-8 mb-8 flex gap-1 bg-white/10 backdrop-blur-sm p-2 rounded-xl w-fit border border-white/10">
        {[
          { id: 'overview', label: '📊 Overview', badge: null },
          { id: 'alerts', label: '🚨 Alertas Críticas', badge: alerts.filter(a => a.severity === 'critical').length },
          { id: 'anomalies', label: '⚠️ Anomalías (IA)', badge: anomalies.length },
          { id: 'forecast', label: '📈 Proyecciones', badge: null },
          { id: 'benchmarks', label: '🎯 Benchmarks', badge: null },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2 ${
              selectedTab === tab.id
                ? 'bg-white text-blue-900 shadow-lg'
                : 'text-white/80 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                selectedTab === tab.id ? 'bg-red-500 text-white' : 'bg-red-500 text-white'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB - Premium KPI Cards */}
      {selectedTab === 'overview' && (
        <div className="px-8 space-y-8">
          {/* KPI Grid */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              Indicadores Clave de Desempeño
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className={`p-6 rounded-xl backdrop-blur-sm border transition-all hover:scale-105 cursor-pointer ${
                    kpi.status === 'excellent'
                      ? 'bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border-emerald-400/30 hover:border-emerald-400/60'
                      : kpi.status === 'warning'
                        ? 'bg-gradient-to-br from-amber-900/40 to-amber-800/20 border-amber-400/30 hover:border-amber-400/60'
                        : 'bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-400/30 hover:border-blue-400/60'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-4xl">{kpi.icon}</span>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold ${
                      kpi.trend > 0 ? 'text-emerald-300' : kpi.trend < 0 ? 'text-red-300' : 'text-slate-300'
                    }`}>
                      {kpi.trend > 0 ? '↑' : kpi.trend < 0 ? '↓' : '→'} {Math.abs(kpi.trend)}%
                    </div>
                  </div>
                  <h3 className="text-white/70 text-sm font-semibold mb-1">{kpi.label}</h3>
                  <div className="text-3xl font-black text-white mb-2">{kpi.value}</div>
                  <p className="text-xs text-white/60">{kpi.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Metrics */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">⚠️</span>
              Métricas de Riesgo
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="p-6 rounded-xl backdrop-blur-sm border border-orange-400/30 bg-gradient-to-br from-orange-900/40 to-orange-800/20">
                <h3 className="font-bold text-white text-lg mb-4">🎯 Exposición Tributaria</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/80">Compras sin CDR</span>
                      <span className="font-bold text-orange-300">12 facturas</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-gradient-to-r from-orange-500 to-orange-400 h-2 rounded-full" style={{ width: '45%' }}></div>
                    </div>
                  </div>
                  <p className="text-xs text-white/60 mt-3">⚠️ Riesgo: Multa SUNAT si no se presenta comprobante de detracciones antes del 25/06</p>
                </div>
              </div>

              <div className="p-6 rounded-xl backdrop-blur-sm border border-emerald-400/30 bg-gradient-to-br from-emerald-900/40 to-emerald-800/20">
                <h3 className="font-bold text-white text-lg mb-4">✅ Integridad de Datos</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/80">Hashes validados</span>
                      <span className="font-bold text-emerald-300">3,247/3,247</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                  <p className="text-xs text-white/60 mt-3">✓ Todos los asientos están intactos. Sin manipulaciones detectadas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ALERTS TAB */}
      {selectedTab === 'alerts' && (
        <div className="px-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">🚨</span>
            Alertas Críticas ({alerts.filter(a => a.severity === 'critical').length})
          </h2>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-5 rounded-xl backdrop-blur-sm border transition ${
                  alert.severity === 'critical'
                    ? 'bg-gradient-to-r from-red-900/40 to-red-800/20 border-red-400/40 hover:border-red-400/70'
                    : 'bg-gradient-to-r from-amber-900/40 to-amber-800/20 border-amber-400/40 hover:border-amber-400/70'
                }`}
              >
                <div className="flex gap-4">
                  <div className="flex-shrink-0 text-3xl">{alert.severity === 'critical' ? '🔴' : '🟠'}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-white text-lg">{alert.title}</h3>
                      <span className="text-xs text-white/60">{alert.timestamp}</span>
                    </div>
                    <p className="text-white/80 text-sm mb-3">{alert.description}</p>
                    {alert.action && (
                      <button className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-semibold transition">
                        → {alert.action}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ANOMALIES TAB */}
      {selectedTab === 'anomalies' && (
        <div className="px-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">🤖</span>
            Anomalías Detectadas por IA ({anomalies.length})
          </h2>
          <div className="space-y-4">
            {anomalies.map((anomaly, idx) => (
              <div key={idx} className="p-6 rounded-xl backdrop-blur-sm border border-red-400/40 bg-gradient-to-br from-red-900/40 to-red-800/20">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-white text-xl">{anomaly.type}</h3>
                  <div className="flex gap-2">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-lg ${
                        anomaly.impact === 'high'
                          ? 'bg-red-500/30 text-red-200'
                          : anomaly.impact === 'medium'
                            ? 'bg-amber-500/30 text-amber-200'
                            : 'bg-blue-500/30 text-blue-200'
                      }`}
                    >
                      {anomaly.impact === 'high' ? '🔴' : '🟠'} {anomaly.impact.toUpperCase()}
                    </span>
                    <span className="text-xs bg-white/10 text-white px-3 py-1 rounded-lg font-bold">
                      {anomaly.confidence}% confianza
                    </span>
                  </div>
                </div>
                <p className="text-white/90 text-base mb-4 leading-relaxed">{anomaly.description}</p>
                <div className="p-4 bg-blue-500/20 border border-blue-400/40 rounded-lg">
                  <p className="text-xs text-white/60 mb-1 font-semibold">💡 Acción Sugerida:</p>
                  <p className="text-white text-sm font-medium">{anomaly.suggestedAction}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FORECAST TAB */}
      {selectedTab === 'forecast' && (
        <div className="px-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">📈</span>
            Proyecciones (Próximos 12 Meses)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl backdrop-blur-sm border border-emerald-400/30 bg-gradient-to-br from-emerald-900/40 to-emerald-800/20">
              <h3 className="font-bold text-white text-lg mb-4">💰 Flujo de Caja Proyectado</h3>
              <div className="space-y-4">
                {[
                  { month: 'Jun 2026', amount: 'S/ 520,000', pct: 92 },
                  { month: 'Jul 2026', amount: 'S/ 485,000', pct: 82 },
                  { month: 'Ago 2026', amount: 'S/ 545,000', pct: 95 },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-white/80">{item.month}</span>
                      <span className="font-bold text-emerald-300">{item.amount}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2.5">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2.5 rounded-full" style={{ width: `${item.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/60 mt-5 pt-4 border-t border-white/10">📊 Tendencia: +8% promedio. Modelo: ARIMA + ajuste estacional</p>
            </div>

            <div className="p-6 rounded-xl backdrop-blur-sm border border-blue-400/30 bg-gradient-to-br from-blue-900/40 to-blue-800/20">
              <h3 className="font-bold text-white text-lg mb-4">📊 Ingresos Proyectados</h3>
              <div className="space-y-4">
                {[
                  { month: 'Jun 2026', amount: 'S/ 1.24M', pct: 88 },
                  { month: 'Jul 2026', amount: 'S/ 1.18M', pct: 82 },
                  { month: 'Ago 2026', amount: 'S/ 1.32M', pct: 92 },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-white/80">{item.month}</span>
                      <span className="font-bold text-blue-300">{item.amount}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2.5">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-2.5 rounded-full" style={{ width: `${item.pct}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/60 mt-5 pt-4 border-t border-white/10">📊 Tendencia: Estable. Confianza: 78%</p>
            </div>
          </div>
        </div>
      )}

      {/* BENCHMARKS TAB */}
      {selectedTab === 'benchmarks' && (
        <div className="px-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">🎯</span>
            Comparativa vs Industria
          </h2>
          <div className="space-y-5">
            {[
              { name: 'Margen Bruto', yours: 42, sector: 38, status: 'above' },
              { name: 'Rotación de Activos', yours: 2.1, sector: 2.5, status: 'below' },
              { name: 'Días de Pago Promedio', yours: 45, sector: 42, status: 'similar' },
            ].map((item, idx) => (
              <div key={idx} className="p-6 rounded-xl backdrop-blur-sm border border-white/20 bg-white/5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white text-lg">{item.name}</h3>
                  <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
                    item.status === 'above'
                      ? 'bg-emerald-500/30 text-emerald-200'
                      : item.status === 'below'
                        ? 'bg-amber-500/30 text-amber-200'
                        : 'bg-blue-500/30 text-blue-200'
                  }`}>
                    {item.status === 'above' ? '📈 Arriba' : item.status === 'below' ? '📉 Abajo' : '➡️ Similar'}
                  </span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 bg-emerald-500/30 text-emerald-200 text-center py-3 rounded-lg font-bold">
                    Tu empresa: {item.yours}{item.name.includes('Días') ? ' días' : item.name.includes('Margen') ? '%' : 'x'}
                  </div>
                  <div className="flex-1 bg-slate-500/30 text-slate-200 text-center py-3 rounded-lg font-bold">
                    Promedio: {item.sector}{item.name.includes('Días') ? ' días' : item.name.includes('Margen') ? '%' : 'x'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-12 px-8 pb-8">
        <div className="p-6 rounded-xl backdrop-blur-sm border border-white/10 bg-white/5 text-center">
          <p className="text-white/60 text-sm">© 2026 CONTA_PRO Enterprise | Dashboard Executive Intelligence</p>
          <p className="text-white/40 text-xs mt-2">Los datos se actualizan automáticamente cada 2 minutos</p>
        </div>
      </div>
    </div>
  );
};
