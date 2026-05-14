import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    title: { display: false },
  },
  scales: {
    y: {
      ticks: {
        callback: (value: unknown) => `S/ ${value}`,
      },
    },
  },
};

const API_BASE = '/api/v1';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';

type FinancialPack = {
  income_statement?: {
    revenue?: string;
    cost?: string;
    expenses?: string;
    gross_profit?: string;
    operating_profit?: string;
  };
  balance_sheet?: {
    assets?: string;
    liabilities?: string;
    equity?: string;
    check?: string;
  };
  cash_flow?: {
    opening_cash?: string;
    net_cash_movement?: string;
    ending_cash?: string;
  };
  ratios?: {
    operating_margin?: string;
    debt_to_equity?: string;
    financial_leverage?: string;
  };
  comparison?: {
    balance_sheet?: {
      period?: string;
      assets?: string;
      liabilities?: string;
      equity?: string;
      check?: string;
    };
    income_statement?: {
      period?: string;
      revenue?: string;
      cost?: string;
      expenses?: string;
      gross_profit?: string;
      operating_profit?: string;
    };
    cash_flow?: {
      period?: string;
      opening_cash?: string;
      net_cash_movement?: string;
      ending_cash?: string;
    };
  };
};

const parseAmount = (value?: string) => {
  const parsed = Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number) => `S/ ${value.toLocaleString('es-PE', { maximumFractionDigits: 2 })}`;

export const FinancialDashboard = () => {
  const [pack, setPack] = useState<FinancialPack | null>(null);
  const [token, setToken] = useState<string>('');
  const [message, setMessage] = useState<string>('Cargando reporte financiero...');

  const downloadBase64 = (filename: string, mimeType: string, base64Content: string) => {
    const binary = atob(base64Content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const requestExport = async (format: 'xlsx' | 'pdf') => {
    if (!token) {
      setMessage('Token no disponible para exportacion.');
      return;
    }
    const response = await fetch(
      `${API_BASE}/reports/financial-pack/${format}?year=2026&month=5&compare_year=2025&compare_month=5`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': TENANT_ID,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`No se pudo exportar ${format.toUpperCase()}`);
    }
    const payload = await response.json();
    downloadBase64(payload.filename, payload.mime_type, payload.content_base64);
    setMessage(`Exportacion ${format.toUpperCase()} completada.`);
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const tokenResponse = await fetch(`${API_BASE}/auth/dev-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: TENANT_ID, user_id: 'erp.operator', role: 'ADMIN' }),
      });
      if (!tokenResponse.ok) {
        setMessage('No se pudo generar token de sesion.');
        return;
      }
      const tokenPayload = await tokenResponse.json();
      if (active) {
        setToken(tokenPayload.access_token);
      }

      const response = await fetch(`${API_BASE}/reports/financial-pack?year=2026&month=5&compare_year=2025&compare_month=5`, {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
          'X-Tenant-Id': TENANT_ID,
        },
      });
      if (!response.ok) {
        setMessage('No se pudo cargar financial pack.');
        return;
      }

      const payload = (await response.json()) as FinancialPack;
      if (active) {
        setPack(payload);
        setMessage('Reporte financiero actualizado.');
      }
    };

    bootstrap().catch(() => {
      if (active) {
        setPack(null);
        setMessage('Error cargando reporte financiero.');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const dynamicData = useMemo(() => {
    const revenue = parseAmount(pack?.income_statement?.revenue);
    const cost = parseAmount(pack?.income_statement?.cost);
    const expenses = parseAmount(pack?.income_statement?.expenses);
    const operatingProfit = parseAmount(pack?.income_statement?.operating_profit);
    const compRevenue = parseAmount(pack?.comparison?.income_statement?.revenue);
    const compCost = parseAmount(pack?.comparison?.income_statement?.cost);
    const compExpenses = parseAmount(pack?.comparison?.income_statement?.expenses);
    const compOperatingProfit = parseAmount(pack?.comparison?.income_statement?.operating_profit);

    return {
      labels: ['Periodo Actual', 'Periodo Comparado'],
      datasets: [
        {
          label: 'Ingresos',
          data: [revenue, compRevenue],
          backgroundColor: '#0078d4',
          borderRadius: 4,
        },
        {
          label: 'Costos',
          data: [cost, compCost],
          backgroundColor: '#6B7280',
          borderRadius: 4,
        },
        {
          label: 'Egresos',
          data: [expenses, compExpenses],
          backgroundColor: '#8db8e7',
          borderRadius: 4,
        },
        {
          label: 'Utilidad Operativa',
          data: [operatingProfit, compOperatingProfit],
          backgroundColor: '#16a34a',
          borderRadius: 4,
        },
      ],
    };
  }, [pack]);

  const leverage = parseAmount(pack?.ratios?.financial_leverage);
  const margin = parseAmount(pack?.ratios?.operating_margin);
  const debtToEquity = parseAmount(pack?.ratios?.debt_to_equity);

  const assets = parseAmount(pack?.balance_sheet?.assets);
  const liabilities = parseAmount(pack?.balance_sheet?.liabilities);
  const equity = parseAmount(pack?.balance_sheet?.equity);
  const check = parseAmount(pack?.balance_sheet?.check);
  const compAssets = parseAmount(pack?.comparison?.balance_sheet?.assets);
  const compLiabilities = parseAmount(pack?.comparison?.balance_sheet?.liabilities);
  const compEquity = parseAmount(pack?.comparison?.balance_sheet?.equity);
  const compCheck = parseAmount(pack?.comparison?.balance_sheet?.check);
  const currentPeriod = pack?.period ?? '2026-05';
  const comparePeriod = pack?.comparison?.balance_sheet?.period ?? pack?.comparison?.income_statement?.period ?? '2025-05';

  const openCash = parseAmount(pack?.cash_flow?.opening_cash);
  const netCash = parseAmount(pack?.cash_flow?.net_cash_movement);
  const endCash = parseAmount(pack?.cash_flow?.ending_cash);
  const compOpenCash = parseAmount(pack?.comparison?.cash_flow?.opening_cash);
  const compNetCash = parseAmount(pack?.comparison?.cash_flow?.net_cash_movement);
  const compEndCash = parseAmount(pack?.comparison?.cash_flow?.ending_cash);

  return (
    <div className="grid grid-cols-12 gap-6 p-6 bg-[#F3F2F1] h-full">
      <div className="col-span-3 bg-white p-4 shadow-sm border-b-2 border-blue-600 rounded">
        <p className="text-xs font-bold text-slate-500 uppercase">Apalancamiento Financiero</p>
        <h2 className="text-2xl font-bold text-slate-800">{leverage.toFixed(2)}</h2>
        <p className="text-xs text-green-600">Margen operativo: {margin.toFixed(2)} | Deuda/Patrimonio: {debtToEquity.toFixed(2)}</p>
      </div>

      <div className="col-span-9 bg-white p-6 shadow-md rounded-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-700">Rendimiento Mensual Comparativo</h3>
          <div className="flex gap-2">
            <button type="button" className="btn-fluent-secondary text-xs" onClick={() => requestExport('xlsx')}>Descargar XLSX</button>
            <button type="button" className="btn-fluent-secondary text-xs" onClick={() => requestExport('pdf')}>Descargar PDF</button>
          </div>
        </div>
        <div className="h-64">
          <Bar data={dynamicData} options={chartOptions} />
        </div>
      </div>

      <div className="col-span-12 text-xs text-slate-600">{message}</div>

      <div className="col-span-12 bg-white shadow-xl rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="p-4 text-left">ESTADO DE SITUACION FINANCIERA</th>
              <th className="p-4 text-right">{currentPeriod} (PEN)</th>
              <th className="p-4 text-right">{comparePeriod} (PEN)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-slate-50 font-bold"><td className="p-3" colSpan={3}>ACTIVO</td></tr>
            <tr><td className="p-3 pl-8 text-slate-600">Activos Totales</td><td className="p-3 text-right">{formatMoney(assets)}</td><td className="p-3 text-right">{formatMoney(compAssets)}</td></tr>
            <tr><td className="p-3 pl-8 text-slate-600">Pasivos Totales</td><td className="p-3 text-right">{formatMoney(liabilities)}</td><td className="p-3 text-right">{formatMoney(compLiabilities)}</td></tr>
            <tr><td className="p-3 pl-8 text-slate-600">Patrimonio</td><td className="p-3 text-right">{formatMoney(equity)}</td><td className="p-3 text-right">{formatMoney(compEquity)}</td></tr>
            <tr><td className="p-3 pl-8 text-slate-600">Check Activo-Pasivo-Patrimonio</td><td className="p-3 text-right">{formatMoney(check)}</td><td className="p-3 text-right">{formatMoney(compCheck)}</td></tr>
            <tr className="bg-slate-50 font-bold"><td className="p-3" colSpan={3}>FLUJO DE CAJA</td></tr>
            <tr><td className="p-3 pl-8 text-slate-600">Caja Inicial</td><td className="p-3 text-right">{formatMoney(openCash)}</td><td className="p-3 text-right">{formatMoney(compOpenCash)}</td></tr>
            <tr><td className="p-3 pl-8 text-slate-600">Movimiento Neto</td><td className="p-3 text-right">{formatMoney(netCash)}</td><td className="p-3 text-right">{formatMoney(compNetCash)}</td></tr>
            <tr><td className="p-3 pl-8 text-slate-600">Caja Final</td><td className="p-3 text-right">{formatMoney(endCash)}</td><td className="p-3 text-right">{formatMoney(compEndCash)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
