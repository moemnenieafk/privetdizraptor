'use client';

import { useState, useRef, useEffect, type ComponentType } from 'react';
import { Search, X, ChevronDown, Check, Save, SlidersHorizontal, TrendingDown, ArrowDownAZ, Activity, ShoppingCart } from 'lucide-react';
import type { SortConfig } from './useCategoryFilters';
import { USED_IN_OPTIONS, type CategoryFilterConfig } from '@/lib/items-filter-config';

type SortOption = {
  key: string;
  label: string;
  iconClass?: string;
  Icon?: ComponentType<{ className?: string }>;
};

const SORT_OPTIONS: SortOption[] = [
  { key: 'vps',        label: 'По цене / слот',      iconClass: 'icon-eft-items-price-slot' },
  { key: 'sellTrader', label: 'Продажа торговцу',    iconClass: 'icon-eft-lore-traders' },
  { key: 'sellFlea',   label: 'Продажа на Барахолке', iconClass: 'icon-eft-currency-ruble' },
  { key: 'buyTrader',  label: 'Купить у торговца',    Icon: ShoppingCart },
  { key: 'buyMin',     label: 'Покупка (Мин. цена)', Icon: TrendingDown },
  { key: 'weight',     label: 'По весу',              iconClass: 'icon-eft-weight-carry' },
  { key: 'name',       label: 'По алфавиту',          Icon: ArrowDownAZ },
  { key: 'indicator',  label: 'По показателю',         Icon: Activity },
];

function SortDropdown({ value, onChange, options }: { value: string; onChange: (key: string) => void; options: SortOption[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = options.find(o => o.key === value) ?? options[0];

  return (
    <div ref={ref} className="relative w-full sm:w-auto sm:shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-full items-center gap-2 rounded border border-lines-hover bg-(--color-base) px-3 font-blender-medium text-type-caption uppercase tracking-wider text-zinc-400 transition-colors duration-200 hover:border-(--primary) hover:text-zinc-200"
      >
        {current.iconClass ? (
          <span className={`h-4 w-4 shrink-0 bg-current mask-contain mask-no-repeat mask-center ${current.iconClass}`} />
        ) : current.Icon ? (
          <current.Icon className="h-4 w-4 shrink-0" />
        ) : null}
        <span>{current.label}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded border border-lines-hover bg-card-menu py-1 shadow-lg">
          {options.map(opt => {
            const isSelected = opt.key === value;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 font-blender-medium text-type-caption uppercase tracking-wider transition-colors duration-150 ${
                  isSelected ? 'text-(--primary)' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {opt.iconClass ? (
                  <span className={`h-4 w-4 shrink-0 bg-current mask-contain mask-no-repeat mask-center ${opt.iconClass}`} />
                ) : opt.Icon ? (
                  <opt.Icon className="h-4 w-4 shrink-0" />
                ) : null}
                <span className="whitespace-nowrap">{opt.label}</span>
                {isSelected && <Check className="ml-auto h-3 w-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CategoryControlBarProps {
  categorySlug?: string;
  config: CategoryFilterConfig;
  searchQuery: string;
  sortConfig: SortConfig;
  activeArmorClasses: number[];
  barterOnly: boolean;
  availableOnly: boolean;
  favoritesOnly: boolean;
  usedIn: string[];
  needMe: boolean;
  isSaved: boolean;
  showAdvanced: boolean;
  activeAdvancedCount: number;
  onSearchChange: (q: string) => void;
  onDropdownSort: (key: string) => void;
  onArmorClassToggle: (ac: number) => void;
  onBarterOnlyChange: (v: boolean) => void;
  onAvailableOnlyChange: (v: boolean) => void;
  onFavoritesOnlyChange: (v: boolean) => void;
  onUsedInToggle: (key: string) => void;
  onNeedMeChange: (v: boolean) => void;
  onSaveFilters: () => void;
  onToggleAdvanced: () => void;
}

const ARMOR_CATEGORIES = ['armor', 'helmets', 'rigs', 'components', 'eyewear', 'facecovers', 'masks'] as const;

export function CategoryControlBar({
  categorySlug,
  config,
  searchQuery,
  sortConfig,
  activeArmorClasses,
  barterOnly,
  availableOnly,
  favoritesOnly,
  usedIn,
  needMe,
  isSaved,
  showAdvanced,
  activeAdvancedCount,
  onSearchChange,
  onDropdownSort,
  onArmorClassToggle,
  onBarterOnlyChange,
  onAvailableOnlyChange,
  onFavoritesOnlyChange,
  onUsedInToggle,
  onNeedMeChange,
  onSaveFilters,
  onToggleAdvanced,
}: CategoryControlBarProps) {
  // Гейт поверх рантайм-проверки: armor-фильтр только для armor-категорий И если конфиг разрешает.
  const showArmorFilter = config.controlBar.includes('armorClass')
    && ARMOR_CATEGORIES.includes(categorySlug as typeof ARMOR_CATEGORIES[number]);
  const has = (c: Parameters<typeof config.controlBar.includes>[0]) => config.controlBar.includes(c);
  const sortOptions = SORT_OPTIONS.filter(o => config.sort.includes(o.key));

  return (
    <div className="@container/controlbar flex w-full flex-wrap items-end gap-3.5 py-3">

      {/* Поиск — на мобиле full-width (1-я строка), с sm тянется на всё свободное место */}
      <div className="relative flex h-9 w-full items-center rounded border border-lines-hover bg-(--color-base) px-3 transition-colors focus-within:border-(--primary) sm:w-auto sm:min-w-36 sm:flex-1">
        <Search className="mr-2 h-4 w-4 shrink-0 text-text-muted" />
        <input
          type="text"
          placeholder="ФИЛЬТР ПРЕДМЕТОВ..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-transparent font-blender-medium text-xs uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="ml-2 shrink-0 text-text-muted hover:text-(--primary)">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Сортировка */}
      <SortDropdown value={sortConfig.key} onChange={onDropdownSort} options={sortOptions} />

      <div className="hidden h-9 w-px shrink-0 bg-lines-hover sm:block" />

      {/* Класс брони (только armor / helmets / rigs) */}
      {showArmorFilter && (
        <>
          <div className="flex shrink-0 animate-[fade-in-up_0.3s_ease-out] items-center gap-0.5">
            {[1, 2, 3, 4, 5, 6].map((ac) => {
              const isActive = activeArmorClasses.includes(ac);
              return (
                <button
                  key={ac}
                  onClick={() => onArmorClassToggle(ac)}
                  title={`Класс брони ${ac}`}
                  className={`flex h-7 w-7 items-center justify-center bg-transparent transition-colors duration-200 ${
                    isActive
                      ? 'text-(--primary)'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span className={`h-4 w-4 bg-current mask-contain mask-no-repeat mask-center icon-eft-armor-class-${ac}`} />
                </button>
              );
            })}
          </div>
          <div className="hidden h-9 w-px shrink-0 bg-lines-hover sm:block" />
        </>
      )}

      {/* «Отображать только» — квадратные иконочные кнопки (usedIn + Нужно мне + Избранное) */}
      {(has('usedIn') || has('needMe') || has('favorites')) && (
        <>
          <div className="flex shrink-0 flex-col gap-1">
            <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              Отображать только
            </span>
            <div className="flex items-center gap-1.5">
              {has('usedIn') && USED_IN_OPTIONS.map((opt) => {
                const isActive = usedIn.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onUsedInToggle(opt.key)}
                    title={opt.tip}
                    aria-pressed={isActive}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-200 ${
                      isActive
                        ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
                        : 'border-lines-hover bg-card-menu hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                    }`}
                  >
                    <span className={`${opt.iconClass} h-5 w-5 mask-contain mask-no-repeat mask-center transition-[background-color] duration-200 ${isActive ? 'bg-(--primary)' : 'bg-text-primary opacity-60'}`} />
                  </button>
                );
              })}

              {has('needMe') && (
                <button
                  type="button"
                  onClick={() => onNeedMeChange(!needMe)}
                  title="Только то, что мне ещё нужно (незавершённые квесты)"
                  aria-pressed={needMe}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-200 ${
                    needMe
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
                      : 'border-lines-hover bg-card-menu hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                  }`}
                >
                  <span className={`icon-eft-prog-items-needed h-5 w-5 mask-contain mask-no-repeat mask-center transition-[background-color] duration-200 ${needMe ? 'bg-(--primary)' : 'bg-text-primary opacity-60'}`} />
                </button>
              )}

              {has('favorites') && (
                <button
                  type="button"
                  onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
                  title="Только избранные предметы"
                  aria-pressed={favoritesOnly}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-200 ${
                    favoritesOnly
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
                      : 'border-lines-hover bg-card-menu hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                  }`}
                >
                  <span className={`${favoritesOnly ? 'icon-eft-favourite-active bg-(--primary)' : 'icon-eft-favourite-default bg-text-primary opacity-60'} h-5 w-5 mask-contain mask-no-repeat mask-center transition-[background-color] duration-200`} />
                </button>
              )}
            </div>
          </div>
          <div className="hidden h-9 w-px shrink-0 bg-lines-hover sm:block" />
        </>
      )}

      {/* Бартер */}
      {has('barterOnly') && (
        <button
          type="button"
          onClick={() => onBarterOnlyChange(!barterOnly)}
          title="Только бартерные предметы"
          className={`flex h-10 shrink-0 items-center gap-1.5 bg-transparent px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-200 ${
            barterOnly
              ? 'text-(--primary)'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="icon-eft-prog-barter h-4 w-4 shrink-0 mask-contain mask-no-repeat mask-center bg-current" />
          <span className="hidden @md/controlbar:block">Бартер</span>
        </button>
      )}

      {/* Доступно мне */}
      {has('availableOnly') && (
        <button
          type="button"
          onClick={() => onAvailableOnlyChange(!availableOnly)}
          title="Доступно на моём уровне (Барахолка с 15 ур.)"
          className={`flex h-10 shrink-0 items-center gap-1.5 bg-transparent px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-200 ${
            availableOnly
              ? 'text-(--primary)'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <span className="hidden @xl/controlbar:block">Доступно мне</span>
          <span className="@xl/controlbar:hidden">Уров.</span>
        </button>
      )}

      {/* Расширенные фильтры */}
      <button
        type="button"
        onClick={onToggleAdvanced}
        title="Расширенные фильтры"
        aria-pressed={showAdvanced}
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-[background-color,border-color] duration-200 ${
          showAdvanced || activeAdvancedCount > 0
            ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
            : 'border-lines-hover bg-card-menu hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
        }`}
      >
        <SlidersHorizontal className={`h-5 w-5 transition-[color] duration-200 ${showAdvanced || activeAdvancedCount > 0 ? 'text-(--primary)' : 'text-text-primary opacity-60'}`} />
        {activeAdvancedCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--primary) text-type-caption font-blender-medium text-(--color-base)">
            {activeAdvancedCount}
          </span>
        )}
      </button>

      <div className="hidden h-9 w-px shrink-0 bg-lines-hover sm:block" />

      {/* Сохранить фильтры — дискета */}
      <button
        type="button"
        onClick={onSaveFilters}
        title="Сохранить текущие фильтры"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border outline-none transition-[background-color,border-color] duration-200 focus-visible:outline-none ${
          isSaved
            ? 'border-nvg-green bg-[color-mix(in_srgb,var(--color-nvg-green)_15%,transparent)]'
            : 'border-lines-hover bg-card-menu hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
        }`}
      >
        {isSaved
          ? <Check className="h-5 w-5 stroke-3 text-nvg-green" />
          : <Save className="h-5 w-5 text-text-primary opacity-60" />}
      </button>
    </div>
  );
}
