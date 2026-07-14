import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CURRENT_SEASON, getSeason } from '@/data/eft-seasons';
import { computeBudget, dropCascade } from '@/lib/season-points';

/**
 * Конструктор сезонных перков. Хранит выбор ПО СЕЗОНАМ (ключ = slug): сезоны сменяют
 * друг друга, а билд прошлого хочется сохранить для истории и сравнения.
 *
 * Стор ничего не знает про подписку — сам конструктор бесплатный (это данные, которые
 * игрок и так видит в клиенте). Гейтить будем только сохранение нескольких билдов и
 * облачный синк, как у сборок оружия.
 */

interface SeasonState {
  /** slug сезона → выбранные id личных перков. */
  selected: Record<string, string[]>;
  /** Последний снимок для «Отменить» (по сезону). */
  history: Record<string, string[][]>;

  toggle: (slug: string, perkId: string) => void;
  applyPreset: (slug: string, perkIds: string[]) => void;
  reset: (slug: string) => void;
  undo: (slug: string) => void;
  canUndo: (slug: string) => boolean;
  selectedFor: (slug: string) => string[];
}

const MAX_HISTORY = 20;

export const useSeasonStore = create<SeasonState>()(
  persist(
    (set, get) => ({
      selected: {},
      history: {},

      selectedFor: (slug) => get().selected[slug] ?? [],

      toggle: (slug, perkId) => {
        const season = getSeason(slug) ?? CURRENT_SEASON;
        const current = get().selected[slug] ?? [];
        const isOn = current.includes(perkId);

        let next: string[];
        if (isOn) {
          // Снятие негативного перка может обнулить бюджет под уже взятые позитивные —
          // тогда снимаем и их, иначе билд остался бы в невозможном состоянии.
          const cascade = dropCascade(season, current, perkId);
          next = current.filter((id) => id !== perkId && !cascade.includes(id));
        } else {
          const perk = season.perks.find((p) => p.id === perkId);
          if (!perk || perk.kind === 'season') return;

          // Конфликтующие перки гасят друг друга — не даём собрать бессмыслицу.
          const conflicts = perk.excludes ?? [];
          if (conflicts.some((id) => current.includes(id))) return;

          const candidate = [...current, perkId];
          if (!computeBudget(season, candidate).valid) return;
          next = candidate;
        }

        set((s) => ({
          selected: { ...s.selected, [slug]: next },
          history: {
            ...s.history,
            [slug]: [...(s.history[slug] ?? []), current].slice(-MAX_HISTORY),
          },
        }));
      },

      applyPreset: (slug, perkIds) => {
        const season = getSeason(slug) ?? CURRENT_SEASON;
        // Пресет всё равно проверяем математикой: данные могут разъехаться с ценами.
        if (!computeBudget(season, perkIds).valid) return;

        const current = get().selected[slug] ?? [];
        set((s) => ({
          selected: { ...s.selected, [slug]: perkIds },
          history: {
            ...s.history,
            [slug]: [...(s.history[slug] ?? []), current].slice(-MAX_HISTORY),
          },
        }));
      },

      reset: (slug) => {
        const current = get().selected[slug] ?? [];
        set((s) => ({
          selected: { ...s.selected, [slug]: [] },
          history: {
            ...s.history,
            [slug]: [...(s.history[slug] ?? []), current].slice(-MAX_HISTORY),
          },
        }));
      },

      undo: (slug) => {
        const stack = get().history[slug] ?? [];
        if (stack.length === 0) return;
        const prev = stack[stack.length - 1];
        set((s) => ({
          selected: { ...s.selected, [slug]: prev },
          history: { ...s.history, [slug]: stack.slice(0, -1) },
        }));
      },

      canUndo: (slug) => (get().history[slug] ?? []).length > 0,
    }),
    { name: 'cta-seasons' },
  ),
);
