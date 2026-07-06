import { create } from "zustand";
import { persist } from "zustand/middleware";

// UI-состояние плавающих Twitch-доков (StreamDock). По каналу:
//   • expanded — большой виджет 280×156 виден;
//   • hidden   — свёрнут в 1×1px: Twitch продолжает считать зрителя, но виджет не
//                виден и не кликабелен. Развернуть можно только внешним триггером
//                (кнопка статуса стрима в хедере / LIVE-бейдж в футере).
// Дефолт (нет записи) = expanded при первом появлении канала в эфире.
// Persist: закрыл один раз — остаётся закрытым между переходами и перезагрузками.
type DockView = "expanded" | "hidden";

interface StreamDockStore {
  views: Record<string, DockView>;
  hide: (channel: string) => void;
  expand: (channel: string) => void;
}

export const useStreamDockStore = create<StreamDockStore>()(
  persist(
    (set) => ({
      views: {},
      hide: (channel) => set((s) => ({ views: { ...s.views, [channel]: "hidden" } })),
      expand: (channel) => set((s) => ({ views: { ...s.views, [channel]: "expanded" } })),
    }),
    { name: "cta-stream-dock" },
  ),
);
