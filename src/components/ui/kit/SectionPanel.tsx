import React from 'react';

interface SectionPanelProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode; // Например, кнопка фильтра или селект
  children: React.ReactNode;
  className?: string;
}

export function SectionPanel({ title, icon, action, children, className = '' }: SectionPanelProps) {
  return (
    <div className={`bg-card-menu border border-lines-hover rounded p-5 relative overflow-hidden ${className}`}>
      <div className="flex items-center justify-between mb-5 border-b border-lines-hover pb-3">
        <div className="flex items-center gap-2 text-text-primary">
          {icon && <span className="text-text-muted flex-shrink-0">{icon}</span>}
          <h2 className="font-blender-medium text-[16px] md:text-[18px] uppercase tracking-widest m-0 leading-none">
            {title}
          </h2>
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}