'use client';
import { useRouter } from 'next/navigation';
import { mapIconClass, mapOrderIndex } from '@/data/map-icons';

import { MapPickerSheet } from '@/components/features/maps/MapPickerSheet';
import { MapQuestSheet } from '@/components/features/maps/MapQuestSheet';
import { MapQuestDetailSheet } from '@/components/features/maps/MapQuestDetailSheet';
import { MapRaidSheet } from '@/components/features/maps/MapRaidSheet';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapViewerLoader } from './MapViewerLoader';
import { MapTopBar } from './MapTopBar';
import { MapSearchDrawer } from './MapSearchDrawer';
import type { HeatPoint } from '@/db/loot-heat';
import { MobileMapBar } from './MobileMapBar';
import { MapMobileDock } from './MapMobileDock';
import { MapBossDock } from './MapBossDock';
import { MapFloorSwitcher } from './MapFloorSwitcher';
import type { EditorialMarkerData, QuestIndexItem, StoryIndexItem } from './EditorialMarkerCard';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useMapViewStore } from '@/store/useMapViewStore';
import { useMapUiStore } from '@/store/useMapUiStore';
import { useMapViewUrlSync } from './useMapViewUrlSync';
import { buildMapFloors, orderFloorsByLevel } from '@/data/eft-map-config';
import type { MapView, MapViewMarker } from './map-types';
import type { MapViewerApi, MapBossStat, MapQuestLite, MapQuestZone } from './map-frame-types';
import type { TaskRaw } from '@/types/quest';

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
  /** Полные таски квестов карты — для master-detail панели QuestDetail в drawer'е поиска. */
  questTasks: TaskRaw[];
  bosses: MapBossStat[];
  questZones: MapQuestZone[];
  /** Редакторские маркеры (editorial_markers) — рендер слоя + карточка по клику. */
  editorialMarkers?: EditorialMarkerData[];
  /** ФАЗА 0 единой системы (unified-markers.md): editorial на языке MapViewMarker — для
   *  drawer-секций/фильтра/ПКМ-цикла (мост на чтении; рендер маркеров остаётся за своим слоем). */
  editorialBridge?: MapViewMarker[];
  /** Точки heatmap плотности денег (EV loose-лута) — режим-toggle. */
  heatPoints?: HeatPoint[];
  /** Юзер admin/editor — показывать кнопку правки на карточке маркера. */
  canEditMarkers?: boolean;
  /** id карты — для постановки нового editorial-маркера (POST на пустой карте). */
  mapId?: string;
  /** Индекс квестов для автокомплита привязки (редакторам). */
  questIndex?: QuestIndexItem[];
  /** Индекс сюжетных историй для привязки (редакторам). */
  storyIndex?: StoryIndexItem[];
  focusQuestId?: string;
  /** Пообъектные точки цели (possibleLocations, game x/z) для ?quest= — пины ВМЕСТО зоны. */
  objectivePoints?: { x: number; z: number; label?: string }[] | null;
}

const mapHref = (slug: string) => `/eft/maps/${slug}`;

/**
 * Оболочка карты. TopBar (десктоп) + адаптивный MapSearchDrawer (десктоп drawer / мобилка
 * bottom-sheet). Прочие мобильные шиты (карты/задания/рейд) — из MobileMapBar/нижнего бара.
 */
export function MapFrame({ data, navMaps, quests, questTasks, bosses, questZones, editorialMarkers, editorialBridge, heatPoints, canEditMarkers, mapId, questIndex, storyIndex, focusQuestId, objectivePoints }: Props) {
  const router = useRouter();
  const { isFullscreen, toggle, exit } = useFullscreen();
  const searchOpen = useMapUiStore((s) => s.searchOpen);
  const setSearchOpen = useMapUiStore((s) => s.setSearchOpen);
  const toggleSearch = useMapUiStore((s) => s.toggleSearch);
  const layersOpen = useMapUiStore((s) => s.layersOpen);
  // Этаж живёт в useMapViewStore (§18.1) — эфемерный вид + синк с URL (permalink).
  const rawFloor = useMapViewStore((s) => s.floor);
  const setActiveFloor = useMapViewStore((s) => s.setFloor);
  useMapViewUrlSync();
  const [ready, setReady] = useState(false);
  const apiRef = useRef<MapViewerApi | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Реальная высота шапки (ROW 1) → фрейм = 100svh − эта высота = ровно остаток вьюпорта, без
  // скролла. Заменяет хардкод 5.5rem. ResizeObserver ловит адаптивный паддинг шапки (clamp) на ресайзе.
  const [headerOffset, setHeaderOffset] = useState(88);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const measure = () => setHeaderOffset(header.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const handleReady = useCallback((api: MapViewerApi) => {
    apiRef.current = api;
    setReady(true);
  }, []);

  // Плавающие body-level доки (StreamDock/StreamStatus/Завоз, fixed z-40/z-70) иначе оказываются
  // ПОВЕРХ наших drawer'ов: page-level drawer заперт в стекинг-контексте фрейма и проваливается
  // под корневые fixed-доки (тот же кейс, что у квест-drawer — см. RestockDock). Решение как там:
  // открыт любой drawer карты → метка data-app-drawer на body → доки её слушают и прячутся.
  useEffect(() => {
    const open = searchOpen || layersOpen;
    document.body.toggleAttribute('data-app-drawer', open);
    return () => document.body.removeAttribute('data-app-drawer');
  }, [searchOpen, layersOpen]);

  const focusBoss = useCallback((boss: MapBossStat) => {
    apiRef.current?.focusPoints(boss.spawns);
  }, []);

  const floors = useMemo(() => buildMapFloors(data.config), [data.config]);
  const floorOrder = useMemo(() => orderFloorsByLevel(floors), [floors]);
  // URL может нести ?floor=N от ДРУГОЙ карты (напр. floor=1 на одноэтажном Лесу/Маяке) — индекс вне
  // диапазона активирует несуществующий этаж, и Поверхность гаснет до 20%. Клампим в валидный диапазон.
  const activeFloor = Math.min(Math.max(rawFloor, 0), Math.max(0, floors.length - 1));

  const mobileMaps = useMemo(
    () =>
      [...navMaps]
        .sort((a, b) => mapOrderIndex(a.slug) - mapOrderIndex(b.slug))
        .map((m) => ({ id: m.slug, name: m.name, iconClass: mapIconClass(m.slug) })),
    [navMaps],
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

  // Дип-линк «Посмотреть на карте»: ?quest=id → изоляция + перелёт + подсветка зоны квеста.
  // Изоляция (слайс C): гасим ВСЕ слои-маркеры (бартер/ключи/лут/спавны) — остаётся только
  // зона-цель квеста (highlightZone рисует полигон напрямую, вне фильтра слоёв). Гасим лишь
  // когда зона найдена, иначе карта осталась бы пустой. Вернуть слои — группами в правой легенде.
  useEffect(() => {
    if (!ready || !focusQuestId) return;
    const pts = objectivePoints;
    const z = questZones.find((q) => q.questId === focusQuestId);
    if (!pts?.length && !z) return;
    // Изоляция (слайс C): гасим чужие слои-маркеры, остаётся только цель квеста.
    const keys = Object.keys(useMapViewStore.getState().activeFilters);
    useMapViewStore.getState().setGroupFilters(keys, false);
    // Пообъектные ТОЧКИ вместо зоны, если у квеста есть possibleLocations; иначе — зона.
    if (pts?.length) apiRef.current?.showObjectivePoints(pts);
    else if (z && z.outline.length >= 3) apiRef.current?.highlightZone(z.outline);
    else if (z?.position) apiRef.current?.flyTo(z.position, 4);
  }, [ready, focusQuestId, questZones, objectivePoints]);

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
        toggleSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, searchOpen, exit, setSearchOpen, toggleSearch]);

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
  // Высота — definite (100svh − реальная высота ROW 1 = headerOffset), т.к. Leaflet-контейнеру
  // нужна конкретная высота, а flex-1 от body(min-h-screen) её не доносит. Фрейм = ровно остаток
  // вьюпорта → страница не скроллится. Полный фуллскрин — опция, прячет и шапку.
  const frameCls = isFullscreen
    ? 'fixed inset-0 z-[200] flex flex-col bg-(--color-base)'
    : 'relative flex w-full flex-col overflow-hidden bg-(--color-base)';
  const frameStyle = isFullscreen ? undefined : { height: `calc(100svh - ${headerOffset}px)` };

  return (
    <div className={frameCls} style={frameStyle}>
      {/* SEO/a11y: видимое имя карты живёт в выпадашке (span в кнопке) — h1 держим здесь. */}
      <h1 className="sr-only">{data.name} — интерактивная карта Escape from Tarkov</h1>
      {/* Десктопный тулбар — плавающий оверлей поверх карты (край-в-край): бар прозрачный,
          сквозь него видно карту. Прячем на мобилке (там своя лента в MobileMapBar). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden lg:block">
        <MapTopBar
          data={data}
          navMaps={navMaps}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggle}
          canEditMarkers={canEditMarkers}
          onPickScreenshot={() => apiRef.current?.pickScreenshotMarker()}
          screenshotSupported={data.config.tileBase ? !!data.config.worldTransform : !!data.config.transform}
        />
      </div>

      {/* Левый drawer «ПОИСК НА ЛОКАЦИИ» (десктоп) — оверлей поверх карты, карту не двигает.
          Только интерактивные карты (у статик-карт нет слоёв/таксономии добычи). */}
      {(!data.config.staticMap || data.config.editorial) && <MapSearchDrawer slug={data.slug} markers={data.markers} quests={quests} questTasks={questTasks} editorialMarkers={editorialMarkers} editorialBridge={editorialBridge} markedRooms={data.markedRooms} apiRef={apiRef} />}

      {/* MOBILE-ONLY шиты — открываются панелью из вьюера (MobileMapBar) / нижнего бара */}
      <MapPickerSheet maps={mobileMaps} activeMapId={data.slug} onSelect={(slug) => router.push(mapHref(slug))} />
      <MapQuestSheet quests={quests} />
      {/* M6 — детали квеста drawer'ом поверх карты (переиспользует QuestDetail + видео + map-пины). */}
      <MapQuestDetailSheet questTasks={questTasks} questZones={questZones} apiRef={apiRef} />
      <MapRaidSheet data={data} />

      <div ref={viewportRef} className="relative min-h-0 flex-1">
        {/* Мобильный верхний бар — плавает над картой (десктоп: MapTopBar выше). */}
        <MobileMapBar data={data} isFullscreen={isFullscreen} onToggleFullscreen={toggle} />

        <MapViewerLoader
          data={data}
          onReady={handleReady}
          activeFloor={activeFloor}
          onRequestFloor={setActiveFloor}
          editorialMarkers={editorialMarkers}
          editorialBridge={editorialBridge}
          heatPoints={heatPoints}
          canEditMarkers={canEditMarkers}
          mapId={mapId}
          questIndex={questIndex}
          storyIndex={storyIndex}
        />
        {/* Десктопный переключатель этажей (на мобилке этаж живёт в нижнем доке). */}
        {floors.length > 1 && (
          <div className="hidden lg:block">
            <MapFloorSwitcher floors={floors} active={activeFloor} onChange={setActiveFloor} />
          </div>
        )}
        {/* Десктоп-док боссов — плавающий оверлей низ-по-центру (каркас E11 §3) */}
        <MapBossDock bosses={bosses} onBossClick={focusBoss} />

        {/* Мобильный нижний док — этаж · босс+спавн · слои/поиск (десктоп: MapTopBar+MapBossDock+MapFloorSwitcher). */}
        <MapMobileDock
          floors={floors}
          activeFloor={activeFloor}
          onStepFloor={stepFloor}
          bosses={bosses}
          onBossClick={focusBoss}
          hasLayers={!data.config.staticMap}
        />
      </div>
    </div>
  );
}