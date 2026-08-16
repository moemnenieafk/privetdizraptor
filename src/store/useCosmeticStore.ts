import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Косметик-бейджи — награды-регалии, начисляемые за вехи прогресса (R12/A6). Собственного
// накопления НЕТ: бейдж лишь ОТМЕЧАЕТ уже-достигнутое (туториал 10/10), поэтому фарм-поверхности
// не создаёт — награда идемпотентна, повторная выдача не дублирует (Set-семантика). Standing
// растёт от нижележащего сигнала (tutorialDone), не от бейджа. Локально, без аккаунта.
// skipHydration как у соседей (SSR-safe): rehydrate() зовём в эффекте на клиенте.

/** Идентификаторы косметик-бейджей. Расширяется по мере появления вех. */
export type CosmeticBadgeId = 'adapted';

/** Визуал бейджа для кита досье (T02): иконка .icon-mask + акцент-токен + микро-тег.
 * Форма зеркалит ArchetypeVisual (archetype-visuals.ts) — тот же рендер-контракт. */
export interface CosmeticBadge {
  id: CosmeticBadgeId;
  /** Подпись бейджа (uppercase-заголовок регалии). */
  label: string;
  /** Одна фраза «за что» — для тултипа/подписи. */
  blurb: string;
  /** Путь к монохромной SVG для .icon-mask (перекрашивается через bg-*). */
  iconClass: string;
  /** Семантический акцент — CSS-переменная токена (var(--color-…)), НЕ сырой HEX (§6). */
  accent: string;
  /** Короткий тег-класс (uppercase, микро-подпись). */
  tag: string;
}

/** Каталог бейджей (pure-данные, безопасно и в server-, и в client-компонентах).
 * Кит досье читает отсюда визуал для каждого earned-id из стора. */
export const COSMETIC_BADGES: Record<CosmeticBadgeId, CosmeticBadge> = {
  adapted: {
    id: 'adapted',
    label: 'АДАПТИРОВАН',
    blurb: 'Путь Новобранца пройден полностью — азы Таркова освоены.',
    iconClass: '/icons/eft/02-quests/story-tour.svg',
    accent: 'var(--color-success)',
    tag: 'RECRUIT+',
  },
};

interface CosmeticStore {
  /** id начисленных бейджей. Хранится массивом (JSON-persist), семантика — множество. */
  earned: CosmeticBadgeId[];
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  /** Начислить бейдж. Идемпотентно: повторная выдача не дублирует (§2 анти-фарм). */
  award: (id: CosmeticBadgeId) => void;
  /** Есть ли бейдж (для рендера баннера/кита). */
  has: (id: CosmeticBadgeId) => boolean;
  /** Сброс (отладка). */
  reset: () => void;
}

export const useCosmeticStore = create<CosmeticStore>()(
  persist(
    (set, get) => ({
      earned: [],
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),
      award: (id) =>
        set((s) => (s.earned.includes(id) ? s : { earned: [...s.earned, id] })),
      has: (id) => get().earned.includes(id),
      reset: () => set({ earned: [] }),
    }),
    {
      name: 'cta-cosmetics',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (s) => ({ earned: s.earned }),
    },
  ),
);
