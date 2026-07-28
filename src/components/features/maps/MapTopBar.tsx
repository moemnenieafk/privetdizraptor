'use client';

import { useRef } from 'react';
import { Layers, Ruler } from 'lucide-react';
import { MapNavDropdown, type NavMapItem } from './MapNavDropdown';
import { MapSearch } from './MapSearch';
import { FullscreenToggleButton } from '@/components/ui/FullscreenToggleButton';
import { useMapUiStore } from '@/store/useMapUiStore';
import type { MapView } from './map-types';
import type { MapViewerApi, MapQuestLite } from './map-frame-types';

interface Props {
  data: MapView;
  navMaps: NavMapItem[];
  quests: MapQuestLite[];
  searchOpen: boolean;
  onSearchToggle: () => void;
  onSearchClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  apiRef: React.RefObject<MapViewerApi | null>;
}

/** Класс кнопки-тоггла бара (стиль эталонной кнопки поиска / FullscreenToggleButton). */
const toggleCls = (active: boolean): string =>
  `flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors ${
    active
      ? 'bg-(--primary)/20 border-(--primary)/40 text-(--primary)'
      : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
  }`;

export function MapTopBar({ data, navMaps, quests, searchOpen, onSearchToggle, onSearchClose, isFullscreen, onToggleFullscreen, apiRef }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const layersOpen = useMapUiStore((s) => s.layersOpen);
  const toggleLayers = useMapUiStore((s) => s.toggleLayers);
  const rulerActive = useMapUiStore((s) => s.rulerActive);
  const toggleRuler = useMapUiStore((s) => s.toggleRuler);

  const hasLayers = !data.config.staticMap;

  return (
    <div className="relative flex items-center gap-3 px-3.5 h-14 bg-card-menu shrink-0 overflow-x-auto scrollbar-hidden">
      {/* Слева — поиск (top-left освобождён под выпадашку результатов) */}
      <div ref={anchorRef} className="relative flex flex-1 items-center gap-2">
        {!data.config.staticMap && (
          <>
            <button type="button" onClick={onSearchToggle} title="Поиск (Ctrl+F)" className={toggleCls(searchOpen)}>
              <span className="icon-mask icon-eft-search-icon h-3.5 w-3.5" />
            </button>
            {searchOpen && (
              <MapSearch markers={data.markers} quests={quests} apiRef={apiRef} anchorRef={anchorRef} onClose={onSearchClose} />
            )}
          </>
        )}
      </div>

      {/* Линейка (measure) — центр-слева, перед выпадашкой */}
      {hasLayers && (
        <button
          type="button"
          onClick={toggleRuler}
          title="Линейка — замер расстояния (ЛКМ точки, ПКМ сброс)"
          aria-label="Линейка"
          className={toggleCls(rulerActive)}
        >
          <Ruler className="h-3.5 w-3.5" />
        </button>
      )}

      {/* По центру — выпадашка выбора карты (иконка+имя+игроки+время+▼) */}
      <div className="flex shrink-0 items-center justify-center">
        <MapNavDropdown
          maps={navMaps}
          activeSlug={data.slug}
          activeName={data.name}
          activePlayers={data.players}
          activeRaidDuration={data.raidDuration}
        />
      </div>

      {/* Справа — тогглы (Слои · фуллскрин); имя+инфо рейда — в выпадашке, трекер — низ-право */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="flex shrink-0 items-center gap-2">
          {hasLayers && (
            <button
              type="button"
              onClick={toggleLayers}
              title="Слои и фильтры"
              aria-label="Слои и фильтры"
              className={toggleCls(layersOpen)}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
          )}

          <FullscreenToggleButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
        </div>
      </div>
    </div>
  );
}
