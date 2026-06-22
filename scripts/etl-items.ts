// Слой 2 — ETL предметов EFT в Supabase.
//
// Источник: public/images/items/eft/items_database.json — автономный статический
// экспорт (tarkov.dev-стиль, 5044 предмета, с ru/en локализацией и готовым
// properties.__typename). НЕ сырой SPT-дамп: категории здесь плоские (нет BSG
// _parent-иерархии), поэтому item_categories.parentId остаётся null.
//
// Идемпотентно: bulk-upsert через onConflictDoUpdate (повторный прогон обновляет,
// не дублирует). Запуск: npm run db:etl
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import path from "node:path";

/* ───────────────── типы сырого источника ───────────────── */
type RawProps = { __typename?: string } & Record<string, unknown>;

interface RawItem {
  id: string;
  category: string;
  all_categories?: string[];
  names?: { ru?: string; en?: string };
  shortNames?: { ru?: string; en?: string };
  descriptions?: { ru?: string; en?: string };
  weight?: number | null;
  width?: number | null;
  height?: number | null;
  basePrice?: number | null;
  properties?: RawProps | null;
}

/* ───────────────── безопасные коэрсеры (без any) ───────────────── */
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

const strArr = (v: unknown): string[] | undefined => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string");
    return a.length ? a : undefined;
  }
  return typeof v === "string" && v.length > 0 ? [v] : undefined;
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

async function main() {
  // Импорты ПОСЛЕ config() — db-модуль читает DATABASE_URL на загрузке.
  const { sql, eq } = await import("drizzle-orm");
  const { db } = await import("../src/db/index.ts");
  const { games, itemCategories, items, itemProperties } = await import(
    "../src/db/schema.ts"
  );
  type ItemProperties = import("../src/db/schema.ts").ItemProperties;

  /* __typename → наш дискриминатор + извлечение полей под схему */
  const toItemProperties = (p: RawProps | null | undefined): ItemProperties => {
    const tn = p?.__typename;
    if (!p || !tn) return { type: "generic" };
    switch (tn) {
      case "ItemPropertiesAmmo":
        return {
          type: "ammo",
          caliber: str(p.caliber),
          penetrationPower: num(p.penetrationPower),
          damage: num(p.damage),
          armorDamage: num(p.armorDamage),
          fragmentationChance: num(p.fragmentationChance),
          initialSpeed: num(p.initialSpeed),
        };
      case "ItemPropertiesWeapon":
        return {
          type: "weapon",
          caliber: str(p.caliber),
          ergonomics: num(p.ergonomics),
          recoilVertical: num(p.recoilVertical),
          recoilHorizontal: num(p.recoilHorizontal),
          fireRate: num(p.fireRate),
        };
      case "ItemPropertiesArmor":
      case "ItemPropertiesHelmet":
      case "ItemPropertiesChestRig":
        return {
          type: "armor",
          armorClass: num(p.class),
          durability: num(p.durability),
          bluntThroughput: num(p.bluntThroughput),
          armorZones: strArr(p.zones) ?? strArr(p.headZones),
          ergoPenalty: num(p.ergoPenalty),
          speedPenalty: num(p.speedPenalty),
          turnPenalty: num(p.turnPenalty),
        };
      case "ItemPropertiesContainer":
      case "ItemPropertiesBackpack":
        return { type: "container", capacity: num(p.capacity) };
      case "ItemPropertiesMedKit":
      case "ItemPropertiesMedicalItem":
      case "ItemPropertiesPainkiller":
      case "ItemPropertiesStim":
      case "ItemPropertiesSurgicalKit":
        return {
          type: "medical",
          useTime: num(p.useTime),
          maxHpResource: num(p.hitpoints),
          hpResourceRate: num(p.hpResourceRate),
        };
      default: {
        // Моды, ключи, прицелы, пресеты, properties=null и пр. — сырьё целиком.
        // rest СПЕРВА: у некоторых сырых props есть своё поле `type`
        // (гранаты: "Grenade"/"Smoke"/…) — наш дискриминатор должен победить.
        const { __typename: _drop, ...rest } = p;
        void _drop;
        return { ...rest, type: "generic" };
      }
    }
  };

  /* ── 1. читаем источник ── */
  const file = path.join(
    process.cwd(),
    "public/images/items/eft/items_database.json",
  );
  const raw = JSON.parse(readFileSync(file, "utf8")) as RawItem[];
  console.log(`Источник: ${raw.length} предметов из ${path.basename(file)}`);

  /* ── 2. gameId для eft (идемпотентный сид на случай пустой базы) ── */
  await db
    .insert(games)
    .values({ code: "eft", name: "Escape from Tarkov" })
    .onConflictDoNothing({ target: games.code });
  const [eft] = await db.select().from(games).where(eq(games.code, "eft"));
  if (!eft) throw new Error("игра eft не найдена после сида");
  const gameId = eft.id;

  /* ── 3. категории (плоский справочник из слагов) ── */
  const slugs = new Set<string>();
  for (const it of raw) {
    if (it.category) slugs.add(it.category);
    for (const c of it.all_categories ?? []) slugs.add(c);
  }
  const catRows = [...slugs].map((slug) => ({
    gameId,
    inGameId: slug,
    name: slug,
  }));
  await db
    .insert(itemCategories)
    .values(catRows)
    .onConflictDoUpdate({
      target: [itemCategories.gameId, itemCategories.inGameId],
      set: { name: sql`excluded.name` },
    });
  const cats = await db
    .select({ id: itemCategories.id, slug: itemCategories.inGameId })
    .from(itemCategories)
    .where(eq(itemCategories.gameId, gameId));
  const catMap = new Map(cats.map((c) => [c.slug, c.id]));
  console.log(`Категорий в базе: ${catMap.size}`);

  /* ── 4. предметы + свойства, пачками по 500 ── */
  let upItems = 0;
  let upProps = 0;
  for (const batch of chunk(raw, 500)) {
    const itemRows = batch.map((it) => ({
      gameId,
      inGameId: it.id,
      categoryId: catMap.get(it.category) ?? null,
      name: it.names?.ru ?? it.names?.en ?? "(без названия)",
      shortName: it.shortNames?.ru ?? it.shortNames?.en ?? null,
      description: it.descriptions?.ru ?? it.descriptions?.en ?? null,
      weight: num(it.weight) ?? null,
      gridWidth: num(it.width) ?? null,
      gridHeight: num(it.height) ?? null,
      basePrice: num(it.basePrice) ?? null,
    }));

    const inserted = await db
      .insert(items)
      .values(itemRows)
      .onConflictDoUpdate({
        target: [items.gameId, items.inGameId],
        set: {
          categoryId: sql`excluded.category_id`,
          name: sql`excluded.name`,
          shortName: sql`excluded.short_name`,
          description: sql`excluded.description`,
          weight: sql`excluded.weight`,
          gridWidth: sql`excluded.grid_width`,
          gridHeight: sql`excluded.grid_height`,
          basePrice: sql`excluded.base_price`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: items.id, inGameId: items.inGameId });
    upItems += inserted.length;

    const idMap = new Map(inserted.map((r) => [r.inGameId, r.id]));
    const propRows = batch
      .map((it) => {
        const itemId = idMap.get(it.id);
        return itemId
          ? {
              itemId,
              properties: toItemProperties(it.properties),
              // сырые свойства из источника (для богатых колонок категорий)
              propertiesRaw: (it.properties ?? null) as Record<string, unknown> | null,
            }
          : null;
      })
      .filter(
        (r): r is {
          itemId: string;
          properties: ItemProperties;
          propertiesRaw: Record<string, unknown> | null;
        } => r !== null,
      );

    await db
      .insert(itemProperties)
      .values(propRows)
      .onConflictDoUpdate({
        target: itemProperties.itemId,
        set: {
          properties: sql`excluded.properties`,
          propertiesRaw: sql`excluded.properties_raw`,
        },
      });
    upProps += propRows.length;
    console.log(`  …обработано ${upItems}/${raw.length}`);
  }

  console.log(`ГОТОВО: items=${upItems}, item_properties=${upProps}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
