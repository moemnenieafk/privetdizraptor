'use client';

import { Search, X, LayoutGrid, List, ChevronDown, Check, Save, SlidersHorizontal } from 'lucide-react';
import type { SortConfig } from './useCategoryFilters';

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

const ARMOR_CATEGORIES = ['armor', 'helmets', 'rigs', 'components'] as const;

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
    <div className="flex w-full items-center gap-2 py-3">

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
      <div className="relative shrink-0">
        <select
          value={sortConfig.key}
          onChange={(e) => onDropdownSort(e.target.value)}
          className="h-10 w-48 cursor-pointer appearance-none rounded border border-lines-hover bg-card-menu pl-3 pr-8 font-blender-medium text-[11px] uppercase tracking-wider text-text-secondary transition-colors focus:border-(--primary) focus:outline-none"
        >
          <option value="vps">По выгоде (VPS)</option>
          <option value="sellTrader">Продажа (Торговец)</option>
          <option value="sellFlea">Продажа (Барахолка)</option>
          <option value="buyMin">Покупка (Мин. цена)</option>
          <option value="name">По алфавиту</option>
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
          <ChevronDown className="h-4 w-4" />
        </span>
      </div>

      <div className="h-6 w-px shrink-0 bg-lines-hover" />

      {/* Класс брони (только armor / helmets / rigs) */}
      {showArmorFilter && (
        <>
          <div className="flex shrink-0 animate-[fade-in-up_0.3s_ease-out] items-center gap-1">
            {[1, 2, 3, 4, 5, 6].map((ac) => {
              const isActive = activeArmorClasses.includes(ac);
              return (
                <button
                  key={ac}
                  onClick={() => onArmorClassToggle(ac)}
                  title={`Класс брони ${ac}`}
                  className={`flex h-7 w-7 items-center justify-center rounded transition-all duration-300 ${
                    isActive
                      ? 'bg-(--primary) text-(--color-base) drop-shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_40%,transparent)]'
                      : 'border border-lines-hover bg-card-menu text-text-muted hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)] hover:text-text-primary'
                  }`}
                >
                  <span className={`h-5 w-5 bg-current mask-contain mask-no-repeat mask-center icon-eft-armor-class-${ac}`} />
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
        className={`flex h-10 shrink-0 items-center gap-1.5 rounded border px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-300 ${
          barterOnly
            ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)'
            : 'border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary'
        }`}
      >
        <span
          className={`icon-eft-prog-barter h-4 w-4 shrink-0 mask-contain mask-no-repeat mask-center ${
            barterOnly ? 'bg-(--primary)' : 'bg-current'
          }`}
        />
        <span className="hidden sm:block">Бартер</span>
      </button>

      {/* Доступно мне */}
      <button
        type="button"
        onClick={() => onAvailableOnlyChange(!availableOnly)}
        title="Доступно на моём уровне (Барахолка с 15 ур.)"
        className={`flex h-10 shrink-0 items-center gap-1.5 rounded border px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-300 ${
          availableOnly
            ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)'
            : 'border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary'
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
        className={`relative flex h-10 shrink-0 items-center gap-1.5 rounded border px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-300 ${
          showAdvanced || activeAdvancedCount > 0
            ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)'
            : 'border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary'
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
      <div className="flex shrink-0 items-center gap-px rounded border border-lines-hover bg-(--color-base) p-1">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
            viewMode === 'grid'
              ? 'bg-(--primary) text-(--color-base) shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]'
              : 'text-text-muted hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)] hover:text-text-primary'
          }`}
          title="Сетка"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewModeChange('table')}
          className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
            viewMode === 'table'
              ? 'bg-(--primary) text-(--color-base) shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]'
              : 'text-text-muted hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)] hover:text-text-primary'
          }`}
          title="Список"
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      {/* Сохранить фильтры — дискета */}
      <button
        onClick={onSaveFilters}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-(--primary) ${
          isSaved
            ? 'border-nvg-green bg-nvg-green text-(--color-base) shadow-[0_0_15px_color-mix(in_srgb,var(--color-nvg-green)_40%,transparent)]'
            : 'border-lines-hover bg-(--color-base) text-text-muted hover:border-(--primary) hover:text-(--primary)'
        }`}
        title="Сохранить текущие фильтры"
      >
        {isSaved ? <Check className="h-4 w-4 stroke-3" /> : <Save className="h-4 w-4" />}
      </button>
    </div>
  );
}
