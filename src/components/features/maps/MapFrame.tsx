'use client';
import { useRouter } from 'next/navigation';
import { mapIconClass, mapOrderIndex } from '@/data/map-icons';

import { MapPickerSheet } from '@/components/features/maps/MapPickerSheet';
import { MapSearchSheet, type MapSearchResult } from '@/components/features/maps/MapSearchSheet';
import { MapQuestSheet } from '@/components/features/maps/MapQuestSheet';
import { MapRaidSheet } from '@/components/features/maps/MapRaidSheet';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapViewerLoader } from './MapViewerLoader';
import { MapTopBar } from './MapTopBar';
import { MapBottomBar } from './MapBottomBar';
import { MapBossDock } from './MapBossDock';
import { MapFloorSwitcher } from './MapFloorSwitcher';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useMapViewStore } from '@/store/useMapViewStore';
import { useMapViewUrlSync } from './useMapViewUrlSync';
import { buildMapFloors, orderFloorsByLevel } from '@/data/eft-map-config';
import type { MapView } from './map-types';
import type { MapViewerApi, MapBossStat, MapQuestLite, MapQuestZone } from './map-frame-types';

interface NavMap {
  slug: string;
  name: string;
  players: string | null;
  raidDuration: number | null;
}

interface Props {
  data: MapView;
  navMaps: NavMap[];
  quests: MapQuestLite[];
  bosses: MapBossStat[];
  questZones: MapQuestZone[];
  focusQuestId?: string;
}

const mapHref = (slug: string) => `/eft/maps/${slug}`;

const searchKind = (t: string): MapSearchResult['kind'] =>
  t === 'extract' ? 'extract' : t === 'quest_zone' ? 'quest' : 'marker';

/**
 * Оболочка карты. Десктоп: TopBar (поиск + навигация). Мобилка: панель 4 иконок живёт
 * в самом вьюере (MobileMapBar), здесь — только шиты (карты + поиск), которые она открывает.
 */
export function MapFrame({ data, navMaps, quests, bosses, questZones, focusQuestId }: Props) {
  const router = useRouter();
  const { isFullscreen, toggle, exit } = useFullscreen();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Этаж живёт в useMapViewStore (§18.1) — эфемерный вид + синк с URL (permalink).
  const activeFloor = useMapViewStore((s) => s.floor);
  const setActiveFloor = useMapViewStore((s) => s.setFloor);
  useMapViewUrlSync();
  const [ready, setReady] = useState(false);
  const apiRef = useRef<MapViewerApi | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const handleReady = useCallback((api: MapViewerApi) => {
    apiRef.current = api;
    setReady(true);
  }, []);

  const focusBoss = useCallback((boss: MapBossStat) => {
    apiRef.current?.focusPoints(boss.spawns);
  }, []);

  const questIds = useMemo(() => quests.map((q) => q.id), [quests]);
  const floors = useMemo(() => buildMapFloors(data.config), [data.config]);
  const floorOrder = useMemo(() => orderFloorsByLevel(floors), [floors]);

  const mobileMaps = useMemo(
    () =>
      [...navMaps]
        .sort((a, b) => mapOrderIndex(a.slug) - mapOrderIndex(b.slug))
        .map((m) => ({ id: m.slug, name: m.name, iconClass: mapIconClass(m.slug) })),
    [navMaps],
  );

  // Поиск по маркерам локации (мобильный шит). Клик — перелёт к маркеру.
  const searchResults = useMemo<MapSearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const out: MapSearchResult[] = [];
    for (let i = 0; i < data.markers.length; i++) {
      const m = data.markers[i];
      if (!m.position) continue;
      const label = m.label ?? '';
      if (!label || !label.toLowerCase().includes(query)) continue;
      out.push({ id: String(i), label, kind: searchKind(m.type) });
      if (out.length >= 40) break;
    }
    return out;
  }, [searchQuery, data.markers]);

  const goToResult = useCallback(
    (r: MapSearchResult) => {
      const m = data.markers[Number(r.id)];
      if (m?.position) apiRef.current?.flyTo(m.position, 5);
    },
    [data.markers],
  );

  // Шаг по визуальному стеку этажей: dir −1 = вверх (выше уровень), +1 = вниз. Без зацикливания.
  const stepFloor = useCallback(
    (dir: -1 | 1) => {
      const cur = useMapViewStore.getState().floor;
      const pos = floorOrder.indexOf(cur);
      if (pos < 0) return;
      const next = Math.min(Math.max(pos + dir, 0), floorOrder.length - 1);
      setActiveFloor(floorOrder[next]);
    },
    [floorOrder, setActiveFloor],
  );

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

  // Хоткеи этажей (только мульти-этаж): ↑/↓ и +/− (осн. клавиатура + NumPad).
  useEffect(() => {
    if (floors.length <= 1) return;
    const handler = (e: KeyboardEvent) => {
      if (searchOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // не перехватываем Ctrl+± (зум браузера) и пр.
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      let dir: -1 | 0 | 1 = 0;
      if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') dir = -1;
      else if (e.key === 'ArrowDown' || e.key === '-') dir = 1;
      if (dir === 0) return;
      e.preventDefault();
      stepFloor(dir);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [floors.length, searchOpen, stepFloor]);

  // Alt + колёсико над вьюпортом → смена этажа. Capture + non-passive: перехват до зума Leaflet.
  useEffect(() => {
    if (floors.length <= 1) return;
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      stepFloor(e.deltaY < 0 ? -1 : 1);
    };
    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [floors.length, stepFloor]);

  // near-fullscreen по умолчанию: край-в-край под шапкой, без bounded-box/паддингов/рамки.
  // Высота — definite (100svh − высота ROW 1 шапки), т.к. Leaflet-контейнеру нужна конкретная
  // высота, а flex-1 от body(min-h-screen) её не доносит. Оффсет 5.5rem под ROW 1 (тюнится).
  // Полный фуллскрин — опция, прячет и шапку.
  const frameCls = isFullscreen
    ? 'fixed inset-0 z-[200] flex flex-col bg-(--color-base)'
    : 'relative flex h-[calc(100svh-5.5rem)] w-full flex-col overflow-hidden bg-(--color-base)';

  return (
    <div className={frameCls}>
      {/* SEO/a11y: видимое имя карты живёт в выпадашке (span в кнопке) — h1 держим здесь. */}
      <h1 className="sr-only">{data.name} — интерактивная карта Escape from Tarkov</h1>
      {/* Десктопный тулбар — прячем на мобилке (лента иконок + поиск живут здесь) */}
      <div className="hidden lg:block">
        <MapTopBar
          data={data}
          navMaps={navMaps}
          quests={quests}
          searchOpen={searchOpen}
          onSearchToggle={() => setSearchOpen((v) => !v)}
          onSearchClose={() => setSearchOpen(false)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggle}
          apiRef={apiRef}
        />
      </div>

      {/* MOBILE-ONLY шиты — открываются панелью из вьюера (MobileMapBar) / нижнего бара */}
      <MapPickerSheet maps={mobileMaps} activeMapId={data.slug} onSelect={(slug) => router.push(mapHref(slug))} />
      <MapSearchSheet results={searchResults} onQueryChange={setSearchQuery} onResultClick={goToResult} />
      <MapQuestSheet quests={quests} mapSlug={data.slug} />
      <MapRaidSheet data={data} />

      <div ref={viewportRef} className="relative min-h-0 flex-1">
        <MapViewerLoader
          data={data}
          onReady={handleReady}
          activeFloor={activeFloor}
          onRequestFloor={setActiveFloor}
        />
        {floors.length > 1 && (
          <MapFloorSwitcher floors={floors} active={activeFloor} onChange={setActiveFloor} />
        )}
        {/* Десктоп-док боссов — плавающий оверлей низ-лево (каркас E11 §3) */}
        <MapBossDock bosses={bosses} onBossClick={focusBoss} />
      </div>
      {/* Нижний бар — только мобилка (десктоп: фуллскрин→верхний бар, боссы→MapBossDock) */}
      <div className="shrink-0 lg:hidden">
        <MapBottomBar
          data={data}
          questIds={questIds}
          bosses={bosses}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggle}
          onBossClick={focusBoss}
        />
      </div>
    </div>
  );
}