'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapViewerLoader } from './MapViewerLoader';
import { MapTopBar } from './MapTopBar';
import { MapBottomBar } from './MapBottomBar';
import { MapFloorSwitcher } from './MapFloorSwitcher';
import { useFullscreen } from '@/hooks/useFullscreen';
import { buildMapFloors } from '@/data/eft-map-config';
import type { MapView } from './map-types';
import type { MapViewerApi, MapBossStat, MapQuestLite, MapQuestZone } from './map-frame-types';

interface NavMap {
  slug: string;
  name: string;
}

interface Props {
  data: MapView;
  navMaps: NavMap[];
  quests: MapQuestLite[];
  bosses: MapBossStat[];
  questZones: MapQuestZone[];
  focusQuestId?: string;
}

/**
 * Единая оболочка карты локации (паттерн фрейма QuestMap): TopBar (поиск + навигация),
 * вьюпорт (Leaflet) и BottomBar (статистика + fullscreen). Владеет fullscreen/поиском и
 * клавиатурой (Ctrl+F / Esc); вьюер общается через императивный MapViewerApi (onReady).
 */
export function MapFrame({ data, navMaps, quests, bosses, questZones, focusQuestId }: Props) {
  const { isFullscreen, toggle, exit } = useFullscreen();
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFloor, setActiveFloor] = useState(0);
  const [ready, setReady] = useState(false);
  const apiRef = useRef<MapViewerApi | null>(null);

  const handleReady = useCallback((api: MapViewerApi) => {
    apiRef.current = api;
    setReady(true);
  }, []);

  const questIds = useMemo(() => quests.map((q) => q.id), [quests]);
  const floors = useMemo(() => buildMapFloors(data.config), [data.config]);

  // Сброс этажа при смене карты — коррекция стейта при смене пропа (без эффекта).
  const [prevSlug, setPrevSlug] = useState(data.slug);
  if (prevSlug !== data.slug) {
    setPrevSlug(data.slug);
    setActiveFloor(0);
  }

  // Дип-линк «Посмотреть на карте»: ?quest=id → перелёт + подсветка зоны квеста.
  useEffect(() => {
    if (!ready || !focusQuestId) return;
    const z = questZones.find((q) => q.questId === focusQuestId);
    if (!z) return;
    if (z.outline.length >= 3) apiRef.current?.highlightZone(z.outline);
    else if (z.position) apiRef.current?.flyTo(z.position, 4);
  }, [ready, focusQuestId, questZones]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        if (isFullscreen) exit();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, searchOpen, exit]);

  const frameCls = isFullscreen
    ? 'fixed inset-0 z-[100] flex flex-col bg-(--color-base)'
    : 'relative flex h-[80vh] min-h-[600px] w-full flex-col overflow-hidden rounded-lg border border-lines-hover bg-(--color-base)';

  return (
    <div className={frameCls}>
      <MapTopBar
        data={data}
        navMaps={navMaps}
        quests={quests}
        searchOpen={searchOpen}
        onSearchToggle={() => setSearchOpen((v) => !v)}
        onSearchClose={() => setSearchOpen(false)}
        apiRef={apiRef}
      />
      <div className="relative min-h-0 flex-1">
        <MapViewerLoader data={data} onReady={handleReady} activeFloor={activeFloor} />
        {floors.length > 1 && (
          <MapFloorSwitcher floors={floors} active={activeFloor} onChange={setActiveFloor} />
        )}
      </div>
      <MapBottomBar
        data={data}
        questIds={questIds}
        bosses={bosses}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggle}
      />
    </div>
  );
}
