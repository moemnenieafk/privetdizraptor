import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerRole, RoleInference } from '@/lib/role-inference';

// Стор роли «Ульты» (см. docs/decisions/adaptive-hub-ulta.md).
// derived — авто-инференс (пересчитывается провайдером из профиля+телеметрии);
// manualOverride — явный выбор игрока (всегда главнее). effectiveRole = override ?? derived.

interface RoleStore {
  /** Последний авто-инференс (null — ещё не считался). */
  derived: RoleInference | null;
  /** Явный выбор игрока — перебивает авто. null — доверяем авто. */
  manualOverride: PlayerRole | null;
  /** Таймстемп последнего пересчёта derived. */
  lastComputedAt: number;
  /** SSR-safe гейт регидратации persist (не персистится). */
  _hasHydrated: boolean;
  setHasHydrated: () => void;

  setDerived: (inference: RoleInference) => void;
  setManualOverride: (role: PlayerRole | null) => void;
  clearOverride: () => void;
}

export const useRoleStore = create<RoleStore>()(
  persist(
    (set) => ({
      derived: null,
      manualOverride: null,
      lastComputedAt: 0,
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      setDerived: (inference) => set({ derived: inference, lastComputedAt: Date.now() }),
      setManualOverride: (role) => set({ manualOverride: role }),
      clearOverride: () => set({ manualOverride: null }),
    }),
    {
      name: 'cta-role',
      // SSR-safe: не гидрируем на module-eval; rehydrate() зовём в эффекте на клиенте.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (state) => ({
        derived: state.derived,
        manualOverride: state.manualOverride,
        lastComputedAt: state.lastComputedAt,
      }),
    },
  ),
);

/** Итоговая роль: ручной выбор главнее авто, дефолт — новичок. */
export function selectEffectiveRole(state: RoleStore): PlayerRole {
  return state.manualOverride ?? state.derived?.primary ?? 'rookie';
}
