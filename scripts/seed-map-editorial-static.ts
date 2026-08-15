// Идемпотентный сид строк maps для СТАТИК-карт с editorial-режимом (визарду нужна строка maps,
// FK editorial_markers.map_id → maps.id). Обратимо: DELETE FROM maps WHERE id IN (...).
// Плюс синхронизирует функцию protect_custom_maps() (защита от прунинга landing-синка).
// Запуск: npx tsx scripts/seed-map-editorial-static.ts
import { config } from "dotenv";
config({ path: ".env.local" });

// id (= slug конфига, его передаёт editorial-страница как mapId) → человекочитаемое имя.
const STATIC_EDITORIAL: Record<string, string> = {
  "the-lab": "Лаборатория",
  icebreaker: "Ледокол",
  labyrinth: "Лабиринт",
};
// Полный список защищённых от прунинга кастомных карт (совпадает с CUSTOM_MAP_IDS в landing.ts).
const PROTECTED = ["factory-hd", "factory", "the-lab", "icebreaker", "labyrinth"];

async function main() {
  const { sql, inArray } = await import("drizzle-orm");
  const { db } = await import("../src/db/index.ts");
  const { maps } = await import("../src/db/schema.ts");
  const { eftGameId } = await import("../src/db/eft.ts");

  const gameId = await eftGameId();
  for (const [id, name] of Object.entries(STATIC_EDITORIAL)) {
    await db
      .insert(maps)
      .values({ id, gameId, name, normalizedName: id })
      .onConflictDoNothing({ target: maps.id });
  }

  // Синхронизируем тело защитной функции со списком PROTECTED (триггер уже навешен). Идемпотентно.
  const list = PROTECTED.map((id) => `'${id}'`).join(", ");
  await db.execute(
    sql.raw(`
    create or replace function public.protect_custom_maps()
    returns trigger language plpgsql as $$
    begin
      if old.id in (${list}) then
        return null;
      end if;
      return old;
    end;
    $$;
  `),
  );

  const rows = await db.select().from(maps).where(inArray(maps.id, Object.keys(STATIC_EDITORIAL)));
  console.log("строки maps (статик-editorial):", rows.map((r) => r.id).sort().join(", "));
  console.log("protect_custom_maps: защищены →", PROTECTED.join(", "));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
