'use client';

import { Layers, Maximize, Minimize, Ruler } from 'lucide-react';
import { MapNavDropdown, type NavMapItem } from './MapNavDropdown';
import { useMapUiStore } from '@/store/useMapUiStore';
import type { MapView } from './map-types';

interface Props {
  data: MapView;
  navMaps: NavMapItem[];
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/** Кнопка-тоггл бара — 36×36 (h-9 w-9), иконка 22px, фон #242426 (card-menu), обводка #313135. */
const toggleCls = (active: boolean): string =>
  `pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-card-menu transition-colors ${
    active
      ? 'border-(--primary) text-(--primary)'
      : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
  }`;

/**
 * Верхний бар карты, раскладка 1:1 с Figma: поиск (лево, 36×36) · ЦЕНТР-группа
 * [линейка · плашка-выпадашка 536×56 · фуллскрин] с гэпами 14px · слои (право, 36×36).
 * flex-1 по краям центрируют группу; поиск липнет к левому краю, слои — к правому.
 */
export function MapTopBar({ data, navMaps, isFullscreen, onToggleFullscreen }: Props) {
  const layersOpen = useMapUiStore((s) => s.layersOpen);
  const toggleLayers = useMapUiStore((s) => s.toggleLayers);
  const searchOpen = useMapUiStore((s) => s.searchOpen);
  const toggleSearch = useMapUiStore((s) => s.toggleSearch);
  const rulerActive = useMapUiStore((s) => s.rulerActive);
  const toggleRuler = useMapUiStore((s) => s.toggleRuler);

  const hasLayers = !data.config.staticMap;

  return (
    <div className="relative flex h-14 items-center px-3.5 border-t border-lines-hover shrink-0 overflow-x-auto scrollbar-hidden">
      {/* Слева — поиск 36×36 (открывает левый drawer «ПОИСК НА ЛОКАЦИИ») */}
      <div className="flex flex-1 items-center">
        {!data.config.staticMap && (
          <button type="button" onClick={toggleSearch} title="Поиск (Ctrl+F)" aria-label="Поиск" className={toggleCls(searchOpen)}>
            <span className="icon-mask icon-eft-search-icon h-5.5 w-5.5" />
          </button>
        )}
      </div>

      {/* Центр-группа: линейка · плашка (536×56) · фуллскрин, гэпы 14px (Figma) */}
      <div className="flex shrink-0 items-center gap-3.5">
        {hasLayers && (
          <button type="button" onClick={toggleRuler} title="Линейка — замер расстояния (ЛКМ точки, ПКМ сброс)" aria-label="Линейка" className={toggleCls(rulerActive)}>
            <Ruler className="h-5.5 w-5.5" />
          </button>
        )}

        <MapNavDropdown
          maps={navMaps}
          activeSlug={data.slug}
          activeName={data.name}
          activePlayers={data.players}
          activeRaidDuration={data.raidDuration}
        />

        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Выйти из полноэкранного (Esc)' : 'Полноэкранный режим'}
          aria-label="Полноэкранный режим"
          className={toggleCls(false)}
        >
          {isFullscreen ? <Minimize className="h-5.5 w-5.5" /> : <Maximize className="h-5.5 w-5.5" />}
        </button>
      </div>

      {/* Справа — слои 36×36 у правого края */}
      <div className="flex flex-1 items-center justify-end">
        {hasLayers && (
          <button type="button" onClick={toggleLayers} title="Слои и фильтры" aria-label="Слои и фильтры" className={toggleCls(layersOpen)}>
            <Layers className="h-5.5 w-5.5" />
          </button>
        )}
      </div>
    </div>
  );
}
