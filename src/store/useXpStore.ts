import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerRole } from '@/lib/role-inference';
import {
  ARCHETYPE_MULTIPLIER,
  FLOW_FEATURE,
  XP_DISCOVERY,
  XP_FLOW,
  XP_VISIT,
  isOnArchetype,
} from '@/lib/xp';

// Клиентский XP-слой экономики очков (docs/decisions/points-economy.md).
// Только хранит/диспатчит — вся математика в @/lib/xp (§4.7). Персист в localStorage,
// skipHydration как useBehaviorStore: до регидрации сюрфейсы не рендерят (mount-гейт).
//
// Разделение потоков (§спека): ЛЮБОЕ действие льёт базовый XP в activityXp (ширина, заголовочный
// сигнал). Множитель ×2 идёт ТОЛЬКО в под-трек активного архетипа и ТОЛЬКО когда фича ∈ его набора
// (глубина = играешь в стиль). Off-архетип в под-трек не попадает вовсе.

interface XpStore {
  /** Суммарный XP активности (ширина по порталу; заголовочный сигнал standing). */
  activityXp: number;
  /** XP под-трека каждого архетипа (глубина в его доменных фичах). */
  subTracks: Partial<Record<PlayerRole, number>>;
  /** id фич, использованных впервые (майлстоун discovery — раз на фичу). */
  discovered: string[];
  _hasHydrated: boolean;
  setHasHydrated: () => void;

  /** Клик/использование фичи: базовый XP + discovery + ×2 в под-трек, если on-архетип. */
  recordFeatureUse: (featureId: string, role: PlayerRole) => void;
  /** Завершённый флоу (XP_FLOW[flowId]): базовый XP + ×2 в под-трек, если flow-фича on-архетип. */
  recordFlow: (flowId: string, role: PlayerRole) => void;
  /** Сброс (дебаг/тесты). */
  reset: () => void;
}

/** Начислить базовый XP в activityXp и (×множитель) в под-трек архетипа, если on-архетип. */
function applyGain(
  s: Pick<XpStore, 'activityXp' | 'subTracks'>,
  base: number,
  featureId: string,
  role: PlayerRole,
): Pick<XpStore, 'activityXp' | 'subTracks'> {
  const activityXp = s.activityXp + base;
  if (!isOnArchetype(featureId, role)) {
    return { activityXp, subTracks: s.subTracks };
  }
  const current = s.subTracks[role] ?? 0;
  return {
    activityXp,
    subTracks: { ...s.subTracks, [role]: current + base * ARCHETYPE_MULTIPLIER },
  };
}

export const useXpStore = create<XpStore>()(
  persist(
    (set, get) => ({
      activityXp: 0,
      subTracks: {},
      discovered: [],
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      recordFeatureUse: (featureId, role) => {
        const state = get();
        const isFirst = !state.discovered.includes(featureId);
        // Базовый XP этого действия = визит (+ discovery-бонус при первом использовании).
        const base = XP_VISIT + (isFirst ? XP_DISCOVERY : 0);
        const gain = applyGain(state, base, featureId, role);
        set({
          ...gain,
          discovered: isFirst ? [...state.discovered, featureId] : state.discovered,
        });
      },

      recordFlow: (flowId, role) => {
        const base = XP_FLOW[flowId];
        if (base === undefined) return; // неизвестный флоу — не начисляем
        // Множитель под-трека — по фиче, к которой привязан флоу (не по самому flowId).
        // Флоу без доменной фичи (profile-load/tutorial-step) → пустой id → под-трек не растёт.
        set(applyGain(get(), base, FLOW_FEATURE[flowId] ?? '', role));
      },

      reset: () => set({ activityXp: 0, subTracks: {}, discovered: [] }),
    }),
    {
      name: 'cta-xp',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (state) => ({
        activityXp: state.activityXp,
        subTracks: state.subTracks,
        discovered: state.discovered,
      }),
    },
  ),
);
