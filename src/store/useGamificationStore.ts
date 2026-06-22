import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BADGE_DEFINITIONS,
  getCurrentTier,
  type BadgeId,
  type BadgeState,
  type TraderTier,
} from '@/types/gamification';
import type { BarterCalculation, BarterTrade, BarterVerdict } from '@/types/barter';

export interface DealInput {
  barter: BarterTrade;
  calc: BarterCalculation;
  allBarters: BarterTrade[];
}

/** Что произошло в результате фиксации — UI слушает это для эффектов/звука. */
export interface DealResult {
  xpGained: number;
  rankUp: TraderTier | null;
  newBadges: BadgeId[];
  streak: number;
  streakUp: boolean;
  verdict: BarterVerdict;
}

interface GamificationStore {
  xp: number;
  sessionProfit: number;
  sessionSavings: number;
  confirmedBarterIds: string[];
  badges: BadgeState[];
  streak: number;
  bestStreak: number;
  dailyDate: string;
  dailyProfit: number;
  lifetimeProfit: number;
  lifetimeSavings: number;
  soundMuted: boolean;
  /** Транзиентный таймстемп последнего ранг-апа (для пульса эмблемы), не персистится. */
  rankUpAt: number;
  /** Прошла ли регидратация persist на клиенте (SSR-safe гейт), не персистится. */
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  recordDeal: (input: DealInput) => DealResult;
  resetSession: () => void;
  toggleSound: () => void;
  /** Применить (слитый) прогресс с сервера — синк аккаунта. */
  hydrateProgress: (p: AccountProgress) => void;
}

/** Persisted-форма прогресса для синка с аккаунтом. */
export interface AccountProgress {
  xp: number;
  confirmedBarterIds: string[];
  badges: BadgeState[];
  streak: number;
  bestStreak: number;
  dailyDate: string | null;
  dailyProfit: number;
  lifetimeProfit: number;
  lifetimeSavings: number;
}

const INITIAL_BADGES: BadgeState[] = BADGE_DEFINITIONS.map((b) => ({ ...b, unlockedAt: null }));

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
    (set, get) => ({
      xp: 0,
      sessionProfit: 0,
      sessionSavings: 0,
      confirmedBarterIds: [],
      badges: INITIAL_BADGES,
      streak: 0,
      bestStreak: 0,
      dailyDate: todayKey(),
      dailyProfit: 0,
      lifetimeProfit: 0,
      lifetimeSavings: 0,
      soundMuted: false,
      rankUpAt: 0,
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      recordDeal: ({ barter, calc, allBarters }) => {
        const state = get();
        const gainedProfit = Math.max(0, calc.netProfit);
        const gainedSavings = Math.max(0, calc.calculatedSavings);
        const profitable = calc.verdict === 'profitable';

        const newXp = state.xp + gainedProfit;
        const newConfirmedIds = state.confirmedBarterIds.includes(barter.id)
          ? state.confirmedBarterIds
          : [...state.confirmedBarterIds, barter.id];
        const newBadgeStates = applyBadgeChecks(
          state.badges,
          barter,
          calc,
          newConfirmedIds,
          allBarters,
        );

        // События для UI
        const prevLevel = getCurrentTier(state.xp).level;
        const newTier = getCurrentTier(newXp);
        const rankUp = newTier.level > prevLevel ? newTier : null;
        const newBadges = newBadgeStates
          .filter((b, i) => b.unlockedAt !== null && state.badges[i].unlockedAt === null)
          .map((b) => b.id);

        // Серию рвёт только явный убыток; нейтральная сделка её сохраняет (не растит).
        const broke = calc.verdict === 'unprofitable';
        const newStreak = broke ? 0 : profitable ? state.streak + 1 : state.streak;
        const streakUp = newStreak > state.streak;
        const bestStreak = Math.max(state.bestStreak, newStreak);

        // Дневная цель — сброс при смене суток
        const today = todayKey();
        const dailyBase = state.dailyDate === today ? state.dailyProfit : 0;

        set({
          xp: newXp,
          sessionProfit: state.sessionProfit + gainedProfit,
          sessionSavings: state.sessionSavings + gainedSavings,
          confirmedBarterIds: newConfirmedIds,
          badges: newBadgeStates,
          streak: newStreak,
          bestStreak,
          dailyDate: today,
          dailyProfit: dailyBase + gainedProfit,
          lifetimeProfit: state.lifetimeProfit + gainedProfit,
          lifetimeSavings: state.lifetimeSavings + gainedSavings,
          rankUpAt: rankUp ? Date.now() : state.rankUpAt,
        });

        return {
          xpGained: gainedProfit,
          rankUp,
          newBadges,
          streak: newStreak,
          streakUp,
          verdict: calc.verdict,
        };
      },

      resetSession: () => set({ sessionProfit: 0, sessionSavings: 0 }),
      toggleSound: () => set((s) => ({ soundMuted: !s.soundMuted })),

      hydrateProgress: (p) =>
        set({
          xp: p.xp,
          confirmedBarterIds: p.confirmedBarterIds,
          badges: p.badges.length ? p.badges : INITIAL_BADGES,
          streak: p.streak,
          bestStreak: p.bestStreak,
          dailyDate: p.dailyDate ?? todayKey(),
          dailyProfit: p.dailyProfit,
          lifetimeProfit: p.lifetimeProfit,
          lifetimeSavings: p.lifetimeSavings,
        }),
    }),
    {
      name: 'cta-barter-gamification',
      // SSR-safe: не гидрируем на module-eval; rehydrate() зовём в эффекте на клиенте.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (state) => ({
        xp: state.xp,
        confirmedBarterIds: state.confirmedBarterIds,
        badges: state.badges,
        streak: state.streak,
        bestStreak: state.bestStreak,
        dailyDate: state.dailyDate,
        dailyProfit: state.dailyProfit,
        lifetimeProfit: state.lifetimeProfit,
        lifetimeSavings: state.lifetimeSavings,
        soundMuted: state.soundMuted,
      }),
    },
  ),
);
