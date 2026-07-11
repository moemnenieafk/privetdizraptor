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
 * Верхняя панель управления картой (mobile-only) — в стиле нижнего бара: полоса bg-card-menu,
 * кнопки как FullscreenToggleButton (rounded border border-lines-hover, ховер --primary),
 * увеличенные до 56×56 под тач. 4 кнопки: поиск / карта / позиция / слои.
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

  // База — как FullscreenToggleButton, но 56×56. Активное состояние подсвечивает рамку/текст.
  const cell = (active: boolean) =>
    `flex size-14 shrink-0 items-center justify-center rounded border transition-colors ${
      active
        ? 'border-(--primary) text-(--primary)'
        : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
    }`;

  return (
    <div className="absolute inset-x-0 top-0 z-[560] flex h-14 items-center gap-3 overflow-x-auto bg-card-menu px-3.5 scrollbar-hidden lg:hidden">
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
  );
}