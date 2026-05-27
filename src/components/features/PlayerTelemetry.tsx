'use client';

import { usePathname } from 'next/navigation';
import { getHeaderConfig } from '@/data/headerConfig';

export function PlayerTelemetry() {
  const pathname = usePathname();
  // Вычисляем конфиг (EFT, FRAGO и т.д.) по URL
  const config = getHeaderConfig(pathname || '');

  // В будущем эти данные будут приходить из глобального стейта (Zustand/Redux) или базы данных
  const playerLevel = 42;
  const playerExp = 65; // Прогресс до следующего уровня (в процентах)
  const playerBalance = 12450000;

  return (
    <div className="hidden md:flex items-center gap-4 bg-card-menu/80 backdrop-blur-md border border-lines-hover rounded-md px-4 py-1.5 h-[34px] transition-colors hover:border-primary/30">
      
      {/* Уровень и прогресс-бар */}
      <div className="flex flex-col gap-1 w-[80px]">
        <div className="flex justify-between items-center text-[10px] font-blender-medium text-text-muted leading-none">
          <span>LVL {playerLevel}</span>
          <span>{playerExp}%</span>
        </div>
        <div className="w-full h-1 bg-base rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-1000 ease-out" 
            style={{ width: `${playerExp}%` }} 
          />
        </div>
      </div>

      {/* Вертикальный разделитель */}
      <div className="w-px h-5 bg-lines-hover" />

      {/* Баланс с динамической валютой */}
      <div className="flex items-center gap-1.5 font-blender-medium">
        <span className="text-primary text-xs">{config.currencySymbol}</span>
        <span className="text-text-primary text-sm tracking-wide">
          {playerBalance.toLocaleString('ru-RU')}
        </span>
      </div>
    </div>
  );
}