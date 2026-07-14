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
}

/** Квест из базы, привязанный к ивенту (резолвится на сервере). */
export interface EftEventQuestLink {
  id: string;
  name: string;
  normalizedName: string;
}

export type EftEventOrder = 'desc' | 'asc';
