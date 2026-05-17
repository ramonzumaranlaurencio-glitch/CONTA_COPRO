import React from 'react';

type PanelsGridProps = {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
};

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
};

const gapClasses = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

export const PanelsGrid = ({ 
  children, 
  columns = 2,
  gap = 'md'
}: PanelsGridProps) => {
  return (
    <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]} auto-rows-max`}>
      {children}
    </div>
  );
};
