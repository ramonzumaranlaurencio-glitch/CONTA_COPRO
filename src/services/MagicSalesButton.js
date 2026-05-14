const API_BASE = '/api/v1';
const TENANT_DEMO = 'tenant-demo';
const USER_DEMO = 'erp.operator';

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
  return payload.access_token;
}

const api = {
  async post(path, body, tenantId) {
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
  async analyze(imageFile, tenantId) {
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

    const payload = await response.json();

    // Adaptador para mantener la API tipo scanResult.find/extractTable del flujo solicitado.
    return {
      raw: payload,
      find(label) {
        const key = String(label || '').toUpperCase();
        if (key === 'RUC') return payload?.scan_data?.ruc || payload?.ruc || '';
        if (key === 'TOTAL') return payload?.scan_data?.total || payload?.total || '0';
        if (key === 'SERIE') return payload?.scan_data?.serie_numero || payload?.serie || '';
        return '';
      },
      extractTable() {
        return payload?.scan_data?.items || payload?.items || [];
      },
    };
  },
};

export async function handleAIVisionProcess(imageFile, tenantId = TENANT_DEMO) {
  // 1. Llamar a la IA para el análisis de píxeles
  const scanResult = await GeometryAI.analyze(imageFile, tenantId);

  // 2. Mapear los datos encontrados (Lógica Contable)
  const invoicePayload = {
    ruc: scanResult.find('RUC'),
    total: parseFloat(scanResult.find('TOTAL')),
    serie: scanResult.find('SERIE'),
    items: scanResult.extractTable(), // Extrae la tabla de productos
  };

  // 3. ACTUALIZACIÓN MULTI-NIVEL (Un solo paso)
  const response = await api.post('/orchestrator/sync-sale', {
    tenant_id: tenantId,
    payload: invoicePayload,
    create_missing_products: true, // Auto-crear si no existe en el Kardex
    post_ledger: true, // Generar asiento contable
    sign_sunat: true, // Enviar a SUNAT si es necesario
  }, tenantId);

  return response.data;
}

export default handleAIVisionProcess;
