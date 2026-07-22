import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CURRENT_SEASON, getSeason } from '@/data/eft-seasons';

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
          // Свободный выбор: просто снимаем перк. Баланс может уйти в минус —
          // это легальное промежуточное состояние, показываем в панели («добери N»).
          next = current.filter((id) => id !== perkId);
        } else {
          const perk = season.perks.find((p) => p.id === perkId);
          if (!perk || perk.kind === 'season') return;

          // Единственный запрет — конфликтующие (взаимно гасящие) перки.
          const conflicts = perk.excludes ?? [];
          if (conflicts.some((id) => current.includes(id))) return;

          next = [...current, perkId];
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
        // Заряжаем выбор как есть (рулетка/каталог дают валидные билды, шаринг —
        // любое собранное состояние). Свободный выбор допускает и невалидное.
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
