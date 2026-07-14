/**
 * Внутриигровые события (ивенты) EFT. Источник — анонсы BSG и вики.
 * Данные статичные, живут в `src/data/eft-events.ts`.
 */

export type EftEventCategory =
  | 'seasonal'
  | 'lore'
  | 'boss'
  | 'economy'
  | 'gameplay'
  | 'prewipe'
  | 'community'
  | 'collab';

export interface EftEventCategoryMeta {
  id: EftEventCategory;
  label: string;
  /** Короткое пояснение для тултипа/легенды. */
  hint: string;
}

export interface EftEvent {
  /** Слаг-якорь: используется как id и как #hash. */
  id: string;
  title: string;
  /** Оригинальное название анонса BSG (для поиска по англоязычным источникам). */
  titleEn?: string;
  /** Дата старта, ISO `YYYY-MM-DD`. */
  date: string;
  /** Дата завершения, если известна. */
  endDate?: string;
  category: EftEventCategory;
  /** Ивент не работал в PvE-режиме. */
  pvpOnly?: boolean;
  /** Ивент идёт прямо сейчас. */
  active?: boolean;
  /** Патч, с которым приехал ивент. */
  patch?: string;
  /** Лид: суть ивента в 1–2 предложениях. */
  summary: string;
  /** Список изменений/механик. */
  changes: string[];
  /**
   * Задания, пришедшие с ивентом и оставшиеся в игре, — `normalizedName` из базы квестов.
   * Временные (снятые после ивента) квесты в базе отсутствуют и здесь не указываются.
   */
  quests?: string[];
  /** Достижения ивента. Статус курируется вручную: наличие в базе ≠ возможность получить. */
  achievements?: EftEventAchievementRef[];
  /** Бартеры, которые ивент добавлял торговцам. Актуальность считается по живой базе. */
  barters?: EftEventBarterRef[];
  /** Явный статус контента/наград после окончания. Если не задан — берётся дефолт по категории. */
  contentStatus?: EftEventContentStatus;
  /** Уточнение к статусу (показывается в карточке). */
  contentNote?: string;
}

/**
 * Что стало с контентом и наградами ивента после его окончания:
 *  - permanent — осталось в игре, можно получить и сейчас;
 *  - seasonal  — возвращается вместе с ивентом (Новый год, Хэллоуин);
 *  - expired   — выдавалось только во время ивента, больше не получить;
 *  - unknown   — не подтверждено, статус уточняется.
 */
export type EftEventContentStatus = 'permanent' | 'seasonal' | 'expired' | 'unknown';

export interface EftEventAchievementRef {
  /** Точное имя достижения, как в базе (ru). */
  name: string;
  status: EftEventContentStatus;
}

export interface EftEventBarterRef {
  /** Описание бартера для карточки. */
  label: string;
  /** normalizedName торговца: mechanic, skier, prapor, ragman… */
  trader: string;
  level: number;
  /** Часть имени предмета-награды — по нему ищем бартер в базе. */
  reward?: string;
  /** Часть имени требуемого предмета. */
  required?: string;
}

export interface EftEventAchievementLink extends EftEventAchievementRef {
  /** id из базы; null — достижения в базе нет (вырезано вместе с ивентом). */
  id: string | null;
  playersCompletedPercent: number | null;
}

export interface EftEventBarterLink extends EftEventBarterRef {
  /** id бартера в базе; null — бартер свёрнут после ивента. */
  id: string | null;
  /** Бартер сейчас реально есть у торговца. */
  live: boolean;
}

/** Разрешённый контент одного ивента (собирается на сервере). */
export interface EftEventContent {
  quests: EftEventQuestLink[];
  achievements: EftEventAchievementLink[];
  barters: EftEventBarterLink[];
}

export type EftEventContentIndex = Record<string, EftEventContent>;

/** Квест из базы, привязанный к ивенту (резолвится на сервере). */
export interface EftEventQuestLink {
  id: string;
  name: string;
  normalizedName: string;
}

export type EftEventOrder = 'desc' | 'asc';
