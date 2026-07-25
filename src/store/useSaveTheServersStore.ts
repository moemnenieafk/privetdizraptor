import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Экономика game01 «Спаси сервера» — ЛОКАЛЬНАЯ, отдельная от profit-XP (useGamificationStore).
// Постоянный кошелёк: очки за забеги копятся, скины холодного оружия покупаются по ступени +20
// и остаются навсегда. Синк с аккаунтом не нужен → без миграций.

interface SaveTheServersStore {
  bestScore: number;
  /** Постоянный кошелёк очков (валюта магазина скинов). */
  wallet: number;
  /** id разблокированных скинов (bars бесплатен на старте). */
  unlockedSkins: string[];
  /** id выбранного скина (активный курсор в игре). */
  selectedSkin: string;
  _hasHydrated: boolean;
  setHasHydrated: () => void;

  /** Итог забега: очки в кошелёк, обновить рекорд. */
  recordRun: (score: number) => void;
  /** Купить скин за price. true — куплено. */
  buySkin: (id: string, price: number) => boolean;
  selectSkin: (id: string) => void;
  resetProgress: () => void;
}

export const useSaveTheServersStore = create<SaveTheServersStore>()(
  persist(
    (set, get) => ({
      bestScore: 0,
      wallet: 0,
      unlockedSkins: ['bars'],
      selectedSkin: 'bars',
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      recordRun: (score) =>
        set((s) => ({ wallet: s.wallet + score, bestScore: Math.max(s.bestScore, score) })),

      buySkin: (id, price) => {
        const s = get();
        if (s.unlockedSkins.includes(id)) {
          set({ selectedSkin: id });
          return true;
        }
        if (s.wallet < price) return false;
        set({ wallet: s.wallet - price, unlockedSkins: [...s.unlockedSkins, id], selectedSkin: id });
        return true;
      },

      selectSkin: (id) =>
        set((s) => (s.unlockedSkins.includes(id) ? { selectedSkin: id } : {})),

      resetProgress: () => set({ bestScore: 0, wallet: 0, unlockedSkins: ['bars'], selectedSkin: 'bars' }),
    }),
    {
      name: 'cta-save-the-servers',
      // SSR-safe: rehydrate() зовём в эффекте на клиенте.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (s) => ({
        bestScore: s.bestScore,
        wallet: s.wallet,
        unlockedSkins: s.unlockedSkins,
        selectedSkin: s.selectedSkin,
      }),
    },
  ),
);
