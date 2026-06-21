// Проверка рантайм-подключения к Supabase (транзакционный пулер) + первый сид.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db/index.ts");
  const { games } = await import("../src/db/schema.ts");

  // Идемпотентный сид: игра EFT. Повторный запуск ничего не дублирует.
  await db
    .insert(games)
    .values({ code: "eft", name: "Escape from Tarkov" })
    .onConflictDoNothing({ target: games.code });

  const rows = await db.select().from(games);
  console.log("games в базе:", rows);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
