import React from 'react';

type PageLayoutProps = {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export const PageLayout = ({
  title,
  subtitle,
  action,
  children,
}: PageLayoutProps) => {
  return (
    <div className="main-layout min-h-screen">
      {/* Premium Header */}
      <div className="command-bar sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="flex-1">
            {title && (
              <h1 className="text-xl font-bold text-white uppercase tracking-wider">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-xs text-slate-300 mt-1">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6 py-8 space-y-6 bg-gradient-to-b from-slate-900/5 to-transparent">
        {children}
      </div>
    </div>
  );
};
