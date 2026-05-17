import React from 'react';

type PanelSectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'default' | 'warning' | 'error' | 'success';
};

const variantStyles: Record<string, string> = {
  default: 'border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50',
  warning: 'border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-orange-100/50',
  error: 'border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-red-100/50',
  success: 'border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-green-100/50',
};

export const PanelSection = ({ 
  title, 
  subtitle, 
  children, 
  action,
  icon,
  variant = 'default' 
}: PanelSectionProps) => {
  return (
    <div className={`rounded-lg shadow-md border border-slate-200/50 overflow-hidden backdrop-filter backdrop-blur-sm transition-all hover:shadow-lg hover:border-slate-300 ${variantStyles[variant]}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-slate-900/80 to-slate-800/80 border-b border-slate-700/30">
        <div className="flex items-center gap-3 flex-1">
          {icon && <div className="text-white text-lg">{icon}</div>}
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h3>
            {subtitle && <p className="text-xs text-slate-300 mt-1">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Content */}
      <div className="p-4 bg-white/80">
        {children}
      </div>
    </div>
  );
};
