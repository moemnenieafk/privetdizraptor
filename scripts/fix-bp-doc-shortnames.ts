// Разовая правка shortName 4 стример-предметов патча 1.1.0 в НАШЕМ каталоге (items).
// Причина: у новых предметов shortName залился как «первые 2 слова» EN-имени (мангл, см.
// fix-item-names-from-tdev.ts). Верные короткие имена задал V4DYA (стример-теги). Правим
// ТОЛЬКО short_name (name/desc/etc не трогаем — точечный UPDATE, не full-replace как admin PUT).
// Запуск: npx tsx scripts/fix-bp-doc-shortnames.ts
import { config } from "dotenv";
config({ path: ".env.local" });

// slug (normalizedName) → верный shortName
const FIXES: Record<string, string> = {
  "can-of-gigabeef-meat": "GigaBeef",
  "lm-kc-130-model-aircraft": "KC-130",
  "french-bakery-baguette": "Cocaoo_",
  "bottle-of-ymxc-water": "YMXC",
};

async function main() {
  // Импорты ПОСЛЕ config() — db-модуль читает DATABASE_URL на загрузке.
  const { db } = await import("../src/db/index.ts");
  const { items, prices } = await import("../src/db/schema.ts");
  const { eftGameId } = await import("../src/db/eft.ts");
  const { and, eq, inArray } = await import("drizzle-orm");

  const gameId = await eftGameId();
  const slugs = Object.keys(FIXES);

  // slug → inGameId из зеркала цен (normalizedName живёт там, не в items).
  const priceRows = await db
    .select({ id: prices.inGameId, slug: prices.normalizedName })
    .from(prices)
    .where(and(eq(prices.gameId, gameId), inArray(prices.normalizedName, slugs)));

  const bySlug = new Map(priceRows.map((r) => [r.slug, r.id]));
  console.log("Резолв slug → id:");
  for (const s of slugs) console.log(`  ${s} → ${bySlug.get(s) ?? "НЕ НАЙДЕН"}`);

  for (const [slug, shortName] of Object.entries(FIXES)) {
    const id = bySlug.get(slug);
    if (!id) {
      console.warn(`⚠ ${slug}: id не найден в prices — пропуск`);
      continue;
    }
    const before = await db
      .select({ name: items.name, shortName: items.shortName })
      .from(items)
      .where(and(eq(items.gameId, gameId), eq(items.inGameId, id)));
    if (before.length === 0) {
      console.warn(`⚠ ${slug} (${id}): нет в items — пропуск`);
      continue;
    }
    const updated = await db
      .update(items)
      .set({ shortName })
      .where(and(eq(items.gameId, gameId), eq(items.inGameId, id)))
      .returning({ id: items.inGameId, name: items.name, shortName: items.shortName });
    console.log(
      `✓ ${before[0].name}: shortName «${before[0].shortName ?? "—"}» → «${updated[0].shortName}»`,
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
