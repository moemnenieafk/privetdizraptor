// Идемпотентная АДДИТИВНАЯ миграция: 3 nullable-колонки в `crafts`
// (task_unlock_id, game_editions, required_quest_items — квест-гейт / издания /
// квест-предметы крафта). Через СЕССИОННЫЙ пул DATABASE_URL_SESSION (:5432) —
// миграции идут мимо db:push (тот --force откатывает RLS/триггеры). Модель —
// scripts/apply-sql.ts (raw SQL через postgres).
//
// Запуск оператором ОТДЕЛЬНЫМ шагом: не часть синка/билда.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const postgres = (await import("postgres")).default;
  const url = process.env.DATABASE_URL_SESSION;
  if (!url) throw new Error("DATABASE_URL_SESSION не задан");

  const sql = postgres(url, { prepare: false, onnotice: () => {} });
  await sql.unsafe(`ALTER TABLE crafts ADD COLUMN IF NOT EXISTS task_unlock_id text;`);
  await sql.unsafe(`ALTER TABLE crafts ADD COLUMN IF NOT EXISTS game_editions jsonb;`);
  await sql.unsafe(`ALTER TABLE crafts ADD COLUMN IF NOT EXISTS required_quest_items jsonb;`);
  await sql.end();
  console.log("✓ crafts: +task_unlock_id +game_editions +required_quest_items");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
