'use client';

import * as L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapViewMarker } from './map-types';
import type { ManualMapMarker } from '@/data/map-markers';

/**
 * Дев-инструмент расстановки маркеров на СТАТИК-карте (вкл. через `?edit=1`).
 * Клик по карте → маркер выбранного типа на текущем этаже. Экспорт → TS в буфер
 * (вставить в `src/data/map-markers/{slug}.ts`). Не пишет в БД — наши данные живут в git.
 */

const TYPES: { key: string; label: string; color: string }[] = [
  { key: 'extract', label: 'Выход', color: '#5FB85B' },
  { key: 'spawn', label: 'Спавн', color: '#E6A23C' },
  { key: 'transit', label: 'Переход', color: '#5FA8D8' },
  { key: 'hazard', label: 'Опасн.', color: '#E5484D' },
  { key: 'lock', label: 'Замок', color: '#BDA550' },
  { key: 'switch', label: 'Рычаг', color: '#C26BE0' },
  { key: 'loot', label: 'Лут', color: '#9696A1' },
];
const colorOf = (t: string): string => TYPES.find((x) => x.key === t)?.color ?? '#9696A1';
const camel = (s: string): string => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function editIcon(m: ManualMapMarker): L.DivIcon {
  const c = colorOf(m.type);
  return L.divIcon({
    className: 'cta-edit-di',
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${c};border:2px solid #141416;box-shadow:0 0 0 1px ${c}"></span>${
      m.label ? `<span style="position:absolute;left:18px;top:0;font-size:10px;color:#F2F2F2;text-shadow:0 1px 3px #000;white-space:nowrap">${m.label}</span>` : ''
    }`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function fromView(initial: MapViewMarker[]): ManualMapMarker[] {
  return initial
    .filter((m) => m.position)
    .map((m) => ({
      id: m.id,
      type: m.type,
      floor: m.floor ?? 0,
      x: m.position!.x,
      z: m.position!.z,
      label: m.label ?? undefined,
      faction: m.faction ?? undefined,
    }));
}

export function MapMarkerEditor({
  map,
  activeFloor,
  slug,
  floorName,
  initial,
}: {
  map: L.Map;
  activeFloor: number;
  slug: string;
  floorName: string;
  initial: MapViewMarker[];
}) {
  const [markers, setMarkers] = useState<ManualMapMarker[]>(() => fromView(initial));
  const [type, setType] = useState('extract');
  const [label, setLabel] = useState('');
  const [faction, setFaction] = useState('all');
  const [copied, setCopied] = useState(false);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Живой снимок полей для обработчика клика (без переподписки на каждый ввод).
  const stateRef = useRef({ type, label, faction, activeFloor });
  useEffect(() => {
    stateRef.current = { type, label, faction, activeFloor };
  });

  // Клик по карте → новый маркер на текущем этаже (x=lng, z=lat — система рендера).
  useEffect(() => {
    const onClick = (e: L.LeafletMouseEvent) => {
      const s = stateRef.current;
      const x = Math.round(e.latlng.lng * 10) / 10;
      const z = Math.round(e.latlng.lat * 10) / 10;
      const m: ManualMapMarker = {
        id: `${s.type}-${Math.round(x)}-${Math.round(z)}-f${s.activeFloor}`,
        type: s.type,
        floor: s.activeFloor,
        x,
        z,
        ...(s.label ? { label: s.label } : {}),
        ...(s.type === 'extract' ? { faction: s.faction } : {}),
      };
      setMarkers((prev) => [...prev.filter((p) => p.id !== m.id), m]);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  // Имперактивный рендер маркеров текущего этажа.
  useEffect(() => {
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map);
    const lg = layerRef.current;
    lg.clearLayers();
    for (const m of markers) {
      if (m.floor !== activeFloor) continue;
      L.marker([m.z, m.x], { icon: editIcon(m) }).addTo(lg);
    }
  }, [markers, activeFloor, map]);

  useEffect(
    () => () => {
      layerRef.current?.remove();
      layerRef.current = null;
    },
    [],
  );

  const del = (id: string): void => setMarkers((prev) => prev.filter((p) => p.id !== id));

  const exportTs = useCallback(() => {
    const rows = markers
      .slice()
      .sort((a, b) => a.floor - b.floor || a.type.localeCompare(b.type))
      .map((m) => {
        const parts = [`id: ${JSON.stringify(m.id)}`, `type: ${JSON.stringify(m.type)}`, `floor: ${m.floor}`, `x: ${m.x}`, `z: ${m.z}`];
        if (m.label) parts.push(`label: ${JSON.stringify(m.label)}`);
        if (m.faction) parts.push(`faction: ${JSON.stringify(m.faction)}`);
        return `  { ${parts.join(', ')} },`;
      })
      .join('\n');
    const ts = `import type { ManualMapMarker } from './types';\n\n// Ручные маркеры (редактор ?edit=1). Новая карта — зарегистрируй массив в ./index.ts.\nexport const ${camel(slug)}Markers: ManualMapMarker[] = [\n${rows}\n];\n`;
    void navigator.clipboard.writeText(ts).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [markers, slug]);

  const onFloor = markers.filter((m) => m.floor === activeFloor);

  return (
    <div className="absolute top-3 left-1/2 z-[600] w-72 -translate-x-1/2 rounded-sm border border-(--primary)/60 bg-(--color-base)/95 backdrop-blur-md">
      <div className="border-b border-lines-hover px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary)">
        Редактор маркеров · {floorName}
      </div>
      <div className="flex flex-col gap-2 p-2.5">
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`rounded-xs px-2 py-1 font-blender-medium text-xs uppercase tracking-wider transition-colors ${
                type === t.key ? 'text-(--color-base)' : 'text-text-secondary hover:text-text-primary'
              }`}
              style={type === t.key ? { backgroundColor: t.color } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Подпись (опц.)"
          className="rounded-xs border border-lines-hover bg-card-menu px-2 py-1 font-blender-book text-sm text-text-primary placeholder:text-text-muted"
        />

        {type === 'extract' ? (
          <div className="flex gap-1">
            {(['all', 'pmc', 'scav'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFaction(f)}
                className={`rounded-xs px-2 py-1 font-blender-medium text-xs uppercase transition-colors ${
                  faction === f ? 'bg-(--primary) text-(--color-base)' : 'text-text-muted hover:text-(--primary)'
                }`}
              >
                {{ all: 'Общий', pmc: 'ЧВК', scav: 'Дикий' }[f]}
              </button>
            ))}
          </div>
        ) : null}

        <p className="font-blender-book text-xs text-text-muted">Клик по карте — поставить точку на этаж «{floorName}».</p>

        <div className="scrollbar-compact max-h-40 overflow-y-auto">
          {onFloor.length === 0 ? (
            <p className="px-1 py-2 font-blender-book text-xs text-text-muted">На этом этаже пусто.</p>
          ) : (
            onFloor.map((m) => (
              <div key={m.id} className="flex items-center gap-2 py-0.5 font-blender-book text-xs text-text-secondary">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(m.type) }} />
                <span className="flex-1 truncate">{m.label || m.type}</span>
                <button type="button" onClick={() => del(m.id)} className="text-text-muted transition-colors hover:text-failure">
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-lines-hover pt-2">
          <span className="font-blender-medium text-xs text-text-muted tabular-nums">всего: {markers.length}</span>
          <button
            type="button"
            onClick={exportTs}
            className="rounded-xs bg-(--primary) px-3 py-1 font-blender-medium text-xs uppercase tracking-wider text-(--color-base) transition-opacity hover:opacity-80"
          >
            {copied ? 'Скопировано ✓' : 'Скопировать TS'}
          </button>
        </div>
      </div>
    </div>
  );
}
