import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BpDailyMode, BpDocType } from '@/data/eft-battlepass';

/**
 * Прогресс Боевого Пропуска (localStorage, §5: без БД). Хранит ПО СЕЗОНАМ (ключ = slug):
 *  - claimed  — какие награды отмечены полученными (тоглы);
 *  - docCounts — сколько документации каждого типа игрок налутал (счётчики −/+);
 *  - daily    — дневной лимит сбора: выбранный режим + окно 24ч + счётчик набора (грилл V4DYA 2026-08-15).
 * Прецеденты: useSeasonStore, useHideoutStore (itemProgress), useRoomOpensStore.
 * Дневной слой — ЛОКАЛЬНЫЙ (не синкается в аккаунт, Q6): эфемерное 24ч-состояние сессии на устройстве.
 */
type DocCounts = Partial<Record<BpDocType, number>>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Дневной трекер сбора документов (по сезону):
 *  - mode — выбранный режим (radio-снимаемый), null = трекинг выключен;
 *  - windowStart — метка первого засчитанного набора в окне (ms), null = окно не открыто;
 *  - count — набрано документов за окно (любой +1 карточки/рейла);
 *  - ackCap — cap, на который игрок уже ответил в этом окне (перевзводится при росте cap, Q7).
 */
export interface BpDaily {
  mode: BpDailyMode | null;
  windowStart: number | null;
  count: number;
  ackCap: number | null;
  /** Игрок нажал «Да, продолжить» для ackCap → показываем красный «исчерпан»-баннер с таймером (Q4). */
  continued: boolean;
}

const EMPTY_DAILY: BpDaily = { mode: null, windowStart: null, count: 0, ackCap: null, continued: false };

interface BattlePassState {
  claimed: Record<string, string[]>;
  docCounts: Record<string, DocCounts>;
  daily: Record<string, BpDaily>;
  /** «Планирую брать» — награды, отмеченные игроком как желанные (подсветка типов в полосе страницы). */
  wanted: Record<string, string[]>;

  toggle: (slug: string, rewardId: string) => void;
  /** Тогл «Мне это нужно» для награды (по сезону). */
  toggleWanted: (slug: string, rewardId: string) => void;
  setMany: (slug: string, rewardIds: string[], on: boolean) => void;
  /** Установить точное количество собранного документа (клампится ≥ 0). */
  setDoc: (slug: string, type: BpDocType, n: number) => void;
  /** Сдвинуть счётчик документа на delta (−/+ кнопки). */
  incDoc: (slug: string, type: BpDocType, delta: number) => void;
  resetSeason: (slug: string) => void;

  /** Выбрать режим дневного лимита (повторный клик по тому же — снять, трекинг выключается, Q2). */
  setDailyMode: (slug: string, mode: BpDailyMode) => void;
  /** Засчитать набор документов в дневной счётчик (только при выбранном режиме, с ролловером окна, Q1/Q3). */
  bumpDaily: (slug: string, delta: number) => void;
  /** Запомнить ответ на предупреждение для cap: continued=true (Да → «исчерпан»+таймер) или false (Нет), Q4. */
  ackDaily: (slug: string, cap: number, continued: boolean) => void;
  /** Сбросить окно/счётчик (истёк таймер 24ч, Q5) — режим сохраняется. */
  rolloverDaily: (slug: string) => void;

  claimedFor: (slug: string) => string[];
  docCountsFor: (slug: string) => DocCounts;
  dailyFor: (slug: string) => BpDaily;
  wantedFor: (slug: string) => string[];
}

export const useBattlePassStore = create<BattlePassState>()(
  persist(
    (set, get) => ({
      claimed: {},
      docCounts: {},
      daily: {},
      wanted: {},

      claimedFor: (slug) => get().claimed[slug] ?? [],
      docCountsFor: (slug) => get().docCounts[slug] ?? {},
      dailyFor: (slug) => get().daily[slug] ?? EMPTY_DAILY,
      wantedFor: (slug) => get().wanted[slug] ?? [],

      toggle: (slug, rewardId) => {
        const current = get().claimed[slug] ?? [];
        const next = current.includes(rewardId)
          ? current.filter((id) => id !== rewardId)
          : [...current, rewardId];
        set((s) => ({ claimed: { ...s.claimed, [slug]: next } }));
      },

      toggleWanted: (slug, rewardId) => {
        const current = get().wanted[slug] ?? [];
        const next = current.includes(rewardId)
          ? current.filter((id) => id !== rewardId)
          : [...current, rewardId];
        set((s) => ({ wanted: { ...s.wanted, [slug]: next } }));
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
          // «Сбросить прогресс сезона» чистит и дневной слой целиком, включая режим (Q5).
          daily: { ...s.daily, [slug]: { ...EMPTY_DAILY } },
          wanted: { ...s.wanted, [slug]: [] },
        })),

      setDailyMode: (slug, mode) => {
        const cur = get().daily[slug] ?? EMPTY_DAILY;
        // Повторный клик по выбранному режиму — снять выбор (трекинг off). Окно/счётчик не трогаем:
        // при повторном выборе продолжат тот же день (окно живёт по абсолютной метке, Q3).
        const next = cur.mode === mode ? null : mode;
        set((s) => ({ daily: { ...s.daily, [slug]: { ...cur, mode: next } } }));
      },

      bumpDaily: (slug, delta) => {
        if (delta <= 0) return; // дневной счётчик только растёт; «−»/ПКМ его не уменьшают (Q1)
        // Считаем от ЛЮБОГО взаимодействия с трекером (набор в ячейке/рейле + «Отметить получение»),
        // независимо от выбранного режима (правка V4DYA 2026-08-15). Режим влияет только на cap предупреждения.
        const cur = get().daily[slug] ?? EMPTY_DAILY;
        const now = Date.now();
        let { windowStart, count, ackCap, continued } = cur;
        // Ролловер: окно прожило 24ч → начинаем заново с этого набора (Q3/Q5).
        if (windowStart != null && now - windowStart >= DAY_MS) {
          windowStart = null;
          count = 0;
          ackCap = null;
          continued = false;
        }
        if (windowStart == null) windowStart = now; // первый набор открывает окно
        count += delta;
        set((s) => ({ daily: { ...s.daily, [slug]: { ...cur, windowStart, count, ackCap, continued } } }));
      },

      ackDaily: (slug, cap, continued) => {
        const cur = get().daily[slug] ?? EMPTY_DAILY;
        set((s) => ({ daily: { ...s.daily, [slug]: { ...cur, ackCap: cap, continued } } }));
      },

      rolloverDaily: (slug) => {
        const cur = get().daily[slug] ?? EMPTY_DAILY;
        set((s) => ({
          daily: { ...s.daily, [slug]: { ...cur, windowStart: null, count: 0, ackCap: null, continued: false } },
        }));
      },
    }),
    { name: 'cta-battlepass' },
  ),
);
