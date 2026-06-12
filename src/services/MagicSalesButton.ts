const API_BASE = '/api/v1';
const TENANT_DEMO = localStorage.getItem('tenant_id') || '11111111-1111-1111-1111-111111111111';
const USER_DEMO = localStorage.getItem('user_id') || '22222222-2222-2222-2222-222222222222';

type ScanResultPayload = {
  scan_data?: {
    nit?: string;
    total?: string | number;
    serie_numero?: string;
    items?: Array<Record<string, unknown>>;
  };
  nit?: string;
  total?: string | number;
  serie?: string;
  items?: Array<Record<string, unknown>>;
};

async function getDevToken(tenantId = TENANT_DEMO) {
  const response = await fetch(`${API_BASE}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: tenantId, user_id: USER_DEMO, role: 'ADMIN' }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  return payload.access_token as string;
}

const api = {
  async post(path: string, body: Record<string, unknown>, tenantId: string) {
    const token = await getDevToken(tenantId);
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Id': tenantId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return { data: await response.json() };
  },
};

const GeometryAI = {
  async analyze(imageFile: File, tenantId: string) {
    const token = await getDevToken(tenantId);
    const formData = new FormData();
    formData.append('file', imageFile);

    const response = await fetch(`${API_BASE}/sales/process-ia`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant-Id': tenantId,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = (await response.json()) as ScanResultPayload;

    // Adaptador para mantener la API scanResult.find/extractTable.
    return {
      raw: payload,
      find(label: string) {
        const key = String(label || '').toUpperCase();
        if (key === 'NIT') return payload.scan_data?.nit || payload.nit || '';
        if (key === 'TOTAL') return payload.scan_data?.total || payload.total || '0';
        if (key === 'SERIE') return payload.scan_data?.serie_numero || payload.serie || '';
        return '';
      },
      extractTable() {
        return payload.scan_data?.items || payload.items || [];
      },
    };
  },
};

export async function handleAIVisionProcess(imageFile: File, tenantId = TENANT_DEMO) {
  // 1. Llamar a la IA para el analisis de pixeles
  const scanResult = await GeometryAI.analyze(imageFile, tenantId);

  // 2. Mapear los datos encontrados (Logica Contable)
  const invoicePayload = {
    nit: String(scanResult.find('NIT') || ''),
    total: parseFloat(String(scanResult.find('TOTAL') || '0')),
    serie: String(scanResult.find('SERIE') || ''),
    items: scanResult.extractTable(),
  };

  // 3. ACTUALIZACION MULTI-NIVEL (Un solo paso)
  const response = await api.post(
    '/orchestrator/sync-sale',
    {
      tenant_id: tenantId,
      payload: invoicePayload,
      create_missing_products: true,
      post_ledger: true,
      sign_sunat: true,
    },
    tenantId,
  );

  return response.data;
}

export default handleAIVisionProcess;

