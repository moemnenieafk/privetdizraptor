'use client';

import { useState, useRef, useEffect, type ComponentType } from 'react';
import { Search, X, LayoutGrid, List, ChevronDown, Check, Save, SlidersHorizontal, TrendingDown, ArrowDownAZ, Activity } from 'lucide-react';
import type { SortConfig } from './useCategoryFilters';

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
  { key: 'buyMin',     label: 'Покупка (Мин. цена)', Icon: TrendingDown },
  { key: 'name',       label: 'По алфавиту',          Icon: ArrowDownAZ },
  { key: 'indicator',  label: 'По показателю',         Icon: Activity },
];

function SortDropdown({ value, onChange }: { value: string; onChange: (key: string) => void }) {
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

  const current = SORT_OPTIONS.find(o => o.key === value) ?? SORT_OPTIONS[0];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-10 items-center gap-2 bg-transparent px-3 font-blender-medium text-[11px] uppercase tracking-wider text-zinc-400 transition-colors duration-200 hover:text-zinc-200"
      >
        {current.iconClass ? (
          <span className={`h-4 w-4 shrink-0 bg-current mask-contain mask-no-repeat mask-center ${current.iconClass}`} />
        ) : current.Icon ? (
          <current.Icon className="h-4 w-4 shrink-0" />
        ) : null}
        <span>{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded border border-lines-hover bg-card-menu py-1 shadow-lg">
          {SORT_OPTIONS.map(opt => {
            const isSelected = opt.key === value;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 font-blender-medium text-[11px] uppercase tracking-wider transition-colors duration-150 ${
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
  searchQuery: string;
  sortConfig: SortConfig;
  activeArmorClasses: number[];
  barterOnly: boolean;
  availableOnly: boolean;
  viewMode: 'grid' | 'table';
  isSaved: boolean;
  showAdvanced: boolean;
  activeAdvancedCount: number;
  onSearchChange: (q: string) => void;
  onDropdownSort: (key: string) => void;
  onArmorClassToggle: (ac: number) => void;
  onBarterOnlyChange: (v: boolean) => void;
  onAvailableOnlyChange: (v: boolean) => void;
  onViewModeChange: (mode: 'grid' | 'table') => void;
  onSaveFilters: () => void;
  onToggleAdvanced: () => void;
}

const ARMOR_CATEGORIES = ['armor', 'helmets', 'rigs', 'components', 'eyewear', 'facecovers', 'masks'] as const;

export function CategoryControlBar({
  categorySlug,
  searchQuery,
  sortConfig,
  activeArmorClasses,
  barterOnly,
  availableOnly,
  viewMode,
  isSaved,
  showAdvanced,
  activeAdvancedCount,
  onSearchChange,
  onDropdownSort,
  onArmorClassToggle,
  onBarterOnlyChange,
  onAvailableOnlyChange,
  onViewModeChange,
  onSaveFilters,
  onToggleAdvanced,
}: CategoryControlBarProps) {
  const showArmorFilter = ARMOR_CATEGORIES.includes(categorySlug as typeof ARMOR_CATEGORIES[number]);

  return (
    <div className="flex w-full flex-wrap items-center gap-2 py-3">

      {/* Поиск — тянется на всё свободное место */}
      <div className="relative flex h-10 min-w-36 flex-1 items-center rounded border border-lines-hover bg-(--color-base) px-3 transition-colors focus-within:border-(--primary)">
        <Search className="mr-2 h-4 w-4 shrink-0 text-text-muted" />
        <input
          type="text"
          placeholder="ФИЛЬТР ПРЕДМЕТОВ..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-transparent font-blender-medium text-[12px] uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="ml-2 shrink-0 text-text-muted hover:text-(--primary)">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Сортировка */}
      <SortDropdown value={sortConfig.key} onChange={onDropdownSort} />

      <div className="h-6 w-px shrink-0 bg-lines-hover" />

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
          <div className="h-6 w-px shrink-0 bg-lines-hover" />
        </>
      )}

      {/* Бартер */}
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
        <span className="hidden sm:block">Бартер</span>
      </button>

      {/* Доступно мне */}
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
        <span className="hidden lg:block">Доступно мне</span>
        <span className="lg:hidden">Уров.</span>
      </button>

      {/* Расширенные фильтры */}
      <button
        type="button"
        onClick={onToggleAdvanced}
        title="Расширенные фильтры"
        className={`relative flex h-10 shrink-0 items-center gap-1.5 bg-transparent px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-200 ${
          showAdvanced || activeAdvancedCount > 0
            ? 'text-(--primary)'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" />
        <span className="hidden md:block">Фильтры</span>
        {activeAdvancedCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-(--primary) text-[9px] font-blender-medium text-(--color-base)">
            {activeAdvancedCount}
          </span>
        )}
      </button>

      <div className="h-6 w-px shrink-0 bg-lines-hover" />

      {/* Переключатель вида */}
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`flex h-8 w-8 items-center justify-center bg-transparent transition-colors duration-200 ${
            viewMode === 'grid'
              ? 'text-(--primary)'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title="Сетка"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewModeChange('table')}
          className={`flex h-8 w-8 items-center justify-center bg-transparent transition-colors duration-200 ${
            viewMode === 'table'
              ? 'text-(--primary)'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title="Список"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      {/* Сохранить фильтры — дискета */}
      <button
        onClick={onSaveFilters}
        className={`flex h-8 w-8 shrink-0 items-center justify-center bg-transparent outline-none transition-colors duration-200 focus-visible:outline-none ${
          isSaved
            ? 'text-nvg-green'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
        title="Сохранить текущие фильтры"
      >
        {isSaved ? <Check className="h-4 w-4 stroke-3" /> : <Save className="h-4 w-4" />}
      </button>
    </div>
  );
}
