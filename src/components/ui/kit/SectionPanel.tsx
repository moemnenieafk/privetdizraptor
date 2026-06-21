import React from 'react';

interface SectionPanelProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode; // Например, кнопка фильтра или селект
  children: React.ReactNode;
  className?: string;
  noDivider?: boolean; // убрать разделительную линию под заголовком
  smallTitle?: boolean; // заголовок размером text-xs (как лейблы карточек)
  bare?: boolean; // без карточного фона/рамки/паддинга — содержимое прямо на фоне страницы
}

export function SectionPanel({ title, icon, action, children, className = '', noDivider = false, smallTitle = false, bare = false }: SectionPanelProps) {
  return (
    <div className={bare ? `relative ${className}` : `bg-card-menu border border-lines-hover rounded p-5 relative overflow-hidden ${className}`}>
      <div className={`flex items-center justify-between ${noDivider ? 'mb-4' : 'mb-5 border-b border-lines-hover pb-3'}`}>
        <div className="flex items-center gap-2 text-text-primary">
          {icon && <span className="text-text-muted flex-shrink-0">{icon}</span>}
          <h2 className={`font-blender-medium ${smallTitle ? 'text-xs' : 'text-[16px] md:text-[18px]'} uppercase tracking-widest m-0 leading-none`}>
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