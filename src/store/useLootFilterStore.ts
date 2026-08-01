import { create } from 'zustand';

// Лут-фильтр: набор label'ов предметов для постоянной подсветки спавнов (реверс-паттерн).
// Эфемерно (про текущий рейд, без localStorage). Позиции считаются в MapViewerClient из data.markers.
interface LootFilterState {
  labels: string[];
  toggle: (label: string) => void;
  clear: () => void;
}

export const useLootFilterStore = create<LootFilterState>((set) => ({
  labels: [],
  toggle: (label) =>
    set((s) => ({ labels: s.labels.includes(label) ? s.labels.filter((l) => l !== label) : [...s.labels, label] })),
  clear: () => set({ labels: [] }),
}));
