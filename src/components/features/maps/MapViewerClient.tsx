'use client';

import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  DoorOpen,
  Footprints,
  Layers,
  LocateFixed,
  Minus,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react';
import { buildMapFloors, type EftMapConfig } from '@/data/eft-map-config';
import { MapLegend } from './MapLegend';
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

function iconFor(m: MapViewMarker): L.DivIcon {
  switch (m.type) {
    case 'extract': {
      const f = (m.faction || 'all').toLowerCase();
      return L.divIcon({
        className: 'cta-di',
        html: `<div class="cta-mk cta-extract ef-${f}"><i class="cta-ex-dot"></i><span class="cta-ex-name">${esc(m.label || 'Выход')}</span></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
    }
    case 'spawn': {
      const k = spawnKind(m);
      return L.divIcon({
        className: 'cta-di',
        html: `<div class="cta-mk cta-spawn ss-${k}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
    }
    case 'transit':
      return L.divIcon({
        className: 'cta-di',
        html: `<div class="cta-mk cta-transit">⇄</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
    default:
      return L.divIcon({
        className: 'cta-di',
        html: `<div class="cta-mk cta-hazard">⚠</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
  }
}

function tooltipFor(m: MapViewMarker): string {
  const head = (cls: string, t: string) => `<div class="cta-tip-h ${cls}">${esc(t)}</div>`;
  if (m.type === 'extract') {
    const fac = { pmc: 'ЧВК', scav: 'Дикий', shared: 'Общий', all: 'Общий' }[(m.faction || 'all').toLowerCase()] ?? 'Выход';
    const ti = m.meta?.transferItem as { name?: string; count?: number } | null | undefined;
    const item = ti?.name ? `<div class="cta-tip-sub">Нужен предмет: ${esc(ti.name)}${ti.count && ti.count > 1 ? ` ×${ti.count}` : ''}</div>` : '';
    return `${head('t-extract', m.label || 'Выход')}<div class="cta-tip-sub">${fac}</div>${item}`;
  }
  if (m.type === 'spawn') {
    const k = spawnKind(m);
    const kn = { pmc: 'Спавн ЧВК', scav: 'Спавн Диких', boss: 'Спавн босса', sniper: 'Снайпер', all: 'Спавн' }[k] ?? 'Спавн';
    return `${head('t-spawn', kn)}${m.label ? `<div class="cta-tip-sub">${esc(m.label)}</div>` : ''}`;
  }
  if (m.type === 'transit') {
    return `${head('t-transit', m.label || 'Переход')}`;
  }
  return `${head('t-hazard', m.label || 'Опасность')}`;
}

/* ───────────────── компонент ───────────────── */
type LayerKey = 'extract' | 'spawn' | 'transit' | 'hazard';
type Faction = 'all' | 'pmc' | 'scav';

const LAYER_META: { key: LayerKey; label: string; Icon: typeof DoorOpen }[] = [
  { key: 'extract', label: 'Выходы', Icon: DoorOpen },
  { key: 'spawn', label: 'Спавны', Icon: Footprints },
  { key: 'transit', label: 'Переходы', Icon: ArrowLeftRight },
  { key: 'hazard', label: 'Опасности', Icon: TriangleAlert },
];

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
  const markersRef = useRef<{ marker: L.Marker; top: number | null; bottom: number | null }[]>([]);
  const svgGroupsRef = useRef<Map<string, SVGGElement> | null>(null);
  const activeFloorRef = useRef(activeFloor);
  // Загрузчик подложки (для статичных мульти-этажных карт: смена этажа = смена SVG).
  const loadImageRef = useRef<((url: string) => void) | null>(null);

  const [vis, setVis] = useState<Record<LayerKey, boolean>>({
    extract: true,
    spawn: true,
    transit: true,
    hazard: true,
  });
  const [faction, setFaction] = useState<Faction>('all');
  const [sel, setSel] = useState<'pmc' | 'scav' | null>(null);

  const counts = useMemo(() => {
    const c: Record<LayerKey, number> = { extract: 0, spawn: 0, transit: 0, hazard: 0 };
    for (const m of data.markers) if (m.type in c) c[m.type as LayerKey]++;
    return c;
  }, [data.markers]);

  const floors = useMemo(() => buildMapFloors(data.config), [data.config]);
  // Статичная карта (наш арт): только подложка + зум/пан, без маркер-UI (слои/фракция/легенда/поиск).
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
      for (const { marker, top, bottom } of markersRef.current) {
        const el = marker.getElement();
        if (!el) continue;
        let visible: boolean;
        if (top == null && bottom == null) visible = isGround; // без высоты → только наземный
        else if (!range) visible = true; // этаж без диапазона → показать всё
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

  // Реакция на переключение этажа (без пересоздания карты).
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

    // SVG-подложка живёт в DOM (инлайн-svgOverlay, не <img>) → <g>-группы этажей доступны
    // для затемнения/блюра. При сбое загрузки — фолбэк на растровый overlay (без этажей).
    let cancelledSvg = false;
    let overlay: L.Layer | null = null;
    const imgBounds: L.LatLngBounds | null = cfg.bounds
      ? cfg.svgBounds
        ? bb(cfg.svgBounds)
        : bb(cfg.bounds)
      : null;

    // Грузит SVG-подложку инлайном (svgOverlay → <g>-группы этажей доступны для затемнения).
    // Для статичных мульти-этажных карт вызывается повторно при смене этажа — меняет подложку.
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
      if (!isStatic) loadImage(data.imageUrl); // статичная карта: подложку грузит эффект этажа
      map.fitBounds(bb(cfg.bounds));
    }

    // слои маркеров
    const groups: Record<LayerKey, L.LayerGroup> = {
      extract: L.layerGroup().addTo(map),
      spawn: L.layerGroup().addTo(map),
      transit: L.layerGroup().addTo(map),
      hazard: L.layerGroup().addTo(map),
    };

    markersRef.current = [];
    for (const m of data.markers) {
      if (!m.position) continue;
      const key = m.type as LayerKey;
      if (!groups[key]) continue;
      const marker = L.marker(ll(m.position), { icon: iconFor(m), riseOnHover: true });
      marker.bindTooltip(tooltipFor(m), {
        className: 'cta-tip',
        direction: 'top',
        offset: [0, -8],
        opacity: 1,
      });
      // полигон зоны выхода — на ховер
      if (m.type === 'extract' && m.outline && m.outline.length > 2) {
        const poly = L.polygon(m.outline.map(ll), {
          className: `cta-ex-zone ef-${(m.faction || 'all').toLowerCase()}`,
          interactive: false,
        });
        marker.on('mouseover', () => poly.addTo(groups.extract));
        marker.on('mouseout', () => poly.remove());
      }
      if (m.type === 'spawn') {
        const k = spawnKind(m);
        if (k === 'pmc' || k === 'scav') marker.on('click', () => setSel((p) => (p === k ? null : k)));
      }
      marker.addTo(groups[key]);
      markersRef.current.push({ marker, top: m.top, bottom: m.bottom });
    }

    map.on('click', () => setSel(null));
    // Гард от StrictMode-гонки: rAF мог сработать уже после размонтирования (map.remove()).
    requestAnimationFrame(() => {
      if (mapRef.current === map) map.invalidateSize();
    });
    applyFloorRef.current(activeFloorRef.current); // первичный фильтр маркеров по этажу

    // Императивный API для фрейма (поиск, перелёт/подсветка зоны квеста).
    const api: MapViewerApi = {
      flyTo: (p, zoom) => map.flyTo(ll(p), zoom ?? Math.min(cfg.maxZoom, 4), { duration: 0.6 }),
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
      toggleLayer: (key) => setVis((p) => (key in p ? { ...p, [key]: !p[key as LayerKey] } : p)),
    };
    onReady?.(api);

    return () => {
      cancelledSvg = true;
      highlightRef.current = null;
      svgGroupsRef.current = null;
      markersRef.current = [];
      loadImageRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [data, onReady, floors, isStatic]);

  // Статичная мульти-этажная карта: у каждого этажа своя SVG-подложка → смена этажа меняет overlay.
  useEffect(() => {
    if (!isStatic) return;
    const url = floors[activeFloor]?.image ?? data.imageUrl;
    if (url) loadImageRef.current?.(url);
  }, [activeFloor, isStatic, floors, data.imageUrl]);

  const rootCls = [
    'cta-map-root absolute inset-0 overflow-hidden bg-(--color-base)',
    vis.extract ? '' : 'hide-extract',
    vis.spawn ? '' : 'hide-spawn',
    vis.transit ? '' : 'hide-transit',
    vis.hazard ? '' : 'hide-hazard',
    `fac-${faction}`,
    sel ? `sel-${sel}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const factionLabel = { pmc: 'ЧВК', scav: 'Диких' }[sel ?? 'pmc'];

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => {
    if (data.config.bounds) mapRef.current?.fitBounds(bb(data.config.bounds));
  };

  return (
    <div className={rootCls}>
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {!isStatic && (
        <>
      {/* Фракция (фильтр выходов по стороне) — заголовок/статы/назад живут во фрейме */}
      <div className="absolute top-3 left-3 z-[500] inline-flex w-fit overflow-hidden rounded-sm border border-lines-hover bg-(--color-base)/80 backdrop-blur-md">
        {(['all', 'pmc', 'scav'] as Faction[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFaction(f)}
            className={`px-3 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest transition-colors ${
              faction === f ? 'bg-(--primary) text-(--color-base)' : 'text-text-muted hover:text-(--primary)'
            }`}
          >
            {{ all: 'Все', pmc: 'ЧВК', scav: 'Дикие' }[f]}
          </button>
        ))}
      </div>

      {/* Панель слоёв */}
      <div className="absolute top-3 right-3 z-[500] w-52 rounded-sm border border-lines-hover bg-(--color-base)/80 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-lines-hover px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          <Layers className="h-3.5 w-3.5" /> Слои
        </div>
        <div className="flex flex-col p-1.5">
          {LAYER_META.map(({ key, label, Icon }) => {
            const on = vis[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setVis((p) => ({ ...p, [key]: !p[key] }))}
                className={`group flex items-center gap-2.5 rounded-xs px-2.5 py-2 text-left transition-colors ${
                  on ? 'text-text-primary hover:bg-card-menu' : 'text-text-muted/60 hover:bg-card-menu'
                }`}
              >
                <Icon className={`h-4 w-4 ${on ? 'text-(--primary)' : 'text-text-muted/50'}`} />
                <span className="flex-1 font-blender-medium text-sm uppercase tracking-wider">{label}</span>
                <span className="font-blender-medium text-type-caption text-text-muted tabular-nums">{counts[key]}</span>
                <span
                  className={`h-3.5 w-3.5 rounded-full border transition-colors ${
                    on ? 'border-(--primary) bg-(--primary)' : 'border-lines-hover bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Легенда (единая таблица соответствия иконок ЦТА) */}
      <MapLegend />

      {/* Подсказка spawn→extract */}
      {sel ? (
        <div className="absolute bottom-3 left-1/2 z-[500] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-sm border border-(--primary)/50 bg-(--color-base)/90 px-4 py-2 backdrop-blur-md">
            <Footprints className="h-4 w-4 text-(--primary)" />
            <span className="font-blender-medium text-sm uppercase tracking-wider text-text-primary">
              Выходы для {factionLabel}
            </span>
            <button type="button" onClick={() => setSel(null)} className="text-text-muted transition-colors hover:text-(--primary)">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
        </>
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
    </div>
  );
}
