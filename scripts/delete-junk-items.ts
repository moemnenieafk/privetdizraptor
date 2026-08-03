// Удаление мусорных предметов из прод-каталога (напр. Twitch-дропы).
// item_properties.itemId → items.id c onDelete:cascade, поэтому чистим только items.
// Запуск: npx tsx scripts/delete-junk-items.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { sql } = await import("drizzle-orm");
  const { db } = await import("../src/db/index.ts");

  const before: any = await db.execute(
    sql`SELECT count(*)::int AS n FROM items WHERE name LIKE 'Twitch Seasons%'`,
  );
  const n = before?.[0]?.n ?? before?.rows?.[0]?.n ?? 0;
  console.log(`к удалению (name LIKE 'Twitch Seasons%'): ${n}`);
  if (!n) {
    console.log("нечего удалять.");
    return;
  }
  await db.execute(sql`DELETE FROM items WHERE name LIKE 'Twitch Seasons%'`);
  const after: any = await db.execute(sql`SELECT count(*)::int AS n FROM items`);
  console.log(`УДАЛЕНО ${n}. items теперь: ${after?.[0]?.n ?? after?.rows?.[0]?.n}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
