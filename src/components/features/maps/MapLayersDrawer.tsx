'use client';

import { useState } from 'react';
import { Check, ChevronDown, Layers, Minus, X } from 'lucide-react';
import { LAYER_GROUPS, type LayerItem } from './map-layers';
import { markerIconUrl, markerColor } from '@/data/map-marker-icons';

/**
 * Drawer «Слои» интерактивной карты (паттерн tarkov.dev, дизайн NIGHTFALL): кнопка-стопка
 * раскрывает панель — дерево чекбоксов. 3 уровня: группа → под-слой ИЛИ раскрываемый узел
 * (Контейнеры/Случайная добыча) с детьми-типами. Чекбокс группы/узла вкл/выкл всех потомков
 * (частичное — «минус»). Пустые под-слои скрываются. У каждого — иконка (резолвер) + счётчик.
 */

const leafKeys = (i: LayerItem): string[] => (i.children ? i.children.map((c) => c.key) : [i.key]);

function LayerGlyph({ item }: { item: LayerItem }): React.ReactElement {
  const color = markerColor(item.sample.type);
  // Иконка нашей таксономии (loose-категории) — CSS-маска, приоритет над резолвером.
  if (item.iconClass)
    return <span className={`icon-mask ${item.iconClass} h-6 w-6 shrink-0`} style={{ color }} />;
  const icon = markerIconUrl(item.sample);
  if (icon?.mode === 'img') return <img src={icon.url} alt="" className="h-8 w-8 shrink-0 object-contain" />;
  if (icon?.mode === 'mask')
    return (
      <span
        className="h-6 w-6 shrink-0"
        style={{
          backgroundColor: color,
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
  return <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function Box({ state }: { state: 'on' | 'off' | 'partial' }): React.ReactElement {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border transition-colors ${
        state === 'off' ? 'border-lines-hover bg-transparent' : 'border-(--primary) bg-(--primary)'
      }`}
    >
      {state === 'on' ? <Check className="h-3 w-3 text-(--color-base)" strokeWidth={3} /> : null}
      {state === 'partial' ? <Minus className="h-3 w-3 text-(--color-base)" strokeWidth={3} /> : null}
    </span>
  );
}

export function MapLayersDrawer({
  vis,
  counts,
  onToggle,
  onSetGroup,
  onCycle,
}: {
  vis: Record<string, boolean>;
  counts: Record<string, number>;
  onToggle: (key: string) => void;
  onSetGroup: (keys: string[], value: boolean) => void;
  /** ПКМ по строке слоя: подлёт к ближайшему объекту, повтор — к следующему по циклу. */
  onCycle: (keys: string[]) => void;
}) {
  const cycle = (e: React.MouseEvent, keys: string[]) => {
    e.preventDefault();
    onCycle(keys);
  };
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ containers: true, loose: true });

  const countOf = (i: LayerItem): number => leafKeys(i).reduce((s, k) => s + (counts[k] ?? 0), 0);
  const stateOf = (keys: string[]): 'on' | 'off' | 'partial' => {
    const on = keys.filter((k) => vis[k]).length;
    return on === 0 ? 'off' : on === keys.length ? 'on' : 'partial';
  };

  // Прячем под-слои/узлы без маркеров на этой карте.
  const groups = LAYER_GROUPS.map((g) => ({
    ...g,
    items: g.items
      .map((i) => (i.children ? { ...i, children: i.children.filter((c) => (counts[c.key] ?? 0) > 0) } : i))
      .filter((i) => countOf(i) > 0),
  })).filter((g) => g.items.length > 0);

  const renderLeaf = (i: LayerItem, deep: boolean) => {
    const active = !!vis[i.key];
    return (
      <button
        key={i.key}
        type="button"
        onClick={() => onToggle(i.key)}
        onContextMenu={(e) => cycle(e, [i.key])}
        title="ПКМ — подлёт к объекту (повтор — к следующему)"
        className={`flex w-full items-center gap-2 rounded-xs py-1.5 pr-2 text-left transition-colors hover:bg-card-menu ${
          deep ? 'pl-14' : 'pl-8'
        } ${active ? 'text-text-secondary' : 'text-text-muted/60'}`}
      >
        <Box state={active ? 'on' : 'off'} />
        <LayerGlyph item={i} />
        <span className="flex-1 truncate font-blender-book text-sm">{i.label}</span>
        <span className="font-blender-medium text-type-micro text-text-muted tabular-nums">{counts[i.key] ?? 0}</span>
      </button>
    );
  };

  const renderNode = (i: LayerItem) => {
    const keys = leafKeys(i);
    const st = stateOf(keys);
    const isCollapsed = collapsed[i.key];
    return (
      <div key={i.key}>
        <div
          onContextMenu={(e) => cycle(e, keys)}
          title="ПКМ — подлёт к объекту (повтор — к следующему)"
          className="flex items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 hover:bg-card-menu"
        >
          <button type="button" onClick={() => onSetGroup(keys, st !== 'on')} aria-label={`Переключить ${i.label}`}>
            <Box state={st} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((p) => ({ ...p, [i.key]: !p[i.key] }))}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <LayerGlyph item={i} />
            <span className="flex-1 truncate font-blender-book text-sm text-text-secondary">{i.label}</span>
            <span className="font-blender-medium text-type-micro text-text-muted tabular-nums">{countOf(i)}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          </button>
        </div>
        {isCollapsed ? null : <div className="flex flex-col">{i.children!.map((c) => renderLeaf(c, true))}</div>}
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`absolute top-3 right-3 z-[520] flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest backdrop-blur-md transition-colors ${
          open
            ? 'border-(--primary) bg-(--primary) text-(--color-base)'
            : 'border-lines-hover bg-(--color-base)/80 text-text-secondary hover:text-(--primary)'
        }`}
      >
        <Layers className="h-3.5 w-3.5" /> Слои
      </button>

      <div
        className={`absolute top-0 right-0 z-[540] flex h-full w-72 flex-col border-l border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-lines-hover px-4 py-3 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary)">
          <Layers className="h-4 w-4" />
          <span className="flex-1">Слои карты</span>
          <button type="button" onClick={() => setOpen(false)} className="text-text-muted transition-colors hover:text-(--primary)" aria-label="Закрыть">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-compact flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {groups.map((g) => {
            const keys = g.items.flatMap(leafKeys);
            const st = stateOf(keys);
            const isCollapsed = collapsed[g.group];
            const total = g.items.reduce((s, i) => s + countOf(i), 0);
            return (
              <div key={g.group}>
                <div
                  onContextMenu={(e) => cycle(e, keys)}
                  title="ПКМ — подлёт к объекту (повтор — к следующему)"
                  className="flex items-center gap-2 rounded-xs px-2 py-1.5 hover:bg-card-menu"
                >
                  <button type="button" onClick={() => onSetGroup(keys, st !== 'on')} aria-label={`Переключить группу ${g.group}`}>
                    <Box state={st} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollapsed((p) => ({ ...p, [g.group]: !p[g.group] }))}
                    className="flex flex-1 items-center gap-1.5 text-left"
                  >
                    <span className="flex-1 font-blender-medium text-type-caption uppercase tracking-widest text-text-primary">{g.group}</span>
                    <span className="font-blender-medium text-type-micro text-text-muted tabular-nums">{total}</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-text-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>
                </div>
                {isCollapsed ? null : (
                  <div className="flex flex-col">
                    {g.items.map((i) => (i.children ? renderNode(i) : renderLeaf(i, false)))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
