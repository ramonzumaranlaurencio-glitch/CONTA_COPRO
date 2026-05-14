import { create } from 'zustand';

type Company = {
  id: string;
  ruc: string;
  businessName: string;
};

type TenantState = {
  currentCompany: Company;
  companies: Company[];
  setCompany: (id: string) => void;
};

const initialCompanies: Company[] = [
  { id: 'tenant-demo', ruc: '20601234567', businessName: 'CONTA_PRO Holding SAC' },
  { id: 'tenant-lima', ruc: '20509876543', businessName: 'Operaciones Lima SAC' },
  { id: 'tenant-norte', ruc: '20455667788', businessName: 'Servicios Norte EIRL' },
];

export const useTenantStore = create<TenantState>((set, get) => ({
  currentCompany: initialCompanies[0],
  companies: initialCompanies,
  setCompany: (id: string) => {
    const company = get().companies.find((item) => item.id === id);
    if (company) {
      set({ currentCompany: company });
    }
  },
}));
