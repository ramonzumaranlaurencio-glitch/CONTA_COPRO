import React from 'react';
import { ChevronDown16Regular } from '@fluentui/react-icons';
import { useTenantStore } from '@/hooks/useTenantStore';

export const TenantSelector = () => {
  const { currentCompany, setCompany, companies } = useTenantStore();

  return (
    <div className="tenant-selector">
      <div className="tenant-selector-info">
        <span className="tenant-selector-caption">Empresa Activa</span>
        <select
          value={currentCompany.id}
          onChange={(event) => setCompany(event.target.value)}
          className="tenant-selector-select"
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id} className="text-slate-800">
              {company.ruc} - {company.businessName}
            </option>
          ))}
        </select>
      </div>
      <ChevronDown16Regular className="tenant-selector-icon" />
    </div>
  );
};
