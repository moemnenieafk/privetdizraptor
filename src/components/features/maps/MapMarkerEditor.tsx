'use client';

import * as L from 'leaflet';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, GripVertical, Trash2, X } from 'lucide-react';
import type { MapViewMarker } from './map-types';
import type { ManualMapMarker } from '@/data/map-markers';
import { manualMarkerIcon } from './manual-marker-icon';
import { markerIconUrl, markerColor, BOSS_ROSTER } from '@/data/map-marker-icons';
import { itemIconUrl } from '@/lib/item-icon';
import {
  CONTAINER_CATEGORIES,
  LOOT_CATEGORIES,
  SPAWN_CATEGORIES,
  categoryLabel,
  defaultCategory,
  type CategoryGroup,
} from '@/data/map-markers/categories';

/**
 * Дев-инструмент расстановки маркеров на СТАТИК-карте (тоггл «Правка»).
 * Клик ставит маркер выбранного типа/категории на текущий этаж; режим «Удалить» → клик стирает.
 * Экспорт → TS в буфер (вставить в src/data/map-markers/{slug}.ts). Данные в git, не в БД.
 * Панель перетаскивается за шапку в пределах фрейма карты.
 */

const TYPES: { key: string; label: string }[] = [
  { key: 'extract', label: 'Выход' },
  { key: 'spawn', label: 'Спавн' },
  { key: 'loot', label: 'Лут' },
  { key: 'container', label: 'Контейнер' },
  { key: 'transit', label: 'Переход' },
  { key: 'hazard', label: 'Опасн.' },
  { key: 'lock', label: 'Замок' },
  { key: 'switch', label: 'Рычаг' },
  { key: 'stationary', label: 'Стационарка' },
];

/** Мини-иконка типа для кнопки палитры (webp → <img>, svg → mask цветом типа). */
function TypeGlyph({ type, active }: { type: string; active: boolean }): React.ReactElement | null {
  const icon = markerIconUrl({ type, faction: 'all', category: defaultCategory(type) || undefined });
  if (!icon) return null;
  if (icon.mode === 'img') return <img src={icon.url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />;
  return (
    <span
      className="h-3.5 w-3.5 shrink-0"
      style={{
        backgroundColor: active ? 'var(--color-base)' : markerColor(type),
        maskImage: `url(${icon.url})`,
        WebkitMaskImage: `url(${icon.url})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
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
      category: m.category ?? undefined,
      bossKey: m.bossKey ?? undefined,
      linkedItemId: m.linkedItemId ?? undefined,
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
  const [category, setCategory] = useState('');
  const [bossKey, setBossKey] = useState('');
  const [itemId, setItemId] = useState('');
  const [label, setLabel] = useState('');
  const [faction, setFaction] = useState('all');
  const [copied, setCopied] = useState(false);
  const [delMode, setDelMode] = useState(false);
  const [pos, setPos] = useState({ x: 60, y: 12 });

  const layerRef = useRef<L.LayerGroup | null>(null);
  const delRef = useRef<(id: string) => void>(() => {});
  const stateRef = useRef({ type, category, bossKey, itemId, label, faction, activeFloor, editing, delMode });
  useEffect(() => {
    stateRef.current = { type, category, bossKey, itemId, label, faction, activeFloor, editing, delMode };
  });

  const del = useCallback((id: string) => setMarkers((prev) => prev.filter((p) => p.id !== id)), []);
  useEffect(() => {
    delRef.current = del;
  });

  const pickType = (t: string): void => {
    setType(t);
    setCategory(defaultCategory(t));
    setBossKey('');
    setItemId('');
  };

  // Клик по карте → новый маркер (только в правке и НЕ в режиме удаления).
  useEffect(() => {
    const onClick = (e: L.LeafletMouseEvent) => {
      const s = stateRef.current;
      if (!s.editing || s.delMode) return;
      const x = Math.round(e.latlng.lng * 10) / 10;
      const z = Math.round(e.latlng.lat * 10) / 10;
      const hasCat = s.type === 'spawn' || s.type === 'loot' || s.type === 'container';
      const withBoss = s.type === 'spawn' && s.category === 'boss' && s.bossKey;
      const withItem = s.type === 'loot' && s.itemId.trim();
      const m: ManualMapMarker = {
        id: `${s.type}-${s.category || s.faction}${withBoss ? `-${s.bossKey}` : ''}${withItem ? `-${s.itemId.trim()}` : ''}-${Math.round(x)}-${Math.round(z)}-f${s.activeFloor}`,
        type: s.type,
        floor: s.activeFloor,
        x,
        z,
        ...(s.label ? { label: s.label } : {}),
        ...(s.type === 'extract' ? { faction: s.faction } : {}),
        ...(hasCat && s.category ? { category: s.category } : {}),
        ...(withBoss ? { bossKey: s.bossKey } : {}),
        ...(withItem ? { linkedItemId: s.itemId.trim() } : {}),
      };
      setMarkers((prev) => [...prev.filter((p) => p.id !== m.id), m]);
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  // Имперактивный рендер маркеров текущего этажа (только в правке).
  useEffect(() => {
    if (!layerRef.current) layerRef.current = L.layerGroup().addTo(map);
    const lg = layerRef.current;
    lg.clearLayers();
    if (!editing) return;
    for (const m of markers) {
      if (m.floor !== activeFloor) continue;
      const mk = L.marker([m.z, m.x], { icon: manualMarkerIcon(m, delMode, true), interactive: delMode, keyboard: false });
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
    const nx = Math.max(0, Math.min(drag.current.px + (e.clientX - drag.current.sx), size.x - 348));
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
        if (m.category) parts.push(`category: ${JSON.stringify(m.category)}`);
        if (m.bossKey) parts.push(`bossKey: ${JSON.stringify(m.bossKey)}`);
        if (m.linkedItemId) parts.push(`linkedItemId: ${JSON.stringify(m.linkedItemId)}`);
        if (m.faction) parts.push(`faction: ${JSON.stringify(m.faction)}`);
        if (m.label) parts.push(`label: ${JSON.stringify(m.label)}`);
        return `  { ${parts.join(', ')} },`;
      })
      .join('\n');
    const camel = slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const ts = `import type { ManualMapMarker } from './types';\n\n// Ручные маркеры (редактор «Правка»). Новая карта — зарегистрируй массив в ./index.ts.\nexport const ${camel}Markers: ManualMapMarker[] = [\n${rows}\n];\n`;
    void navigator.clipboard.writeText(ts).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
    // Дев: дублируем экспорт файлом на диск (буфер ненадёжен в авто-режиме) → читается извне.
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ts], { type: 'text/plain' }));
    a.download = `${slug}-markers.ts`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [markers, slug]);

  if (!editing) return null;

  const onFloor = markers.filter((m) => m.floor === activeFloor);
  const groups: CategoryGroup[] | null = type === 'loot' ? LOOT_CATEGORIES : type === 'container' ? CONTAINER_CATEGORIES : null;

  return (
    <div className="absolute z-[600] w-87 rounded-sm border border-(--primary)/60 bg-(--color-base)/95 backdrop-blur-md" style={{ left: pos.x, top: pos.y }}>
      {/* Шапка — drag handle */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className="flex cursor-grab touch-none items-center gap-1.5 border-b border-lines-hover px-2 py-2 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) select-none active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="flex-1 truncate">Маркеры · {floorName}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="shrink-0 text-text-muted transition-colors hover:text-(--primary)"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 p-2.5">
        {/* Тип маркера */}
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickType(t.key)}
              className={`flex items-center gap-1 rounded-xs px-2 py-1 font-blender-medium text-xs uppercase tracking-wider transition-colors ${
                type === t.key ? 'text-(--color-base)' : 'text-text-secondary hover:text-text-primary'
              }`}
              style={type === t.key ? { backgroundColor: markerColor(t.key) } : undefined}
            >
              <TypeGlyph type={t.key} active={type === t.key} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Под-категория */}
        {type === 'extract' ? (
          <div className="flex gap-1">
            {(['all', 'pmc', 'scav'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFaction(f)}
                className={`rounded-xs px-2 py-1 font-blender-medium text-type-micro uppercase transition-colors ${
                  faction === f ? 'bg-(--primary) text-(--color-base)' : 'text-text-muted hover:text-(--primary)'
                }`}
              >
                {{ all: 'Общий', pmc: 'ЧВК', scav: 'Дикий' }[f]}
              </button>
            ))}
          </div>
        ) : null}

        {type === 'spawn' ? (
          <div className="flex flex-wrap gap-1">
            {SPAWN_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`rounded-xs px-1.5 py-0.5 font-blender-medium text-type-micro uppercase tracking-wide transition-colors ${
                  category === c.key ? 'bg-(--primary) text-(--color-base)' : 'border border-lines-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Пикер конкретного босса (портрет webp) — только для category='boss'. */}
        {type === 'spawn' && category === 'boss' ? (
          <div className="scrollbar-compact flex max-h-28 flex-wrap gap-1 overflow-y-auto pr-1">
            {BOSS_ROSTER.map((b) => {
              const on = bossKey === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBossKey(on ? '' : b.key)}
                  title={b.label}
                  className={`flex items-center gap-1 rounded-xs px-1 py-0.5 font-blender-medium text-type-micro uppercase tracking-wide transition-colors ${
                    on ? 'bg-(--primary) text-(--color-base)' : 'border border-lines-hover text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <img src={`/images/bosses/eft/${b.key}.webp`} alt="" className="h-4 w-4 shrink-0 object-contain" />
                  {b.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {groups ? (
          <div className="scrollbar-compact flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
            {groups.map((g) => (
              <div key={g.group}>
                <div className="px-0.5 font-blender-medium text-type-micro uppercase tracking-wider text-text-muted">{g.group}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {g.items.map((it) => {
                    const on = category === it.key;
                    return (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => setCategory(it.key)}
                        className={`flex items-center gap-1 rounded-xs px-1.5 py-0.5 font-blender-medium text-type-micro uppercase tracking-wide transition-colors ${
                          on ? 'bg-(--primary) text-(--color-base)' : 'border border-lines-hover text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {it.icon ? <span className={`icon-mask ${it.icon} h-3 w-3 shrink-0`} style={{ color: on ? 'var(--color-base)' : '#9696A1' }} /> : null}
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Привязка к предмету (loot): BSG-id → иконка-плитка из базы + клик-линк (напр. газовый резак). */}
        {type === 'loot' ? (
          <div className="flex items-center gap-1.5">
            {itemId.trim() ? (
              <img
                src={itemIconUrl(itemId.trim())}
                alt=""
                className="h-6 w-6 shrink-0 rounded-xs object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <input
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="ID предмета (иконка из базы, опц.)"
              className="min-w-0 flex-1 rounded-xs border border-lines-hover bg-card-menu px-2 py-1 font-blender-book text-sm text-text-primary placeholder:text-text-muted"
            />
          </div>
        ) : null}

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Подпись (опц.)"
          className="rounded-xs border border-lines-hover bg-card-menu px-2 py-1 font-blender-book text-sm text-text-primary placeholder:text-text-muted"
        />

        <p className="font-blender-book text-type-micro text-text-muted">
          {delMode ? 'Режим удаления — клик по маркеру стирает его.' : `Клик по карте — поставить на «${floorName}».`}
        </p>

        <div className="scrollbar-compact max-h-40 overflow-y-auto">
          {onFloor.length === 0 ? (
            <p className="px-1 py-2 font-blender-book text-xs text-text-muted">На этом этаже пусто.</p>
          ) : (
            onFloor.map((m) => (
              <div key={m.id} className="flex items-center gap-2 py-0.5 font-blender-book text-xs text-text-secondary">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: markerColor(m.type) }} />
                <span className="flex-1 truncate">{m.label || (m.category ? categoryLabel(m.category) : null) || m.type}</span>
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
