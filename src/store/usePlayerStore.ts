import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type EditionType } from '@/components/layout/header-modules/ProfileSettingsModal';

export interface PlayerProfile {
  id: string;
  nickname: string;
  level: string;
  prestige: string;
  faction: 'USEC' | 'BEAR';
  edition: EditionType;
  mode: 'PVP' | 'PVE';
  traderLevels: Record<string, number>;
}

const defaultTraderLevels = {
  prapor: 1, therapist: 1, fence: 1, skier: 1, peacekeeper: 1, mechanic: 1, ragman: 1, jaeger: 1, ref: 1
};

interface PlayerStore {
  profiles: PlayerProfile[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  addProfile: () => void;
  updateProfile: (id: string, data: Partial<PlayerProfile>) => void;
  deleteProfile: (id: string) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      profiles: [
        {
          id: '1',
          nickname: 'TarkovCitizen',
          level: '1',
          prestige: '0',
          faction: 'BEAR',
          edition: 'Standard',
          mode: 'PVP',
          traderLevels: defaultTraderLevels,
        }
      ],
      activeProfileId: '1',

      setActiveProfileId: (id) => set({ activeProfileId: id }),

      addProfile: () => set((state) => {
        if (state.profiles.length >= 5) return state; // Максимум 5 профилей
        const newId = Date.now().toString();
        const newProfile: PlayerProfile = {
          id: newId,
          nickname: `TarkovCitizen_${state.profiles.length + 1}`,
          level: '1',
          prestige: '0',
          faction: 'USEC',
          edition: 'Standard',
          mode: 'PVE',
          traderLevels: { ...defaultTraderLevels },
        };
        return {
          profiles: [...state.profiles, newProfile],
          activeProfileId: newId, // Автоматически переключаем на новый профиль
        };
      }),

      updateProfile: (id, data) => set((state) => ({
        profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...data } : p)),
      })),

      deleteProfile: (id) => set((state) => {
        const newProfiles = state.profiles.filter((p) => p.id !== id);
        if (newProfiles.length === 0) return state; // Не даем удалить единственный (последний) профиль
        return {
          profiles: newProfiles,
          activeProfileId: state.activeProfileId === id ? newProfiles[0].id : state.activeProfileId,
        };
      }),
    }),
    {
      name: 'player-profile-storage',
    }
  )
);