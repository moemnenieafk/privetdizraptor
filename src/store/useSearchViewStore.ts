import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewMode } from "@/components/ui/DataViewToggle";

// UI-состояние выдачи предметов в глобальном тактическом поиске (TacticalSearch).
//   • grid  — плитка (дефолт): узнаваемые иконки-инвентарь, быстрый поиск глазами;
//   • table — список: плотные строки, удобно сравнивать цены/статы на мобилке.
// Persist: выбранный режим запоминается между переходами и перезагрузками.
interface SearchViewStore {
  itemView: ViewMode;
  setItemView: (view: ViewMode) => void;
}

export const useSearchViewStore = create<SearchViewStore>()(
  persist(
    (set) => ({
      itemView: "grid",
      setItemView: (itemView) => set({ itemView }),
    }),
    { name: "cta-search-view" },
  ),
);
