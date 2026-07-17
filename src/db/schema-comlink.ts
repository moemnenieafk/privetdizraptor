// Раздел «Связь» (COMLINK) — социальный слой ЦТА: анкеты игроков, подтверждённые
// рейды, карма, отзывы, жалобы, форум.
//
// Живёт отдельно от schema.ts (паттерн schema-gunsmith): таблицы самодостаточны,
// а schema.ts и так под 800 строк. Drizzle это переживает — select/insert работают
// с таблицей из любого модуля.
//
// ПРИНЦИПЫ КАРМЫ (сверено с многолетним опытом Stack Overflow):
//   • Оценивать может ТОЛЬКО участник подтверждённого рейда — не «мнение о анкете»,
//     а «мы реально играли». Анонимный слив невозможен по построению.
//   • Асимметрия: плюс дороже минуса (+10 против −2), минус стоит и автору (−1) —
//     на минус надо решиться.
//   • Карма — это СУММА журнала karma_events, а не мутируемое число в profiles:
//     пересчитываемо, аудируемо, отзыв жалобы = удаление события.
//
// Накатывается роутом /api/cron/migrate-comlink (DDL в comlink-ddl.ts) — db:push
// с телефона недоступен.
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { games, profiles } from "./schema";

/* ─────────────────── comlink_profiles: анкета игрока ─────────────────── */

/** Цель анкеты. Одна активная анкета на пользователя+игру, цель — её дискриминатор. */
export type ComlinkGoal = "partner" | "team" | "student" | "sherpa";

/** Когда играет. Мультивыбор. */
export type PlayTime = "morning" | "day" | "evening" | "night";

/** Стиль игры. Мультивыбор. */
export type PlayStyle = "pvp" | "loot" | "quests" | "chill";

export const comlinkProfiles = pgTable(
  "comlink_profiles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    goal: text("goal").$type<ComlinkGoal>().notNull(),
    /** Карты, на которых играет (map slug'и из нашего раздела карт). Пусто = любые. */
    maps: jsonb("maps").$type<string[]>().notNull().default([]),
    playTime: jsonb("play_time").$type<PlayTime[]>().notNull().default([]),
    playStyle: jsonb("play_style").$type<PlayStyle[]>().notNull().default([]),
    /** Есть микрофон/готов в голос. */
    voice: boolean("voice").notNull().default(true),
    /** Часовой пояс смещением от МСК: -1, 0, +4... Для «играем в одно время». */
    tzOffset: integer("tz_offset"),
    /** Свободный текст «о себе». Жёсткий кап — не блог. */
    about: text("about").notNull().default(""),
    /** Анкета видна в поиске. Скрытие ≠ удаление: рейды и карма остаются. */
    active: boolean("active").notNull().default(true),
    /**
     * Снимок игрового профиля НА МОМЕНТ ПУБЛИКАЦИИ (ник/уровень/фракция из
     * player_profiles). Живые данные подтягиваются в рантайме джойном; снимок
     * нужен спискам, чтобы не джойнить JSONB-блоб на каждую строку выдачи.
     */
    gameSnapshot: jsonb("game_snapshot").$type<{
      nickname: string;
      level: string;
      faction: string;
      mode: string;
    } | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId] }),
    index("comlink_profiles_search_idx").on(t.gameId, t.active, t.goal),
  ],
);

/* ─────────────────── comlink_raids: подтверждённый совместный рейд ─────────────────── */

/**
 * Ядро доверия. initiator зовёт partner'а → pending. Partner подтверждает в 48ч →
 * confirmed (+5 кармы обоим, открывается окно взаимной оценки). Не подтвердил →
 * expired, рейда не было, оценки нет.
 */
export type RaidStatus = "pending" | "confirmed" | "declined" | "expired";

export const comlinkRaids = pgTable(
  "comlink_raids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    initiatorId: uuid("initiator_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: text("status").$type<RaidStatus>().notNull().default("pending"),
    /** Комментарий инициатора: «Таможня, вечером, квесты». */
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    /** Когда partner подтвердил/отклонил. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("comlink_raids_partner_idx").on(t.partnerId, t.status),
    index("comlink_raids_initiator_idx").on(t.initiatorId, t.status),
  ],
);

/* ─────────────────── comlink_reviews: отзыв после рейда ─────────────────── */

/**
 * Отзыв привязан СТРОГО к confirmed-рейду: (raidId, authorId) уникальны — одна
 * оценка с каждой стороны. Оценки скрыты (hidden) до обоюдной сдачи или дедлайна
 * 72ч — чтобы не было мести за минус.
 */
export const comlinkReviews = pgTable(
  "comlink_reviews",
  {
    raidId: uuid("raid_id")
      .notNull()
      .references(() => comlinkRaids.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** true = положительный (+10 цели), false = отрицательный (−2 цели, −1 автору). */
    positive: boolean("positive").notNull(),
    /** Короткий текст. Для отрицательного — обязателен (проверяет API). */
    comment: text("comment").notNull().default(""),
    /** Скрыт до обоюдной сдачи или дедлайна. */
    hidden: boolean("hidden").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.raidId, t.authorId] }),
    index("comlink_reviews_target_idx").on(t.targetId, t.hidden),
  ],
);

/* ─────────────────── karma_events: журнал кармы ─────────────────── */

/**
 * Карма пользователя = SUM(delta) по журналу. Никакого мутируемого счётчика:
 * пересчитываемо, аудируемо, отзыв жалобы модератором = DELETE события.
 * refType+refId указывают на источник (рейд/отзыв/жалоба/сборка) — защита от
 * двойного начисления уникальным индексом.
 */
export type KarmaReason =
  | "raid_confirmed" //  +5 обоим
  | "review_positive" // +10 цели
  | "review_negative" //  −2 цели
  | "review_cost" //      −1 автору отрицательного отзыва
  | "sherpa_session" //  +15 шерпе (ученик подтвердил)
  | "build_liked" //      +5 (сборка набрала 10 лайков)
  | "report_upheld" //   −25 (жалоба подтверждена модератором)
  | "scam_confirmed" //  −50 (кидок, разбор модератора)
  | "manual"; //          ручная корректировка модератора

export const karmaEvents = pgTable(
  "karma_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    reason: text("reason").$type<KarmaReason>().notNull(),
    delta: integer("delta").notNull(),
    /** Тип и id источника: 'raid' | 'review' | 'report' | 'build' | 'session'. */
    refType: text("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    /** Кто начислил (для manual — модератор). NULL = система. */
    issuedBy: uuid("issued_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("karma_events_user_idx").on(t.userId),
    // Одно начисление одной причины на один источник одному пользователю.
    index("karma_events_dedupe_idx").on(t.userId, t.reason, t.refType, t.refId),
  ],
);

/** Уровни доверия. Пороги — снизу вверх, бейдж у ника по всему разделу. */
export const KARMA_TIERS = [
  { min: 500, id: "legend", label: "Легенда" },
  { min: 200, id: "veteran", label: "Ветеран" },
  { min: 50, id: "fighter", label: "Боец" },
  { min: 0, id: "wild", label: "Дикий" },
] as const;

export type KarmaTierId = (typeof KARMA_TIERS)[number]["id"];

export function karmaTier(total: number): (typeof KARMA_TIERS)[number] {
  for (const t of KARMA_TIERS) if (total >= t.min) return t;
  return KARMA_TIERS[KARMA_TIERS.length - 1];
}

/* ─────────────────── comlink_reports: жалобы ─────────────────── */

export type ReportStatus = "open" | "upheld" | "rejected";

export const comlinkReports = pgTable(
  "comlink_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** На что жалоба: 'profile' | 'review' | 'topic' | 'post'. */
    refType: text("ref_type").notNull(),
    refId: text("ref_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    /** Кто разобрал и когда. */
    resolvedBy: uuid("resolved_by").references(() => profiles.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("comlink_reports_queue_idx").on(t.status, t.createdAt)],
);

/* ─────────────────── форум: темы и ответы (подраздел «Обсуждения») ─────────────────── */

export const comlinkTopics = pgTable(
  "comlink_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Закрыта модератором — отвечать нельзя. */
    locked: boolean("locked").notNull().default(false),
    /** Закреплена сверху списка. */
    pinned: boolean("pinned").notNull().default(false),
    /** Денормализация для списка: число ответов и время последнего. */
    replyCount: integer("reply_count").notNull().default(0),
    lastReplyAt: timestamp("last_reply_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("comlink_topics_list_idx").on(t.gameId, t.pinned, t.lastReplyAt)],
);

export const comlinkPosts = pgTable(
  "comlink_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => comlinkTopics.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** Скрыт модератором (мягкое удаление: жалобы должны ссылаться на текст). */
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("comlink_posts_topic_idx").on(t.topicId, t.createdAt)],
);

/* ─────────────────── inferred types ─────────────────── */
export type ComlinkProfileRow = typeof comlinkProfiles.$inferSelect;
export type NewComlinkProfileRow = typeof comlinkProfiles.$inferInsert;
export type ComlinkRaidRow = typeof comlinkRaids.$inferSelect;
export type ComlinkReviewRow = typeof comlinkReviews.$inferSelect;
export type KarmaEventRow = typeof karmaEvents.$inferSelect;
export type ComlinkReportRow = typeof comlinkReports.$inferSelect;
export type ComlinkTopicRow = typeof comlinkTopics.$inferSelect;
export type ComlinkPostRow = typeof comlinkPosts.$inferSelect;

/* ─────────────────── player_verifications: подтверждение ЧВК-профиля ───────────────────
 * Доверительный слой — «галочка», что публичный ЧВК-профиль (ник из player_profiles)
 * реально принадлежит владельцу аккаунта ЦТА. Публичного API BSG для проверки владения
 * НЕТ → механизм ручной (решение V4DYA): юзер получает одноразовый код, присылает скрин
 * игрового профиля с этим кодом в кадре, модератор «Связь» сверяет ник и подтверждает.
 * Доступно только платным тирам (проверка в POST /api/eft/verification). 1 строка на
 * юзера+игру. RLS: owner-select own row; пишет owner-роль через API. Скрин-пруф лежит
 * инлайном в jsonb (base64, паттерн feedback.attachments) — модератору для сверки.
 *
 * Статусы: awaiting (код выдан, скрин ещё не отправлен) → pending (в очереди модерации)
 * → approved | rejected (терминальные). Повторная подача после rejected возвращает в
 * awaiting с новым кодом. */
export type VerificationStatus = "awaiting" | "pending" | "approved" | "rejected";

/** Скрин-пруф игрового профиля (инлайн base64, паттерн feedback.attachments). */
export type VerificationProof = {
  mime: string; // image/png | image/jpeg | image/webp
  size: number; // байт (декодированного изображения)
  dataBase64: string; // содержимое без data:-префикса
};

export const playerVerifications = pgTable(
  "player_verifications",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    status: text("status").$type<VerificationStatus>().notNull().default("awaiting"),
    /** Заявленный ЧВК-ник — снимок активного player_profile на момент выдачи кода. */
    claimedNickname: text("claimed_nickname").notNull().default(""),
    /** Одноразовый код-челлендж (должен попасть в кадр скрина) — анти-replay. */
    code: text("code").notNull(),
    /** Необязательная ссылка/aid профиля (tarkov.dev) для перекрёстной сверки. */
    accountRef: text("account_ref"),
    /** Скрин-пруф. null, пока не отправлен (статус awaiting). */
    proof: jsonb("proof").$type<VerificationProof | null>(),
    /** Заметка модератора при отклонении (видна пользователю). */
    note: text("note").notNull().default(""),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.gameId] }),
    index("player_verifications_queue_idx").on(t.status, t.updatedAt),
  ],
);

export type PlayerVerificationRow = typeof playerVerifications.$inferSelect;
