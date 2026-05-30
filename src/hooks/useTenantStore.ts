import { create } from 'zustand';
import type { Rubro } from '../config/itemCatalog';

export type Company = {
  id: string;
  ruc: string;
  businessName: string;
  rubro: Rubro;      // Rubro principal de la empresa
  rubros: Rubro[];   // Todos los rubros aplicables
};

type TenantState = {
  currentCompany: Company;
  companies: Company[];
  setCompany: (id: string) => void;
  setRubro: (rubro: Rubro) => void;
  setRubros: (rubros: Rubro[]) => void;
};

const initialCompanies: Company[] = [
  { id: 'tenant-demo',  ruc: '20601234567', businessName: 'CONTA_PRO Holding SAC',    rubro: 'GE', rubros: ['GE'] },
  { id: 'tenant-lima',  ruc: '20509876543', businessName: 'Operaciones Lima SAC',      rubro: 'CO', rubros: ['CO','GE'] },
  { id: 'tenant-norte', ruc: '20455667788', businessName: 'Servicios Norte EIRL',      rubro: 'DI', rubros: ['DI','CM','GE'] },
];

export const useTenantStore = create<TenantState>((set, get) => ({
  currentCompany: initialCompanies[0],
  companies: initialCompanies,
  setCompany: (id: string) => {
    const company = get().companies.find((item) => item.id === id);
    if (company) set({ currentCompany: company });
  },
  setRubro: (rubro: Rubro) => {
    set(state => ({
      currentCompany: { ...state.currentCompany, rubro },
    }));
  },
  setRubros: (rubros: Rubro[]) => {
    set(state => ({
      currentCompany: { ...state.currentCompany, rubros, rubro: rubros[0] ?? state.currentCompany.rubro },
    }));
  },
}));
