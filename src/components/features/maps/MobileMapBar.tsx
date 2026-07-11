'use client';

import { Search, Crosshair, Layers } from 'lucide-react';
import { useMapUiStore } from '@/store/useMapUiStore';
import type { TrackerControls } from './PlayerTracker';

interface MobileMapBarProps {
  activeMapIconClass: string | null | undefined;
  activeMapName: string;
  tracker: TrackerControls;
  hasLayers: boolean;
  layersOpen: boolean;
  onLayersToggle: () => void;
}

/**
 * Мобильная панель управления картой (mobile-only): один ряд из 4 квадратных иконок 56×56 —
 * поиск / карта / позиция / слои. Поиск и карту открывает через глобальный стор (шиты живут
 * в MapFrame); позиция дёргает единый трекер; слои — управляемый drawer (стейт в MapViewerClient).
 */
export function MobileMapBar({
  activeMapIconClass,
  activeMapName,
  tracker,
  hasLayers,
  layersOpen,
  onLayersToggle,
}: MobileMapBarProps) {
  const openSheet = useMapUiStore((s) => s.openSheet);
  const activeSheet = useMapUiStore((s) => s.activeSheet);

  const cell = (active: boolean) =>
    `flex size-14 items-center justify-center rounded-xs transition-colors ${
      active ? 'bg-(--primary) text-(--color-base)' : 'text-text-secondary hover:text-(--primary)'
    }`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[560] flex justify-start p-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
      <div className="pointer-events-auto flex items-center gap-1 rounded-sm border border-lines-hover bg-(--color-base)/90 p-1 backdrop-blur-md">
        {/* Поиск */}
        <button aria-label="Поиск" onClick={() => openSheet('search')} className={cell(activeSheet === 'search')}>
          <Search className="size-6" strokeWidth={2} />
        </button>

        {/* Карта */}
        <button aria-label={`Карта: ${activeMapName}`} onClick={() => openSheet('maps')} className={cell(activeSheet === 'maps')}>
          {activeMapIconClass ? (
            <span className={`icon-mask ${activeMapIconClass} size-7`} />
          ) : (
            <span className="font-blender-medium text-sm uppercase leading-none">{activeMapName.slice(0, 3)}</span>
          )}
        </button>

        {/* Позиция */}
        <button
          aria-label={tracker.active ? 'Слежение включено' : 'Определить позицию'}
          onClick={tracker.toggle}
          disabled={!tracker.supported && !tracker.active}
          className={`${cell(tracker.active)} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <Crosshair className={`size-6 ${tracker.requesting ? 'animate-pulse' : ''}`} strokeWidth={2} />
        </button>

        {/* Слои */}
        {hasLayers && (
          <button aria-label="Слои карты" onClick={onLayersToggle} className={cell(layersOpen)}>
            <Layers className="size-6" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}