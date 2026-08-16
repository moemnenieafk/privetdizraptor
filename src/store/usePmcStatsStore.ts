import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerView } from '@/types/eft-player';

/**
 * Рич-стата активного профиля ЧВК: навыки / мастерство оружия / рейды по сторонам.
 * Этих данных НЕТ в плоском usePlayerStore (там только идентичность + сводные числа) —
 * они парсятся из личного profile.json и живут отдельным слотом, чтобы досье могло
 * развернуть детальную статистику под карточками разделов (профиль-гейт: view==null → секции нет).
 *
 * Волна 1: один слот `view`. Волна 2 превратит его в per-mode (season/pvp/pve) — сейчас НЕ трогаем.
 */
interface PmcStatsStore {
  /** Распарсенная вью-модель профиля. null — стата не загружена (гейт секции). */
  view: PlayerView | null;
  setView: (view: PlayerView | null) => void;
}

export const usePmcStatsStore = create<PmcStatsStore>()(
  persist(
    (set) => ({
      view: null,
      setView: (view) => set({ view }),
    }),
    {
      name: 'pmc-rich-stats-storage',
    },
  ),
);
