// Идемпотентный сид строки карты в таблицу `maps` для HD-превью (editorial-маркеры
// ссылаются на maps(id), иначе визарду некуда сохранять). Обратимо: DELETE FROM maps WHERE id=...
// Запуск: npx tsx scripts/seed-map-hd.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db/index.ts");
  const { maps } = await import("../src/db/schema.ts");
  const { eftGameId } = await import("../src/db/eft.ts");

  const gameId = await eftGameId();
  await db
    .insert(maps)
    .values({ id: "factory-hd", gameId, name: "Завод — HD (тайлы)", normalizedName: "factory-hd" })
    .onConflictDoNothing({ target: maps.id });

  const [row] = await db.select().from(maps).where(eq(maps.id, "factory-hd"));
  console.log("maps.factory-hd:", row ?? "НЕ создана");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
