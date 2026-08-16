import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Стор конструктора главной EFT (Слой 1) — РУЧНОЙ override поверх авто-набора архетипа.
// ГЛОБАЛЬНЫЙ (одно состояние на юзера, НЕ per-profile) — применяется к любому архетип-набору.
// Ключи — featureId из FEATURE_CATALOG. Пустой стор → чистая авто-база (Слой 0 без изменений).
// §4.7: сам расчёт показа — чистый хелпер computeHomeFeatures, здесь только состояние+actions.

export type HomeCardSize = 'big' | 'middle' | 'mini';

export interface HomeLayoutOverride {
  /** Скрытые фичи (выкинуты из набора). */
  hidden: string[];
  /** Закреплённые вверх — в порядке закрепления. */
  pinned: string[];
  /** Переопределение размера плитки. */
  sizes: Record<string, HomeCardSize>;
  /** Добавленные из полного каталога (не из архетип-набора). */
  added: string[];
}

interface HomeLayoutStore extends HomeLayoutOverride {
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  /** Скрыть/вернуть фичу (тумблер). */
  toggleHidden: (id: string) => void;
  /** Закрепить/открепить вверх (тумблер). */
  togglePinned: (id: string) => void;
  /** Задать размер плитки. */
  setSize: (id: string, size: HomeCardSize) => void;
  /** Добавить фичу из каталога (в набор, уникально). */
  addFeature: (id: string) => void;
  /** Убрать ранее добавленную фичу. */
  removeAdded: (id: string) => void;
  /** Полный сброс к авто-базе. */
  reset: () => void;
}

const toggle = (list: string[], id: string): string[] =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

export const useHomeLayoutStore = create<HomeLayoutStore>()(
  persist(
    (set) => ({
      hidden: [],
      pinned: [],
      sizes: {},
      added: [],
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      toggleHidden: (id) => set((s) => ({ hidden: toggle(s.hidden, id) })),
      togglePinned: (id) => set((s) => ({ pinned: toggle(s.pinned, id) })),
      setSize: (id, size) => set((s) => ({ sizes: { ...s.sizes, [id]: size } })),
      addFeature: (id) =>
        set((s) => ({
          added: s.added.includes(id) ? s.added : [...s.added, id],
          // Добавление возвращает скрытое обратно в набор.
          hidden: s.hidden.filter((x) => x !== id),
        })),
      removeAdded: (id) => set((s) => ({ added: s.added.filter((x) => x !== id) })),
      reset: () => set({ hidden: [], pinned: [], sizes: {}, added: [] }),
    }),
    {
      name: 'cta-home-layout-v1',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (state) => ({
        hidden: state.hidden,
        pinned: state.pinned,
        sizes: state.sizes,
        added: state.added,
      }),
    },
  ),
);
