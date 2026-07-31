'use client';

import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crosshair, LocateFixed, MapPin, Minus, Navigation, Pencil, Plus, SquarePen, Trash2 } from 'lucide-react';
import { buildMapFloors, type EftMapConfig } from '@/data/eft-map-config';
import { MapMarkerEditor } from './MapMarkerEditor';
import { MapLayersDrawer } from './MapLayersDrawer';
import { MarkerDeletionDrawer } from './MarkerDeletionDrawer';
import { useEftTracker } from './PlayerTracker';
import { MobileMapBar } from './MobileMapBar';
import { useMapUiStore } from '@/store/useMapUiStore';
import { useMapViewStore } from '@/store/useMapViewStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import { mapIconClass } from '@/data/map-icons';
import { useRouter } from 'next/navigation';
import { manualMarkerIcon } from './manual-marker-icon';
import { markerColor, isItemId } from '@/data/map-marker-icons';
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
  canEditMarkers?: boolean;
  mapId?: string;
  questIndex?: QuestIndexItem[];
  storyIndex?: StoryIndexItem[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const highlightRef = useRef<L.Polygon | null>(null);
  const markersRef = useRef<{ marker: L.Marker; top: number | null; bottom: number | null; floor?: number | null }[]>([]);
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

  // Слой редакторских маркеров (editorial_markers) — изолированный эффект (не трогает init).
  // Всегда виден (кураторские точки, их мало); клик открывает карточку-popup НАД каплей.
  const router = useRouter();
  const editorialLayerRef = useRef<L.LayerGroup | null>(null);
  const [openEditorialId, setOpenEditorialId] = useState<string | null>(null);
  const openEditorial = editorialMarkers?.find((m) => m.id === openEditorialId) ?? null;
  const editorialOverlayRef = useRef<HTMLDivElement | null>(null);
  // Режим постановки маркера (admin/editor): следующий клик по карте открывает ЧЕРНОВИК.
  const [addMode, setAddMode] = useState(false);
  // Черновик нового маркера (в памяти) — INSERT только на «Сохранить», не на клик по карте.
  const [pendingMarker, setPendingMarker] = useState<EditorialMarkerData | null>(null);
  const activeMarker = pendingMarker ?? openEditorial;
  const closeCard = () => {
    setOpenEditorialId(null);
    setPendingMarker(null);
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
  const [overrideMode, setOverrideMode] = useState(false);
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
    for (const m of editorialMarkers ?? []) {
      if (!m.id) continue;
      const id = m.id;
      const icon = editorialIcon(m);
      // Область-лассо → пунктирный полигон с заливкой цветом категории + иконка в центроиде.
      if (m.polygon && m.polygon.length >= 3) {
        const color = markerColor(m.type);
        const poly = L.polygon(m.polygon.map(ll), { color, weight: 2, dashArray: '6 5', fillColor: color, fillOpacity: 0.18 });
        if (m.title) poly.bindTooltip(m.title, { className: 'cta-tip', direction: 'top', opacity: 1 });
        poly.on('click', () => setOpenEditorialId(id));
        poly.addTo(group);
        const cx = m.polygon.reduce((s, p) => s + p.x, 0) / m.polygon.length;
        const cz = m.polygon.reduce((s, p) => s + p.z, 0) / m.polygon.length;
        L.marker(ll({ x: cx, z: cz }), { icon, interactive: false }).addTo(group);
        continue;
      }
      const mk = L.marker(ll({ x: m.x, z: m.z }), { icon, riseOnHover: true });
      if (m.title) mk.bindTooltip(m.title, { className: 'cta-tip', direction: 'top', offset: [0, -18], opacity: 1 });
      mk.on('click', () => setOpenEditorialId(id));
      mk.addTo(group);
    }
    return () => {
      group.remove();
      editorialLayerRef.current = null;
    };
  }, [mapInst, editorialMarkers]);

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
  }, [mapInst, addMode, mapId]);

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

  // Открытость панели слоёв поднята в стор (§E11 каркас #1): десктоп-триггер живёт в верхнем
  // баре (MapFrame), мобильный — в MobileMapBar; оба пишут в один useMapUiStore.
  const layersOpen = useMapUiStore((s) => s.layersOpen);
  const setLayersOpen = useMapUiStore((s) => s.setLayersOpen);
  const toggleLayers = useMapUiStore((s) => s.toggleLayers);
  // Drawer «Удаление маркеров» + список помеченных.
  const deleteMarks = useMapUiStore((s) => s.deleteMarks);
  const deleteOpen = useMapUiStore((s) => s.deleteOpen);
  const setDeleteOpen = useMapUiStore((s) => s.setDeleteOpen);
  const toggleDelete = useMapUiStore((s) => s.toggleDelete);
  const toggleDeleteMark = useMapUiStore((s) => s.toggleDeleteMark);
  const clearDeleteMarks = useMapUiStore((s) => s.clearDeleteMarks);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const markedForDelete = useMemo(
    () => (editorialMarkers ?? []).filter((m) => m.id && deleteMarks.includes(m.id)),
    [editorialMarkers, deleteMarks],
  );
  const confirmDeleteMarks = async () => {
    if (markedForDelete.length === 0) return;
    setDeleteBusy(true);
    try {
      for (const m of markedForDelete) {
        if (!m.id) continue;
        const res = await fetch(`/api/admin/editorial-markers?id=${m.id}&slug=${data.slug}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      clearDeleteMarks();
      setDeleteOpen(false);
      closeCard();
      router.refresh();
    } catch (e) {
      console.error('[editorial-marker batch delete]', e);
      alert('Не удалось удалить помеченные маркеры');
    } finally {
      setDeleteBusy(false);
    }
  };

  // Инстанс трекера один (нужен mapRef здесь). Кнопка+координаты живут в низ-право (GRILL-2),
  // рендерятся ниже прямо из этого хука — публикация наверх больше не нужна.
  const tracker = useEftTracker({ mapRef, config: data.config, floors, onRequestFloor });
  // Координаты игрока для readout низ-право (pose обновляется трекером ~1/сек — дёшево).
  const pose = useTrackingStore((s) => s.pose);

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
      crs: makeCRS(cfg),
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
    const imgBounds: L.LatLngBounds | null = cfg.bounds
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

    if (cfg.bounds) {
      // Без maxBounds — карту можно свободно увести в сторону (не «отпружинивает» к центру).
      if (!isStatic) loadImage(data.imageUrl);
      map.fitBounds(bb(cfg.bounds));
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
        // Клик: в override-режиме (admin) → карточка-оверрайд; иначе кросс-линк (квест-зона→задача, лут→предмет).
        marker.on('click', () => {
          if (overrideModeRef.current) return openOverrideRef.current(m);
          if (m.type === 'quest' && m.questId) window.open(`/eft/quests/task/${m.questId}`, '_blank', 'noopener');
          else if (m.itemSlug) window.open(`/eft/items/item/${m.itemSlug}`, '_blank', 'noopener');
        });
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
                if (overrideModeRef.current) return openOverrideRef.current(m);
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
      highlightZone: (outline) => {
        if (highlightRef.current) {
          highlightRef.current.remove();
          highlightRef.current = null;
        }
        if (!outline || outline.length < 3) return;
        const poly = L.polygon(outline.map((o) => ll(o)), {
          className: 'cta-ex-zone cta-quest-zone ef-all',
          interactive: false,
        });
        poly.addTo(map);
        highlightRef.current = poly;
        map.flyToBounds(poly.getBounds(), { padding: [60, 60], maxZoom: cfg.maxZoom, duration: 0.6 });
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
      setMapInst(null);
    };
  }, [data, onReady, floors, isStatic]);

  // Статичная мульти-этажная карта: подгрузка SVG-подложки текущего этажа.
  useEffect(() => {
    if (!isStatic) return;
    const img = floors[activeFloor]?.image;
    if (img) loadImageRef.current?.(img);
  }, [activeFloor, isStatic, floors]);

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

  // ПКМ по слою в drawer: подлёт к ближайшему объекту слоя; повтор — к следующему по циклу.
  const cycleToLayer = useCallback(
    (keys: string[]) => {
      const map = mapRef.current;
      if (!map) return;
      const list = keys.flatMap((k) => positionsByLayerRef.current[k] ?? []);
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
      ) : (
        <MapLayersDrawer
          vis={vis}
          counts={counts}
          onToggle={(k) => useMapViewStore.getState().toggleFilter(k)}
          onSetGroup={setGroup}
          onCycle={cycleToLayer}
          open={layersOpen}
          onOpenChange={setLayersOpen}
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

      <MobileMapBar
        activeMapIconClass={mapIconClass(data.slug)}
        activeMapName={data.name}
        tracker={tracker}
        hasLayers={!isStatic}
        layersOpen={layersOpen}
        onLayersToggle={toggleLayers}
      />

      {/* Зум + атрибуция */}
      <div className="absolute right-3.5 bottom-3.5 z-[500] flex flex-col items-end gap-2">
        {canEditMarkers && !isStatic && (
          <button
            type="button"
            onClick={() => {
              setAddMode((v) => !v);
              setOverrideMode(false);
            }}
            aria-pressed={addMode}
            title={addMode ? 'Отмена постановки — кликните по карте, чтобы поставить маркер' : 'Поставить маркер на карте'}
            className={`flex h-9 w-9 items-center justify-center rounded-sm border backdrop-blur-md transition-colors ${
              addMode
                ? 'border-(--primary) bg-(--primary) text-(--color-base)'
                : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
            }`}
          >
            <MapPin className="h-4.5 w-4.5" />
          </button>
        )}
        {canEditMarkers && !isStatic && (
          <button
            type="button"
            onClick={() => {
              setOverrideMode((v) => !v);
              setAddMode(false);
            }}
            aria-pressed={overrideMode}
            title={overrideMode ? 'Выключить правку синканных (клик по маркеру = ссылка)' : 'Править синканные маркеры: клик по маркеру → карточка-оверрайд'}
            className={`flex h-9 w-9 items-center justify-center rounded-sm border backdrop-blur-md transition-colors ${
              overrideMode
                ? 'border-(--primary) bg-(--primary) text-(--color-base)'
                : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
            }`}
          >
            <SquarePen className="h-4.5 w-4.5" />
          </button>
        )}
        {canEditMarkers && !isStatic && (
          <button
            type="button"
            onClick={toggleDelete}
            aria-pressed={deleteOpen}
            title="Удаление маркеров (помеченные на удаление)"
            className={`relative flex h-9 w-9 items-center justify-center rounded-sm border backdrop-blur-md transition-colors ${
              deleteOpen ? 'border-danger bg-danger text-(--color-base)' : 'border-lines-hover bg-card-menu text-text-secondary hover:text-danger'
            }`}
          >
            <Trash2 className="h-4.5 w-4.5" />
            {deleteMarks.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-blender-medium text-[9px] text-(--color-base) tabular-nums">
                {deleteMarks.length}
              </span>
            )}
          </button>
        )}
        <div className="flex flex-col overflow-hidden rounded-sm border border-lines-hover bg-card-menu backdrop-blur-md">
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
        {data.author ? (
          <span className="rounded-xs bg-(--color-base)/70 px-2 py-0.5 font-blender-book text-[10px] tracking-wide text-text-muted/70 backdrop-blur-md">
            Карта: {data.author}
          </span>
        ) : null}
      </div>

      {isStatic && mapInst ? (
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