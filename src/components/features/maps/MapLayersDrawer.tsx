'use client';

import { useState } from 'react';
import { Check, ChevronDown, Flame, Layers, Minus, X } from 'lucide-react';
import { LAYER_GROUPS, type LayerItem } from './map-layers';
import { markerIconUrl, markerColor } from '@/data/map-marker-icons';
import { useHeatmapStore } from '@/store/useHeatmapStore';
import { SheetCloseButton } from '@/components/ui/SheetCloseButton';

/**
 * Drawer «Легенда карты» (слои + легенда + счётчики + текст-фильтр слиты, GRILL-2). Дерево
 * чекбоксов: группа → под-слой ИЛИ раскрываемый узел (Контейнеры/Случайная добыча) с детьми-
 * типами. Чекбокс группы/узла вкл/выкл всех потомков (частичное — «минус»). Иконка каждого листа
 * = сам маркер (легенда) + счётчик. Пустые/не совпавшие с текст-фильтром под-слои скрыты.
 *
 * Открытие управляемое (useMapUiStore): десктоп-триггер «Слои» — в верхнем баре (MapTopBar),
 * мобильный — в MobileMapBar. open/onOpenChange приходят из MapViewerClient.
 */

const leafKeys = (i: LayerItem): string[] => (i.children ? i.children.map((c) => c.key) : [i.key]);

function LayerGlyph({ item }: { item: LayerItem }): React.ReactElement {
  const color = markerColor(item.sample.type);
  // Полноцветный маркер-svg (как «Случайная добыча») — приоритет: детальный арт нельзя в маску.
  if (item.iconImg) return <img src={item.iconImg} alt="" className="h-8 w-8 shrink-0 object-contain" />;
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
  onSolo,
  onCycle,
  open: openProp,
  onOpenChange,
  hasHeat = false,
}: {
  vis: Record<string, boolean>;
  counts: Record<string, number>;
  onToggle: (key: string) => void;
  onSetGroup: (keys: string[], value: boolean) => void;
  /** Соло: включить только эту категорию (Alt+клик по галочке), остальные выключить. */
  onSolo: (keys: string[]) => void;
  /** ПКМ по строке слоя: подлёт к ближайшему объекту, повтор — к следующему по циклу. */
  onCycle: (keys: string[]) => void;
  /** Управляемое открытие (мобильная панель). Без пропа — внутренний стейт (десктоп). */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** Есть ли у карты heat-датасет — тогда на мобилке показываем тоггл (десктоп: в зум-кластере). */
  hasHeat?: boolean;
}) {
  const heatActive = useHeatmapStore((s) => s.active);
  const heatToggle = useHeatmapStore((s) => s.toggle);
  const cycle = (e: React.MouseEvent, keys: string[]) => {
    e.preventDefault();
    onCycle(keys);
  };
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInternalOpen(v));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ containers: true, loose: true });
  const [filter, setFilter] = useState('');

  // Мульти-фильтр: термины через запятую (OR). Пусто → показываем всё. Совпадение по имени
  // группы/узла/листа. Регистронезависимо (сам ввод — uppercase, сравнение — lower).
  const terms = filter.toLowerCase().split(',').map((t) => t.trim()).filter(Boolean);
  const hit = (label: string): boolean => terms.length === 0 || terms.some((t) => label.toLowerCase().includes(t));

  const countOf = (i: LayerItem): number => leafKeys(i).reduce((s, k) => s + (counts[k] ?? 0), 0);
  const stateOf = (keys: string[]): 'on' | 'off' | 'partial' => {
    const on = keys.filter((k) => vis[k]).length;
    return on === 0 ? 'off' : on === keys.length ? 'on' : 'partial';
  };

  // Прячем под-слои/узлы без маркеров на этой карте + применяем текст-фильтр.
  const groups = LAYER_GROUPS.map((g) => {
    const gHit = hit(g.group);
    const items = g.items
      .map((i) => {
        if (!i.children) return i;
        const nHit = gHit || hit(i.label);
        return { ...i, children: i.children.filter((c) => (counts[c.key] ?? 0) > 0 && (nHit || hit(c.label))) };
      })
      .filter((i) => (i.children ? i.children.length > 0 : (counts[i.key] ?? 0) > 0 && (gHit || hit(i.label))));
    return { ...g, items };
  }).filter((g) => g.items.length > 0);

  const renderLeaf = (i: LayerItem, deep: boolean) => {
    const active = !!vis[i.key];
    return (
      <button
        key={i.key}
        type="button"
        onClick={(e) => (e.altKey ? onSolo([i.key]) : onToggle(i.key))}
        onContextMenu={(e) => cycle(e, [i.key])}
        title="Alt+клик — показать только эту категорию · ПКМ — подлёт к объекту"
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
          <button type="button" onClick={(e) => (e.altKey ? onSolo(keys) : onSetGroup(keys, st !== 'on'))} title="Alt+клик — показать только эту категорию" aria-label={`Переключить ${i.label}`}>
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
      {/* Десктоп-триггер «Слои» переехал в верхний бар (MapTopBar); открытие — через useMapUiStore.
          Адаптив (как MapSearchDrawer): десктоп — правый drawer (w-87), мобилка — bottom-sheet
          (M4 Figma 2591:4428). Тот же контент/логика дерева — меняется только оболочка. */}
      <div
        className={`absolute inset-x-0 bottom-0 z-[540] flex max-h-[85svh] flex-col rounded-t-xl border-t border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 lg:inset-x-auto lg:top-0 lg:right-0 lg:bottom-auto lg:h-full lg:max-h-none lg:w-87 lg:rounded-t-none lg:border-t-0 lg:border-l ${
          open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
        }`}
      >
        {/* Мобильный хват боттом-шита */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-lines-hover lg:hidden" />
        {/* Шапка 56px: амбер-кнопка слоёв (та же, что открывает в баре) + заголовок. На мобилке кнопка
            слева (закрыть), на десктопе — справа; заголовок между ними растягивается. */}
        <div className="flex h-14 shrink-0 items-center gap-3 px-3.5 lg:justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Закрыть легенду"
            className="order-first flex h-9 w-9 shrink-0 items-center justify-center rounded border border-(--primary) bg-(--primary) text-(--color-base) lg:order-last"
          >
            <Layers className="h-5.5 w-5.5" />
          </button>
          <span className="flex-1 font-blender-medium text-base uppercase tracking-widest text-text-primary lg:flex-none">Легенда карты</span>
          {/* Мобильный крестик-закрытие (десктоп закрывает амбер-кнопкой слоёв справа). */}
          <SheetCloseButton onClick={() => setOpen(false)} ariaLabel="Закрыть легенду" className="order-last lg:hidden" />
        </div>

        {/* Мульти-фильтр по маркерам (термины через запятую): инпут сверху, подпись снизу — как в «Поиске». */}
        <div className="flex flex-col gap-2 px-3 py-2.5">
          <div className="flex h-8 items-center gap-2 rounded-xs border border-lines-hover bg-(--color-base)/60 px-2.5">
            <Layers className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Фильтр по маркерам"
              className="w-full bg-transparent font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary outline-none placeholder:text-text-muted/60"
            />
            {filter && (
              <button type="button" onClick={() => setFilter('')} aria-label="Очистить фильтр" className="shrink-0 text-text-muted transition-colors hover:text-(--primary)">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="font-blender-medium text-[0.625rem] text-text-secondary">
            Доступна мульти-фильтрация, например: Платный, Босс, Опасности · <span className="text-(--primary)">Alt+клик</span> по категории — показать только её
          </p>
        </div>

        {/* Тепловая карта денег (EV лута) — на мобилке живёт тут (зум-кластер с этим тогглом скрыт <lg). */}
        {hasHeat && (
          <button
            type="button"
            onClick={heatToggle}
            aria-pressed={heatActive}
            className={`mx-3 mb-1 flex h-9 shrink-0 items-center gap-2 rounded-xs border px-2.5 transition-colors lg:hidden ${
              heatActive ? 'border-(--primary) text-(--primary)' : 'border-lines-hover text-text-secondary'
            }`}
          >
            <Flame className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="flex-1 text-left font-blender-medium text-type-caption uppercase tracking-widest">Тепловая карта денег</span>
            <Box state={heatActive ? 'on' : 'off'} />
          </button>
        )}

        <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center font-blender-book text-xs text-text-muted">Ничего не найдено</p>
          )}
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
                  <button type="button" onClick={(e) => (e.altKey ? onSolo(keys) : onSetGroup(keys, st !== 'on'))} title="Alt+клик — показать только эту группу" aria-label={`Переключить группу ${g.group}`}>
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