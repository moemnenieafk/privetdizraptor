'use client';

import { Search, X, LayoutGrid, List, ArrowDownUp, Check, Bookmark } from 'lucide-react';
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
  onSearchChange: (q: string) => void;
  onDropdownSort: (key: string) => void;
  onArmorClassToggle: (ac: number) => void;
  onBarterOnlyChange: (v: boolean) => void;
  onAvailableOnlyChange: (v: boolean) => void;
  onViewModeChange: (mode: 'grid' | 'table') => void;
  onSaveFilters: () => void;
}

const ARMOR_CATEGORIES = ['armor', 'helmets', 'rigs'] as const;

export function CategoryControlBar({
  categorySlug,
  searchQuery,
  sortConfig,
  activeArmorClasses,
  barterOnly,
  availableOnly,
  viewMode,
  isSaved,
  onSearchChange,
  onDropdownSort,
  onArmorClassToggle,
  onBarterOnlyChange,
  onAvailableOnlyChange,
  onViewModeChange,
  onSaveFilters,
}: CategoryControlBarProps) {
  const showArmorFilter = ARMOR_CATEGORIES.includes(categorySlug as typeof ARMOR_CATEGORIES[number]);

  return (
    <div className="bg-card-menu border border-lines-hover p-4 rounded flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between shadow-lg w-full">

      {/* Поиск */}
      <div className="relative flex items-center bg-(--color-base) border border-lines-hover rounded h-10 px-3 w-full xl:w-80 focus-within:border-(--primary) transition-colors shrink-0">
        <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
        <input
          type="text"
          placeholder="ФИЛЬТР ПРЕДМЕТОВ..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-transparent text-[12px] font-blender-medium uppercase tracking-wider text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="text-text-muted hover:text-(--primary) shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Контролы */}
      <div className="flex flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto">

        {/* Фильтр класса брони */}
        {showArmorFilter && (
          <>
            <div className="flex items-center gap-3 animate-[fade-in-up_0.3s_ease-out]">
              <div className="flex flex-wrap items-center gap-1 border-lines-hover rounded p-1">
                {[1, 2, 3, 4, 5, 6].map((ac) => {
                  const isActive = activeArmorClasses.includes(ac);
                  return (
                    <button
                      key={ac}
                      onClick={() => onArmorClassToggle(ac)}
                      title={`Показать/Скрыть класс брони ${ac}`}
                      className={`flex h-7 w-7 items-center justify-center rounded transition-all duration-300 ${
                        isActive
                          ? 'bg-(--primary) text-(--color-base) drop-shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_40%,transparent)]'
                          : 'bg-transparent text-text-muted hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)] hover:text-text-primary'
                      }`}
                    >
                      <span className={`h-5 w-5 bg-current [mask-size:contain] [mask-repeat:no-repeat] [mask-position:center] icon-eft-armor-class-${ac}`} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="w-px h-6 bg-lines-hover mx-1 hidden lg:block" />
          </>
        )}

        {/* Только бартер */}
        <label className="flex items-center gap-2 cursor-pointer group shrink-0">
          <input type="checkbox" className="hidden peer" checked={barterOnly} onChange={(e) => onBarterOnlyChange(e.target.checked)} />
          <div className="w-4 h-4 rounded border border-lines-hover bg-(--color-base) peer-checked:bg-nvg-green peer-checked:border-nvg-green transition-colors flex items-center justify-center">
            {barterOnly && <Check className="w-3 h-3 text-(--color-base) stroke-3" />}
          </div>
          <span className="text-[10px] font-blender-medium uppercase tracking-widest text-text-secondary group-hover:text-text-primary transition-colors mt-0.5">
            Только бартер
          </span>
        </label>

        {/* Доступно мне */}
        <label className="flex items-center gap-2 cursor-pointer group shrink-0" title="Доступно на моем уровне (Барахолка с 15 ур.)">
          <input type="checkbox" className="hidden peer" checked={availableOnly} onChange={(e) => onAvailableOnlyChange(e.target.checked)} />
          <div className="w-4 h-4 rounded border border-lines-hover bg-(--color-base) peer-checked:bg-(--primary) peer-checked:border-(--primary) transition-colors flex items-center justify-center">
            {availableOnly && <Check className="w-3 h-3 text-(--color-base) stroke-3" />}
          </div>
          <span className="text-[10px] font-blender-medium uppercase tracking-widest text-text-secondary group-hover:text-text-primary transition-colors mt-0.5">
            Доступно мне
          </span>
        </label>

        {/* Сортировка */}
        <div className="flex items-center bg-(--color-base) border border-lines-hover rounded h-10 px-3 grow sm:grow-0">
          <ArrowDownUp className="w-4 h-4 text-text-muted mr-2 shrink-0" />
          <select
            value={sortConfig.key}
            onChange={(e) => onDropdownSort(e.target.value)}
            className="bg-transparent text-text-secondary text-[12px] font-blender-medium uppercase tracking-wider focus:outline-none cursor-pointer w-full"
          >
            <option value="vps">По выгоде (VPS)</option>
            <option value="sellTrader">Продажа (Торговец)</option>
            <option value="sellFlea">Продажа (Барахолка)</option>
            <option value="buyMin">Покупка (Мин. цена)</option>
            <option value="name">По алфавиту</option>
          </select>
        </div>

        <div className="w-px h-6 bg-lines-hover mx-1 hidden sm:block" />

        {/* Переключатель вид */}
        <div className="flex items-center gap-1 bg-(--color-base) border border-lines-hover rounded p-1 shrink-0">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${viewMode === 'grid' ? 'bg-(--primary) text-(--color-base) shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]' : 'text-text-muted hover:text-text-primary hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)]'}`}
            title="Сетка"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${viewMode === 'table' ? 'bg-(--primary) text-(--color-base) shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_40%,transparent)]' : 'text-text-muted hover:text-text-primary hover:bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)]'}`}
            title="Список"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-lines-hover mx-1 hidden sm:block" />

        {/* Сохранить фильтры */}
        <button
          onClick={onSaveFilters}
          className={`h-10 w-10 shrink-0 flex items-center justify-center rounded transition-all duration-300 border outline-none focus-visible:ring-2 focus-visible:ring-(--primary) ${
            isSaved
              ? 'bg-nvg-green border-nvg-green text-(--color-base) shadow-[0_0_15px_color-mix(in_srgb,var(--color-nvg-green)_40%,transparent)]'
              : 'bg-(--color-base) border-lines-hover text-text-muted hover:border-(--primary) hover:text-(--primary)'
          }`}
          title="Запомнить фильтры как стандартные"
        >
          {isSaved ? <Check className="w-4 h-4 stroke-3" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
