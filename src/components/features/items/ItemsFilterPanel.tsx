"use client";

import { Search, ChevronDown, Check } from "lucide-react";
import { ItemCategoryType } from "@/types/tarkov-items";
import { ArmorFilterPanel } from "./ArmorFilterPanel";

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
    <div className="flex w-full flex-col gap-4 py-3">
      {/* Строка 1: Поиск + Сортировка */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {/* Поиск */}
        <div className="relative flex items-center">
          <span className="absolute left-3 text-text-muted">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск предметов..."
            className="flex h-10 w-full rounded border border-lines-hover bg-(--color-base) py-2 pl-9 pr-4 font-blender-book text-sm text-text-primary transition-colors duration-300 placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
          />
        </div>

        {/* Сортировка */}
        <div className="relative flex items-center">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="flex h-10 w-full cursor-pointer appearance-none rounded border border-lines-hover bg-card-menu px-3 pr-8 font-blender-book text-sm text-text-primary transition-colors duration-300 focus:border-(--primary) focus:outline-none"
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

      {/* Строка 2: Категории + Переключатели */}
      <div className="flex w-full flex-wrap items-center gap-2">
        {CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onCategoryChange(value)}
            className={`flex items-center justify-center rounded border px-3 py-1.5 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-300 ${
              activeCategory === value
                ? "border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)"
                : "border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}

        {/* Разделитель */}
        <div className="mx-1 h-5 w-px bg-lines-hover" />

        {/* Бартер — иконка-переключатель */}
        <button
          type="button"
          onClick={() => setBarterOnly(!barterOnly)}
          title="Только бартерные предметы"
          className={`flex items-center gap-1.5 rounded border px-3 py-1.5 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-300 ${
            barterOnly
              ? "border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)"
              : "border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary"
          }`}
        >
          <span
            className={`icon-eft-prog-barter h-4 w-4 shrink-0 mask-center mask-no-repeat mask-contain ${
              barterOnly ? "bg-(--primary)" : "bg-current"
            }`}
          />
          Бартер
        </button>

        {/* Доступно мне */}
        {setAvailableOnly && (
          <label
            className="flex cursor-pointer items-center gap-2 rounded border border-lines-hover bg-card-menu px-3 py-1.5 transition-colors duration-300 hover:border-text-secondary group"
            title="Оставить только те предметы, которые вы можете купить на текущем уровне"
          >
            <input
              type="checkbox"
              className="hidden peer"
              checked={availableOnly || false}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            <div className="flex h-4 w-4 items-center justify-center rounded border border-lines-hover bg-card-menu peer-checked:border-(--primary) peer-checked:bg-(--primary) transition-colors">
              {availableOnly && <Check className="h-3 w-3 stroke-3 text-(--color-base)" />}
            </div>
            <span className="font-blender-medium text-xs uppercase tracking-wider text-text-muted group-hover:text-text-primary transition-colors">
              Доступно мне
            </span>
          </label>
        )}
      </div>

      <ArmorFilterPanel
        filters={armorFilters}
        onChange={onArmorFiltersChange}
        isVisible={activeCategory === "armor"}
      />
    </div>
  );
};
