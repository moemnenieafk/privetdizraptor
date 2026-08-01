import { create } from 'zustand';

// Story/lore-слой: одна выбранная сюжетная история → подсветка её чекпоинтов-маршрута на карте.
// Эфемерно. Позиции/порядок считаются в MapViewerClient из editorial-маркеров (linkKind='story').
interface StoryFilterState {
  slug: string | null;
  /** Выбрать историю; повторный выбор той же — снять (toggle). */
  select: (slug: string) => void;
  clear: () => void;
}

export const useStoryFilterStore = create<StoryFilterState>((set) => ({
  slug: null,
  select: (slug) => set((s) => ({ slug: s.slug === slug ? null : slug })),
  clear: () => set({ slug: null }),
}));
