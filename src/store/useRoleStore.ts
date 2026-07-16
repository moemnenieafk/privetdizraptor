import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerRole, RoleInference } from '@/lib/role-inference';

// Стор роли «Ульты» — ПО ПРОФИЛЮ ЧВК (у каждого профиля свой стиль → своя роль).
// derived — авто-инференс (провайдер), manualOverride — явный выбор игрока (главнее).

export interface ProfileRole {
  derived: RoleInference | null;
  manualOverride: PlayerRole | null;
  lastComputedAt: number;
}

const EMPTY_ROLE: ProfileRole = { derived: null, manualOverride: null, lastComputedAt: 0 };

interface RoleStore {
  byProfile: Record<string, ProfileRole>;
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  setDerived: (profileId: string, inference: RoleInference) => void;
  setManualOverride: (profileId: string, role: PlayerRole | null) => void;
  clearOverride: (profileId: string) => void;
}

export const useRoleStore = create<RoleStore>()(
  persist(
    (set) => ({
      byProfile: {},
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      setDerived: (profileId, inference) =>
        set((s) => ({
          byProfile: {
            ...s.byProfile,
            [profileId]: { ...(s.byProfile[profileId] ?? EMPTY_ROLE), derived: inference, lastComputedAt: Date.now() },
          },
        })),
      setManualOverride: (profileId, role) =>
        set((s) => ({
          byProfile: {
            ...s.byProfile,
            [profileId]: { ...(s.byProfile[profileId] ?? EMPTY_ROLE), manualOverride: role },
          },
        })),
      clearOverride: (profileId) =>
        set((s) => ({
          byProfile: {
            ...s.byProfile,
            [profileId]: { ...(s.byProfile[profileId] ?? EMPTY_ROLE), manualOverride: null },
          },
        })),
    }),
    {
      name: 'cta-role-v2',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (state) => ({ byProfile: state.byProfile }),
    },
  ),
);

/** Роль конкретного профиля (или пустая). */
export function selectProfileRole(state: RoleStore, profileId: string): ProfileRole {
  return state.byProfile[profileId] ?? EMPTY_ROLE;
}

/** Итоговая роль профиля: ручной выбор главнее авто, дефолт — новичок. */
export function effectiveRoleFor(state: RoleStore, profileId: string): PlayerRole {
  const r = state.byProfile[profileId];
  return r?.manualOverride ?? r?.derived?.primary ?? 'rookie';
}
