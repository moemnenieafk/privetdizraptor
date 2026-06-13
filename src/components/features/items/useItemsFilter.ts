import { useState, useMemo } from "react";
import { TarkovItem, ItemCategoryType, ArmorMetrics } from "@/types/tarkov-items";
import { SortOption, ArmorFilterState } from "@/components/features/items/ItemsFilterPanel";

export const useItemsFilter = (initialItems: TarkovItem[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ItemCategoryType | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("none");
  const [armorFilters, setArmorFilters] = useState<ArmorFilterState>({ minClass: 1, maxClass: 6 });

  const filteredItems = useMemo(() => {
    // 1. Фильтрация
    let result = initialItems.filter((item) => {
      const matchesCategory = activeCategory === "all" || item.category === activeCategory;
      
      const normalizedQuery = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.shortName.toLowerCase().includes(normalizedQuery);

      if (!matchesCategory || !matchesSearch) return false;

      // Логика фильтрации по классу брони
      if (activeCategory === "armor" && item.category === "armor") {
        const armor = item as ArmorMetrics;
        const ac = armor.armorClass || 1;
        if (ac < armorFilters.minClass || ac > armorFilters.maxClass) return false;
      }

      return true;
    });

    // 2. Сортировка
    if (sortBy !== "none") {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case "name_asc":
            return a.name.localeCompare(b.name, "ru");
          case "name_desc":
            return b.name.localeCompare(a.name, "ru");
          case "price_asc":
            if (a.fleaPrice === null) return 1;
            if (b.fleaPrice === null) return -1;
            return a.fleaPrice - b.fleaPrice;
          case "price_desc":
            if (a.fleaPrice === null) return 1;
            if (b.fleaPrice === null) return -1;
            return b.fleaPrice - a.fleaPrice;
          default:
            return 0;
        }
      });
    }

    return result;
  }, [initialItems, searchQuery, activeCategory, sortBy]);

  return {
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    sortBy,
    setSortBy,
    armorFilters,
    setArmorFilters,
    filteredItems,
  };
};