import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Экономика game02 «Три в ряд»: кошелёк ₽ + энергия (5 макс, +1/30мин, −1 при поражении).
// Звёзды/убежище (мета-прогресс) — заложено на будущее, в MVP не начисляем.

const ENERGY_MAX = 5;
const ENERGY_REGEN_MS = 30 * 60 * 1000;

interface Match3Store {
  rubles: number;
  energy: number;
  energyAt: number; // якорь регена (мс)
  currentLevel: number;
  stars: number; // мета-прогресс (future)
  _hasHydrated: boolean;
  setHasHydrated: () => void;

  /** Текущая энергия с учётом регена (обновляет стор). */
  syncEnergy: () => number;
  addRubles: (n: number) => void;
  spendRubles: (n: number) => boolean;
  spendEnergy: () => void;
  refillEnergy: () => boolean;
  setLevel: (i: number) => void;
}

export const useMatch3Store = create<Match3Store>()(
  persist(
    (set, get) => ({
      rubles: 0,
      energy: ENERGY_MAX,
      energyAt: Date.now(),
      currentLevel: 0,
      stars: 0,
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      syncEnergy: () => {
        const s = get();
        if (s.energy >= ENERGY_MAX) return s.energy;
        const now = Date.now();
        const gained = Math.floor((now - s.energyAt) / ENERGY_REGEN_MS);
        if (gained <= 0) return s.energy;
        const energy = Math.min(ENERGY_MAX, s.energy + gained);
        const energyAt = energy >= ENERGY_MAX ? now : s.energyAt + gained * ENERGY_REGEN_MS;
        set({ energy, energyAt });
        return energy;
      },

      addRubles: (n) => set((s) => ({ rubles: s.rubles + n })),
      spendRubles: (n) => {
        if (get().rubles < n) return false;
        set((s) => ({ rubles: s.rubles - n }));
        return true;
      },
      spendEnergy: () => {
        const e = get().syncEnergy();
        set((s) => ({ energy: Math.max(0, e - 1), energyAt: e >= ENERGY_MAX ? Date.now() : s.energyAt }));
      },
      refillEnergy: () => {
        if (!get().spendRubles(500)) return false;
        set({ energy: ENERGY_MAX, energyAt: Date.now() });
        return true;
      },
      setLevel: (i) => set({ currentLevel: i }),
    }),
    {
      name: 'cta-match3',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (s) => ({
        rubles: s.rubles,
        energy: s.energy,
        energyAt: s.energyAt,
        currentLevel: s.currentLevel,
        stars: s.stars,
      }),
    },
  ),
);
