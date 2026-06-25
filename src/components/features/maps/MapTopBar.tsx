'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MapNavStrip } from './MapNavStrip';
import { MapSearch } from './MapSearch';
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
  apiRef: React.RefObject<MapViewerApi | null>;
}

export function MapTopBar({ data, navMaps, quests, searchOpen, onSearchToggle, onSearchClose, apiRef }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);

  const searchBtnCls = `flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors ${
    searchOpen
      ? 'bg-(--primary)/20 border-(--primary)/40 text-(--primary)'
      : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
  }`;

  return (
    <div className="relative flex items-center gap-3 px-3.5 h-14 bg-card-menu shrink-0 overflow-x-auto scrollbar-hidden">
      <div ref={anchorRef} className="relative flex shrink-0 items-center gap-2">
        <Link
          href="/eft/maps"
          title="Все карты"
          className="flex h-7 w-7 items-center justify-center rounded border border-lines-hover text-text-secondary transition-colors hover:border-(--primary)/40 hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
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

      <div className="h-7 w-px shrink-0 bg-lines-hover" />

      <h1 className="shrink-0 whitespace-nowrap font-blender-medium text-lg uppercase leading-none tracking-widest text-text-primary">
        {data.name}
      </h1>

      <div className="flex min-w-0 flex-1 items-center justify-end">
        <MapNavStrip maps={navMaps} activeSlug={data.slug} />
      </div>
    </div>
  );
}
