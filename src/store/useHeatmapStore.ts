import { create } from 'zustand';

// Heatmap плотности денег (EV) — режим-toggle поверх карты. Эфемерно (как лут-фильтр/story).
// Точки/веса приходят пропсом из page.tsx (EV посчитан сервером); тут только флаг видимости.
interface HeatmapState {
  active: boolean;
  toggle: () => void;
  setActive: (v: boolean) => void;
}

export const useHeatmapStore = create<HeatmapState>((set) => ({
  active: false,
  toggle: () => set((s) => ({ active: !s.active })),
  setActive: (v) => set({ active: v }),
}));
