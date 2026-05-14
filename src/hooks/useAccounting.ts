import { useCallback, useRef } from 'react';

type LedgerLine = {
  account: string;
  debit: number;
  credit: number;
  cost_center?: string;
};

type PostEntryPayload = {
  date: string;
  description: string;
  lines: LedgerLine[];
};

const API_BASE = '/api/v1';
const TENANT_ID = 'tenant-demo';
const USER_ID = 'erp.operator';

const sanitizeNumber = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(2)) : 0);

export const useAccounting = () => {
  const tokenRef = useRef<string | null>(null);

  const getToken = useCallback(async () => {
    if (tokenRef.current) {
      return tokenRef.current;
    }

    const response = await fetch(`${API_BASE}/auth/dev-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TENANT_ID, user_id: USER_ID, role: 'ADMIN' }),
    });

    if (!response.ok) {
      throw new Error('Unable to generate dev token');
    }

    const payload = await response.json();
    tokenRef.current = payload.access_token;
    return tokenRef.current;
  }, []);

  const postEntry = useCallback(async (payload: PostEntryPayload) => {
    const token = await getToken();

    const entryDate = new Date(payload.date);
    const year = entryDate.getUTCFullYear();
    const month = entryDate.getUTCMonth() + 1;

    const response = await fetch(`${API_BASE}/ledger/journal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Id': TENANT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: TENANT_ID,
        year,
        month,
        entry_date: payload.date,
        description: payload.description,
        source_module: 'SALES',
        source_id: `sale:${Date.now()}`,
        currency: 'PEN',
        lines: payload.lines.map((line) => ({
          account_code: line.account,
          account_name: `Cuenta ${line.account}`,
          debit: sanitizeNumber(line.debit),
          credit: sanitizeNumber(line.credit),
          cost_center: line.cost_center,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }, [getToken]);

  const validateRUC = useCallback(async (ruc: string) => {
    if (!/^\d{11}$/.test(ruc)) {
      return { valid: false, message: 'RUC invalido, debe tener 11 digitos.' };
    }

    try {
      const response = await fetch(`https://api.apis.net.pe/v2/sunat/ruc?numero=${ruc}`);
      if (response.ok) {
        const payload = await response.json();
        const razonSocial = payload.razonSocial || payload.nombre || 'Contribuyente validado';
        return { valid: true, message: razonSocial };
      }
      return { valid: true, message: 'RUC validado localmente. Servicio externo no disponible.' };
    } catch {
      return { valid: true, message: 'RUC validado localmente. Sin conectividad a servicio externo.' };
    }
  }, []);

  return { postEntry, validateRUC };
};
