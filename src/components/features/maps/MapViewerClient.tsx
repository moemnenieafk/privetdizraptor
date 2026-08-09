'use client';

import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crosshair, Flame, LocateFixed, Minus, Navigation, Pencil, Plus } from 'lucide-react';
import { buildMapFloors, type EftMapConfig } from '@/data/eft-map-config';
import { MapMarkerEditor } from './MapMarkerEditor';
import { MapLayersDrawer } from './MapLayersDrawer';
import { MarkerDeletionDrawer } from './MarkerDeletionDrawer';
import { useEftTracker } from './PlayerTracker';
import { MapToolsSheet } from './MapToolsSheet';
import { useMapUiStore } from '@/store/useMapUiStore';
import { useMapViewStore } from '@/store/useMapViewStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import { useSquadStore, type SquadPose } from '@/store/useSquadStore';
import { useMyKeysStore } from '@/store/useMyKeysStore';
import { useLootFilterStore } from '@/store/useLootFilterStore';
import { useStoryFilterStore } from '@/store/useStoryFilterStore';
import { useHeatmapStore } from '@/store/useHeatmapStore';
import type { HeatPoint } from '@/db/loot-heat';
import { useSquad } from './useSquad';
import { SquadDrawer } from './SquadDrawer';
import { LockKeyCard } from './LockKeyCard';
import { ExtractCard } from './ExtractCard';
import { floorIndexForHeight } from '@/lib/eft-screenshot';
import { useRouter } from 'next/navigation';
import { manualMarkerIcon } from './manual-marker-icon';
import { markerColor, isItemId, LINK_KIND_COLOR } from '@/data/map-marker-icons';
import { EditorialMarkerCard, type EditorialMarkerData, type QuestIndexItem, type StoryIndexItem } from './EditorialMarkerCard';
import { ALL_LAYER_ITEMS, layerKeyForMarker, lodVisibleAt } from './map-layers';
import { categoryLabel } from '@/data/map-markers/categories';
import type { MapView, MapViewMarker } from './map-types';
import type { MapViewerApi } from './map-frame-types';

/* ───────────────── проекция (порт из open-source tarkov-dev, MIT) ───────────────── */
// Кастомный CRS зашивает transform + поворот в проекцию: маркеры ставятся в сырых
// игровых [z, x], подложка — в bounds, всё совмещается без CSS-поворота.

function applyRotation(latLng: L.LatLng, rotation: number): L.LatLng {
  if (!latLng.lng && !latLng.lat) return L.latLng(0, 0);
  if (!rotation) return latLng;
  const a = (rotation * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const x = latLng.lng;
  const y = latLng.lat;
  return L.latLng(x * sin + y * cos, x * cos - y * sin);
}

function makeCRS(cfg: EftMapConfig): L.CRS {
  const t = cfg.transform ?? [1, 0, 1, 0];
  const scaleX = t[0];
  const scaleY = t[2] * -1;
  const marginX = t[1];
  const marginY = t[3];
  const rot = cfg.coordinateRotation || 0;
  return L.Util.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(scaleX, marginX, scaleY, marginY),
    projection: L.Util.extend({}, L.Projection.LonLat, {
      project: (latLng: L.LatLng) => L.Projection.LonLat.project(applyRotation(latLng, rot)),
      unproject: (point: L.Point) => applyRotation(L.Projection.LonLat.unproject(point), -rot),
    }),
  }) as unknown as L.CRS;
}

const bb = (b: [[number, number], [number, number]]): L.LatLngBounds =>
  L.latLngBounds([b[0][1], b[0][0]], [b[1][1], b[1][0]]);

const ll = (p: { x: number; z: number }): [number, number] => [p.z, p.x];

// Тайловая карта: тип метки (из ручной разметки, ключ = цвет) → цвет + RU-подпись.
// Совпадает с палитрой сайта; keydoor — жёлтая дверь-ключ V4DYA (ключ привяжем позже).
const HD_MARKER_STYLE: Record<string, { color: string; label: string }> = {
  extract: { color: '#5FB85B', label: 'Выход' },
  transit: { color: '#FF7724', label: 'Переход' },
  spawn: { color: '#E6A23C', label: 'Спавн' },
  loot: { color: '#E68E25', label: 'Лут' },
  container: { color: '#9A8866', label: 'Контейнер' },
  lock: { color: '#BDA550', label: 'Замок' },
  keydoor: { color: '#FFCF00', label: 'Дверь-ключ' },
};

/* ───────────────── маркеры ───────────────── */
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const spawnKind = (m: MapViewMarker): string => {
  if (m.spawnFaction) return m.spawnFaction;
  const c = m.categories ?? [];
  if (c.includes('boss')) return 'boss';
  if (c.includes('sniper')) return 'sniper';
  const s = (m.sides ?? [])[0]?.toLowerCase();
  return s === 'pmc' || s === 'scav' ? s : 'all';
};

/** Иконка маркера вьюера — через общий резолвер (webp/svg/плейсхолдер), без подписи (она в тултипе). */
const markerDivIcon = (m: MapViewMarker): L.DivIcon => manualMarkerIcon(m, false, false);

/** Иконка editorial-маркера — единая для слоя карты и курсора move-режима. */
function editorialIcon(m: EditorialMarkerData): L.DivIcon {
  const meta =
    m.type === 'hazard' && m.category
      ? { hazardType: m.category }
      : m.type === 'quest_zone' && m.category
        ? { objectiveKind: m.category }
        : undefined;
  return manualMarkerIcon({
    type: m.type,
    category: m.category ?? undefined,
    faction: m.faction ?? undefined,
    label: m.title,
    meta,
    linkKind: m.linkKind,
    linkedItemId: m.type === 'loot' && isItemId(m.category) ? m.category ?? undefined : undefined,
  });
}

/** Иконка тиммейта (сквад): стрелка в его цвете + ник под ней. nick эскейпится (user input в HTML). */
function teammateIcon(color: string, rotationDeg: number, nick: string): L.DivIcon {
  return L.divIcon({
    className: 'cta-squad-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html:
      `<div style="position:relative;width:28px;height:28px">` +
      `<div style="width:28px;height:28px;transform:rotate(${rotationDeg}deg);filter:drop-shadow(0 0 4px rgba(0,0,0,.6))">` +
      `<svg viewBox="0 0 24 24" width="28" height="28" fill="${color}"><path d="M12 2 L20 21 L12 16 L4 21 Z"/></svg></div>` +
      `<span style="position:absolute;top:28px;left:50%;transform:translateX(-50%);white-space:nowrap;` +
      `font-size:10px;font-weight:600;color:${color};text-shadow:0 0 3px #000,0 0 2px #000">${esc(nick)}</span>` +
      `</div>`,
  });
}

/** Синканный маркер tarkov.dev → форма editorial-оверрайда (предзаполнение карточки, source_marker_id). */
function syncedToEditorial(m: MapViewMarker, mapId: string): EditorialMarkerData {
  const type =
    m.type === 'loot_loose' ? 'loot' : m.type === 'loot_container' ? 'container' : m.type === 'quest' ? 'quest_zone' : m.type;
  const category = m.type === 'loot_loose' && m.linkedItemId ? m.linkedItemId : m.category ?? null;
  return {
    mapId,
    x: m.position?.x ?? 0,
    z: m.position?.z ?? 0,
    y: m.position?.y ?? null,
    floor: m.floor ?? null,
    type,
    category,
    faction: m.faction ?? null,
    title: m.label ?? '',
    description: null,
    screenshots: [],
    linkKind: 'none',
    linkId: null,
    linkStep: null,
    polygon: null,
    sourceMarkerId: m.id,
    hidden: false,
    linkedQuest: null,
    linkedStory: null,
  };
}

function tooltipFor(m: MapViewMarker): string {
  const head = (cls: string, t: string) => `<div class="cta-tip-h ${cls}">${esc(t)}</div>`;
  const sub = (t: string) => `<div class="cta-tip-sub">${esc(t)}</div>`;
  switch (m.type) {
    case 'extract': {
      const fac = { pmc: 'ЧВК', scav: 'Дикий', shared: 'Общий', all: 'Общий' }[(m.faction || 'all').toLowerCase()] ?? 'Выход';
      const ti = m.meta?.transferItem as { name?: string; count?: number } | null | undefined;
      const item = ti?.name ? sub(`Нужен предмет: ${ti.name}${ti.count && ti.count > 1 ? ` ×${ti.count}` : ''}`) : '';
      return `${head('t-extract', m.label || 'Выход')}${sub(fac)}${item}`;
    }
    case 'spawn': {
      const k = spawnKind(m);
      const kn =
        {
          pmc: 'Спавн ЧВК',
          scav: 'Спавн Диких',
          boss: 'Спавн босса',
          sniper: 'Снайпер',
          rogue: 'Спавн Отступников',
          'black-division': 'Спавн Black Division',
          all: 'Спавн',
        }[k] ?? 'Спавн';
      return `${head('t-spawn', kn)}${m.label ? sub(m.label) : ''}`;
    }
    case 'transit':
      return head('t-transit', m.label || 'Переход');
    case 'hazard':
      return head('t-hazard', m.label || 'Опасность');
    case 'lock':
      return `${head('t-extract', m.label || 'Замок')}${sub('Замок / ключ')}`;
    case 'switch':
      return `${head('t-transit', m.label || 'Рычаг')}`;
    case 'loot_container':
      return `${head('t-spawn', m.label || 'Контейнер')}`;
    case 'loot_loose':
      return `${head('t-spawn', m.label || 'Лут')}`;
    case 'stationary_weapon':
      return `${head('t-transit', m.label || 'Стационарное оружие')}`;
    case 'quest_zone':
      return `${head('t-extract', m.label || 'Зона квеста')}${sub('Цель квеста')}`;
    default:
      return head('t-hazard', m.label || m.type);
  }
}

/* ───────────────── кластеризация loose loot ───────────────── */
const CLUSTER_CELL = 46; // px — размер ячейки грид-кластера

function clusterIcon(count: number): L.DivIcon {
  const s = count > 99 ? 34 : count > 9 ? 30 : 26;
  return L.divIcon({
    className: 'cta-di',
    html: `<div class="cta-cluster cta-mk-scale" style="width:${s}px;height:${s}px;line-height:${s - 2}px">${count}</div>`,
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

/* ───────────────── компонент ───────────────── */
export function MapViewerClient({
  data,
  onReady,
  activeFloor = 0,
  onRequestFloor,
  editorialMarkers,
  editorialBridge,
  heatPoints,
  canEditMarkers,
  mapId,
  questIndex,
  storyIndex,
}: {
  data: MapView;
  onReady?: (api: MapViewerApi) => void;
  activeFloor?: number;
  onRequestFloor?: (idx: number) => void;
  editorialMarkers?: EditorialMarkerData[];
  editorialBridge?: MapViewMarker[];
  heatPoints?: HeatPoint[];
  canEditMarkers?: boolean;
  mapId?: string;
  questIndex?: QuestIndexItem[];
  storyIndex?: StoryIndexItem[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const highlightRef = useRef<L.Polygon | null>(null);
  const objectivePinsRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<{ marker: L.Marker; top: number | null; bottom: number | null; floor?: number | null }[]>([]);
  // Синканые маркеры по их source-id → для класса .cta-mk-del без пересборки слоя (режим удаления).
  const sourceMarkerElsRef = useRef<Map<string, L.Marker>>(new Map());
  // Editorial-маркеры по id → тоже императивная пометка (капля/центроид + приглушение полигона),
  // БЕЗ пересборки слоя: rebuild на каждую пометку ронял Leaflet (_initIcon→appendChild) при гонке с refresh.
  const editorialElsRef = useRef<Map<string, { mk: L.Marker; poly?: L.Polygon }>>(new Map());
  const svgGroupsRef = useRef<Map<string, SVGGElement> | null>(null);
  const activeFloorRef = useRef(activeFloor);
  const loadImageRef = useRef<((url: string) => void) | null>(null);

  // Слои маркеров: L.LayerGroup на под-слой; loose loot (loose-*) — кластер на категорию.
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const looseGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const looseMarkersRef = useRef<Record<string, MapViewMarker[]>>({});
  // LOD: применить эффективную видимость слоёв (фильтр × зум-тир). Ставится в init-эффекте.
  const applyLayerVisRef = useRef<() => void>(() => {});
  // Позиции маркеров по под-слою (для ПКМ-цикла в drawer) + курсор цикла + слой пульс-подсветки.
  const positionsByLayerRef = useRef<Record<string, { x: number; z: number }[]>>({});
  const cycleCursorRef = useRef<Record<string, number>>({});
  const flashRef = useRef<L.LayerGroup | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashPointsRef = useRef<(pts: { x: number; z: number }[]) => void>(() => {});

  // Видимость слоёв — единый стор (GRILL-2 §3): синхронно с легендой и левым drawer'ом.
  const vis = useMapViewStore((s) => s.activeFilters);
  const visRef = useRef(vis);
  useEffect(() => {
    visRef.current = vis;
  });

  const [editing, setEditing] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1',
  );
  const [mapInst, setMapInst] = useState<L.Map | null>(null);
  const staticLayerRef = useRef<L.LayerGroup | null>(null);
  // Активный тайл-слой подложки (тайловая карта); свап при смене этажа.
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  // Вектор-оверлей поверх тайлов (гибрид «тайлы+вектор»): резкие контуры на любом зуме.
  const vectorOverlayRef = useRef<L.SVGOverlay | null>(null);
  const vectorTokenRef = useRef(0); // гонка: быстрый свап этажей отменяет устаревший fetch
  // Слой маркеров поверх тайлов (поэтажный SVG из /markers): выходы/спавны/замки и т.п.
  // Интерактивные метки HD-карты (из распарсенной разметки): слой + датасет по этажам.
  const hdMarkerLayerRef = useRef<L.LayerGroup | null>(null);
  const hdMarkerDataRef = useRef<Record<string, { type: string; x: number; y: number }[]> | null>(null);
  const setTileFloorRef = useRef<((idx: number) => void) | null>(null);

  // Слой редакторских маркеров (editorial_markers) — изолированный эффект (не трогает init).
  // Всегда виден (кураторские точки, их мало); клик открывает карточку-popup НАД каплей.
  const router = useRouter();
  const editorialLayerRef = useRef<L.LayerGroup | null>(null);
  const [openEditorialId, setOpenEditorialId] = useState<string | null>(null);
  const openEditorial = editorialMarkers?.find((m) => m.id === openEditorialId) ?? null;
  const editorialOverlayRef = useRef<HTMLDivElement | null>(null);
  // Режим постановки маркера (admin/editor): следующий клик по карте открывает ЧЕРНОВИК.
  const addMode = useMapUiStore((s) => s.addMode);
  const setAddMode = useMapUiStore((s) => s.setAddMode);
  // Черновик нового маркера (в памяти) — INSERT только на «Сохранить», не на клик по карте.
  const [pendingMarker, setPendingMarker] = useState<EditorialMarkerData | null>(null);
  const activeMarker = pendingMarker ?? openEditorial;
  const closeCard = () => {
    setOpenEditorialId(null);
    setPendingMarker(null);
  };

  // Drawer «Удаление маркеров» + список помеченных (объявлено до editorial-эффекта — он читает deleteMarks).
  // Ключ пометки: editorial → его id; синканый tarkov.dev → `src:<sourceMarkerId>` (см. карточку).
  const deleteMarks = useMapUiStore((s) => s.deleteMarks);
  const deleteOpen = useMapUiStore((s) => s.deleteOpen);
  const setDeleteOpen = useMapUiStore((s) => s.setDeleteOpen);
  const toggleDeleteMark = useMapUiStore((s) => s.toggleDeleteMark);
  const clearDeleteMarks = useMapUiStore((s) => s.clearDeleteMarks);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Refs, чтобы клик-хендлеры/рендер-луп синканого слоя читали актуальные значения без пересоздания.
  const deleteOpenRef = useRef(false);
  const deleteMarksRef = useRef<string[]>(deleteMarks);
  useEffect(() => {
    deleteOpenRef.current = deleteOpen;
    deleteMarksRef.current = deleteMarks;
  });
  // Индексы id→маркер: строятся раз на смену данных, чтобы пометка была O(помеченных), а НЕ
  // O(всех маркеров карты). Лут — тысячи точек, скан на каждый клик пометки подвешивал UI.
  const syncedById = useMemo(() => {
    const idx = new Map<string, MapViewMarker>();
    for (const m of data.markers) idx.set(m.id, m);
    return idx;
  }, [data.markers]);
  const editorialById = useMemo(() => {
    const idx = new Map<string, EditorialMarkerData>();
    for (const m of editorialMarkers ?? []) if (m.id) idx.set(m.id, m);
    return idx;
  }, [editorialMarkers]);
  // Помеченные = editorial (ключ = id) + синканые (ключ = `src:<id>`) → в EditorialMarkerData для дровера.
  const markedForDelete = useMemo(() => {
    const out: EditorialMarkerData[] = [];
    for (const key of deleteMarks) {
      if (key.startsWith('src:')) {
        if (!mapId) continue;
        const sm = syncedById.get(key.slice(4));
        if (sm) out.push(syncedToEditorial(sm, mapId));
      } else {
        const em = editorialById.get(key);
        if (em) out.push(em);
      }
    }
    return out;
  }, [deleteMarks, syncedById, editorialById, mapId]);
  const confirmDeleteMarks = async () => {
    if (markedForDelete.length === 0) return;
    setDeleteBusy(true);
    try {
      for (const m of markedForDelete) {
        if (m.id) {
          // editorial — реальное удаление строки.
          const res = await fetch(`/api/admin/editorial-markers?id=${m.id}&slug=${data.slug}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else if (m.sourceMarkerId) {
          // синканый — override hidden=true (страница подавит оригинал на рендере).
          const res = await fetch('/api/admin/editorial-markers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mapId: m.mapId,
              slug: data.slug,
              x: m.x,
              z: m.z,
              y: m.y,
              floor: m.floor,
              type: m.type,
              category: m.category,
              faction: m.faction,
              title: m.title || 'скрыто',
              description: m.description,
              screenshots: m.screenshots,
              linkKind: m.linkKind,
              linkId: m.linkId,
              linkStep: m.linkStep,
              polygon: m.polygon,
              sourceMarkerId: m.sourceMarkerId,
              hidden: true,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        }
      }
      clearDeleteMarks();
      setDeleteOpen(false);
      closeCard();
      router.refresh();
    } catch (e) {
      console.error('[marker batch delete/hide]', e);
      alert('Не удалось удалить/скрыть помеченные маркеры');
    } finally {
      setDeleteBusy(false);
    }
  };

  // Рисование области-лассо (по запросу из карточки). Точки в ref (перф) + счётчик для UI.
  // Пока активно — карточка спрятана (но смонтирована → черновик жив), onDone пишет polygon в её draft.
  const [areaDraw, setAreaDraw] = useState<{ color: string; onDone: (p: { x: number; z: number }[] | null) => void } | null>(null);
  const areaPtsRef = useRef<{ x: number; z: number }[]>([]);
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const [areaCount, setAreaCount] = useState(0);
  const startAreaDraw = (req: { current: { x: number; z: number }[] | null; color: string; onDone: (p: { x: number; z: number }[] | null) => void }) => {
    setAddMode(false); // клик-хендлер лассо не должен конкурировать с постановкой маркера
    areaPtsRef.current = req.current ? req.current.map((p) => ({ x: p.x, z: p.z })) : [];
    setAreaCount(areaPtsRef.current.length);
    setAreaDraw({ color: req.color, onDone: req.onDone });
  };
  const finishAreaDraw = () => {
    const pts = areaPtsRef.current;
    areaDraw?.onDone(pts.length >= 3 ? pts.map((p) => ({ x: p.x, z: p.z })) : null);
    setAreaDraw(null);
    areaPtsRef.current = [];
    setAreaCount(0);
  };
  const cancelAreaDraw = () => {
    setAreaDraw(null);
    areaPtsRef.current = [];
    setAreaCount(0);
  };

  // Индекс лута карты (loose loot, БЕЗ контейнеров) — для поиска предмета в визарде (Лут шаг 2).
  const lootIndex = useMemo(() => {
    const byLabel = new Map<string, { id: string; label: string }>();
    for (const m of data.markers) {
      if (m.type !== 'loot_loose' || !m.label || !m.linkedItemId || m.lootCat === 'container') continue;
      if (!byLabel.has(m.label)) byLabel.set(m.label, { id: m.linkedItemId, label: m.label });
    }
    return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [data.markers]);

  // Move-режим (перемещение editorial-маркера). Курсор = иконка маркера (следит за мышью);
  // ЛКМ ставит новую точку → подтверждение → апдейт x/z. Pan на СКМ (ЛКМ занят установкой).
  const [moveMarker, setMoveMarker] = useState<EditorialMarkerData | null>(null);
  const [movePos, setMovePos] = useState<{ x: number; z: number } | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const moveCursorRef = useRef<HTMLDivElement | null>(null);
  const startMove = () => {
    if (activeMarker?.id || activeMarker?.sourceMarkerId) {
      setAddMode(false); // не смешивать с постановкой (её клик-хендлер конфликтует с move)
      setMoveMarker(activeMarker);
      setMovePos(null);
    }
  };
  const cancelMove = () => {
    setMoveMarker(null);
    setMovePos(null);
  };
  const confirmMove = async () => {
    if (!moveMarker || !movePos) return;
    setMoveBusy(true);
    try {
      const res = await fetch('/api/admin/editorial-markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: moveMarker.id,
          mapId: moveMarker.mapId,
          slug: data.slug,
          x: movePos.x,
          z: movePos.z,
          y: moveMarker.y,
          floor: moveMarker.floor,
          type: moveMarker.type,
          category: moveMarker.category,
          faction: moveMarker.faction,
          title: moveMarker.title,
          description: moveMarker.description,
          screenshots: moveMarker.screenshots,
          linkKind: moveMarker.linkKind,
          linkId: moveMarker.linkId,
          linkStep: moveMarker.linkStep,
          polygon: moveMarker.polygon,
          sourceMarkerId: moveMarker.sourceMarkerId,
          hidden: moveMarker.hidden,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cancelMove();
      closeCard();
      router.refresh();
    } catch (e) {
      console.error('[editorial-marker move]', e);
      alert('Не удалось переместить маркер');
    } finally {
      setMoveBusy(false);
    }
  };
  const moveIconHtml = moveMarker ? String(editorialIcon(moveMarker).options.html ?? '') : '';

  // Режим оверрайда синканных маркеров (admin): клик по чужому tarkov.dev-маркеру → карточка-оверрайд
  // (source_marker_id). Ref — чтобы клик-хендлеры в рендер-эффекте не пересоздавались при смене режима.
  const overrideMode = useMapUiStore((s) => s.overrideMode);
  const overrideModeRef = useRef(false);
  const openOverrideRef = useRef<(m: MapViewMarker) => void>(() => {});
  useEffect(() => {
    overrideModeRef.current = overrideMode;
  }, [overrideMode]);
  useEffect(() => {
    openOverrideRef.current = (m: MapViewMarker) => {
      if (mapId) setPendingMarker(syncedToEditorial(m, mapId));
    };
  }, [mapId]);
  // «Скрыть» синканный маркер: оверрайд с hidden=true (страница подавит оригинал на рендере).
  const hideMarker = async () => {
    if (!activeMarker?.sourceMarkerId || !confirm('Скрыть этот синканный маркер?')) return;
    try {
      const res = await fetch('/api/admin/editorial-markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeMarker.id,
          mapId: activeMarker.mapId,
          slug: data.slug,
          x: activeMarker.x,
          z: activeMarker.z,
          y: activeMarker.y,
          floor: activeMarker.floor,
          type: activeMarker.type,
          category: activeMarker.category,
          faction: activeMarker.faction,
          title: activeMarker.title || 'скрыто',
          description: activeMarker.description,
          screenshots: activeMarker.screenshots,
          linkKind: activeMarker.linkKind,
          linkId: activeMarker.linkId,
          linkStep: activeMarker.linkStep,
          polygon: activeMarker.polygon,
          sourceMarkerId: activeMarker.sourceMarkerId,
          hidden: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      closeCard();
      router.refresh();
    } catch (e) {
      console.error('[editorial-marker hide]', e);
      alert('Не удалось скрыть маркер');
    }
  };

  useEffect(() => {
    const map = mapInst;
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    editorialLayerRef.current = group;
    const els = new Map<string, { mk: L.Marker; poly?: L.Polygon }>();
    for (const m of editorialMarkers ?? []) {
      if (!m.id) continue;
      const id = m.id;
      const icon = editorialIcon(m);
      const marked = deleteMarksRef.current.includes(id); // стартовая пометка (живые смены — в toggle-эффекте)
      // Область-лассо → пунктирный полигон с заливкой цветом категории + иконка в центроиде.
      if (m.polygon && m.polygon.length >= 3) {
        const color = markerColor(m.type);
        const poly = L.polygon(m.polygon.map(ll), { color, weight: 2, dashArray: '6 5', fillColor: color, fillOpacity: marked ? 0.05 : 0.18, opacity: marked ? 0.35 : 1 });
        if (m.title) poly.bindTooltip(m.title, { className: 'cta-tip', direction: 'top', opacity: 1 });
        poly.on('click', () => setOpenEditorialId(id));
        poly.addTo(group);
        const cx = m.polygon.reduce((s, p) => s + p.x, 0) / m.polygon.length;
        const cz = m.polygon.reduce((s, p) => s + p.z, 0) / m.polygon.length;
        const cm = L.marker(ll({ x: cx, z: cz }), { icon, interactive: false });
        cm.addTo(group);
        if (marked) cm.getElement()?.classList.add('cta-mk-del');
        els.set(id, { mk: cm, poly });
        continue;
      }
      const mk = L.marker(ll({ x: m.x, z: m.z }), { icon, riseOnHover: true });
      if (m.title) mk.bindTooltip(m.title, { className: 'cta-tip', direction: 'top', offset: [0, -18], opacity: 1 });
      mk.on('click', () => setOpenEditorialId(id));
      mk.addTo(group);
      if (marked) mk.getElement()?.classList.add('cta-mk-del');
      els.set(id, { mk });
    }
    editorialElsRef.current = els;
    return () => {
      group.remove();
      editorialLayerRef.current = null;
      editorialElsRef.current = new Map();
    };
  }, [mapInst, editorialMarkers]);

  // Пометка на удаление — ИМПЕРАТИВНО (класс + приглушение полигона), без пересборки слоёв.
  // editorial по id, синканые по `src:<id>`. Так пометка не роняет Leaflet при гонке с refresh.
  useEffect(() => {
    for (const [id, { mk, poly }] of editorialElsRef.current) {
      const marked = deleteMarks.includes(id);
      mk.getElement()?.classList.toggle('cta-mk-del', marked);
      poly?.setStyle({ fillOpacity: marked ? 0.05 : 0.18, opacity: marked ? 0.35 : 1 });
    }
    for (const [sid, mk] of sourceMarkerElsRef.current) {
      mk.getElement()?.classList.toggle('cta-mk-del', deleteMarks.includes(`src:${sid}`));
    }
  }, [deleteMarks, mapInst, editorialMarkers]);

  // Карточка-popup держится НАД каплей: пересчёт экранной точки при пане/зуме; клик по карте — закрыть.
  useEffect(() => {
    const map = mapInst;
    if (!map || !activeMarker) return;
    const latlng = ll({ x: activeMarker.x, z: activeMarker.z });
    const GAP = 22;
    const M = 8;
    // Позиция НАД пином, но с клэмпом в границы карты — карточка всегда целиком видна.
    const place = () => {
      const el = editorialOverlayRef.current;
      if (!el) return;
      const pt = map.latLngToContainerPoint(latlng);
      const size = map.getSize();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.min(Math.max(pt.x, w / 2 + M), size.x - w / 2 - M);
      let top = pt.y - GAP - h;
      top = Math.max(M, Math.min(top, size.y - h - M));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };
    place();
    map.on('move zoom', place);
    // Пересчёт при изменении высоты карточки (раскрытие пикера, галерея).
    const ro = new ResizeObserver(place);
    if (editorialOverlayRef.current) ro.observe(editorialOverlayRef.current);
    return () => {
      map.off('move zoom', place);
      ro.disconnect();
    };
  }, [mapInst, activeMarker]);

  // Закрытие по нажатию в ЛЮБОМ месте вне карточки (карта, drawer, страница). setTimeout —
  // чтобы клик-открытие капли не закрыл окно сразу же тем же событием.
  useEffect(() => {
    if (!activeMarker || areaDraw || moveMarker) return; // лассо/move: клики по карте — не закрытие
    const onDown = (e: MouseEvent) => {
      if (!editorialOverlayRef.current?.contains(e.target as Node)) closeCard();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [activeMarker, areaDraw, moveMarker]);

  // Постановка: в addMode следующий клик по карте открывает ЧЕРНОВИК (x=lng, z=lat) в памяти —
  // без записи в БД. INSERT произойдёт только при «Сохранить» в карточке.
  useEffect(() => {
    const map = mapInst;
    if (!map || !addMode || !mapId) return;
    const el = map.getContainer();
    el.style.cursor = 'crosshair';
    const onClick = (e: L.LeafletMouseEvent) => {
      setPendingMarker({
        mapId,
        x: e.latlng.lng,
        z: e.latlng.lat,
        y: null,
        floor: null,
        type: 'poi',
        category: null,
        title: '',
        description: null,
        screenshots: [],
        linkKind: 'none',
        linkId: null,
        linkStep: null,
        linkedQuest: null,
      });
      setOpenEditorialId(null);
      setAddMode(false);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
      el.style.cursor = '';
    };
  }, [mapInst, addMode, mapId, setAddMode]);

  // Пин черновика (полый амбер = несохранённый) — отдельный слой, пока pendingMarker жив.
  useEffect(() => {
    const map = mapInst;
    if (!map || !pendingMarker) return;
    const icon = L.divIcon({
      className: 'cta-editorial-mk',
      html: '<span style="display:block;width:16px;height:16px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:transparent;border:2px solid var(--primary,#e68e25);box-shadow:0 0 4px rgba(0,0,0,.6)"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 16],
    });
    const mk = L.marker(ll({ x: pendingMarker.x, z: pendingMarker.z }), { icon, interactive: false }).addTo(map);
    return () => {
      mk.remove();
    };
  }, [mapInst, pendingMarker]);

  // Режим лассо: ЛКМ ставит вершину, ПКМ убирает последнюю; живой полигон (пунктир+заливка).
  // Завершение — кнопкой «Готово» в панели (dblclick конфликтует с двойным click). Pan остаётся.
  useEffect(() => {
    const map = mapInst;
    if (!map || !areaDraw) return;
    const el = map.getContainer();
    el.style.cursor = 'crosshair';
    map.doubleClickZoom.disable(); // клики-вершины не должны зумить; pan на drag остаётся
    const group = L.layerGroup().addTo(map);
    areaLayerRef.current = group;
    const redraw = () => {
      group.clearLayers();
      const pts = areaPtsRef.current;
      if (pts.length >= 3) {
        L.polygon(pts.map(ll), { color: areaDraw.color, weight: 2, dashArray: '6 5', fillColor: areaDraw.color, fillOpacity: 0.2, interactive: false }).addTo(group);
      } else if (pts.length === 2) {
        L.polyline(pts.map(ll), { color: areaDraw.color, weight: 2, dashArray: '6 5', interactive: false }).addTo(group);
      }
      for (const p of pts) {
        L.circleMarker(ll(p), { radius: 4, color: '#fff', weight: 1, fillColor: areaDraw.color, fillOpacity: 1, interactive: false }).addTo(group);
      }
    };
    redraw();
    const onClick = (e: L.LeafletMouseEvent) => {
      areaPtsRef.current.push({ x: e.latlng.lng, z: e.latlng.lat });
      setAreaCount(areaPtsRef.current.length);
      redraw();
    };
    const onContext = (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      areaPtsRef.current.pop();
      setAreaCount(areaPtsRef.current.length);
      redraw();
    };
    map.on('click', onClick);
    map.on('contextmenu', onContext);
    return () => {
      map.off('click', onClick);
      map.off('contextmenu', onContext);
      map.doubleClickZoom.enable();
      el.style.cursor = '';
      group.remove();
      areaLayerRef.current = null;
    };
  }, [mapInst, areaDraw]);

  // Move-режим, фаза 1 (точка не выбрана): курсор-пин следит за мышью, ЛКМ ставит точку,
  // СКМ панорамирует (ЛКМ-drag отключён), Esc отменяет. Точка выбрана → фаза 2 (подтверждение).
  useEffect(() => {
    const map = mapInst;
    if (!map || !moveMarker || movePos) return;
    const el = map.getContainer();
    el.style.cursor = 'none';
    map.dragging.disable();
    let panning = false;
    let last: { x: number; y: number } | null = null;
    const onMouseMove = (e: MouseEvent) => {
      if (moveCursorRef.current) {
        moveCursorRef.current.style.left = `${e.clientX}px`;
        moveCursorRef.current.style.top = `${e.clientY}px`;
      }
      if (panning && last) {
        map.panBy([last.x - e.clientX, last.y - e.clientY], { animate: false });
        last = { x: e.clientX, y: e.clientY };
      }
    };
    const onDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        panning = true;
        last = { x: e.clientX, y: e.clientY };
      }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 1) panning = false;
    };
    const onClick = (e: L.LeafletMouseEvent) => setMovePos({ x: e.latlng.lng, z: e.latlng.lat });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoveMarker(null);
        setMovePos(null);
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    map.on('click', onClick);
    return () => {
      el.style.cursor = '';
      map.dragging.enable();
      window.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
      map.off('click', onClick);
    };
  }, [mapInst, moveMarker, movePos]);

  // Число маркеров на под-слой (для drawer'а + скрытия пустых слоёв).
  const counts = useMemo(() => {
    const c: Record<string, number> = Object.fromEntries(ALL_LAYER_ITEMS.map((i) => [i.key, 0]));
    for (const m of data.markers) {
      if (!m.position) continue;
      const key = layerKeyForMarker(m);
      if (key && key in c) c[key]++;
    }
    return c;
  }, [data.markers]);

  const floors = useMemo(() => buildMapFloors(data.config), [data.config]);
  const isStatic = !!data.config.staticMap;
  // Тайловая подложка (нарезка sharp'ом, см. skill map-stitch): рисуем L.tileLayer вместо SVG-оверлея.
  const isTiled = !!data.config.tileBase;

  // Открытость панели слоёв поднята в стор (§E11 каркас #1): десктоп-триггер живёт в верхнем
  // баре (MapTopBar), мобильный — в нижнем доке (MapMobileDock); оба пишут в один useMapUiStore.
  const layersOpen = useMapUiStore((s) => s.layersOpen);
  const setLayersOpen = useMapUiStore((s) => s.setLayersOpen);

  // Инстанс трекера один (нужен mapRef здесь). Кнопка+координаты живут в низ-право (GRILL-2),
  // рендерятся ниже прямо из этого хука — публикация наверх больше не нужна.
  const tracker = useEftTracker({ mapRef, config: data.config, floors, onRequestFloor });
  // Координаты игрока для readout низ-право (pose обновляется трекером ~1/сек — дёшево).
  const pose = useTrackingStore((s) => s.pose);

  // ── Сквад: шаринг позиции (Realtime, эфемерно). Своя поза → broadcast; тиммейты → presence+broadcast. ──
  const squadOpen = useMapUiStore((s) => s.squadOpen);
  const setSquadOpen = useMapUiStore((s) => s.setSquadOpen);
  const squadMembers = useSquadStore((s) => s.members);
  const squadPoses = useSquadStore((s) => s.poses);
  const squadSelfId = useSquadStore((s) => s.memberId);
  const squadMapId = mapId ?? data.slug;
  // Геометрия позы без ts — метку времени ставит useSquad при отправке (Date.now в рендере — импурно).
  const selfSquadPose = useMemo<Omit<SquadPose, 'ts'> | null>(
    () => (pose ? { x: pose.x, z: pose.z, y: pose.y, yaw: pose.yaw, floor: floorIndexForHeight(floors, pose.y) } : null),
    [pose, floors],
  );
  useSquad({ mapId: squadMapId, mapName: data.name, selfPose: selfSquadPose, broadcasting: tracker.active });
  // ?squad=CODE в URL → открыть drawer (авто-джойн не делаем — нужен ник + согласие).
  const [squadParam] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('squad') : null,
  );
  useEffect(() => {
    if (squadParam && !useSquadStore.getState().roomCode) setSquadOpen(true);
  }, [squadParam, setSquadOpen]);

  // Слой меток тиммейтов: точки участников на ТОЙ ЖЕ карте (broadcast-позы). Частота низкая → простая пересборка.
  useEffect(() => {
    const map = mapInst;
    if (!map) return;
    const group = L.layerGroup().addTo(map);
    const rot = data.config.coordinateRotation || 0;
    for (const m of squadMembers) {
      if (m.id === squadSelfId || m.mapId !== squadMapId) continue;
      const p = squadPoses[m.id];
      if (!p) continue;
      L.marker(ll({ x: p.x, z: p.z }), { icon: teammateIcon(m.color, p.yaw + rot, m.nick), interactive: false, zIndexOffset: 9000 }).addTo(group);
    }
    return () => {
      group.remove();
    };
  }, [mapInst, squadMembers, squadPoses, squadMapId, squadSelfId, data.config.coordinateRotation]);

  // ── Read-only инфо-карточка (замок→ключ / требования выхода) — один поповер за раз, НАД меткой. ──
  const [infoMarker, setInfoMarker] = useState<MapViewMarker | null>(null);
  const infoCardRef = useRef<HTMLDivElement | null>(null);
  const openInfoCardRef = useRef<(m: MapViewMarker) => void>(() => {});
  useEffect(() => {
    openInfoCardRef.current = (m: MapViewMarker) => setInfoMarker(m);
  }, []);
  // Индекс замков по ключу (linkedItemId) — счётчик «ещё N дверей» + подсветка соседей.
  const locksByKey = useMemo(() => {
    const idx = new Map<string, MapViewMarker[]>();
    for (const m of data.markers) {
      if (m.type !== 'lock' || !m.linkedItemId || !m.position) continue;
      const arr = idx.get(m.linkedItemId);
      if (arr) arr.push(m);
      else idx.set(m.linkedItemId, [m]);
    }
    return idx;
  }, [data.markers]);
  const lockSiblings = useMemo(
    () => (infoMarker?.type === 'lock' && infoMarker.linkedItemId ? (locksByKey.get(infoMarker.linkedItemId) ?? []).filter((m) => m.id !== infoMarker.id) : []),
    [infoMarker, locksByKey],
  );
  // Карточка держится НАД меткой замка (как editorial-card): пересчёт при пане/зуме.
  useEffect(() => {
    const map = mapInst;
    if (!map || !infoMarker?.position) return;
    const latlng = ll({ x: infoMarker.position.x, z: infoMarker.position.z });
    const place = () => {
      const el = infoCardRef.current;
      if (!el) return;
      const pt = map.latLngToContainerPoint(latlng);
      const size = map.getSize();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const M = 8;
      const left = Math.min(Math.max(pt.x, w / 2 + M), size.x - w / 2 - M);
      let top = pt.y - 22 - h;
      top = Math.max(M, Math.min(top, size.y - h - M));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    };
    place();
    map.on('move zoom', place);
    const ro = new ResizeObserver(place);
    if (infoCardRef.current) ro.observe(infoCardRef.current);
    return () => {
      map.off('move zoom', place);
      ro.disconnect();
    };
  }, [mapInst, infoMarker]);
  // Закрытие карточки замка: клик вне / Esc.
  useEffect(() => {
    if (!infoMarker) return;
    const onDown = (e: MouseEvent) => {
      if (!infoCardRef.current?.contains(e.target as Node)) setInfoMarker(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoMarker(null);
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onEsc);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [infoMarker]);

  // ── Реверс Ключ→Двери: постоянная подсветка дверей «моих ключей» (вне LOD/фильтра слоя замков). ──
  const myKeys = useMyKeysStore((s) => s.keys);
  const myKeyDoors = useMemo(() => {
    const pts: { x: number; z: number }[] = [];
    for (const id of myKeys) {
      for (const m of locksByKey.get(id) ?? []) if (m.position) pts.push({ x: m.position.x, z: m.position.z });
    }
    return pts;
  }, [myKeys, locksByKey]);
  useEffect(() => {
    const map = mapInst;
    if (!map || myKeyDoors.length === 0) return;
    const group = L.layerGroup().addTo(map);
    const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#e68e25';
    for (const p of myKeyDoors) {
      L.circleMarker(ll(p), { radius: 13, color: primary, weight: 2, opacity: 0.9, fillColor: primary, fillOpacity: 0.12, interactive: false }).addTo(group);
    }
    return () => {
      group.remove();
    };
  }, [mapInst, myKeyDoors]);

  // ── Лут-фильтр: постоянная подсветка спавнов выбранных предметов (accent-frago, вне LOD/фильтра). ──
  const lootLabels = useLootFilterStore((s) => s.labels);
  const lootPositions = useMemo(() => {
    if (lootLabels.length === 0) return [];
    const set = new Set(lootLabels);
    const pts: { x: number; z: number }[] = [];
    for (const m of data.markers) {
      if (m.position && m.label && set.has(m.label)) pts.push({ x: m.position.x, z: m.position.z });
    }
    return pts;
  }, [lootLabels, data.markers]);
  useEffect(() => {
    const map = mapInst;
    if (!map || lootPositions.length === 0) return;
    const group = L.layerGroup().addTo(map);
    const teal = getComputedStyle(document.documentElement).getPropertyValue('--color-accent-frago').trim() || '#00CDAB';
    for (const p of lootPositions) {
      L.circleMarker(ll(p), { radius: 11, color: teal, weight: 2, opacity: 0.95, fillColor: teal, fillOpacity: 0.14, interactive: false }).addTo(group);
    }
    return () => {
      group.remove();
    };
  }, [mapInst, lootPositions]);

  // ── Story/lore-слой: маршрут выбранной истории (кольца-номера + пунктирная линия) из editorial linkKind='story'. ──
  const storySlug = useStoryFilterStore((s) => s.slug);
  const storyCheckpoints = useMemo(() => {
    if (!storySlug) return [];
    return (editorialMarkers ?? [])
      .filter((m) => m.linkKind === 'story' && m.linkId === storySlug && Number.isFinite(m.x) && Number.isFinite(m.z))
      .map((m) => ({ x: m.x, z: m.z, step: m.linkStep ?? null }))
      .sort((a, b) => (a.step ?? 1e9) - (b.step ?? 1e9));
  }, [storySlug, editorialMarkers]);
  useEffect(() => {
    const map = mapInst;
    if (!map || storyCheckpoints.length === 0) return;
    const group = L.layerGroup().addTo(map);
    const tint = LINK_KIND_COLOR.story; // story-tint — единый источник (map-marker-icons)
    const stepped = storyCheckpoints.filter((c) => c.step != null);
    if (stepped.length >= 2) {
      L.polyline(stepped.map((c) => ll({ x: c.x, z: c.z })), { color: tint, weight: 2, dashArray: '6 5', opacity: 0.8, interactive: false }).addTo(group);
    }
    for (const c of storyCheckpoints) {
      const label = c.step != null ? String(c.step) : '•';
      L.marker(ll({ x: c.x, z: c.z }), {
        interactive: false,
        zIndexOffset: 8000,
        icon: L.divIcon({
          className: 'cta-story-cp',
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          html: `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:color-mix(in srgb, ${tint} 22%, transparent);border:2px solid ${tint};color:#fff;font-size:12px;font-weight:700;box-shadow:0 0 6px rgba(0,0,0,.55)">${label}</div>`,
        }),
      }).addTo(group);
    }
    return () => {
      group.remove();
    };
  }, [mapInst, storyCheckpoints]);

  // ── Heatmap плотности ДЕНЕГ (EV): L.heatLayer из heatPoints (сервер посчитал EV), режим-toggle, вне LOD. ──
  const heatActive = useHeatmapStore((s) => s.active);
  const heatToggle = useHeatmapStore((s) => s.toggle);
  const heatData = useMemo<[number, number, number][]>(
    // ll = [z, x]; третий элемент — интенсивность (EV ₽). Проекция через наш CRS (latLngToContainerPoint).
    () => (heatPoints ?? []).map((p) => [p.z, p.x, p.ev]),
    [heatPoints],
  );
  // Нормировка по p95 — редкие джекпоты (LEDX и т.п.) не «выжигают» всю карту в один цвет.
  const heatMax = useMemo(() => {
    if (!heatData.length) return 1;
    const evs = heatData.map((d) => d[2]).sort((a, b) => a - b);
    return evs[Math.floor(evs.length * 0.95)] || evs[evs.length - 1] || 1;
  }, [heatData]);
  useEffect(() => {
    const map = mapInst;
    if (!map || !heatActive || heatData.length === 0) return;
    let layer: L.Layer | null = null;
    let cancelled = false;
    // leaflet.heat патчит leaflet-СИНГЛТОН; неймспейс `import * as L` его не отражает (свойство
    // добавлено после eval модуля) → грузим плагин динамикой и берём heatLayer с `leaflet.default`.
    void (async () => {
      const leaflet = (await import('leaflet')) as unknown as { default?: unknown };
      const Lx = (leaflet.default ?? leaflet) as { heatLayer?: (d: unknown, o: unknown) => L.Layer };
      if (typeof Lx.heatLayer !== 'function') await import('leaflet.heat');
      if (cancelled || typeof Lx.heatLayer !== 'function') return;
      layer = Lx.heatLayer(heatData, {
        radius: 34,
        blur: 24,
        max: heatMax,
        minOpacity: 0.4,
        // Черновой градиент NIGHTFALL (тепло→жар): nvg-green → amber → danger. Финал-стопы за V4DYA.
        gradient: { 0.15: '#5FB85B', 0.5: '#E68E25', 0.8: '#E5484D', 1.0: '#ffce54' },
      });
      layer.addTo(map);
      // leaflet.heat кладёт канвас в overlayPane — ПОД непрозрачную арт-подложку карты (тоже overlayPane),
      // heat виден только по краям. Поднимаем z-index канваса НАД артом (но канвас остаётся в overlayPane,
      // ниже markerPane — иконки выходов/спавнов не прячем).
      const heatCanvas = (layer as unknown as { _canvas?: HTMLElement })._canvas;
      if (heatCanvas) heatCanvas.style.zIndex = '450';
    })();
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [mapInst, heatActive, heatData, heatMax]);

  // Линейка (measure): флаг из стора, точки/слой замера. Хендлеры клика — в init-эффекте карты
  // (через ref, чтобы не пересоздавать карту). Выключение линейки очищает замер.
  const rulerActive = useMapUiStore((s) => s.rulerActive);
  const rulerActiveRef = useRef(rulerActive);
  const rulerLayerRef = useRef<L.LayerGroup | null>(null);
  const rulerPtsRef = useRef<{ x: number; z: number }[]>([]);
  useEffect(() => {
    rulerActiveRef.current = rulerActive;
    if (!rulerActive) {
      rulerPtsRef.current = [];
      rulerLayerRef.current?.clearLayers();
    }
  }, [rulerActive]);

  // Применить этаж: затемнить чужие <g>-слои SVG + спрятать маркеры вне диапазона высоты.
  const applyFloor = useCallback(
    (idx: number) => {
      const fl = floors[idx] ?? floors[0];
      const groups = svgGroupsRef.current;
      if (groups) {
        groups.forEach((g, id) => {
          if (fl?.svgLayer && id !== fl.svgLayer) g.classList.add('is-dimmed');
          else g.classList.remove('is-dimmed');
        });
      }
      const range = fl?.height ?? null;
      const isGround = idx === 0;
      for (const { marker, top, bottom, floor } of markersRef.current) {
        const el = marker.getElement();
        if (!el) continue;
        let visible: boolean;
        if (floor != null) visible = floor === idx;
        else if (top == null && bottom == null) visible = isGround;
        else if (!range) visible = true;
        else visible = (top ?? bottom ?? 0) >= range[0] && (bottom ?? top ?? 0) <= range[1];
        // §8: чужой этаж не исчезает, а гаснет до контекста (класс). soloFloors прячет через CSS.
        el.classList.toggle('cta-mk-offfloor', !visible);
      }
    },
    [floors],
  );

  const applyFloorRef = useRef(applyFloor);
  useEffect(() => {
    applyFloorRef.current = applyFloor;
    activeFloorRef.current = activeFloor;
  });

  useEffect(() => {
    applyFloor(activeFloor);
  }, [activeFloor, applyFloor]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const cfg = data.config;
    const map = L.map(el, {
      // Тайловая карта — чистый CRS.Simple (пиксельный холст, маркеров нет); иначе — проекция с transform.
      crs: isTiled ? L.CRS.Simple : makeCRS(cfg),
      zoomSnap: 0.1,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      wheelPxPerZoomLevel: 120,
      minZoom: cfg.minZoom,
      // +2 уровня к максимальному зуму (карта векторная — остаётся резкой); «зазумить максимально».
      maxZoom: cfg.maxZoom + 2,
    });
    mapRef.current = map;
    setMapInst(map);

    let cancelledSvg = false;
    let overlay: L.Layer | null = null;
    // Тайловая карта: bounds через unproject (CRS.Simple transformation (1,0,-1,0) → pixelY=-lat*scale;
    // ручная арифметика знака ломается — unproject считает верно). Холст на native-макс-зуме.
    const imgBounds: L.LatLngBounds | null = isTiled
      ? (() => {
          const pw = cfg.tilePixelSize?.[0];
          const ph = cfg.tilePixelSize?.[1];
          if (!pw || !ph) return null;
          return new L.LatLngBounds(map.unproject([0, ph], cfg.maxZoom), map.unproject([pw, 0], cfg.maxZoom));
        })()
      : cfg.bounds
        ? cfg.svgBounds
          ? bb(cfg.svgBounds)
          : bb(cfg.bounds)
        : null;

    const loadImage = (url: string) => {
      if (!imgBounds || !mapRef.current) return;
      fetch(url)
        .then((r) => r.text())
        .then((txt) => {
          if (cancelledSvg || !mapRef.current) return;
          const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
          const svgEl = doc.documentElement as unknown as SVGSVGElement;
          if (svgEl.nodeName.toLowerCase() !== 'svg') throw new Error('bad svg');
          if (overlay) overlay.remove();
          overlay = L.svgOverlay(svgEl, imgBounds, { interactive: false, className: 'cta-map-svg' }).addTo(map);
          const gmap = new Map<string, SVGGElement>();
          for (const fl of floors) {
            if (!fl.svgLayer) continue;
            const g = svgEl.querySelector<SVGGElement>(`#${CSS.escape(fl.svgLayer)}`);
            if (g) {
              g.dataset.floor = fl.svgLayer;
              gmap.set(fl.svgLayer, g);
            }
          }
          svgGroupsRef.current = gmap;
          applyFloorRef.current(activeFloorRef.current);
        })
        .catch(() => {
          if (cancelledSvg || !mapRef.current) return;
          if (overlay) overlay.remove();
          overlay = L.imageOverlay(url, imgBounds, { interactive: false, className: 'cta-map-svg' }).addTo(map);
        });
    };
    loadImageRef.current = loadImage;

    // Тайловая подложка: пирамида 256px google-layout (tile-z == map-zoom при нашей калибровке bounds).
    // maxNativeZoom = cfg.maxZoom (native max нарезки); выше — Leaflet масштабирует последний уровень (over-zoom).
    const setTileFloor = (idx: number) => {
      if (!imgBounds || !mapRef.current) return;
      const folder = floors[idx]?.tile ?? floors[0]?.tile;
      if (!folder) return;
      // 1) Растровая пирамида этажа.
      if (tileLayerRef.current) tileLayerRef.current.remove();
      // ⚠️ sharp/libvips google-layout пишет {z}/{y}/{x} (строка/столбец), а НЕ XYZ {z}/{x}/{y}.
      // Поэтому в шаблоне Leaflet порядок y/x — иначе тайлы транспонируются и стены не сходятся.
      const tileVer = cfg.tileVersion ? `?v=${cfg.tileVersion}` : '';
      tileLayerRef.current = L.tileLayer(`/maps/${cfg.tileBase}/tiles/${folder}/{z}/{y}/{x}.${cfg.tileExt ?? 'webp'}${tileVer}`, {
        tileSize: 256,
        minNativeZoom: 0,
        maxNativeZoom: cfg.maxZoom,
        noWrap: true,
        bounds: imgBounds,
        keepBuffer: 4,
        className: 'cta-map-tiles',
      }).addTo(map);
      // 2) SVG-оверлеи поверх тайлов (вектор-геометрия и/или слой маркеров) — каждый по флагу.
      // Тот же холст 16384² → ложатся 1:1. Снимаем непрозрачный фон #141416 у оверлея,
      // иначе он перекроет тайлы. Гонка async-fetch закрыта токеном на слой.
      const loadOverlay = (
        url: string,
        ref: React.MutableRefObject<L.SVGOverlay | null>,
        tokenRef: React.MutableRefObject<number>,
        className: string,
      ) => {
        const token = ++tokenRef.current;
        if (ref.current) {
          ref.current.remove();
          ref.current = null;
        }
        fetch(url)
          .then((r) => (r.ok ? r.text() : Promise.reject(new Error('нет ' + url))))
          .then((txt) => {
            if (token !== tokenRef.current || !mapRef.current) return; // этаж сменился — бросаем
            const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
            const svgEl = doc.documentElement as unknown as SVGSVGElement;
            if (svgEl.nodeName.toLowerCase() !== 'svg') return;
            // Снять фон-подложку (#141416) — иначе перекроет тайлы.
            svgEl.querySelectorAll('rect').forEach((rc) => {
              if ((rc.getAttribute('fill') || '').toLowerCase() === '#141416') rc.remove();
            });
            ref.current = L.svgOverlay(svgEl, imgBounds, { interactive: false, className }).addTo(map);
          })
          .catch(() => {}); // оверлей опционален — без него остаётся чистый растр
      };

      if (cfg.tileVector) loadOverlay(`/maps/${cfg.tileBase}/vector/${folder}.svg`, vectorOverlayRef, vectorTokenRef, 'cta-map-tiles-vec');
      else if (vectorOverlayRef.current) { vectorOverlayRef.current.remove(); vectorOverlayRef.current = null; }

      // 3) Интерактивные метки из распарсенной разметки (цвет по типу, тултип, клик).
      if (cfg.tileMarkers) renderHdMarkers(idx);
    };
    setTileFloorRef.current = setTileFloor;

    // Рендер интерактивных меток HD-карты для этажа: circleMarker по пиксель-позиции
    // (unproject на native-макс-зуме), цвет/подпись по типу. Данные — из hdMarkerDataRef.
    const renderHdMarkers = (idx: number) => {
      if (!imgBounds || !mapRef.current) return;
      if (!hdMarkerLayerRef.current) hdMarkerLayerRef.current = L.layerGroup().addTo(map);
      const grp = hdMarkerLayerRef.current;
      grp.clearLayers();
      const folder = floors[idx]?.tile ?? floors[0]?.tile;
      const data = (folder && hdMarkerDataRef.current?.[folder]) || [];
      for (const m of data) {
        const st = HD_MARKER_STYLE[m.type];
        if (!st) continue;
        const cm = L.circleMarker(map.unproject([m.x, m.y], cfg.maxZoom), {
          radius: 7,
          fillColor: st.color,
          fillOpacity: 0.9,
          color: '#0D0D0F',
          weight: 2,
          className: 'cta-hd-marker',
        });
        cm.bindTooltip(st.label, { direction: 'top', offset: [0, -6], className: 'cta-tip', opacity: 1 });
        grp.addLayer(cm);
      }
    };

    // Датасет меток грузим один раз (fetch), затем рисуем активный этаж.
    if (isTiled && cfg.tileMarkers) {
      fetch(`/maps/${cfg.tileBase}/markers/${cfg.tileBase}-markers.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('нет датасета маркеров'))))
        .then((d) => {
          if (!mapRef.current) return;
          hdMarkerDataRef.current = d;
          renderHdMarkers(activeFloorRef.current);
        })
        .catch(() => {});
    }

    // Без maxBounds — карту можно свободно увести в сторону (не «отпружинивает» к центру).
    if (isTiled && imgBounds) {
      setTileFloor(activeFloorRef.current);
      map.fitBounds(imgBounds);
    } else if (cfg.bounds) {
      if (!isStatic) loadImage(data.imageUrl);
      map.fitBounds(bb(cfg.bounds));
    }

    // Оверлей МЕЧЕНЫХ КОМНАТ: тонкий SVG (тот же viewBox/bounds арта → ложится пиксель-в-пиксель),
    // кликабельный → страница комнаты. 404 для карт без меченок — просто пропускаем. Слой снимет map.remove().
    if (!isStatic && imgBounds) {
      fetch(`/images/maps/eft/marked-rooms/${data.slug}.svg`)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error('нет меченок'))))
        .then((txt) => {
          if (cancelledSvg || !mapRef.current) return;
          const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
          const svgEl = doc.documentElement as unknown as SVGSVGElement;
          if (svgEl.nodeName.toLowerCase() !== 'svg') return;
          L.svgOverlay(svgEl, imgBounds, { interactive: false, className: 'cta-marked-rooms' }).addTo(map);
          svgEl.addEventListener('click', (e) => {
            const room = (e.target as Element | null)?.closest?.('[data-room]')?.getAttribute('data-room');
            if (room) router.push(`/eft/maps/${data.slug}/rooms/${room}`);
          });
        })
        .catch(() => {});
    }

    // Пропорциональный зум: маркеры мельче при отдалении (fit), крупнее при приближении.
    const setMarkerScale = () => {
      const span = Math.max(0.001, cfg.maxZoom - cfg.minZoom);
      const t = Math.max(0, Math.min(1, (map.getZoom() - cfg.minZoom) / span));
      el.style.setProperty('--marker-scale', (0.5 + t * 0.9).toFixed(3));
    };
    map.on('zoom zoomend', setMarkerScale);
    setMarkerScale();

    // слои маркеров
    markersRef.current = [];
    layerGroupsRef.current = {};
    looseMarkersRef.current = {};

    if (isStatic) {
      // Статик-карта: ручные маркеры одним слоём, фильтр по индексу этажа; правка заменяет слой.
      const manualGroup = L.layerGroup().addTo(map);
      staticLayerRef.current = manualGroup;
      for (const m of data.markers) {
        if (!m.position) continue;
        const marker = L.marker(ll(m.position), { icon: manualMarkerIcon(m), riseOnHover: true });
        const tip = m.label || (m.category ? categoryLabel(m.category) : null) || m.type;
        marker.bindTooltip(tip, { className: 'cta-tip', direction: 'top', offset: [0, -8], opacity: 1 });
        if (m.type === 'quest' && m.questId) {
          marker.on('click', () => window.open(`/eft/quests/task/${m.questId}`, '_blank', 'noopener'));
        } else if (m.itemSlug) {
          marker.on('click', () => window.open(`/eft/items/item/${m.itemSlug}`, '_blank', 'noopener'));
        }
        marker.addTo(manualGroup);
        markersRef.current.push({ marker, top: null, bottom: null, floor: m.floor ?? null });
      }
    } else {
      // Интерактивная карта: под-слой на каждый ключ таксономии (loose loot — кластер отдельно).
      const groups: Record<string, L.LayerGroup> = {};
      for (const item of ALL_LAYER_ITEMS) if (!item.key.startsWith('loose-')) groups[item.key] = L.layerGroup();
      layerGroupsRef.current = groups;

      const looseGroups: Record<string, L.LayerGroup> = {};
      const looseMarkers: Record<string, MapViewMarker[]> = {};
      const positions: Record<string, { x: number; z: number }[]> = {};

      for (const m of data.markers) {
        if (!m.position) continue;
        const key = layerKeyForMarker(m);
        if (!key) continue;
        (positions[key] ??= []).push({ x: m.position.x, z: m.position.z });
        if (key.startsWith('loose-')) {
          (looseMarkers[key] ??= []).push(m);
          looseGroups[key] ??= L.layerGroup();
          continue;
        }
        const grp = groups[key];
        if (!grp) continue;
        const marker = L.marker(ll(m.position), { icon: markerDivIcon(m), riseOnHover: true });
        marker.bindTooltip(tooltipFor(m), { className: 'cta-tip', direction: 'top', offset: [0, -8], opacity: 1 });
        // Клик: в override- ИЛИ delete-режиме (admin) → карточка-оверрайд (там кнопка Скрыть/пометка);
        // иначе кросс-линк (квест-зона→задача, лут→предмет).
        marker.on('click', () => {
          if (overrideModeRef.current || deleteOpenRef.current) return openOverrideRef.current(m);
          if (m.type === 'lock' || m.type === 'extract') return openInfoCardRef.current(m); // read-only инфо-карточка
          if (m.type === 'quest' && m.questId) window.open(`/eft/quests/task/${m.questId}`, '_blank', 'noopener');
          else if (m.itemSlug) window.open(`/eft/items/item/${m.itemSlug}`, '_blank', 'noopener');
        });
        // Регистрируем для класса пометки + применяем стартовое состояние.
        sourceMarkerElsRef.current.set(m.id, marker);
        if (deleteMarksRef.current.includes(`src:${m.id}`)) marker.getElement()?.classList.add('cta-mk-del');
        // Полигон зоны выхода — на ховер.
        if (m.type === 'extract' && m.outline && m.outline.length > 2) {
          const poly = L.polygon(m.outline.map(ll), {
            className: `cta-ex-zone ef-${(m.faction || 'all').toLowerCase()}`,
            interactive: false,
          });
          marker.on('mouseover', () => poly.addTo(grp));
          marker.on('mouseout', () => poly.remove());
        }
        marker.addTo(grp);
        markersRef.current.push({ marker, top: m.top, bottom: m.bottom });
      }
      looseGroupsRef.current = looseGroups;
      looseMarkersRef.current = looseMarkers;
      positionsByLayerRef.current = positions;

      // Грид-кластер loose loot по категориям: пересобирается при зуме, пока слой видим.
      const rebuildLoose = (only?: string) => {
        for (const key of only ? [only] : Object.keys(looseGroups)) {
          const grp = looseGroups[key];
          if (!grp) continue;
          grp.clearLayers();
          const buckets = new Map<string, MapViewMarker[]>();
          for (const m of looseMarkers[key] ?? []) {
            if (!m.position) continue;
            const p = map.latLngToLayerPoint(ll(m.position));
            const k = `${Math.floor(p.x / CLUSTER_CELL)}_${Math.floor(p.y / CLUSTER_CELL)}`;
            const arr = buckets.get(k);
            if (arr) arr.push(m);
            else buckets.set(k, [m]);
          }
          for (const arr of buckets.values()) {
            if (arr.length === 1) {
              const m = arr[0];
              const mk = L.marker(ll(m.position!), { icon: markerDivIcon(m), riseOnHover: true });
              mk.bindTooltip(tooltipFor(m), { className: 'cta-tip', direction: 'top', offset: [0, -8], opacity: 1 });
              mk.on('click', () => {
                if (overrideModeRef.current || deleteOpenRef.current) return openOverrideRef.current(m);
                if (m.itemSlug) window.open(`/eft/items/item/${m.itemSlug}`, '_blank', 'noopener');
              });
              mk.addTo(grp);
            } else {
              let sx = 0;
              let sz = 0;
              for (const m of arr) {
                sx += m.position!.x;
                sz += m.position!.z;
              }
              const c = { x: sx / arr.length, z: sz / arr.length };
              const mk = L.marker(ll(c), { icon: clusterIcon(arr.length), riseOnHover: true });
              mk.on('click', () => map.flyTo(ll(c), Math.min(cfg.maxZoom, map.getZoom() + 2), { duration: 0.5 }));
              mk.addTo(grp);
            }
          }
        }
      };
      // LOD-гейт (§4): слой на карте только если включён фильтром И зум дорос до его тира.
      // Долю зум-спана нормируем на [minZoom,maxZoom] карты (как --marker-scale) — абсолютные
      // z-уровни непереносимы меж карт. Пересчёт на zoomend и при смене фильтра (vis-эффект).
      const zoomFrac = () => {
        const span = Math.max(0.001, cfg.maxZoom - cfg.minZoom);
        return Math.max(0, Math.min(1, (map.getZoom() - cfg.minZoom) / span));
      };
      const applyLayerVis = () => {
        const v = visRef.current;
        const frac = zoomFrac();
        for (const [key, grp] of Object.entries(groups)) {
          const on = v[key] && lodVisibleAt(key, frac);
          if (on) {
            if (!map.hasLayer(grp)) grp.addTo(map);
          } else if (map.hasLayer(grp)) {
            map.removeLayer(grp);
          }
        }
        for (const [key, grp] of Object.entries(looseGroups)) {
          const on = v[key] && lodVisibleAt(key, frac);
          if (on) {
            if (!map.hasLayer(grp)) grp.addTo(map);
            rebuildLoose(key); // кластер зависит от зума — пересобираем, пока слой виден
          } else if (map.hasLayer(grp)) {
            map.removeLayer(grp);
          }
        }
        // re-add пересоздаёт DOM маркеров → переприменить затемнение чужих этажей (§8).
        applyFloorRef.current(activeFloorRef.current);
      };
      applyLayerVisRef.current = applyLayerVis;
      map.on('zoomend', applyLayerVis);
      applyLayerVis();
    }

    // Гард от StrictMode-гонки: rAF мог сработать уже после размонтирования (map.remove()).
    // invalidateSize уточняет зум после осадки флекса → переоценить LOD на итоговом зуме.
    requestAnimationFrame(() => {
      if (mapRef.current !== map) return;
      map.invalidateSize();
      applyLayerVisRef.current();
    });

    // Контейнер на flex-1 получает высоту ПОСЛЕ init Leaflet (осадка флекса), плюс
    // фуллскрин / ресайз окна. Без переинвалидации карта остаётся чёрной.
    const resizeObs = new ResizeObserver(() => {
      if (mapRef.current !== map) return;
      map.invalidateSize();
      applyLayerVisRef.current();
    });
    resizeObs.observe(el);

    applyFloorRef.current(activeFloorRef.current);

    // Пульс-подсветка точек (спавны босса / ПКМ-цикл) — временные маркеры, гаснут через ~2.6с.
    const flashPoints = (pts: { x: number; z: number }[]) => {
      if (!flashRef.current) flashRef.current = L.layerGroup().addTo(map);
      const fg = flashRef.current;
      fg.clearLayers();
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      for (const p of pts) {
        L.marker(ll(p), {
          icon: L.divIcon({ className: 'cta-di', html: '<div class="cta-flash"></div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
          interactive: false,
          keyboard: false,
        }).addTo(fg);
      }
      flashTimerRef.current = setTimeout(() => fg.clearLayers(), 2600);
    };
    flashPointsRef.current = flashPoints;

    // Линейка: ЛКМ ставит точку замера, ПКМ — сброс. Активность читаем через ref (без ре-инита).
    const drawRuler = () => {
      if (!rulerLayerRef.current) rulerLayerRef.current = L.layerGroup().addTo(map);
      const g = rulerLayerRef.current;
      g.clearLayers();
      const pts = rulerPtsRef.current;
      if (!pts.length) return;
      const hasLabel = pts.length >= 2;
      if (hasLabel) L.polyline(pts.map(ll), { className: 'cta-ruler-line', interactive: false }).addTo(g);
      pts.forEach((p, i) => {
        // Последнюю точку помечает блок дистанции — точку-дубль тут не рисуем (иначе налезает на цифру).
        if (hasLabel && i === pts.length - 1) return;
        L.marker(ll(p), {
          icon: L.divIcon({ className: 'cta-di', html: '<div class="cta-ruler-dot"></div>', iconSize: [8, 8], iconAnchor: [4, 4] }),
          interactive: false,
          keyboard: false,
        }).addTo(g);
      });
      if (hasLabel) {
        let d = 0;
        for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        L.marker(ll(pts[pts.length - 1]), {
          icon: L.divIcon({ className: 'cta-di', html: `<div class="cta-ruler-label">${Math.round(d)} м</div>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
          interactive: false,
          keyboard: false,
        }).addTo(g);
      }
    };
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!rulerActiveRef.current) return;
      rulerPtsRef.current.push({ x: e.latlng.lng, z: e.latlng.lat });
      drawRuler();
    });
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      if (!rulerActiveRef.current) return;
      L.DomEvent.preventDefault(e.originalEvent);
      rulerPtsRef.current = [];
      drawRuler();
    });

    const api: MapViewerApi = {
      flyTo: (p, zoom) => map.flyTo(ll(p), zoom ?? Math.min(cfg.maxZoom, 4), { duration: 0.6 }),
      focusPoints: (pts) => {
        if (!pts.length) return;
        const lls = pts.map((p) => ll(p));
        if (lls.length === 1) map.flyTo(lls[0], Math.min(cfg.maxZoom, 4), { duration: 0.6 });
        else map.flyToBounds(L.latLngBounds(lls), { padding: [90, 90], maxZoom: cfg.maxZoom, duration: 0.6 });
        flashPoints(pts);
      },
      cycleToLayer: (keys) => cycleToLayer(keys),
      highlightZone: (outline) => {
        if (highlightRef.current) {
          highlightRef.current.remove();
          highlightRef.current = null;
        }
        if (objectivePinsRef.current) { objectivePinsRef.current.remove(); objectivePinsRef.current = null; }
        if (!outline || outline.length < 3) return;
        const poly = L.polygon(outline.map((o) => ll(o)), {
          className: 'cta-ex-zone cta-quest-zone ef-all',
          interactive: false,
        });
        poly.addTo(map);
        highlightRef.current = poly;
        map.flyToBounds(poly.getBounds(), { padding: [60, 60], maxZoom: cfg.maxZoom, duration: 0.6 });
      },
      showObjectivePoints: (points) => {
        // Пообъектные пины ВМЕСТО зоны (?quest= с possibleLocations): свой layerGroup вне фильтра/
        // LOD (гоча №2 скилла map-interactions), квест-иконка на каждой возможной позиции.
        // Снимаем и зону, и прошлые пины.
        if (highlightRef.current) { highlightRef.current.remove(); highlightRef.current = null; }
        if (objectivePinsRef.current) { objectivePinsRef.current.remove(); objectivePinsRef.current = null; }
        if (!points || !points.length) return;
        const icon = L.divIcon({
          className: 'cta-di',
          html: '<img src="/icons/eft/01-maps/markers/quest/quest-maker.svg" alt="" style="width:26px;height:26px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.65))" />',
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });
        const group = L.layerGroup();
        for (const p of points) {
          const mk = L.marker(ll(p), { icon, interactive: !!p.label, riseOnHover: true });
          if (p.label) mk.bindTooltip(p.label, { direction: 'top', offset: [0, -24] });
          mk.addTo(group);
        }
        group.addTo(map);
        objectivePinsRef.current = group;
        const lls = points.map((p) => ll(p));
        if (lls.length === 1) map.flyTo(lls[0], Math.min(cfg.maxZoom, 4), { duration: 0.6 });
        else map.flyToBounds(L.latLngBounds(lls), { padding: [80, 80], maxZoom: cfg.maxZoom, duration: 0.6 });
      },
      fitView: () => {
        if (cfg.bounds) map.fitBounds(bb(cfg.bounds));
      },
      toggleLayer: (key) => useMapViewStore.getState().toggleFilter(key),
    };
    onReady?.(api);

    return () => {
      cancelledSvg = true;
      resizeObs.disconnect();
      highlightRef.current = null;
      objectivePinsRef.current = null;
      svgGroupsRef.current = null;
      markersRef.current = [];
      layerGroupsRef.current = {};
      looseGroupsRef.current = {};
      looseMarkersRef.current = {};
      positionsByLayerRef.current = {};
      flashRef.current = null;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      rulerLayerRef.current = null;
      rulerPtsRef.current = [];
      loadImageRef.current = null;
      map.remove();
      mapRef.current = null;
      staticLayerRef.current = null;
      tileLayerRef.current = null;
      vectorOverlayRef.current = null;
      hdMarkerLayerRef.current = null;
      hdMarkerDataRef.current = null;
      setTileFloorRef.current = null;
      setMapInst(null);
    };
  }, [data, onReady, floors, isStatic, router]);

  // Статичная мульти-этажная карта: смена подложки текущего этажа (тайл-слой или SVG).
  useEffect(() => {
    if (!isStatic) return;
    if (isTiled) {
      setTileFloorRef.current?.(activeFloor);
      return;
    }
    const img = floors[activeFloor]?.image;
    if (img) loadImageRef.current?.(img);
  }, [activeFloor, isStatic, isTiled, floors]);

  // «Правка» (только статик): прячем боевой слой маркеров — его заменяет редактор.
  useEffect(() => {
    if (!isStatic) return;
    const l = staticLayerRef.current;
    const m = mapRef.current;
    if (!l || !m) return;
    if (editing) {
      m.removeLayer(l);
    } else {
      m.addLayer(l);
      applyFloorRef.current(activeFloorRef.current);
    }
  }, [editing, isStatic, mapInst]);

  // Видимость под-слоёв (интерактивная карта): фильтр × LOD-тир → add/remove L.LayerGroup.
  // Единая точка — applyLayerVis из init-эффекта (читает свежий visRef + зум; сам переприменяет этаж).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isStatic) return;
    applyLayerVisRef.current();
  }, [vis, isStatic, mapInst]);

  const rootCls = [
    'cta-map-root absolute inset-0 overflow-hidden bg-(--color-base)',
    data.config.soloFloors ? 'solo-floors' : '',
    rulerActive ? 'cta-ruler-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => {
    if (data.config.bounds) mapRef.current?.fitBounds(bb(data.config.bounds));
  };

  const setGroup = (keys: string[], value: boolean) =>
    useMapViewStore.getState().setGroupFilters(keys, value);

  // ФАЗА 0 единой системы (unified-markers.md): позиции editorial-моста по ключу слоя — чтобы
  // ПКМ-цикл по секции drawer'а долетал и до Wizard-маркеров. Только ИНДЕКС ПОЗИЦИЙ для чтения;
  // сами капли рисует editorial-слой — второй раз тут НЕ создаём (иначе дубль-рендер).
  const bridgePosByLayer = useMemo(() => {
    const out: Record<string, { x: number; z: number }[]> = {};
    for (const m of editorialBridge ?? []) {
      if (!m.position) continue;
      const key = layerKeyForMarker(m);
      if (key) (out[key] ??= []).push({ x: m.position.x, z: m.position.z });
    }
    return out;
  }, [editorialBridge]);
  const bridgePosByLayerRef = useRef(bridgePosByLayer);
  useEffect(() => {
    bridgePosByLayerRef.current = bridgePosByLayer;
  });

  // ПКМ по слою в drawer: подлёт к ближайшему объекту слоя; повтор — к следующему по циклу.
  const cycleToLayer = useCallback(
    (keys: string[]) => {
      const map = mapRef.current;
      if (!map) return;
      const list = keys.flatMap((k) => [
        ...(positionsByLayerRef.current[k] ?? []),
        ...(bridgePosByLayerRef.current[k] ?? []),
      ]);
      if (!list.length) return;
      const ck = keys.join(',');
      let idx = cycleCursorRef.current[ck];
      if (idx == null) {
        const c = map.getCenter();
        let best = 0;
        let bestD = Infinity;
        list.forEach((p, i) => {
          const d = map.distance(c, L.latLng(p.z, p.x));
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        idx = best;
      } else {
        idx = (idx + 1) % list.length;
      }
      cycleCursorRef.current[ck] = idx;
      const p = list[idx];
      map.flyTo([p.z, p.x], Math.min(data.config.maxZoom, 5), { duration: 0.5 });
      flashPointsRef.current([p]);
    },
    [data.config.maxZoom],
  );

  return (
    <div className={rootCls}>
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Карточка редакторского маркера — popup НАД каплей (позиция ставится эффектом).
          activeMarker = черновик (pending, без id) ЛИБО открытый сохранённый маркер. */}
      {activeMarker && (
        <div
          ref={editorialOverlayRef}
          className={`absolute z-[520] w-87 ${areaDraw || moveMarker ? 'pointer-events-none opacity-0' : ''}`}
          style={{ transform: 'translateX(-50%)' }}
        >
          <EditorialMarkerCard
            key={activeMarker.id ?? activeMarker.sourceMarkerId ?? 'new'}
            marker={activeMarker}
            linkedQuest={activeMarker.linkedQuest}
            linkedStory={activeMarker.linkedStory}
            linkedItem={activeMarker.linkedItem}
            canEdit={canEditMarkers}
            defaultEditing={!activeMarker.id && !activeMarker.sourceMarkerId}
            questIndex={questIndex}
            storyIndex={storyIndex}
            mapSlug={data.slug}
            onCancel={closeCard}
            onDrawArea={startAreaDraw}
            lootIndex={lootIndex}
            onMove={startMove}
            onHide={hideMarker}
            onMutated={() => {
              closeCard();
              router.refresh();
            }}
          />
        </div>
      )}

      {/* Read-only инфо-карточка — popup НАД меткой (замок→ключ / требования выхода). Позиция ставится эффектом. */}
      {infoMarker && (
        <div ref={infoCardRef} className="absolute z-[520] w-72" style={{ transform: 'translateX(-50%)' }}>
          {infoMarker.type === 'extract' ? (
            <ExtractCard marker={infoMarker} onClose={() => setInfoMarker(null)} />
          ) : (
            <LockKeyCard
              marker={infoMarker}
              sameKeyCount={lockSiblings.length}
              onHighlightSiblings={() => flashPointsRef.current(lockSiblings.map((m) => ({ x: m.position!.x, z: m.position!.z })))}
              onClose={() => setInfoMarker(null)}
            />
          )}
        </div>
      )}

      {/* Панель рисования области-лассо (карточка на это время спрятана, но смонтирована → черновик жив). */}
      {areaDraw && (
        <div className="absolute bottom-16 left-1/2 z-[560] flex -translate-x-1/2 items-center gap-3 rounded-sm border border-lines-hover bg-card-menu px-4 py-2 backdrop-blur-md">
          <span className="font-blender-medium text-xs text-text-secondary">
            Область: <span className="text-text-primary">ЛКМ</span> — точка · <span className="text-text-primary">ПКМ</span> — убрать · <span className="tabular-nums text-(--primary)">{areaCount}</span> точ.
          </span>
          <button
            type="button"
            onClick={finishAreaDraw}
            disabled={areaCount < 3}
            className="flex h-8 items-center gap-1.5 rounded-xs bg-(--primary) px-3 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Готово
          </button>
          <button
            type="button"
            onClick={cancelAreaDraw}
            className="flex h-8 items-center rounded-xs border border-lines-hover px-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:text-danger"
          >
            Отмена
          </button>
        </div>
      )}

      {/* Move-режим: курсор-пин (иконка маркера следит за мышью), панель-подсказка, подтверждение. */}
      {moveMarker && (
        <div
          ref={moveCursorRef}
          className="pointer-events-none fixed z-[600]"
          style={{ transform: 'translate(-50%, -100%)' }}
          dangerouslySetInnerHTML={{ __html: moveIconHtml }}
        />
      )}
      {moveMarker && !movePos && (
        <div className="absolute bottom-16 left-1/2 z-[560] flex -translate-x-1/2 items-center gap-2 rounded-sm border border-lines-hover bg-card-menu px-4 py-2 backdrop-blur-md">
          <span className="font-blender-medium text-xs text-text-secondary">
            Перемещение: <span className="text-text-primary">ЛКМ</span> — новая точка · <span className="text-text-primary">СКМ</span> — двигать карту · <span className="text-text-primary">Esc</span> — отмена
          </span>
        </div>
      )}
      {moveMarker && movePos && (
        <div className="absolute inset-0 z-[600] flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center gap-3 rounded-sm border border-lines-hover bg-card-menu px-6 py-4 backdrop-blur-md">
            <span className="font-blender-medium text-sm text-text-primary">Переместить маркер сюда?</span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={confirmMove}
                disabled={moveBusy}
                className="flex h-8 items-center gap-1.5 rounded-xs bg-(--primary) px-4 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Да
              </button>
              <button
                type="button"
                onClick={() => setMovePos(null)}
                disabled={moveBusy}
                className="flex h-8 items-center rounded-xs border border-lines-hover px-4 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary) disabled:opacity-50"
              >
                Заново
              </button>
              <button
                type="button"
                onClick={cancelMove}
                disabled={moveBusy}
                className="flex h-8 items-center rounded-xs border border-lines-hover px-4 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:text-danger disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {isStatic ? (
        // Старый статик-редактор ручных маркеров (git-данные). На editorial-картах (factory-hd)
        // скрыт — там маркеры правит визард через тулбар, а «Правка» дублировала и путала.
        data.config.editorial ? null : (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`absolute top-3 right-3 z-[550] flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest backdrop-blur-md transition-colors ${
              editing
                ? 'border-(--primary) bg-(--primary) text-(--color-base)'
                : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" /> Правка
          </button>
        )
      ) : (
        <MapLayersDrawer
          vis={vis}
          counts={counts}
          onToggle={(k) => useMapViewStore.getState().toggleFilter(k)}
          onSetGroup={setGroup}
          onCycle={cycleToLayer}
          open={layersOpen}
          onOpenChange={setLayersOpen}
          hasHeat={!!heatPoints?.length}
        />
      )}

      {!isStatic && canEditMarkers && (
        <MarkerDeletionDrawer
          marked={markedForDelete}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onUnmark={toggleDeleteMark}
          onConfirm={confirmDeleteMarks}
          busy={deleteBusy}
        />
      )}

      {/* Сквад — шаринг позиции (только карты с проекцией координат). */}
      {data.config.transform && (
        <SquadDrawer
          open={squadOpen}
          onOpenChange={setSquadOpen}
          currentMapId={squadMapId}
          initialCode={squadParam ?? undefined}
        />
      )}

      {/* Мобильный шит «Инструменты» (M2) — режимы правки/линейка/GPS из useMapUiStore + трекер. */}
      <MapToolsSheet canEditMarkers={!isStatic && canEditMarkers} tracker={tracker} />

      {/* Зум — левый край по центру (десктоп-only: на мобилке зум пинчем, по макету кнопок нет). */}
      <div className="absolute left-3.5 top-1/2 z-[500] hidden -translate-y-1/2 flex-col overflow-hidden rounded-sm border border-lines-hover bg-card-menu backdrop-blur-md lg:flex">
        {!!heatPoints?.length && (
          <button
            type="button"
            onClick={heatToggle}
            aria-label="Тепловая карта денег"
            aria-pressed={heatActive}
            title={heatActive ? 'Скрыть тепловую карту денег' : 'Тепловая карта денег (EV лута)'}
            className={`flex h-9 w-9 items-center justify-center border-b border-lines-hover transition-colors hover:bg-lines-hover hover:text-(--primary) ${heatActive ? 'bg-lines-hover text-(--primary)' : 'text-text-secondary'}`}
          >
            <Flame className="h-5.5 w-5.5" />
          </button>
        )}
        <button type="button" onClick={zoomIn} aria-label="Приблизить" className="flex h-9 w-9 items-center justify-center border-b border-lines-hover text-text-secondary transition-colors hover:bg-lines-hover hover:text-(--primary)">
          <Plus className="h-5.5 w-5.5" />
        </button>
        <button type="button" onClick={zoomOut} aria-label="Отдалить" className="flex h-9 w-9 items-center justify-center border-b border-lines-hover text-text-secondary transition-colors hover:bg-lines-hover hover:text-(--primary)">
          <Minus className="h-5.5 w-5.5" />
        </button>
        <button type="button" onClick={resetView} aria-label="Сбросить вид" className="flex h-9 w-9 items-center justify-center text-text-secondary transition-colors hover:bg-lines-hover hover:text-(--primary)">
          <LocateFixed className="h-5.5 w-5.5" />
        </button>
      </div>

      {/* Позиция + трекер (низ-право, десктоп-only: на мобилке слои/поиск в нижнем доке, GPS — в шите «Инструменты»). */}
      <div className="absolute right-3.5 bottom-3.5 z-[500] hidden flex-col items-end gap-2 lg:flex">

        {/* Трекер позиции игрока + координаты (низ-право, GRILL-2). Только карты с проекцией. */}
        {data.config.transform && (
          <div className="flex flex-col items-end gap-1.5">
            {tracker.active && pose && (
              <span className="rounded-xs bg-(--color-base)/80 px-2 py-1 font-blender-medium text-type-micro tabular-nums text-(--primary) backdrop-blur-md">
                X {Math.round(pose.x)} · Y {Math.round(pose.z)}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              {tracker.active && (
                <button
                  type="button"
                  onClick={tracker.toggleFollow}
                  aria-label="Следовать за игроком"
                  title="Следовать за игроком"
                  className={`flex h-9 w-9 items-center justify-center rounded-sm border backdrop-blur-md transition-colors ${
                    tracker.follow
                      ? 'border-(--primary) bg-(--primary) text-(--color-base)'
                      : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
                  }`}
                >
                  <Navigation className="h-5.5 w-5.5" />
                </button>
              )}
              <button
                type="button"
                onClick={tracker.toggle}
                disabled={!tracker.supported && !tracker.active}
                title={
                  !tracker.supported && !tracker.active
                    ? 'Нужен Chrome/Edge на ПК'
                    : tracker.active
                      ? 'Слежу за позицией'
                      : 'Определить позицию'
                }
                aria-label="Определить позицию"
                className={`flex h-9 w-9 items-center justify-center rounded-sm border backdrop-blur-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  tracker.active
                    ? 'border-(--primary) bg-(--primary) text-(--color-base)'
                    : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
                }`}
              >
                <Crosshair className={`h-5.5 w-5.5 ${tracker.requesting ? 'animate-pulse' : ''}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isStatic && mapInst && !data.config.editorial ? (
        <MapMarkerEditor
          map={mapInst}
          activeFloor={activeFloor}
          slug={data.slug}
          floorName={floors[activeFloor]?.name ?? '—'}
          initial={data.markers}
          editing={editing}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}