'use client';
import { MobileMapToolbar } from '@/components/features/map/MobileMapToolbar';
import { MapPickerSheet } from '@/components/features/map/MapPickerSheet';
import { MapQuestSheet } from '@/components/features/map/MapQuestSheet';
import { MapSearchSheet } from '@/components/features/map/MapSearchSheet';
import { MapFloatingControls } from '@/components/features/map/MapFloatingControls';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapViewerLoader } from './MapViewerLoader';
import { MapTopBar } from './MapTopBar';
import { MapBottomBar } from './MapBottomBar';
import { MapFloorSwitcher } from './MapFloorSwitcher';
import { useFullscreen } from '@/hooks/useFullscreen';
import { buildMapFloors, orderFloorsByLevel } from '@/data/eft-map-config';
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

  // Шаг по визуальному стеку этажей: dir −1 = вверх (выше уровень), +1 = вниз. Без зацикливания.
  const stepFloor = useCallback(
    (dir: -1 | 1) => {
      setActiveFloor((cur) => {
        const pos = floorOrder.indexOf(cur);
        if (pos < 0) return cur;
        const next = Math.min(Math.max(pos + dir, 0), floorOrder.length - 1);
        return floorOrder[next];
      });
    },
    [floorOrder],
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

  // Дефолт-фрейм (решение maps-frame-size): эталон 1100×768 на FullHD — ширина max-w-275 (=1100px,
  // как контент шапки), высота max-h-192 (=768px). Ниже FullHD высота ужимается под вьюпорт
  // (≈220px = шапка + отступы main), чтобы хедер+фрейм влезали без скролла; min-h-105 (=420px) — пол.
  // Fullscreen — без изменений.
  const frameCls = isFullscreen
    ? 'fixed inset-0 z-[100] flex flex-col bg-(--color-base)'
    : 'relative mx-auto flex h-[calc(100svh-220px)] max-h-192 min-h-105 w-full max-w-275 flex-col overflow-hidden rounded-lg border border-lines-hover bg-(--color-base)';

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
      </div>
      <MapBottomBar
        data={data}
        questIds={questIds}
        bosses={bosses}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggle}
        onBossClick={focusBoss}
      />
    </div>
  );
}
