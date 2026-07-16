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
    avg24hPricePve: integer("avg24h_price_pve"),
    low24hPricePve: integer("low24h_price_pve"),
    sellForPve: jsonb("sell_for_pve").$type<PriceVendorOffer[]>(),
    buyForPve: jsonb("buy_for_pve").$type<PriceVendorOffer[]>(),
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
  // Официальные метаданные BSG (зеркалим из tarkov.dev): редкость (3 тира) + фракция.
  // normalized* — стабильные англ. слаги для логики/цветов; rarity/side — ru-лейблы для показа.
  rarity: text("rarity"), // "Обычные" | "Редкие" | "Легендарные"
  normalizedRarity: text("normalized_rarity"), // "common" | "rare" | "legendary"
  side: text("side"), // "ЧВК" | "Диких" | "Всё"
  normalizedSide: text("normalized_side"), // "pmc" | "scavs" | "all"
  adjustedPlayersCompletedPercent: real("adjusted_players_completed_percent"),
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
 * Разблокирует «Важные предметы» (агрегатор предметов убежища) и гейты craft-profit.
 * itemRequirements — {itemId, count} (валюта-рубли тоже идёт предметом); имя/иконка/цена
 * подтягиваются join'ом к items/prices при чтении. Ключи (станция+уровень) стабильны
 * между вайпами, поэтому синк — чистый upsert без прюна. Наполняет `db:sync-hideout`.
 */
export type HideoutItemReq = { itemId: string; count: number; fir?: boolean };
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

/* ───────────────── map geometry (self-mirror tarkov.dev) — Phase 4 интерактивные карты ───────────────── */
/**
 * Зеркало ГЕОМЕТРИИ интерактивных карт из tarkov.dev GraphQL (Map.{spawns,extracts,…}).
 * Координаты — факты (как prices), лицензионно чистые. Картинки-подложки (SVG) НЕ здесь —
 * они в Storage cta-media, ключ хранится в map_assets.imageKey; параметры проекции
 * (transform/bounds/rotation/heightRange/layers) — в статике src/data/eft-map-config.ts
 * (это параметры НАШЕГО рендера, не игровые данные). Наполняет `db:sync-maps-geometry` + крон.
 */

// Per-map: метаданные карты + указатель на изображение в Storage + атрибуция автора SVG.
export const mapAssets = pgTable("map_assets", {
  mapId: text("map_id")
    .primaryKey()
    .references(() => maps.id, { onDelete: "cascade" }),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  normalizedName: text("normalized_name").notNull(), // slug = ключ в eft-map-config
  imageKey: text("image_key"), // ключ в Storage cta-media: "maps/eft/{slug}.svg" (null если нет интерактивной подложки)
  imageFormat: text("image_format"), // "svg"
  author: text("author"), // атрибуция автора SVG (Shebuka/Jindouz/…), требование лицензии
  authorLink: text("author_link"),
  raidDuration: integer("raid_duration"), // минуты
  players: text("players"), // "8-12"
  minPlayerLevel: integer("min_player_level"),
  maxPlayerLevel: integer("max_player_level"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

// Тип маркера (дискриминатор). position null допустим (боссы — спавн по зоне, без координат).
export type MapMarkerKind =
  | "extract"
  | "spawn"
  | "transit"
  | "hazard"
  | "loot_container"
  | "loot_loose"
  | "lock"
  | "switch"
  | "boss"
  | "stationary_weapon"
  | "quest_zone"; // зоны объективов квестов (linkedQuestId) — для подсветки «Посмотреть на карте»

export type MapPos = { x: number; y: number; z: number };

// Все маркеры всех карт. id — GraphQL id (extract/transit/switch) ИЛИ synth-hash от
// mapId+type+позиция (spawn/loot/hazard/lock/…). PK composite (mapId, id). Геометрия в
// jsonb — зеркалит источник 1:1 (как слоты barters/crafts). Прюн — per-map (см. maps.ts).
export const mapMarkers = pgTable(
  "map_markers",
  {
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    type: text("type").$type<MapMarkerKind>().notNull(),
    position: jsonb("position").$type<MapPos>(), // null у боссов
    outline: jsonb("outline").$type<MapPos[]>(), // полигон зоны (выходы/опасности/…)
    top: real("top"),
    bottom: real("bottom"),
    label: text("label"),
    faction: text("faction"), // extract: "all"|"pmc"|"scav"
    sides: jsonb("sides").$type<string[]>(), // spawn: ["pmc"]/["scav"]/…
    categories: jsonb("categories").$type<string[]>(), // spawn: ["bot"]/["player"]/["boss"]/["sniper"]
    linkedItemId: text("linked_item_id"), // lock.key.id / lootContainer.id / lootLoose первый item
    linkedQuestId: text("linked_quest_id"), // зарезервировано под квест-слой (v2)
    meta: jsonb("meta").$type<Record<string, unknown>>(), // тип-специфичная нагрузка (switch-цепочки, boss spawnLocations, …)
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.mapId, t.id] }),
    index("map_markers_map_type_idx").on(t.mapId, t.type),
  ],
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
  // Кулдаун смены логина (Фаза 2-идентичность): когда username менялся в последний раз.
  // Колонка additive — заводится через supabase/account-identity.sql (db:sql, без db:push).
  usernameChangedAt: timestamp("username_changed_at", { withTimezone: true }),
  // Соц-привязки (account-real-data slice 1): хендлы вводятся вручную, NULL = не привязано.
  // Колонки additive — заводятся через supabase/account-social.sql (db:sql, без db:push).
  twitch: text("twitch"),
  youtube: text("youtube"),
  discord: text("discord"),
  steam: text("steam"),
  // Настройки рассылок (account-real-data): opt-out, по умолчанию всё включено.
  // Колонки additive — заводятся через supabase/account-notifications.sql (db:sql, без db:push).
  notifyAccount: boolean("notify_account").notNull().default(true),
  notifyOffers: boolean("notify_offers").notNull().default(true),
  notifyNews: boolean("notify_news").notNull().default(true),
  role: text("role").notNull().default("user"), // см. Role в @/lib/auth/roles
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Роль пользователя. Канон прав и предикаты — src/lib/auth/roles.ts.
//   user | editor (контент) | moderator («Связь») | admin (всё)
export type UserRole = "user" | "editor" | "moderator" | "admin";

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

/* ─────────────────────── achievement_progress ─────────────────────── */
/**
 * Фаза 2 достижений — облачный трекинг достижений игрока (замена localStorage).
 * Одна строка на пользователя+игру; поля 1:1 повторяют persisted-форму
 * useAchievementStore (completed/tracked). Публичного API «ачивки игрока» в EFT
 * нет → трекинг ручной (как квесты). user_id → profiles.id с каскадом.
 */
export const achievementProgress = pgTable(
  "achievement_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    completedIds: jsonb("completed_ids").$type<string[]>().notNull(),
    trackedIds: jsonb("tracked_ids").$type<string[]>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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

/* ─────────────────────── player_profiles ─────────────────────── */
/**
 * Слой 4d — облачные ИГРОВЫЕ профили (ник/уровень/prestige/edition/фракция/режим/
 * уровни торговцев). ГИБРИД: localStorage остаётся источником, синк в БД при логине
 * (паттерн ProgressSync). Одна строка на пользователя+игру; JSONB-блоб 1:1 повторяет
 * persisted-форму usePlayerStore (`{ profiles[], activeProfileId }`). До 5 профилей.
 * RLS owner-only (supabase/player-profiles-rls.sql).
 */
export type PlayerProfilePersist = {
  id: string;
  nickname: string;
  level: string;
  prestige: string;
  faction: string;
  edition: string;
  mode: string;
  hoursPlayed: number | null;
  raids: number | null;
  survivalRate: number | null;
  traderLevels: Record<string, number>;
};

export const playerProfiles = pgTable(
  "player_profiles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    profiles: jsonb("profiles").$type<PlayerProfilePersist[]>().notNull(),
    activeProfileId: text("active_profile_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.gameId] })],
);

/* ─────────────────────── rate_limits (S5 — app-level лимитер) ─────────────────────── */
/**
 * Fixed-window счётчик для rate-limit публичных auth-эндпоинтов (login/register).
 * Бэкенд-онли: пишет/читает только серверная owner-роль (Drizzle, мимо RLS);
 * RLS включён без policy (supabase/rate-limits.sql) — anon/authenticated доступа нет.
 * key = "login:ip:..." / "register:email:..."; протухшие ключи чистятся опортунистически.
 * Заводится через db:sql (additive), без db:push. Vercel+Supabase, без внешнего Upstash.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).defaultNow().notNull(),
});

/* ─────────────────────── feedback (форма «Сообщить об ошибке») ─────────────────────── */
/**
 * Обращения пользователей «Сообщение об ошибке или неточности данных» (Figma 1588:1322).
 * Форма глобальная, «намертво» цепляет текущий URL страницы (pageUrl). Бэкенд-онли:
 * пишет только серверная owner-роль (Drizzle через API-роут), читает — CMS/админ.
 * RLS включён без policy (supabase/feedback.sql) — anon/authenticated прямого доступа нет
 * (паттерн rate_limits). SMTP отложен (hosting-vercel-first) → сперва копим в БД, письмо
 * прикрутим позже (Edge Function). Вложения (≤5 шт × ≤500 КБ) храним инлайн в jsonb как
 * base64 — без ручного bucket'а; при росте объёма мигрируем в Storage cta-feedback.
 */
export type FeedbackAttachment = {
  name: string;
  type: string; // MIME
  size: number; // байт
  dataBase64: string; // содержимое файла
};

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageUrl: text("page_url").notNull(), // намертво привязанная страница-источник
    email: text("email").notNull(),
    message: text("message").notNull(),
    attachments: jsonb("attachments").$type<FeedbackAttachment[]>().notNull().default([]),
    userId: uuid("user_id"), // profiles.id, если залогинен (без FK — обращения переживают удаление аккаунта)
    userAgent: text("user_agent"),
    status: text("status").notNull().default("new"), // 'new' | 'read' | 'resolved' (для CMS)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("feedback_status_created_idx").on(t.status, t.createdAt)],
);

/* ───────────────── inferred types (для использования в коде) ───────────────── */
export type FeedbackRow = typeof feedback.$inferSelect;
export type NewFeedbackRow = typeof feedback.$inferInsert;
export type PlayerProfileRow = typeof playerProfiles.$inferSelect;
export type NewPlayerProfileRow = typeof playerProfiles.$inferInsert;
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
export type MapAssetRow = typeof mapAssets.$inferSelect;
export type NewMapAssetRow = typeof mapAssets.$inferInsert;
export type MapMarkerRow = typeof mapMarkers.$inferSelect;
export type NewMapMarkerRow = typeof mapMarkers.$inferInsert;

/* ───────────────── weapon builds — оружейный слой (self-mirror tarkov.dev) ───────────────── */
/**
 * Слой сборок оружия. В `items`/`item_properties` лежит общая карточка предмета, но
 * для конструктора нужны три вещи, которых там нет: ДЕРЕВО СЛОТОВ, модификаторы
 * модулей и пресеты. Держим их отдельными плоскими таблицами — конструктору нужен
 * быстрый батч-ридер, а не разбор JSONB на каждый мод.
 *
 * Наполняет `db:sync-weapons` (items(types: [gun, mods, preset])).
 * Ключи (item id) стабильны между вайпами → синк это чистый upsert.
 *
 * ВАЖНО: recoilModifier/accuracyModifier в источнике приходят ДОЛЕЙ (-0.06 = −6%).
 * Храним как есть, движок (src/lib/weapon-build.ts) складывает их и умножает базу.
 */

// Оружие-база: стоковые характеристики до обвеса + указатель на дефолт-пресет.
export const weaponBases = pgTable(
  "weapon_bases",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(), // inGameId оружия
    caliber: text("caliber"),
    ergonomics: real("ergonomics").notNull().default(0),
    recoilVertical: integer("recoil_vertical").notNull().default(0),
    recoilHorizontal: integer("recoil_horizontal").notNull().default(0),
    fireRate: integer("fire_rate"),
    fireModes: jsonb("fire_modes").$type<string[]>(),
    sightingRange: integer("sighting_range"),
    centerOfImpact: real("center_of_impact"), // MOA базы
    deviationCurve: real("deviation_curve"),
    deviationMax: real("deviation_max"),
    defaultPresetId: text("default_preset_id"), // item id пресета «из коробки» (у него своя картинка)
    defaultAmmoId: text("default_ammo_id"),
    allowedAmmoIds: jsonb("allowed_ammo_ids").$type<string[]>().notNull().default([]),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.itemId] })],
);

// Слот-приёмник модулей. Родитель — оружие ИЛИ сам модуль (планка → крышка → прицел).
// allowedItemIds — плоский массив (excluded уже вычтены на этапе синка): пикер модулей
// фильтрует на клиенте простой IN-проверкой, без запроса на каждый слот.
export const weaponSlots = pgTable(
  "weapon_slots",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    parentItemId: text("parent_item_id").notNull(),
    slotId: text("slot_id").notNull(), // BSG id слота
    nameId: text("name_id").notNull(), // mod_muzzle / mod_magazine / mod_scope — ключ дерева сборки
    name: text("name").notNull(),
    required: boolean("required").notNull().default(false),
    ord: integer("ord").notNull().default(0), // порядок показа в конструкторе
    allowedItemIds: jsonb("allowed_item_ids").$type<string[]>().notNull().default([]),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.parentItemId, t.slotId] }),
    index("weapon_slots_parent_idx").on(t.gameId, t.parentItemId),
  ],
);

// Деталь сборки: модуль ИЛИ патрон. Дискриминатор — kind (совпадает с union'ом движка).
// Для мода значимы ergonomics/recoilModifier/accuracyModifier/velocity/capacity,
// для патрона — initialSpeed/recoilModifier/accuracyModifier (остальное null).
export type WeaponPartKind = "mod" | "ammo";

export const weaponParts = pgTable(
  "weapon_parts",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    kind: text("kind").$type<WeaponPartKind>().notNull(),
    ergonomics: real("ergonomics").notNull().default(0), // плоская прибавка, может быть < 0
    recoilModifier: real("recoil_modifier").notNull().default(0), // доля
    accuracyModifier: real("accuracy_modifier").notNull().default(0), // доля
    velocity: real("velocity").notNull().default(0), // % к скорости пули (мод)
    loudness: integer("loudness").notNull().default(0),
    capacity: integer("capacity"), // магазины
    initialSpeed: real("initial_speed"), // патроны
    conflictingItemIds: jsonb("conflicting_item_ids").$type<string[]>().notNull().default([]),
    conflictingSlotIds: jsonb("conflicting_slot_ids").$type<string[]>().notNull().default([]),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.itemId] }),
    index("weapon_parts_kind_idx").on(t.gameId, t.kind),
  ],
);

// Пресет = САМОСТОЯТЕЛЬНЫЙ item со своим id → у него есть собственная отрендеренная
// картинка СОБРАННОГО ствола (items/eft/512/{id}.webp в R2). Отсюда hero-картинки
// сборок: точное совпадение дерева с parts → показываем рендер пресета.
export type WeaponPresetPart = { itemId: string; slotNameId: string; count: number };

export const weaponPresets = pgTable(
  "weapon_presets",
  {
    id: text("id").primaryKey(), // item id самого пресета
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    baseItemId: text("base_item_id").notNull(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ergonomics: real("ergonomics"),
    recoilVertical: integer("recoil_vertical"),
    recoilHorizontal: integer("recoil_horizontal"),
    moa: real("moa"),
    parts: jsonb("parts").$type<WeaponPresetPart[]>().notNull().default([]),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("weapon_presets_base_idx").on(t.gameId, t.baseItemId)],
);

/* ───────────────── weapon_builds — сборки игрока (облако + community) ───────────────── */
/**
 * Облачные сборки. ГИБРИД (паттерн playerProfiles): источник — localStorage
 * (useBuildStore, ключ `cta-weapon-builds`), синк в БД при логине для платных тиров.
 * `tree` 1:1 повторяет BuildNode из src/lib/weapon-build.ts → синк без конвертации.
 * `stats` — денормализованный снимок расчёта: нужен для сортировки/фильтров ленты
 * community и для OG-картинки, чтобы не поднимать весь справочник модулей.
 *
 * Лимит free-тира (3 сборки) проверяется НА СЕРВЕРЕ в POST /api/eft/builds —
 * useBuildQuota это только UX. RLS: owner-only на запись, публичные — на чтение
 * (supabase/weapon-builds-rls.sql, накатывается через db:sql).
 */
export type BuildTreeNode = {
  itemId: string;
  quantity: number;
  mods: Record<string, BuildTreeNode>;
};

export type BuildStatsSnapshot = {
  ergonomics: number;
  recoilVertical: number;
  recoilHorizontal: number;
  recoilSum: number;
  moa: number | null;
  weight: number;
  velocity: number | null;
  capacity: number | null;
  modCount: number;
  /** Итог в рублях на момент сохранения (цены живые, значение справочное). */
  priceRub: number | null;
};

export const weaponBuilds = pgTable(
  "weapon_builds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    purpose: text("purpose").notNull().default(""), // «мета» / «бюджет» / «Оружейник ч.7»
    baseItemId: text("base_item_id").notNull(),
    tree: jsonb("tree").$type<BuildTreeNode>().notNull(),
    stats: jsonb("stats").$type<BuildStatsSnapshot>().notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    slug: text("slug").unique(), // /eft/progress/loadouts/b/{slug}
    likes: integer("likes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("weapon_builds_user_idx").on(t.userId, t.gameId),
    index("weapon_builds_public_idx").on(t.isPublic, t.baseItemId),
  ],
);

/* ───────────────── inferred types (оружейный слой) ───────────────── */
export type WeaponBaseRow = typeof weaponBases.$inferSelect;
export type NewWeaponBaseRow = typeof weaponBases.$inferInsert;
export type WeaponSlotRow = typeof weaponSlots.$inferSelect;
export type NewWeaponSlotRow = typeof weaponSlots.$inferInsert;
export type WeaponPartRow = typeof weaponParts.$inferSelect;
export type NewWeaponPartRow = typeof weaponParts.$inferInsert;
export type WeaponPresetRow = typeof weaponPresets.$inferSelect;
export type NewWeaponPresetRow = typeof weaponPresets.$inferInsert;
export type WeaponBuildRow = typeof weaponBuilds.$inferSelect;
export type NewWeaponBuildRow = typeof weaponBuilds.$inferInsert;
/* ───────────────── game changes (CDC — «что реально изменилось в игре») ─────────────────
 * Трекаем ТОЛЬКО игровые поля предмета (вес, базовая цена, статы), которые меняются
 * патчами/силент-чейнджами. Флиа-цены НЕ трекаем — это рынок, а не изменения игры.
 * item_change_state — снимок-отпечаток на (игра, предмет). Дифф-джоб сравнивает свежие
 * items+item_properties со снимком и пишет дельты в item_changes. */
export const itemChangeState = pgTable(
  "item_change_state",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    inGameId: text("in_game_id").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    fingerprint: jsonb("fingerprint").$type<Record<string, string>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("item_change_state_game_ingame_idx").on(t.gameId, t.inGameId)],
);

// Журнал изменений: 'added' | 'removed' | 'field'. Группируется по detected_at в чейнджсеты.
export const itemChanges = pgTable(
  "item_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    inGameId: text("in_game_id").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    kind: text("kind").notNull(),
    field: text("field"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    // category: 'stat' (статы предметов) | 'trader' (офферы торговцев). scope — имя торговца.
    category: text("category").notNull().default("stat"),
    scope: text("scope"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("item_changes_detected_idx").on(t.detectedAt),
    index("item_changes_game_idx").on(t.gameId),
  ],
);

export type ItemChangeRow = typeof itemChanges.$inferSelect;

/* ───────────────── change digests (редакторский разбор среза изменений) ─────────────────
 * Человеческий «разбор ЦТА» на срез изменений (по дню). Автоинтерпретация статов в UI —
 * это факты; здесь редактор добавляет текстовый разбор/контекст и публикует. Пишет только
 * серверный admin-роут (Drizzle мимо RLS); публичное чтение — только published. */
export const changeDigests = pgTable(
  "change_digests",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD — совпадает с днём чейнджсета
    noteRu: text("note_ru").notNull().default(""),
    published: boolean("published").notNull().default(false),
    authorId: uuid("author_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("change_digests_game_date_idx").on(t.gameId, t.date)],
);

export type ChangeDigestRow = typeof changeDigests.$inferSelect;

/* ───────────────── trader offer state (снимок офферов торговцев для диффа) ─────────────────
 * Снимок-отпечаток оффера торговца на (игра, торговец, предмет-tpl): лояльность + цена.
 * Источник — сырые assort.json из sp-tarkov/server. Дифф пишет дельты в item_changes
 * (category='trader'). Скупщик (динамический ассорт) не трекается. */
export const traderOfferState = pgTable(
  "trader_offer_state",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    traderId: text("trader_id").notNull(), // BSG-id торговца
    tpl: text("tpl").notNull(), // template предмета (= items.in_game_id)
    fingerprint: text("fingerprint").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("trader_offer_state_key_idx").on(t.gameId, t.traderId, t.tpl)],
);

/* ───────────────── craft state (снимок крафтов убежища для диффа) ─────────────────
 * Снимок-отпечаток рецепта убежища на (игра, recipeId): продукт, выход, время,
 * уровень зоны, входы. Источник — hideout/production.json из sp-tarkov/server.
 * Дельты пишутся в item_changes (category='craft', scope=зона). */
export const craftState = pgTable(
  "craft_state",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    recipeId: text("recipe_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("craft_state_key_idx").on(t.gameId, t.recipeId)],
);

/* ───────────────── quest state (снимок квестов для диффа) ─────────────────
 * Отпечаток квеста на (игра, questId): опыт, награды, репутация, цели, требования.
 * name хранится, чтобы показать удалённый квест. Источник — templates/quests.json
 * (sp-tarkov) + RU-имена из tarkov.dev. Дельты → item_changes (category='quest'). */
export const questState = pgTable(
  "quest_state",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    questId: text("quest_id").notNull(),
    name: text("name").notNull(),
    fingerprint: text("fingerprint").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("quest_state_key_idx").on(t.gameId, t.questId)],
);
