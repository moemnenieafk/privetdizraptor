import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Прогресс Боевого Пропуска: какие награды игрок отметил как полученные. Хранится ПО СЕЗОНАМ
 * (ключ = slug сезона) в localStorage — личный трекер, серверу не нужен (§5: необратимых
 * БД-операций нет). Прецеденты: useSeasonStore, useRoomOpensStore.
 *
 * Компонент подписывается на `claimed[slug]` и сам выводит Set для O(1)-проверки — стор держит
 * массивы (сериализуемы).
 */
interface BattlePassState {
  /** slug сезона → id полученных наград. */
  claimed: Record<string, string[]>;

  toggle: (slug: string, rewardId: string) => void;
  /** Массовая простановка (например «получить всю страницу»). */
  setMany: (slug: string, rewardIds: string[], on: boolean) => void;
  resetSeason: (slug: string) => void;
  claimedFor: (slug: string) => string[];
}

export const useBattlePassStore = create<BattlePassState>()(
  persist(
    (set, get) => ({
      claimed: {},

      claimedFor: (slug) => get().claimed[slug] ?? [],

      toggle: (slug, rewardId) => {
        const current = get().claimed[slug] ?? [];
        const next = current.includes(rewardId)
          ? current.filter((id) => id !== rewardId)
          : [...current, rewardId];
        set((s) => ({ claimed: { ...s.claimed, [slug]: next } }));
      },

      setMany: (slug, rewardIds, on) => {
        const current = new Set(get().claimed[slug] ?? []);
        for (const id of rewardIds) {
          if (on) current.add(id);
          else current.delete(id);
        }
        set((s) => ({ claimed: { ...s.claimed, [slug]: [...current] } }));
      },

      resetSeason: (slug) => set((s) => ({ claimed: { ...s.claimed, [slug]: [] } })),
    }),
    { name: 'cta-battlepass' },
  ),
);
