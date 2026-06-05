// =============================================================================
//  src/config/planFeatures.ts
//  Planes CONTA_PRO — Contadores Independientes + Empresas + Super Admin
// =============================================================================

export type Plan =
  // ── Contadores ──────────────────────────────────────────────────────────────
  | 'TRIAL_CONTADOR'      // 1 mes gratis · hasta 3 negocios
  | 'BASICO_CONTADOR'     // hasta 5 negocios · sin IA
  | 'PLUS_CONTADOR'       // hasta 10 negocios · 50 usos IA/mes
  | 'PRO_CONTADOR'        // hasta 15 negocios · 100 usos IA/mes
  | 'MAESTRO_PLUS'        // contador con ERP completo (planillas, inventario) · a tratar
  // ── Empresas ────────────────────────────────────────────────────────────────
  | 'PLUS_EMPRESA'        // 1 empresa · 100 docs IA · módulos por rubro
  | 'PRO_EMPRESA'         // 1 empresa · 200 docs IA · más módulos
  | 'MAESTRO_EMPRESA'     // ERP personalizado · implementación guiada
  // ── Legados (compatibilidad con código existente) ─────────────────────────
  | 'BASIC'
  | 'PLUS'
  | 'PREMIUM'
  // ── Super admin CONTA_PRO ───────────────────────────────────────────────────
  | 'CONTA_PRO';

export interface PlanFeatures {
  accounting:        boolean;
  sales:             boolean;
  purchases:         boolean;
  reports:           boolean;
  dashboard:         boolean;
  inventory:         boolean;
  payroll:           boolean;
  ocr:               boolean;
  ai:                boolean;
  toolTokens:        boolean;
  advancedBI:        boolean;
  dian:              boolean;
  audit:             boolean;
  integrations:      boolean;
  // Nuevos campos
  maxBusinesses:     number;   // 0 = ilimitado
  aiDocsPerMonth:    number;   // 0 = ilimitado
  fullErp:           boolean;
  costCenters:       boolean;
  multiWarehouse:    boolean;
  superAdmin:        boolean;
}

const UNLIMITED = 0;

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  // ─── CONTADORES ────────────────────────────────────────────────────────────
  TRIAL_CONTADOR: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: false,  payroll: false,  ocr: false,  ai: false,  toolTokens: false,
    advancedBI: false, dian: true,  audit: true,  integrations: false,
    maxBusinesses: 3,  aiDocsPerMonth: 0,  fullErp: false, costCenters: false,
    multiWarehouse: false, superAdmin: false,
  },
  BASICO_CONTADOR: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: false,  payroll: false,  ocr: false,  ai: false,  toolTokens: false,
    advancedBI: false, dian: true,  audit: true,  integrations: false,
    maxBusinesses: 5,  aiDocsPerMonth: 0,  fullErp: false, costCenters: false,
    multiWarehouse: false, superAdmin: false,
  },
  PLUS_CONTADOR: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: false,  payroll: false,  ocr: true,  ai: true,  toolTokens: false,
    advancedBI: false, dian: true,  audit: true,  integrations: false,
    maxBusinesses: 10, aiDocsPerMonth: 50,  fullErp: false, costCenters: false,
    multiWarehouse: false, superAdmin: false,
  },
  PRO_CONTADOR: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: false,  payroll: false,  ocr: true,  ai: true,  toolTokens: false,
    advancedBI: true,  dian: true,  audit: true,  integrations: false,
    maxBusinesses: 15, aiDocsPerMonth: 100, fullErp: false, costCenters: false,
    multiWarehouse: false, superAdmin: false,
  },
  MAESTRO_PLUS: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: true,   payroll: true,  ocr: true,  ai: true,  toolTokens: true,
    advancedBI: true,  dian: true,  audit: true,  integrations: true,
    maxBusinesses: UNLIMITED, aiDocsPerMonth: UNLIMITED, fullErp: true,
    costCenters: true, multiWarehouse: true, superAdmin: false,
  },
  // ─── EMPRESAS ─────────────────────────────────────────────────────────────
  PLUS_EMPRESA: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: true,   payroll: false, ocr: true,  ai: true,  toolTokens: false,
    advancedBI: false, dian: false, audit: false, integrations: false,
    maxBusinesses: 1,  aiDocsPerMonth: 100, fullErp: false, costCenters: false,
    multiWarehouse: false, superAdmin: false,
  },
  PRO_EMPRESA: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: true,   payroll: true,  ocr: true,  ai: true,  toolTokens: false,
    advancedBI: true,  dian: true,  audit: false, integrations: false,
    maxBusinesses: 1,  aiDocsPerMonth: 200, fullErp: false, costCenters: true,
    multiWarehouse: true, superAdmin: false,
  },
  MAESTRO_EMPRESA: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: true,   payroll: true,  ocr: true,  ai: true,  toolTokens: true,
    advancedBI: true,  dian: true,  audit: true,  integrations: true,
    maxBusinesses: UNLIMITED, aiDocsPerMonth: UNLIMITED, fullErp: true,
    costCenters: true, multiWarehouse: true, superAdmin: false,
  },
  // ─── LEGADOS ──────────────────────────────────────────────────────────────
  BASIC: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: false,  payroll: false, ocr: false, ai: false, toolTokens: false,
    advancedBI: false, dian: false, audit: false, integrations: false,
    maxBusinesses: 5, aiDocsPerMonth: 0, fullErp: false, costCenters: false,
    multiWarehouse: false, superAdmin: false,
  },
  PLUS: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: true,   payroll: true,  ocr: true,  ai: true,  toolTokens: false,
    advancedBI: true,  dian: false, audit: false, integrations: false,
    maxBusinesses: 10, aiDocsPerMonth: 50, fullErp: false, costCenters: false,
    multiWarehouse: false, superAdmin: false,
  },
  PREMIUM: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: true,   payroll: true,  ocr: true,  ai: true,  toolTokens: true,
    advancedBI: true,  dian: true,  audit: true,  integrations: true,
    maxBusinesses: UNLIMITED, aiDocsPerMonth: UNLIMITED, fullErp: true,
    costCenters: true, multiWarehouse: true, superAdmin: false,
  },
  // ─── SUPER ADMIN ──────────────────────────────────────────────────────────
  CONTA_PRO: {
    accounting: true,  sales: true,  purchases: true,  reports: true,  dashboard: true,
    inventory: true,   payroll: true,  ocr: true,  ai: true,  toolTokens: true,
    advancedBI: true,  dian: true,  audit: true,  integrations: true,
    maxBusinesses: UNLIMITED, aiDocsPerMonth: UNLIMITED, fullErp: true,
    costCenters: true, multiWarehouse: true, superAdmin: true,
  },
};

export function hasFeature(plan: string, feature: keyof PlanFeatures): boolean {
  return Boolean(PLAN_FEATURES[plan as Plan]?.[feature]);
}

export function getPlanFeatures(plan: string): PlanFeatures {
  return PLAN_FEATURES[plan as Plan] ?? PLAN_FEATURES.BASIC;
}
