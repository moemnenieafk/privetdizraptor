import React from 'react';

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  inverse?: boolean; // Если true, то чем больше значение — тем хуже (красный цвет). Например, отдача.
  colorClass?: string; // Принудительный цвет бара, например 'bg-[var(--primary)]'
}

export function ProgressBar({ label, value, max, suffix = '', inverse = false, colorClass = 'bg-stone-400' }: ProgressBarProps) {
  // Ограничиваем процент от 0 до 100
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  // Вычисление цвета: если параметр негативный (inverse) и его значение превышает 50% от максимума, делаем красным
  const isDanger = inverse && value > (max / 2);
  const finalColorClass = isDanger ? 'bg-red-500' : colorClass;

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1">
        <span className="text-[12px] font-blender-medium uppercase tracking-wider text-text-secondary">
          {label}
        </span>
        <span className="text-sm font-mono font-bold text-text-primary">
          {value}{suffix}
          <span className="text-text-muted font-normal text-xs ml-1">/ {max}</span>
        </span>
      </div>
      <div className="w-full bg-[#0D0D0F] rounded-full h-2 overflow-hidden border border-lines-hover">
        <div 
          className={`${finalColorClass} h-full rounded-full transition-all duration-700 ease-out`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}