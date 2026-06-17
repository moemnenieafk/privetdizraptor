import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BADGE_DEFINITIONS, type BadgeState } from '@/types/gamification';
import type { BarterCalculation, BarterTrade } from '@/types/barter';

export interface DealInput {
  barter: BarterTrade;
  calc: BarterCalculation;
  allBarters: BarterTrade[];
}

interface GamificationStore {
  xp: number;
  sessionProfit: number;
  sessionSavings: number;
  confirmedBarterIds: string[];
  badges: BadgeState[];
  recordDeal: (input: DealInput) => void;
  resetSession: () => void;
}

const INITIAL_BADGES: BadgeState[] = BADGE_DEFINITIONS.map((b) => ({ ...b, unlockedAt: null }));

function applyBadgeChecks(
  badges: BadgeState[],
  barter: BarterTrade,
  calc: BarterCalculation,
  confirmedIds: string[],
  allBarters: BarterTrade[],
): BadgeState[] {
  return badges.map((badge) => {
    if (badge.unlockedAt !== null) return badge;
    let unlock = false;
    if (badge.id === 'wholesaler') {
      unlock = barter.requiredItems.length >= 5;
    } else if (badge.id === 'speculator') {
      unlock = calc.roi > 200;
    } else if (badge.id === 'lighthouse-master') {
      const lkBarters = allBarters.filter((b) => b.trader.normalizedName === 'lightkeeper');
      unlock = lkBarters.length > 0 && lkBarters.every((b) => confirmedIds.includes(b.id));
    }
    return unlock ? { ...badge, unlockedAt: Date.now() } : badge;
  });
}

export const useGamificationStore = create<GamificationStore>()(
  persist(
    (set) => ({
      xp: 0,
      sessionProfit: 0,
      sessionSavings: 0,
      confirmedBarterIds: [],
      badges: INITIAL_BADGES,

      recordDeal: ({ barter, calc, allBarters }) =>
        set((state) => {
          const gainedProfit = Math.max(0, calc.instantProfit);
          const gainedSavings = Math.max(0, calc.calculatedSavings);
          const newConfirmedIds = state.confirmedBarterIds.includes(barter.id)
            ? state.confirmedBarterIds
            : [...state.confirmedBarterIds, barter.id];
          return {
            xp: state.xp + gainedProfit,
            sessionProfit: state.sessionProfit + gainedProfit,
            sessionSavings: state.sessionSavings + gainedSavings,
            confirmedBarterIds: newConfirmedIds,
            badges: applyBadgeChecks(state.badges, barter, calc, newConfirmedIds, allBarters),
          };
        }),

      resetSession: () => set({ sessionProfit: 0, sessionSavings: 0 }),
    }),
    {
      name: 'cta-barter-gamification',
      partialize: (state) => ({
        xp: state.xp,
        confirmedBarterIds: state.confirmedBarterIds,
        badges: state.badges,
      }),
    },
  ),
);
