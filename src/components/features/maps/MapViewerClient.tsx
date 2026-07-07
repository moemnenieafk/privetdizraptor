'use client';

import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Minus, Pencil, Plus } from 'lucide-react';
import { buildMapFloors, type EftMapConfig } from '@/data/eft-map-config';
import { MapMarkerEditor } from './MapMarkerEditor';
import { MapLayersDrawer } from './MapLayersDrawer';
import { manualMarkerIcon } from './manual-marker-icon';
import { ALL_LAYER_ITEMS, defaultLayerVisibility, layerKeyForMarker } from './map-layers';
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

function scaledBounds(b: [[number, number], [number, number]], f: number): L.LatLngBoundsExpression {
  const cx = (b[0][0] + b[1][0]) / 2;
  const cy = (b[0][1] + b[1][1]) / 2;
  const w = (b[1][0] - b[0][0]) * f;
  const h = (b[1][1] - b[0][1]) * f;
  return [
    [cy - h / 2, cx - w / 2],
    [cy + h / 2, cx + w / 2],
  ];
}

const ll = (p: { x: number; z: number }): [number, number] => [p.z, p.x];

/* ───────────────── маркеры ───────────────── */
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const spawnKind = (m: MapViewMarker): string => {
  const c = m.categories ?? [];
  if (c.includes('boss')) return 'boss';
  if (c.includes('sniper')) return 'sniper';
  const s = (m.sides ?? [])[0]?.toLowerCase();
  return s === 'pmc' || s === 'scav' ? s : 'all';
};

/** Иконка маркера вьюера — через общий резолвер (webp/svg/плейсхолдер), без подписи (она в тултипе). */
const markerDivIcon = (m: MapViewMarker): L.DivIcon => manualMarkerIcon(m, false, false);

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
      const kn = { pmc: 'Спавн ЧВК', scav: 'Спавн Диких', boss: 'Спавн босса', sniper: 'Снайпер', all: 'Спавн' }[k] ?? 'Спавн';
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
}: {
  data: MapView;
  onReady?: (api: MapViewerApi) => void;
  activeFloor?: number;
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
  const rebuildLooseRef = useRef<(key?: string) => void>(() => {});
  // Позиции маркеров по под-слою (для ПКМ-цикла в drawer) + курсор цикла + слой пульс-подсветки.
  const positionsByLayerRef = useRef<Record<string, { x: number; z: number }[]>>({});
  const cycleCursorRef = useRef<Record<string, number>>({});
  const flashRef = useRef<L.LayerGroup | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashPointsRef = useRef<(pts: { x: number; z: number }[]) => void>(() => {});

  const [vis, setVis] = useState<Record<string, boolean>>(() => defaultLayerVisibility());
  const visRef = useRef(vis);
  useEffect(() => {
    visRef.current = vis;
  });

  const [editing, setEditing] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1',
  );
  const [mapInst, setMapInst] = useState<L.Map | null>(null);
  const staticLayerRef = useRef<L.LayerGroup | null>(null);

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
        el.style.display = visible ? '' : 'none';
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
      maxZoom: cfg.maxZoom,
      maxBoundsViscosity: 0.6,
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
      map.setMaxBounds(scaledBounds(cfg.bounds, 1.5));
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
      rebuildLooseRef.current = rebuildLoose;
      map.on('zoomend', () => {
        const v = visRef.current;
        for (const key of Object.keys(looseGroups)) if (v[key]) rebuildLoose(key);
      });

      // Начальная видимость слоёв.
      const v0 = visRef.current;
      for (const [key, grp] of Object.entries(groups)) if (v0[key]) grp.addTo(map);
      for (const [key, grp] of Object.entries(looseGroups))
        if (v0[key]) {
          grp.addTo(map);
          rebuildLoose(key);
        }
    }

    // Гард от StrictMode-гонки: rAF мог сработать уже после размонтирования (map.remove()).
    requestAnimationFrame(() => {
      if (mapRef.current === map) map.invalidateSize();
    });
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
      toggleLayer: (key) => setVis((p) => (key in p ? { ...p, [key]: !p[key] } : p)),
    };
    onReady?.(api);

    return () => {
      cancelledSvg = true;
      highlightRef.current = null;
      svgGroupsRef.current = null;
      markersRef.current = [];
      layerGroupsRef.current = {};
      looseGroupsRef.current = {};
      looseMarkersRef.current = {};
      positionsByLayerRef.current = {};
      flashRef.current = null;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
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

  // Видимость под-слоёв (интерактивная карта): add/remove L.LayerGroup + пересбор кластера.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isStatic) return;
    for (const [key, grp] of Object.entries(layerGroupsRef.current)) {
      if (vis[key]) {
        if (!map.hasLayer(grp)) grp.addTo(map);
      } else if (map.hasLayer(grp)) {
        map.removeLayer(grp);
      }
    }
    for (const [key, grp] of Object.entries(looseGroupsRef.current)) {
      if (vis[key]) {
        if (!map.hasLayer(grp)) grp.addTo(map);
        rebuildLooseRef.current(key);
      } else if (map.hasLayer(grp)) {
        map.removeLayer(grp);
      }
    }
    applyFloorRef.current(activeFloorRef.current);
  }, [vis, isStatic, mapInst]);

  const rootCls = ['cta-map-root absolute inset-0 overflow-hidden bg-(--color-base)', data.config.soloFloors ? 'solo-floors' : '']
    .filter(Boolean)
    .join(' ');

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => {
    if (data.config.bounds) mapRef.current?.fitBounds(bb(data.config.bounds));
  };

  const setGroup = (keys: string[], value: boolean) =>
    setVis((p) => ({ ...p, ...Object.fromEntries(keys.map((k) => [k, value])) }));

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

      {isStatic ? (
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`absolute top-3 right-3 z-[550] flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest backdrop-blur-md transition-colors ${
            editing
              ? 'border-(--primary) bg-(--primary) text-(--color-base)'
              : 'border-lines-hover bg-(--color-base)/80 text-text-secondary hover:text-(--primary)'
          }`}
        >
          <Pencil className="h-3.5 w-3.5" /> Правка
        </button>
      ) : (
        <MapLayersDrawer
          vis={vis}
          counts={counts}
          onToggle={(k) => setVis((p) => ({ ...p, [k]: !p[k] }))}
          onSetGroup={setGroup}
          onCycle={cycleToLayer}
        />
      )}

      {/* Зум + атрибуция */}
      <div className="absolute right-3 bottom-3 z-[500] flex flex-col items-end gap-2">
        <div className="flex flex-col overflow-hidden rounded-sm border border-lines-hover bg-(--color-base)/80 backdrop-blur-md">
          <button type="button" onClick={zoomIn} aria-label="Приблизить" className="border-b border-lines-hover p-2 text-text-secondary transition-colors hover:bg-card-menu hover:text-(--primary)">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={zoomOut} aria-label="Отдалить" className="border-b border-lines-hover p-2 text-text-secondary transition-colors hover:bg-card-menu hover:text-(--primary)">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" onClick={resetView} aria-label="Сбросить вид" className="p-2 text-text-secondary transition-colors hover:bg-card-menu hover:text-(--primary)">
            <LocateFixed className="h-4 w-4" />
          </button>
        </div>
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
