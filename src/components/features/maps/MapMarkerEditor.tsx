'use client';

import * as L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, GripVertical, Trash2, X } from 'lucide-react';
import type { MapViewMarker } from './map-types';
import type { ManualMapMarker } from '@/data/map-markers';

/**
 * Дев-инструмент расстановки маркеров на СТАТИК-карте (тоггл кнопкой «Правка»).
 * Клик по карте → маркер выбранного типа на текущем этаже; режим «Удалить» → клик по маркеру стирает.
 * Экспорт → TS в буфер (вставить в `src/data/map-markers/{slug}.ts`). Не пишет в БД — данные в git.
 * Панель перетаскивается за шапку в пределах фрейма карты.
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

function editIcon(m: ManualMapMarker, del: boolean): L.DivIcon {
  const c = colorOf(m.type);
  return L.divIcon({
    className: 'cta-edit-di',
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${c};border:2px solid #141416;box-shadow:0 0 0 1px ${c}${
      del ? ',0 0 8px 2px #E5484D' : ''
    };cursor:${del ? 'pointer' : 'default'}"></span>${
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
  editing,
  onClose,
}: {
  map: L.Map;
  activeFloor: number;
  slug: string;
  floorName: string;
  initial: MapViewMarker[];
  editing: boolean;
  onClose: () => void;
}) {
  const [markers, setMarkers] = useState<ManualMapMarker[]>(() => fromView(initial));
  const [type, setType] = useState('extract');
  const [label, setLabel] = useState('');
  const [faction, setFaction] = useState('all');
  const [copied, setCopied] = useState(false);
  const [delMode, setDelMode] = useState(false);
  const [pos, setPos] = useState({ x: 60, y: 12 });

  const layerRef = useRef<L.LayerGroup | null>(null);
  const delRef = useRef<(id: string) => void>(() => {});

  // Живой снимок полей для обработчика клика по карте (без переподписки на каждый ввод).
  const stateRef = useRef({ type, label, faction, activeFloor, editing, delMode });
  useEffect(() => {
    stateRef.current = { type, label, faction, activeFloor, editing, delMode };
  });

  const del = useCallback((id: string) => setMarkers((prev) => prev.filter((p) => p.id !== id)), []);
  useEffect(() => {
    delRef.current = del;
  });

  // Клик по карте → новый маркер на текущем этаже (только в режиме правки и НЕ в режиме удаления).
  useEffect(() => {
    const onClick = (e: L.LeafletMouseEvent) => {
      const s = stateRef.current;
      if (!s.editing || s.delMode) return;
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

  // Имперактивный рендер маркеров текущего этажа (только в режиме правки).
  useEffect(() => {
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map);
    const lg = layerRef.current;
    lg.clearLayers();
    if (!editing) return;
    for (const m of markers) {
      if (m.floor !== activeFloor) continue;
      const mk = L.marker([m.z, m.x], { icon: editIcon(m, delMode), interactive: delMode, keyboard: false });
      if (delMode)
        mk.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          delRef.current(m.id);
        });
      mk.addTo(lg);
    }
  }, [markers, activeFloor, map, editing, delMode]);

  useEffect(
    () => () => {
      layerRef.current?.remove();
      layerRef.current = null;
    },
    [],
  );

  // Перетаскивание панели за шапку (pointer capture, clamp в пределах фрейма).
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const size = map.getSize();
    const nx = Math.max(0, Math.min(drag.current.px + (e.clientX - drag.current.sx), size.x - 260));
    const ny = Math.max(0, Math.min(drag.current.py + (e.clientY - drag.current.sy), size.y - 56));
    setPos({ x: nx, y: ny });
  };
  const onUp = (e: React.PointerEvent) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

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
    const ts = `import type { ManualMapMarker } from './types';\n\n// Ручные маркеры (редактор «Правка»). Новая карта — зарегистрируй массив в ./index.ts.\nexport const ${camel(slug)}Markers: ManualMapMarker[] = [\n${rows}\n];\n`;
    void navigator.clipboard.writeText(ts).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [markers, slug]);

  if (!editing) return null;

  const onFloor = markers.filter((m) => m.floor === activeFloor);

  return (
    <div
      className="absolute z-[600] w-65 rounded-sm border border-(--primary)/60 bg-(--color-base)/95 backdrop-blur-md"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Шапка — drag handle */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className="flex cursor-grab touch-none items-center gap-1.5 border-b border-lines-hover px-2 py-2 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) select-none active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="flex-1 truncate">Маркеры · {floorName}</span>
        <button type="button" onClick={onClose} className="shrink-0 text-text-muted transition-colors hover:text-(--primary)" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
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

        <p className="font-blender-book text-xs text-text-muted">
          {delMode ? 'Режим удаления — клик по маркеру стирает его.' : `Клик по карте — поставить «${TYPES.find((t) => t.key === type)?.label}» на «${floorName}».`}
        </p>

        <div className="scrollbar-compact max-h-40 overflow-y-auto">
          {onFloor.length === 0 ? (
            <p className="px-1 py-2 font-blender-book text-xs text-text-muted">На этом этаже пусто.</p>
          ) : (
            onFloor.map((m) => (
              <div key={m.id} className="flex items-center gap-2 py-0.5 font-blender-book text-xs text-text-secondary">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(m.type) }} />
                <span className="flex-1 truncate">{m.label || m.type}</span>
                <button type="button" onClick={() => del(m.id)} className="shrink-0 text-text-muted transition-colors hover:text-failure" aria-label="Удалить маркер">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-lines-hover pt-2">
          <span className="font-blender-medium text-xs text-text-muted tabular-nums">{markers.length}</span>
          <button
            type="button"
            onClick={() => setDelMode((d) => !d)}
            className={`ml-auto flex items-center gap-1 rounded-xs px-2.5 py-1 font-blender-medium text-xs uppercase tracking-wider transition-colors ${
              delMode ? 'bg-failure text-(--color-base)' : 'border border-lines-hover text-text-secondary hover:text-failure'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Удалить
          </button>
          <button
            type="button"
            onClick={exportTs}
            className="flex items-center gap-1 rounded-xs bg-(--primary) px-2.5 py-1 font-blender-medium text-xs uppercase tracking-wider text-(--color-base) transition-opacity hover:opacity-80"
          >
            <Copy className="h-3.5 w-3.5" /> {copied ? 'Готово ✓' : 'TS'}
          </button>
        </div>
      </div>
    </div>
  );
}
