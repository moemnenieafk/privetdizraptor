import { useState, useMemo } from "react";
import { TarkovItem, ItemCategoryType, ArmorMetrics } from "@/types/tarkov-items";
import { SortOption, ArmorFilterState } from "@/components/features/items/ItemsFilterPanel";
import { usePlayerStore } from "@/store/usePlayerStore";

export const useItemsFilter = (initialItems: TarkovItem[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ItemCategoryType | "all">("all");
  const [sortBy, setSortBy] = useState<SortOption>("none");
  const [armorFilters, setArmorFilters] = useState<ArmorFilterState>({ minClass: 1, maxClass: 6 });
  const [barterOnly, setBarterOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);

  // Глобальный стейт профиля игрока для фильтрации "Доступно мне"
  const profiles = usePlayerStore((state) => state.profiles);
  const activeProfileId = usePlayerStore((state) => state.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const traderLevels = activeProfile?.traderLevels || {};
  const playerLevel = Number(activeProfile?.level) || 1;

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

      // Фильтр "Только для бартера" (ищет 'barter' в массиве типов GraphQL от tarkov.dev)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemTypes = (item as any).types as string[] | undefined;
      if (barterOnly && (!itemTypes || !itemTypes.includes("barter"))) return false;

      // Логика фильтрации по классу брони
      if (activeCategory === "armor" && item.category === "armor") {
        const armor = item as ArmorMetrics;
        const ac = armor.armorClass || 1;
        if (ac < armorFilters.minClass || ac > armorFilters.maxClass) return false;
      }

      // Фильтр "Доступно мне" по уровню торговцев ЧВК и барахолке
      if (availableOnly) {
        // Ищем все предложения о покупке (buyFor - покупаем у торговцев)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buyOffers = (item as any).buyFor as any[];
        if (!buyOffers || !Array.isArray(buyOffers) || buyOffers.length === 0) {
          return false; // Предмет вообще нельзя купить напрямую
        }

        const hasAvailableOffer = buyOffers.some((offer) => {
          const vendor = offer.vendor?.normalizedName || offer.vendor?.name?.toLowerCase();
          if (!vendor) return false;

          // Барахолка доступна только с 15 уровня
          if (vendor === "flea-market") {
            return playerLevel >= 15;
          }

          // Проверяем требования к уровню лояльности торговца (API tarkov.dev)
          const requiredLevel = offer.vendor?.minTraderLevel || offer.minTraderLevel || offer.loyaltyLevel || 1;
          const currentLevel = traderLevels[vendor as keyof typeof traderLevels] || 1;
          
          return currentLevel >= requiredLevel;
        });

        if (!hasAvailableOffer) return false;
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
          case "vps_desc": {
            const areaA = ((a as any).width || 1) * ((a as any).height || 1);
            const areaB = ((b as any).width || 1) * ((b as any).height || 1);
            const vpsA = a.fleaPrice ? a.fleaPrice / areaA : -1;
            const vpsB = b.fleaPrice ? b.fleaPrice / areaB : -1;
            return vpsB - vpsA;
          }
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
    barterOnly,
    setBarterOnly,
    availableOnly,
    setAvailableOnly,
    filteredItems,
  };
};