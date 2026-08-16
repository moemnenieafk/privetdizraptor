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
  hoursPlayed: number | null;
  raids: number | null;
  survivalRate: number | null;
  traderLevels: Record<string, number>;
  // ── EFT-идентичность из личного profile.json (аддитивно, T-plumbing) ──
  // Заполняется загрузкой профиля (parseGameProfile → updateProfile). Существующие
  // читатели (шапка/модалка/Досье hero) на эти поля не завязаны — все опциональны и
  // по умолчанию null. Досье-визуал (позже, по Figma) читает K/D и pmc-показатели отсюда.
  /** Битфлаги memberCategory игры (издание/статусы: EOD/Unheard/Sherpa…). */
  memberCategory?: number | null;
  /** Игровой опыт ЧВК (info.experience — очки уровня, для EXP+ в Досье). */
  experience?: number | null;
  /** Убийств всего (PMC-сторона). */
  kills?: number | null;
  /** Смертей всего (PMC-сторона). */
  deaths?: number | null;
  /** Погиб в рейде — вынесен из игры (ExitStatus/Killed, PMC). */
  killed?: number | null;
  /** Выжил в рейде (ExitStatus/Survived, PMC). */
  survived?: number | null;
  /** K/D = kills/deaths. */
  kd?: number | null;
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
          hoursPlayed: null,
          raids: null,
          survivalRate: null,
          traderLevels: defaultTraderLevels,
          memberCategory: null,
          experience: null,
          kills: null,
          deaths: null,
          killed: null,
          survived: null,
          kd: null,
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
          hoursPlayed: null,
          raids: null,
          survivalRate: null,
          traderLevels: { ...defaultTraderLevels },
          memberCategory: null,
          experience: null,
          kills: null,
          deaths: null,
          killed: null,
          survived: null,
          kd: null,
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