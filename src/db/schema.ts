import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  real,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Слой 1 — фундамент базы CTA.
 *
 * Модель: EAV + JSONB (по research docs/architecture). Универсальные поля предмета
 * лежат нормализованно в `items`, а специфика типа (броня/патрон/оружие/…) — в
 * JSONB-поле `item_properties.properties`, типизированном через Discriminated Union.
 *
 * Схема сразу мультигейминг-ready: всё привязано к `games`.
 */

/* ───────────────────────── games ───────────────────────── */
// Справочник игр. Фундамент мультигейминга: eft, abi, gzw...
export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // 'eft', 'abi', 'gzw'
  name: text("name").notNull(), // 'Escape from Tarkov'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ─────────────────────── item_categories ─────────────────────── */
// Иерархия категорий (Adjacency List). Коррелирует с `_parent` из дампов SPT.
export const itemCategories = pgTable(
  "item_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    inGameId: text("in_game_id").notNull(), // BSG node id из SPT
    parentId: uuid("parent_id").references((): AnyPgColumn => itemCategories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
  },
  (t) => [
    uniqueIndex("item_categories_game_ingame_idx").on(t.gameId, t.inGameId),
    index("item_categories_parent_idx").on(t.parentId),
  ],
);

/* ───────────────────────── items ───────────────────────── */
// Entity: только универсальные поля, общие для всех предметов всех игр.
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    inGameId: text("in_game_id").notNull(), // 24-символьный BSG UID
    categoryId: uuid("category_id").references(() => itemCategories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    shortName: text("short_name"),
    description: text("description"),
    weight: real("weight"),
    gridWidth: integer("grid_width"),
    gridHeight: integer("grid_height"),
    basePrice: integer("base_price"),
    iconPath: text("icon_path"), // ключ в Cloudflare R2
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("items_game_ingame_idx").on(t.gameId, t.inGameId),
    index("items_category_idx").on(t.categoryId),
  ],
);

/* ─────────────────────── item_properties ─────────────────────── */
/**
 * Типизированное JSONB-хранилище специфики предмета (1:1 к items).
 * Дискриминатор — поле `type`. Парсер SPT раскладывает `_props` в нужный вариант.
 * GIN-индекс обязателен для фильтрации по вложенным полям (напр. penetrationPower > 40).
 */
export type ItemPropertiesAmmo = {
  type: "ammo";
  caliber?: string;
  penetrationPower?: number;
  damage?: number;
  armorDamage?: number;
  fragmentationChance?: number;
  initialSpeed?: number;
};

export type ItemPropertiesArmor = {
  type: "armor";
  armorClass?: number;
  durability?: number;
  bluntThroughput?: number;
  armorZones?: string[];
  ergoPenalty?: number;
  speedPenalty?: number;
  turnPenalty?: number;
};

export type ItemPropertiesWeapon = {
  type: "weapon";
  caliber?: string;
  ergonomics?: number;
  recoilVertical?: number;
  recoilHorizontal?: number;
  fireRate?: number;
};

export type ItemPropertiesContainer = {
  type: "container";
  gridWidth?: number;
  gridHeight?: number;
  capacity?: number;
};

export type ItemPropertiesMedical = {
  type: "medical";
  useTime?: number;
  maxHpResource?: number;
  hpResourceRate?: number;
};

// Fallback для прочих предметов, пока тип не разобран отдельно.
export type ItemPropertiesGeneric = {
  type: "generic";
  [key: string]: unknown;
};

export type ItemProperties =
  | ItemPropertiesAmmo
  | ItemPropertiesArmor
  | ItemPropertiesWeapon
  | ItemPropertiesContainer
  | ItemPropertiesMedical
  | ItemPropertiesGeneric;

export const itemProperties = pgTable(
  "item_properties",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    properties: jsonb("properties").$type<ItemProperties>().notNull(),
    // Сырые свойства из items_database.json (tarkov.dev-форма, с __typename и ВСЕМИ
    // полями) — для богатых колонок страницы категорий. Тонкий `properties` выше
    // оставлен для дискриминатора `type` и GIN-фильтра.
    propertiesRaw: jsonb("properties_raw").$type<Record<string, unknown>>(),
  },
  (t) => [index("item_properties_gin_idx").using("gin", t.properties)],
);

/* ───────────────────────── prices (self-mirror tarkov.dev) ───────────────────────── */
/**
 * Слой 3+ — зеркало живых цен/экономики из tarkov.dev. Наполняется серверным
 * кроном (`/api/cron/sync-prices`), UI читает ТОЛЬКО отсюда — чтобы ни одна
 * страница не обращалась к api.tarkov.dev в рантайме (см. autonomy-research).
 * 1 строка на (игра, предмет). Источник легко заменить — таблица-буфер.
 */
export type PriceVendorOffer = {
  price: number;
  priceRUB?: number;
  currency?: string;
  vendor: { name: string; normalizedName?: string };
};

export const prices = pgTable(
  "prices",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    inGameId: text("in_game_id").notNull(), // 24-символьный BSG UID
    normalizedName: text("normalized_name"),
    bsgCategoryId: text("bsg_category_id"), // тонкая BSG-категория (для фильтра категорий)
    backgroundColor: text("background_color"),
    types: jsonb("types").$type<string[]>(),
    lastLowPrice: integer("last_low_price"),
    avg24hPrice: integer("avg24h_price"),
    changeLast48hPercent: real("change_last_48h_percent"),
    low24hPrice: integer("low24h_price"),
    high24hPrice: integer("high24h_price"),
    sellFor: jsonb("sell_for").$type<PriceVendorOffer[]>(),
    buyFor: jsonb("buy_for").$type<PriceVendorOffer[]>(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.inGameId] })],
);

/* ───────────────────────── barters / crafts (self-mirror tarkov.dev) ───────────────────────── */
/**
 * Зеркало ТОПОЛОГИИ бартеров и крафтов (без цен — цены берём из `prices` при
 * чтении, чтобы оставались свежими). Слоты — массив {itemId, count}; имя/иконка/
 * цена подтягиваются join'ом к `items` + `prices`. Наполняет тот же крон.
 */
export type TradeSlot = { itemId: string; count: number };

export const barters = pgTable("barters", {
  id: text("id").primaryKey(), // tarkov.dev barter id
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  traderName: text("trader_name").notNull(),
  traderNormalizedName: text("trader_normalized_name"),
  level: integer("level"),
  taskUnlockId: text("task_unlock_id"), // квест-гейт бартера (для unlock_trade-индикатора)
  taskUnlockName: text("task_unlock_name"),
  requiredItems: jsonb("required_items").$type<TradeSlot[]>().notNull(),
  rewardItems: jsonb("reward_items").$type<TradeSlot[]>().notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

export const crafts = pgTable("crafts", {
  id: text("id").primaryKey(), // tarkov.dev craft id
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  stationName: text("station_name").notNull(),
  stationNormalizedName: text("station_normalized_name"),
  level: integer("level"),
  duration: integer("duration"), // секунды
  requiredItems: jsonb("required_items").$type<TradeSlot[]>().notNull(),
  rewardItems: jsonb("reward_items").$type<TradeSlot[]>().notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ───────────────── achievements / maps / traders (self-mirror tarkov.dev) ───────────────── */
// Достижения EFT (страница /eft/progress/achievements). playersCompletedPercent «живой».
export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  hidden: boolean("hidden"),
  playersCompletedPercent: real("players_completed_percent"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

// Карты EFT (для лендинг-виджета картографии). wiki НЕ храним (правило: без внешних вики).
export const maps = pgTable("maps", {
  id: text("id").primaryKey(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

// Торговцы EFT (resetTime для виджета «ближайший сброс»; levels на будущее).
export const traders = pgTable("traders", {
  normalizedName: text("normalized_name").primaryKey(),
  gameId: uuid("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  resetTime: text("reset_time"),
  levels: jsonb("levels").$type<{ level: number; requiredPlayerLevel: number }[]>(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ───────────────── hideout_upgrades (self-mirror tarkov.dev) ───────────────── */
/**
 * Зеркало требований апгрейдов убежища из tarkov.dev. 1 строка на (игра, станция, уровень).
 * Разблокирует «Нужные предметы» (агрегатор предметов убежища) и гейты craft-profit.
 * itemRequirements — {itemId, count} (валюта-рубли тоже идёт предметом); имя/иконка/цена
 * подтягиваются join'ом к items/prices при чтении. Ключи (станция+уровень) стабильны
 * между вайпами, поэтому синк — чистый upsert без прюна. Наполняет `db:sync-hideout`.
 */
export type HideoutItemReq = { itemId: string; count: number };
export type HideoutModuleReq = { station: string; level: number };
export type HideoutTraderReq = { trader: string; level: number };
export type HideoutSkillReq = { skill: string; level: number };

export const hideoutUpgrades = pgTable(
  "hideout_upgrades",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    stationNormalizedName: text("station_normalized_name").notNull(),
    stationName: text("station_name").notNull(),
    level: integer("level").notNull(),
    constructionTime: integer("construction_time"), // секунды
    itemRequirements: jsonb("item_requirements").$type<HideoutItemReq[]>().notNull(),
    stationRequirements: jsonb("station_requirements").$type<HideoutModuleReq[]>().notNull(),
    traderRequirements: jsonb("trader_requirements").$type<HideoutTraderReq[]>().notNull(),
    skillRequirements: jsonb("skill_requirements").$type<HideoutSkillReq[]>().notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.stationNormalizedName, t.level] })],
);

/* ───────────────────────── profiles ───────────────────────── */
/**
 * Слой 4 — профиль игрока, 1:1 к auth.users (Supabase Auth). id = auth.users.id.
 * Кросс-схемный FK на auth.users, триггер автосоздания профиля при регистрации
 * и RLS-политики живут в supabase/auth-setup.sql — drizzle-kit не управляет
 * схемой `auth`, поэтому эту обвязку накатываем отдельным SQL один раз.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id (FK навешивается в auth-setup.sql)
  username: text("username"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"), // 'user' | 'admin' (слой 5, CMS)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Роль пользователя — дискриминатор доступа к CMS.
export type UserRole = "user" | "admin";

/* ─────────────────────── quest_progress ─────────────────────── */
/**
 * Слой 4b — прогресс квестов игрока в облаке (замена localStorage).
 * Одна строка на пользователя+игру. Поля-блобы 1:1 повторяют форму
 * zustand-стора useQuestStore (см. его partialize), чтобы синк шёл напрямую
 * через loadProgress(). user_id → profiles.id (а тот → auth.users) с каскадом.
 */
export const questProgress = pgTable(
  "quest_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    completedQuests: jsonb("completed_quests").$type<string[]>().notNull(),
    itemProgress: jsonb("item_progress")
      .$type<Record<string, Record<string, number>>>()
      .notNull(),
    pinnedQuests: jsonb("pinned_quests").$type<string[]>().notNull(),
    questNotes: jsonb("quest_notes").$type<Record<string, string>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

/* ─────────────────────── barter_progress ─────────────────────── */
/**
 * Слой 4c — облачный прогресс геймификации «Прибыль бартера» (замена localStorage).
 * Одна строка на пользователя+игру; поля 1:1 повторяют persisted-форму
 * useGamificationStore. xp/прибыль — bigint: цель прогрессии 500M → 1B → 2B+
 * переполняет int4 (~2.1 млрд). user_id → profiles.id с каскадом.
 */
export type BarterBadgePersist = {
  id: string;
  label: string;
  description: string;
  unlockedAt: number | null;
};

export const barterProgress = pgTable(
  "barter_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    xp: bigint("xp", { mode: "number" }).notNull().default(0),
    confirmedBarterIds: jsonb("confirmed_barter_ids").$type<string[]>().notNull(),
    badges: jsonb("badges").$type<BarterBadgePersist[]>().notNull(),
    streak: integer("streak").notNull().default(0),
    bestStreak: integer("best_streak").notNull().default(0),
    dailyDate: text("daily_date"),
    dailyProfit: bigint("daily_profit", { mode: "number" }).notNull().default(0),
    lifetimeProfit: bigint("lifetime_profit", { mode: "number" }).notNull().default(0),
    lifetimeSavings: bigint("lifetime_savings", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

/* ───────────────── inferred types (для использования в коде) ───────────────── */
export type BarterProgressRow = typeof barterProgress.$inferSelect;
export type NewBarterProgressRow = typeof barterProgress.$inferInsert;
export type QuestProgress = typeof questProgress.$inferSelect;
export type NewQuestProgress = typeof questProgress.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type ItemCategory = typeof itemCategories.$inferSelect;
export type NewItemCategory = typeof itemCategories.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemPropertiesRow = typeof itemProperties.$inferSelect;
export type NewItemPropertiesRow = typeof itemProperties.$inferInsert;
export type PriceRow = typeof prices.$inferSelect;
export type NewPriceRow = typeof prices.$inferInsert;
export type BarterRow = typeof barters.$inferSelect;
export type NewBarterRow = typeof barters.$inferInsert;
export type CraftRow = typeof crafts.$inferSelect;
export type NewCraftRow = typeof crafts.$inferInsert;
export type AchievementRow = typeof achievements.$inferSelect;
export type NewAchievementRow = typeof achievements.$inferInsert;
export type MapRow = typeof maps.$inferSelect;
export type NewMapRow = typeof maps.$inferInsert;
export type TraderRow = typeof traders.$inferSelect;
export type NewTraderRow = typeof traders.$inferInsert;
export type HideoutUpgradeRow = typeof hideoutUpgrades.$inferSelect;
export type NewHideoutUpgradeRow = typeof hideoutUpgrades.$inferInsert;
