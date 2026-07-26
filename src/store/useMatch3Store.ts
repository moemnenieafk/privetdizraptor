import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  START_RUBLES,
  ENERGY_MAX,
  ENERGY_REGEN_MS,
  ENERGY_REFILL_PRICE,
  TOOLS,
  type ToolKind,
} from '@/components/features/arcade/games/tarkov-match3/config';

// Экономика game02 «Три в ряд» v0.3: кошелёк ₽ (старт 2000), энергия (5 макс, +1/30мин, −1 при
// поражении, рефилл 900 ₽), звёзды ⭐ (+1 за уровень), инвентарь инструментов (старт 0).

type ToolInv = Record<ToolKind, number>;
const emptyTools = (): ToolInv => ({ tool: 0, 'pestik-horizontal': 0, 'pestik-vertical': 0, vodka: 0 });

interface Match3Store {
  rubles: number;
  energy: number;
  energyAt: number; // якорь регена (мс)
  currentLevel: number;
  stars: number;
  tools: ToolInv;
  _hasHydrated: boolean;
  setHasHydrated: () => void;

  syncEnergy: () => number;
  addRubles: (n: number) => void;
  spendRubles: (n: number) => boolean;
  spendEnergy: () => void;
  refillEnergy: () => boolean;
  addStar: () => void;
  spendTool: (kind: ToolKind) => boolean;
  addTool: (kind: ToolKind, n: number) => void;
  setLevel: (i: number) => void;
}

export const useMatch3Store = create<Match3Store>()(
  persist(
    (set, get) => ({
      rubles: START_RUBLES,
      energy: ENERGY_MAX,
      energyAt: Date.now(),
      currentLevel: 0,
      stars: 0,
      tools: emptyTools(),
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
        if (!get().spendRubles(ENERGY_REFILL_PRICE)) return false;
        set({ energy: ENERGY_MAX, energyAt: Date.now() });
        return true;
      },
      addStar: () => set((s) => ({ stars: s.stars + 1 })),
      spendTool: (kind) => {
        if ((get().tools[kind] ?? 0) <= 0) return false;
        set((s) => ({ tools: { ...s.tools, [kind]: s.tools[kind] - 1 } }));
        return true;
      },
      addTool: (kind, n) => set((s) => ({ tools: { ...s.tools, [kind]: (s.tools[kind] ?? 0) + n } })),
      setLevel: (i) => set({ currentLevel: i }),
    }),
    {
      name: 'cta-match3',
      version: 3, // v0.3: сброс экономики к стартовым (2000 ₽ / 5 ⚡ / 0 ⭐ / инструменты 0)
      skipHydration: true,
      migrate: () => ({
        rubles: START_RUBLES,
        energy: ENERGY_MAX,
        energyAt: Date.now(),
        currentLevel: 0,
        stars: 0,
        tools: emptyTools(),
      }),
      onRehydrateStorage: () => (state) => {
        // Гарантируем валидный инвентарь после старой версии/частичного стейта.
        if (state && !state.tools) state.tools = emptyTools();
        for (const t of TOOLS) if (state && state.tools[t] == null) state.tools[t] = 0;
        state?.setHasHydrated();
      },
      partialize: (s) => ({
        rubles: s.rubles,
        energy: s.energy,
        energyAt: s.energyAt,
        currentLevel: s.currentLevel,
        stars: s.stars,
        tools: s.tools,
      }),
    },
  ),
);
