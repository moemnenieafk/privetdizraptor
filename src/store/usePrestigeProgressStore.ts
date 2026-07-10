import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Прогресс целей престижа («Путь к Престижу»). Ключ: `${profileId}|${level}|${objId}`.
// count-цели хранят число сдач; flag-цели — 0/1. level-цели не хранятся (авто по телеметрии).
// v1 — localStorage (облачная синхра — отдельной задачей, как у story-progress).
interface PrestigeProgressStore {
  values: Record<string, number>;
  setCount: (key: string, value: number) => void;
  incCount: (key: string, max: number) => void;
  decCount: (key: string) => void;
  toggleFlag: (key: string) => void;
  resetLevel: (profileId: string, level: number) => void;
}

export const prestigeObjKey = (profileId: string, level: number, objId: string) =>
  `${profileId}|${level}|${objId}`;

export const usePrestigeProgressStore = create<PrestigeProgressStore>()(
  persist(
    (set) => ({
      values: {},
      setCount: (key, value) =>
        set((s) => ({ values: { ...s.values, [key]: Math.max(0, value) } })),
      incCount: (key, max) =>
        set((s) => ({
          values: { ...s.values, [key]: Math.min(max, (s.values[key] ?? 0) + 1) },
        })),
      decCount: (key) =>
        set((s) => ({
          values: { ...s.values, [key]: Math.max(0, (s.values[key] ?? 0) - 1) },
        })),
      toggleFlag: (key) =>
        set((s) => ({ values: { ...s.values, [key]: s.values[key] ? 0 : 1 } })),
      resetLevel: (profileId, level) =>
        set((s) => {
          const prefix = `${profileId}|${level}|`;
          const next: Record<string, number> = {};
          for (const [k, v] of Object.entries(s.values)) {
            if (!k.startsWith(prefix)) next[k] = v;
          }
          return { values: next };
        }),
    }),
    { name: 'cta-prestige-progress' },
  ),
);
