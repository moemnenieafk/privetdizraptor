import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
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
  },
  (t) => [index("item_properties_gin_idx").using("gin", t.properties)],
);

/* ───────────────── inferred types (для использования в коде) ───────────────── */
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type ItemCategory = typeof itemCategories.$inferSelect;
export type NewItemCategory = typeof itemCategories.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type ItemPropertiesRow = typeof itemProperties.$inferSelect;
export type NewItemPropertiesRow = typeof itemProperties.$inferInsert;
