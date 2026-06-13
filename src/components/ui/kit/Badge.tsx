import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-card-menu border-lines-hover text-text-muted',
  primary: 'bg-primary/10 border-(--primary) text-(--primary)',
  success: 'bg-green-500/10 border-green-500/30 text-green-400',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  danger: 'bg-red-500/10 border-red-500/30 text-red-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center justify-center 
        px-2 py-0.5 rounded border 
        text-[10px] font-black uppercase tracking-widest
        transition-colors duration-200
        ${variantStyles[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}