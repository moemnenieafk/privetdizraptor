'use client';

import { useRef } from 'react';
import { MapNavStrip } from './MapNavStrip';
import { MapSearch } from './MapSearch';
import { FullscreenToggleButton } from '@/components/ui/FullscreenToggleButton';
import type { MapView } from './map-types';
import type { MapViewerApi, MapQuestLite } from './map-frame-types';

interface NavMap {
  slug: string;
  name: string;
}

interface Props {
  data: MapView;
  navMaps: NavMap[];
  quests: MapQuestLite[];
  searchOpen: boolean;
  onSearchToggle: () => void;
  onSearchClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  apiRef: React.RefObject<MapViewerApi | null>;
}

export function MapTopBar({ data, navMaps, quests, searchOpen, onSearchToggle, onSearchClose, isFullscreen, onToggleFullscreen, apiRef }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);

  const searchBtnCls = `flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors ${
    searchOpen
      ? 'bg-(--primary)/20 border-(--primary)/40 text-(--primary)'
      : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
  }`;

  return (
    <div className="relative flex items-center gap-3 px-3.5 h-14 bg-card-menu shrink-0 overflow-x-auto scrollbar-hidden">
      {/* Слева — поиск (top-left освобождён под выпадашку результатов) */}
      <div ref={anchorRef} className="relative flex flex-1 items-center gap-2">
        {!data.config.staticMap && (
          <>
            <button type="button" onClick={onSearchToggle} title="Поиск (Ctrl+F)" className={searchBtnCls}>
              <span className="icon-mask icon-eft-search-icon h-3.5 w-3.5" />
            </button>
            {searchOpen && (
              <MapSearch markers={data.markers} quests={quests} apiRef={apiRef} anchorRef={anchorRef} onClose={onSearchClose} />
            )}
          </>
        )}
      </div>

      {/* По центру — навигация по картам */}
      <div className="flex shrink-0 items-center justify-center">
        <MapNavStrip maps={navMaps} activeSlug={data.slug} />
      </div>

      {/* Справа — инфо рейда + название + фуллскрин */}
      <div className="flex flex-1 items-center justify-end gap-3">
        {(data.players || data.raidDuration != null) && (
          <div className="hidden shrink-0 items-center gap-3 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary xl:flex">
            {data.players && <span>{data.players} игроков</span>}
            {data.raidDuration != null && <span>{data.raidDuration} мин</span>}
          </div>
        )}
        <h1 className="whitespace-nowrap font-blender-medium text-lg uppercase leading-none tracking-widest text-text-primary">
          {data.name}
        </h1>
        <FullscreenToggleButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
      </div>
    </div>
  );
}
