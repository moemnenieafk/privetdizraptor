import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BpDocType } from '@/data/eft-battlepass';

/**
 * Прогресс Боевого Пропуска (localStorage, §5: без БД). Хранит ПО СЕЗОНАМ (ключ = slug):
 *  - claimed  — какие награды отмечены полученными (тоглы);
 *  - docCounts — сколько документации каждого типа игрок налутал (счётчики −/+).
 * Прецеденты: useSeasonStore, useHideoutStore (itemProgress), useRoomOpensStore.
 */
type DocCounts = Partial<Record<BpDocType, number>>;

interface BattlePassState {
  claimed: Record<string, string[]>;
  docCounts: Record<string, DocCounts>;

  toggle: (slug: string, rewardId: string) => void;
  setMany: (slug: string, rewardIds: string[], on: boolean) => void;
  /** Установить точное количество собранного документа (клампится ≥ 0). */
  setDoc: (slug: string, type: BpDocType, n: number) => void;
  /** Сдвинуть счётчик документа на delta (−/+ кнопки). */
  incDoc: (slug: string, type: BpDocType, delta: number) => void;
  resetSeason: (slug: string) => void;

  claimedFor: (slug: string) => string[];
  docCountsFor: (slug: string) => DocCounts;
}

export const useBattlePassStore = create<BattlePassState>()(
  persist(
    (set, get) => ({
      claimed: {},
      docCounts: {},

      claimedFor: (slug) => get().claimed[slug] ?? [],
      docCountsFor: (slug) => get().docCounts[slug] ?? {},

      toggle: (slug, rewardId) => {
        const current = get().claimed[slug] ?? [];
        const next = current.includes(rewardId)
          ? current.filter((id) => id !== rewardId)
          : [...current, rewardId];
        set((s) => ({ claimed: { ...s.claimed, [slug]: next } }));
      },

      setMany: (slug, rewardIds, on) => {
        const current = new Set(get().claimed[slug] ?? []);
        for (const id of rewardIds) {
          if (on) current.add(id);
          else current.delete(id);
        }
        set((s) => ({ claimed: { ...s.claimed, [slug]: [...current] } }));
      },

      setDoc: (slug, type, n) => {
        const cur = get().docCounts[slug] ?? {};
        set((s) => ({
          docCounts: { ...s.docCounts, [slug]: { ...cur, [type]: Math.max(0, Math.round(n)) } },
        }));
      },

      incDoc: (slug, type, delta) => {
        const cur = get().docCounts[slug] ?? {};
        const next = Math.max(0, (cur[type] ?? 0) + delta);
        set((s) => ({ docCounts: { ...s.docCounts, [slug]: { ...cur, [type]: next } } }));
      },

      resetSeason: (slug) =>
        set((s) => ({
          claimed: { ...s.claimed, [slug]: [] },
          docCounts: { ...s.docCounts, [slug]: {} },
        })),
    }),
    { name: 'cta-battlepass' },
  ),
);
