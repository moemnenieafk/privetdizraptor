'use client';

import { Search, Crosshair, Layers, Wrench } from 'lucide-react';
import { useMapUiStore } from '@/store/useMapUiStore';
import { MapRestockChip } from './MapRestockChip';
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
 * Верхняя панель карты (mobile-only) в стиле нижнего бара. Раскладка на 3 зоны:
 * слева — завоз + условия рейда + поиск + инструменты, по центру — карта,
 * справа — позиция + слои. Кнопки как FullscreenToggleButton (rounded border
 * border-lines-hover), 28×28. Инструменты/слои/поиск открывают свои шиты.
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
  const searchOpen = useMapUiStore((s) => s.searchOpen);
  const toggleSearch = useMapUiStore((s) => s.toggleSearch);

  const cell = (active: boolean) =>
    `flex size-7 shrink-0 items-center justify-center rounded border transition-colors ${
      active
        ? 'border-(--primary) text-(--primary)'
        : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
    }`;

  return (
    <div className="absolute inset-x-0 top-0 z-[560] flex h-14 items-center bg-card-menu px-3.5 lg:hidden">
      {/* Слева — завоз + условия рейда + поиск + инструменты */}
      <div className="flex flex-1 items-center justify-start gap-2">
        <MapRestockChip />
        <button aria-label="Условия рейда" onClick={() => openSheet('raid')} className={cell(activeSheet === 'raid')}>
          <span className="icon-mask icon-eft-lore-docs h-4 w-4" />
        </button>
        {hasLayers && (
          <button aria-label="Поиск" onClick={toggleSearch} className={cell(searchOpen)}>
            <Search className="size-4" strokeWidth={2} />
          </button>
        )}
        <button aria-label="Инструменты" onClick={() => openSheet('tools')} className={cell(activeSheet === 'tools')}>
          <Wrench className="size-4" strokeWidth={2} />
        </button>
      </div>

      {/* По центру — карта */}
      <div className="flex flex-1 justify-center">
        <button aria-label={`Карта: ${activeMapName}`} onClick={() => openSheet('maps')} className={cell(activeSheet === 'maps')}>
          {activeMapIconClass ? (
            <span className={`icon-mask ${activeMapIconClass} size-4`} />
          ) : (
            <span className="font-blender-medium text-[10px] uppercase leading-none">{activeMapName.slice(0, 3)}</span>
          )}
        </button>
      </div>

      {/* Справа — позиция + слои */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <button
          aria-label={tracker.active ? 'Слежение включено' : 'Определить позицию'}
          onClick={tracker.toggle}
          disabled={!tracker.supported && !tracker.active}
          className={`${cell(tracker.active)} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <Crosshair className={`size-4 ${tracker.requesting ? 'animate-pulse' : ''}`} strokeWidth={2} />
        </button>

        {hasLayers && (
          <button aria-label="Слои карты" onClick={onLayersToggle} className={cell(layersOpen)}>
            <Layers className="size-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
