"use client";

import { Search, ChevronDown, Check } from "lucide-react";
import { ItemCategoryType } from "@/types/tarkov-items";

export type SortOption = "none" | "name_asc" | "name_desc" | "price_asc" | "price_desc" | "vps_desc";

export interface ArmorFilterState {
  minClass: number;
  maxClass: number;
}

interface ItemsFilterPanelProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: ItemCategoryType | "all";
  onCategoryChange: (category: ItemCategoryType | "all") => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  armorFilters: ArmorFilterState;
  onArmorFiltersChange: (filters: ArmorFilterState) => void;
  barterOnly: boolean;
  setBarterOnly: (value: boolean) => void;
  availableOnly?: boolean;
  setAvailableOnly?: (value: boolean) => void;
}

const CATEGORIES: { value: ItemCategoryType | "all"; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "weapon", label: "Оружие" },
  { value: "armor", label: "Броня" },
  { value: "ammo", label: "Патроны" },
  { value: "meds", label: "Медицина" },
  { value: "headset", label: "Гарнитуры" },
  { value: "container", label: "Контейнеры" },
  { value: "common", label: "Разное" },
];

export const ItemsFilterPanel = ({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  armorFilters,
  onArmorFiltersChange,
  barterOnly,
  setBarterOnly,
  availableOnly,
  setAvailableOnly,
}: ItemsFilterPanelProps) => {
  return (
    <div className="sticky top-[72px] z-40 flex w-full flex-col gap-5 rounded border border-[var(--color-lines-hover)] bg-[color-mix(in_srgb,var(--color-card-menu)_80%,transparent)] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300">
      {/* Верхняя строка: Поиск и Сортировка */}
      <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Поиск */}
        <div className="relative flex w-full shrink-0 items-center md:w-72">
          <span title="Поиск" className="absolute left-3 text-text-muted">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск предметов..."
            className="flex h-10 w-full rounded border border-lines-hover bg-[var(--color-base)] py-2 pl-9 pr-4 font-blender-book text-sm text-text-primary transition-colors duration-300 placeholder:text-text-muted focus:border-[var(--primary)] focus:outline-none"
          />
        </div>

      {/* Кастомная сортировка */}
      <div className="relative flex w-full items-center md:w-48">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="flex h-10 w-full cursor-pointer appearance-none rounded border border-lines-hover bg-card-menu px-3 pr-8 font-blender-book text-sm text-text-primary transition-colors duration-300 focus:border-[var(--primary)] focus:outline-none"
        >
          <option value="none">Сортировка</option>
          <option value="name_asc">По имени (А-Я)</option>
          <option value="name_desc">По имени (Я-А)</option>
          <option value="price_asc">По цене (возр.)</option>
          <option value="price_desc">По цене (убыв.)</option>
          <option value="vps_desc">Цена/Слот (убыв.)</option>
        </select>
        <span className="pointer-events-none absolute right-3 text-text-muted">
          <ChevronDown className="h-4 w-4" />
        </span>
      </div>
      </div>

      {/* Нижняя строка: Фильтр по категориям */}
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-wrap gap-2">
          {CATEGORIES.map(({ value, label }) => (
            <button
            key={value}
            type="button"
            onClick={() => onCategoryChange(value)}
            className={`flex items-center justify-center rounded border px-3 py-1.5 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-300 ${
              activeCategory === value
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-[var(--primary)]"
                : "border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
            </button>
          ))}
        </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0 mt-4 lg:mt-0">
        <label className="flex items-center gap-2 cursor-pointer group w-fit shrink-0">
          <input 
            type="checkbox" 
            className="hidden peer"
            checked={barterOnly}
            onChange={(e) => setBarterOnly(e.target.checked)}
          />
          <div className="w-4 h-4 rounded border border-lines-hover bg-card-menu peer-checked:bg-[var(--color-nvg-green)] peer-checked:border-[var(--color-nvg-green)] transition-colors flex items-center justify-center">
            {barterOnly && <Check className="w-3 h-3 text-[var(--color-base)] stroke-[3]" />}
          </div>
          <span className="text-sm font-blender-book text-text-secondary group-hover:text-text-primary transition-colors mt-0.5">
            Только бартерные предметы
          </span>
        </label>
        {setAvailableOnly && (
          <label className="flex items-center gap-2 cursor-pointer group w-fit shrink-0" title="Оставить только те предметы, которые вы можете купить на текущем уровне">
            <input 
              type="checkbox" 
              className="hidden peer"
              checked={availableOnly || false}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            <div className="w-4 h-4 rounded border border-lines-hover bg-card-menu peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)] transition-colors flex items-center justify-center">
              {availableOnly && <Check className="w-3 h-3 text-[var(--color-base)] stroke-[3]" />}
            </div>
            <span className="text-sm font-blender-book text-text-secondary group-hover:text-text-primary transition-colors mt-0.5">
              Доступно мне
            </span>
          </label>
        )}
      </div>
      </div>

      {/* Опциональная панель фильтров брони */}
      <div className={`grid transition-all duration-300 ease-out ${activeCategory === "armor" ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-[var(--color-lines-hover)] pt-4 md:flex-row md:items-center">
            <div className="flex w-full items-center gap-6 md:w-auto">
              <div className="flex w-full flex-col gap-2 md:w-32">
                <div className="flex justify-between font-mono text-[10px] text-[var(--color-text-muted)]">
                  <span>Мин: {armorFilters.minClass}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={armorFilters.minClass}
                  onChange={(e) => onArmorFiltersChange({ ...armorFilters, minClass: Math.min(Number(e.target.value), armorFilters.maxClass) })}
                  className="h-1 w-full cursor-pointer appearance-none rounded bg-[var(--color-lines-hover)] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--primary)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125"
                />
              </div>
              <div className="flex w-full flex-col gap-2 md:w-32">
                <div className="flex justify-between font-mono text-[10px] text-[var(--color-text-muted)]">
                  <span>Макс: {armorFilters.maxClass}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={armorFilters.maxClass}
                  onChange={(e) => onArmorFiltersChange({ ...armorFilters, maxClass: Math.max(Number(e.target.value), armorFilters.minClass) })}
                  className="h-1 w-full cursor-pointer appearance-none rounded bg-[var(--color-lines-hover)] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--primary)] [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};