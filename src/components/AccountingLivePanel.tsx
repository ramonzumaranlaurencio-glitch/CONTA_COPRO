import React, { useEffect, useMemo, useState } from 'react';

export type AccountingMovement = {
  id: string;
  date: string;
  period: string;
  glosa: string;
  account: string;
  accountName: string;
  costCenter: string;
  debit: number;
  credit: number;
  module: string;
  status: string;
  hash: string;
  risk: 'BAJO' | 'MEDIO' | 'ALTO';
};

export type ChartAccountItem = {
  code: string;
  name: string;
  account_class: string;
  statement: string;
  nature: string;
  accepts_cost_center: boolean;
  accepts_partner: boolean;
};

type AccountingLivePanelProps = {
  movements?: AccountingMovement[];
  chartAccounts?: ChartAccountItem[];
  loading?: boolean;
  selectedMovementId?: string;
  statusMessage?: string;
  aiMessage?: string;
  onRefresh?: () => void;
  onExportCsv?: () => void;
  onRunAudit?: () => void;
  onSelectMovement?: (movement: AccountingMovement) => void;
};

const money = (value: number) =>
  `$ ${value.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

export default function AccountingLivePanel({
  movements = [],
  chartAccounts = [],
  loading = false,
  selectedMovementId,
  statusMessage = '',
  aiMessage = '',
  onRefresh,
  onExportCsv,
  onRunAudit,
  onSelectMovement,
}: AccountingLivePanelProps) {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(selectedMovementId ?? null);
  const [search, setSearch] = useState('');

  const PUC_CLASSES: Record<string, string> = {
    '1': 'Activos', '2': 'Pasivos', '3': 'Patrimonio',
    '4': 'Ingresos', '5': 'Gastos', '6': 'Costos Ventas',
    '7': 'Costos Producción', '8': 'Orden Deudoras', '9': 'Orden Acreedoras',
  };

  // Plan contable dinámico — usa código exacto de la cuenta (PUC Colombia)
  // Cada cuenta aparece como entrada propia: 1405, 1435, 2408, 2205, etc.
  const plan = useMemo(() => {
    const grouped = new Map<string, { code: string; name: string; type: string }>();

    // Cuentas del backend (plan contable real) — código exacto, sin truncar
    for (const acc of chartAccounts) {
      const code = acc.code;
      if (!grouped.has(code)) {
        const typeLabel =
          acc.statement === 'PROFIT_LOSS'
            ? 'Resultados'
            : acc.statement === 'BALANCE'
            ? 'Balance'
            : acc.statement || 'Otros';
        grouped.set(code, { code, name: acc.name, type: typeLabel });
      }
    }

    // Complementa con cuentas presentes en movimientos pero no en el plan
    for (const m of movements) {
      if (!m.account) continue;
      const code = m.account;
      if (code && !grouped.has(code)) {
        grouped.set(code, {
          code,
          name: m.accountName || `Cuenta ${code}`,
          type: 'Otros',
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [chartAccounts, movements]);

  // Totales por cuenta — asigna cada movimiento a la entrada más específica del plan
  const accountTotals = useMemo(() => {
    const result = new Map<string, { count: number; debit: number; credit: number }>();
    for (const acc of plan) {
      result.set(acc.code, { count: 0, debit: 0, credit: 0 });
    }
    for (const movement of movements) {
      const code = movement.account || '';
      // Busca la entrada del plan más específica que coincida con este movimiento
      let bestMatch = '';
      for (const planCode of result.keys()) {
        if ((code === planCode || code.startsWith(planCode)) && planCode.length > bestMatch.length) {
          bestMatch = planCode;
        }
      }
      if (bestMatch) {
        const total = result.get(bestMatch)!;
        total.count += 1;
        total.debit += movement.debit;
        total.credit += movement.credit;
      }
    }
    return result;
  }, [movements, plan]);

  // Filtrado: por cuenta seleccionada (startsWith) y búsqueda de texto
  const filtered = useMemo(() => {
    return movements.filter((m) => {
      const byAccount =
        selectedAccount === '' ? true : (m.account || '').startsWith(selectedAccount);
      const bySearch = `${m.glosa} ${m.account} ${m.accountName} ${m.module} ${m.hash}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return byAccount && bySearch;
    });
  }, [movements, selectedAccount, search]);

  useEffect(() => {
    if (selectedMovementId) {
      setSelectedId(selectedMovementId);
    }
  }, [selectedMovementId]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const debe = filtered.reduce((a, b) => a + b.debit, 0);
  const haber = filtered.reduce((a, b) => a + b.credit, 0);

  return (
    <section className="sap-card" style={{ marginTop: 0, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="sap-card-head">
        <div>
          <h3>Plan Contable Vivo | Libro Diario y Mayor Analítico</h3>
          <p>{statusMessage || 'Plan contable actualizado desde el sistema.'}</p>
        </div>

        <div className="sap-actions">
          <input
            className="sap-search"
            placeholder="Buscar cuenta, glosa, NIT, hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="sap-btn" type="button" onClick={onRefresh}>Actualizar</button>
          <button className="sap-btn" type="button" onClick={onExportCsv}>CSV</button>
          <button className="sap-btn blue" type="button" onClick={onRunAudit}>Auditoría IA</button>
        </div>
      </div>

      <div className="sap-live-grid" style={{ flex: 1, minHeight: 0 }}>
        <aside className="sap-plan-list">
          {/* Opción: Todas las cuentas */}
          <button
            type="button"
            className={`sap-account ${selectedAccount === '' ? 'active' : ''}`}
            onClick={() => setSelectedAccount('')}
          >
            <span>∑</span>
            <div>
              <strong>Todas las cuentas</strong>
              <small>{movements.length} movimientos</small>
            </div>
          </button>

          {/* Plan contable dinámico */}
          {plan.length === 0 && !loading && (
            <div style={{ padding: '12px 8px', color: '#64748b', fontSize: 12 }}>
              Sin cuentas registradas aún. Registre compras, ventas o asientos.
            </div>
          )}
          {plan.map((account, idx) => {
            const total = accountTotals.get(account.code) ?? { count: 0, debit: 0, credit: 0 };
            const saldo = total.debit - total.credit;
            const cls = account.code[0];
            const prevCls = idx > 0 ? plan[idx - 1].code[0] : null;
            const showHeader = cls !== prevCls;
            return (
              <React.Fragment key={account.code}>
                {showHeader && (
                  <div className="sap-plan-class">
                    Clase {cls} · {PUC_CLASSES[cls] || 'Otras'}
                  </div>
                )}
                <button
                  type="button"
                  className={`sap-account ${selectedAccount === account.code ? 'active' : ''}`}
                  onClick={() => setSelectedAccount(account.code)}
                >
                  <span>{account.code}</span>
                  <div>
                    <strong>{account.name}</strong>
                    <small>
                      {account.type} · {total.count} mov.
                      {total.count > 0 && ` · ${money(Math.abs(saldo))}`}
                    </small>
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </aside>

        <div className="sap-ledger-wrap">
          <table className="sap-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Periodo</th>
                <th>Glosa</th>
                <th>Cuenta</th>
                <th>CC</th>
                <th>Debe</th>
                <th>Haber</th>
                <th>Estado</th>
                <th>Módulo</th>
                <th>Hash</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                    ⟳ Cargando datos desde la API...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 24 }}>
                    {movements.length === 0
                      ? 'Sin movimientos. Registre compras, ventas o asientos para ver datos.'
                      : 'Sin movimientos para la cuenta o búsqueda seleccionada.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelectedId(row.id);
                      onSelectMovement?.(row);
                    }}
                    style={selected?.id === row.id ? { outline: '2px solid #2563eb', outlineOffset: '-2px' } : undefined}
                  >
                    <td>{row.date}</td>
                    <td>{row.period}</td>
                    <td>{row.glosa}</td>
                    <td>
                      <strong>{row.account}</strong>
                      <br />
                      <small>{row.accountName}</small>
                    </td>
                    <td>{row.costCenter}</td>
                    <td className="money">{row.debit ? money(row.debit) : '-'}</td>
                    <td className="money">{row.credit ? money(row.credit) : '-'}</td>
                    <td>
                      <span className={`sap-badge ${row.risk.toLowerCase()}`}>{row.status}</span>
                    </td>
                    <td>{row.module}</td>
                    <td className="hash">{row.hash}</td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={5}>Totales visibles</td>
                <td className="money">{money(debe)}</td>
                <td className="money">{money(haber)}</td>
                <td colSpan={3}>{Math.abs(debe - haber) < 0.01 ? 'Cuadrado ✓' : `Diferencia: ${money(Math.abs(debe - haber))}`}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <aside className="sap-detail">
          <h3>Detalle Analítico</h3>

          {selected ? (
            <>
              <p><b>Asiento:</b> {selected.id}</p>
              <p><b>Cuenta:</b> {selected.account} - {selected.accountName}</p>
              <p><b>Centro costo:</b> {selected.costCenter || '—'}</p>
              <p><b>Módulo:</b> {selected.module}</p>
              <p><b>Estado:</b> {selected.status}</p>
              <p><b>Hash:</b> <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{selected.hash}</span></p>

              <h4 style={{ marginTop: 12 }}>Recomendación IA</h4>
              <ul>
                <li>{selected.risk === 'ALTO' ? 'Priorizar revisión del asiento y su cuadre.' : 'Movimiento sin alerta crítica visible.'}</li>
                <li>Validar centro de costo en cuentas clase 6/9.</li>
                <li>Verificar respaldo XML/PDF y trazabilidad del hash.</li>
                <li>{aiMessage || 'Ejecuta Auditoría IA para ampliar recomendaciones.'}</li>
              </ul>
            </>
          ) : (
            <p style={{ color: '#94a3b8' }}>Selecciona una cuenta con movimientos para ver el detalle analítico.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
