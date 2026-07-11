'use client';

import { type ReactNode } from 'react';
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { useMapUiStore } from '@/store/useMapUiStore';

interface MobileMapToolbarProps {
  activeMapName: string;
  activeMapIcon: ReactNode;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/**
 * Компактная иконка-линейка в левом-верхнем углу карты (mobile-only).
 * Карта — голая иконка (название живёт в дропдауне), рядом — фуллскрин.
 * z-[110] держит панель поверх фуллскрин-фрейма (z-[100]).
 */
export function MobileMapToolbar({
  activeMapName,
  activeMapIcon,
  isFullscreen,
  onToggleFullscreen,
}: MobileMapToolbarProps) {
  const activeSheet = useMapUiStore((s) => s.activeSheet);
  const toggleSheet = useMapUiStore((s) => s.toggleSheet);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[110] flex items-start p-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xs border border-lines-hover bg-card-menu/95 p-1 backdrop-blur-sm">
        {/* Карта — только иконка; тап открывает дропдаун со списком (там подписи) */}
        <button
          aria-label={`Карта: ${activeMapName}. Сменить локацию`}
          onClick={() => toggleSheet('maps')}
          className="relative flex size-11 items-center justify-center rounded-xs text-(--primary)"
        >
          {activeMapIcon}
          <ChevronDown
            className={`absolute right-0.5 bottom-0.5 size-3 text-text-secondary transition-transform ${activeSheet === 'maps' ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>

        {/* Полный экран — режим мини-карты / второго монитора */}
        <button
          aria-label={isFullscreen ? 'Выйти из полноэкранного' : 'Полный экран'}
          onClick={onToggleFullscreen}
          className="flex size-11 items-center justify-center rounded-xs text-text-secondary"
        >
          {isFullscreen ? <Minimize2 className="size-5" strokeWidth={2} /> : <Maximize2 className="size-5" strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}