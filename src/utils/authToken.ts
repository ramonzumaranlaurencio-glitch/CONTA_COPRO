/**
 * Utilidad de token compartida — reemplaza todas las llamadas a dev-token.
 * Prioridad: estado local → localStorage → renovar con /auth/login → vacío (modo offline)
 */

const API_BASE = '/api/v1';
const TENANT_DEFAULT = '11111111-1111-1111-1111-111111111111';

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isTokenAlive(token: string | null | undefined, tenantId?: string): boolean {
  if (!token) return false;
  const p = parseJwt(token);
  if (!p) return false;
  if (tenantId && p.tenant_id && p.tenant_id !== tenantId) return false;
  return ((p.exp as number) || 0) * 1000 > Date.now() + 60_000;
}

async function renewViaLogin(tenantId: string): Promise<string> {
  const username = localStorage.getItem('login_username');
  const password = localStorage.getItem('login_password');
  if (!username || !password) return '';
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, tenant_id: tenantId }),
    });
    if (!res.ok) return '';
    const data = await res.json() as { access_token?: string };
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      return data.access_token;
    }
  } catch { /* sin conexión */ }
  return '';
}

/**
 * Devuelve un token válido. Nunca llama a dev-token.
 * @param candidate token en estado React (puede estar expirado)
 * @param tenantId  tenant actual (opcional)
 */
export async function getAuthToken(
  candidate?: string | null,
  tenantId: string = TENANT_DEFAULT,
): Promise<string> {
  if (isTokenAlive(candidate, tenantId)) return candidate as string;
  const stored = localStorage.getItem('access_token');
  if (isTokenAlive(stored, tenantId)) return stored as string;
  const renewed = await renewViaLogin(tenantId);
  return renewed || stored || candidate || '';
}

/** Cabeceras JSON+Auth listas para fetch */
export function authHeaders(token: string, tenantId: string = TENANT_DEFAULT) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
    'Content-Type': 'application/json',
  };
}

export { TENANT_DEFAULT, API_BASE };
