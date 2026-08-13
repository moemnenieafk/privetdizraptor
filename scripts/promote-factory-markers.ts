// Шаг 3 промоута HD-Завода (docs/decisions/factory-hd-promote.md, модель A — полностью editorial):
// переносит user-метки (визард-выверка V4DYA) с map_id='factory-hd' на боевой map_id='factory'.
// Синканные (source='sync') НЕ трогаются — тайл-ветка page.tsx их и так не рендерит (уборка — Шаг 6).
//
// БЕЗ флага — DRY-RUN (только читает и печатает план, БД не меняется). --apply — исполняет.
// --rollback — реверс (вернуть user-метки factory → factory-hd).
// Бэкап ДО: `npm run dump:factory-hd` (scripts/data/factory-hd-markers.snapshot.json).
// Реверс безопасен: до промоута у factory было 0 user-меток → все user-factory именно наши.
//
// Запуск:  npx tsx scripts/promote-factory-markers.ts [--apply | --rollback]
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, inArray, count } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { markers } from "../src/db/schema-markers.ts";
import { maps } from "../src/db/schema.ts";
import { eftGameId } from "../src/db/eft.ts";

const FROM = "factory-hd";
const TO = "factory";
const APPLY = process.argv.includes("--apply");
const ROLLBACK = process.argv.includes("--rollback");

async function markerCount(mapId: string, source: "user" | "sync"): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(markers)
    .where(and(eq(markers.mapId, mapId), eq(markers.source, source)));
  return r?.n ?? 0;
}

async function main(): Promise<void> {
  const mapsRows = await db
    .select({ id: maps.id, name: maps.name })
    .from(maps)
    .where(inArray(maps.id, [FROM, TO]));
  const hasFrom = mapsRows.some((m) => m.id === FROM);
  const hasTo = mapsRows.some((m) => m.id === TO);

  const [userFrom, userTo, syncTo] = await Promise.all([
    markerCount(FROM, "user"),
    markerCount(TO, "user"),
    markerCount(TO, "sync"),
  ]);

  console.log("── СОСТОЯНИЕ ДО ──");
  console.log(`maps: ${mapsRows.map((m) => `${m.id}="${m.name}"`).join(", ") || "(нет строк factory/factory-hd!)"}`);
  console.log(`user-метки ${FROM}: ${userFrom}`);
  console.log(`user-метки ${TO}:   ${userTo}  (ожидаем 0 до промоута)`);
  console.log(`sync-метки ${TO}:   ${syncTo}  (не трогаем)`);

  if (ROLLBACK) {
    if (!hasFrom) {
      console.error(`✗ нет строки maps '${FROM}' — реверс невозможен (FK map_id→maps.id)`);
      process.exit(1);
    }
    const moved = await db
      .update(markers)
      .set({ mapId: FROM, updatedAt: new Date() })
      .where(and(eq(markers.mapId, TO), eq(markers.source, "user")))
      .returning({ id: markers.id });
    console.log(`\n↩ РЕВЕРС: ${moved.length} user-меток ${TO} → ${FROM}`);
    process.exit(0);
  }

  // Гварды промоута.
  if (userFrom === 0) {
    console.error(`✗ у '${FROM}' 0 user-меток — нечего переносить (бэкап делал?). Стоп.`);
    process.exit(1);
  }
  if (userTo > 0) {
    console.error(`⚠ у '${TO}' уже ${userTo} user-меток — возможна коллизия. Разобраться вручную, промоут остановлен.`);
    process.exit(1);
  }

  const willCreateMaps = !hasTo; // FK-анкор editorial-меток; синканный factory сидит под BSG-id (иная строка).

  if (!APPLY) {
    console.log("\n── DRY-RUN (БД не менялась) ──");
    if (willCreateMaps) console.log(`СОЗДАМ строку maps '${TO}' (name "Завод", normalizedName '${TO}') — FK-анкор editorial.`);
    else console.log(`строка maps '${TO}' уже есть — переиспользую.`);
    console.log(`ПЛАН: перенести ${userFrom} user-меток ${FROM} → ${TO} (sync не трогаем).`);
    console.log("Исполнить: npx tsx scripts/promote-factory-markers.ts --apply");
    process.exit(0);
  }

  // "+ строка maps" из спеки: editorial-метки FK-ссылаются на maps.id. Синканный factory сидит под
  // BSG-id (отдельная строка maps, normalizedName='factory') → не конфликтует, все join'ы идут по id.
  if (willCreateMaps) {
    const gameId = await eftGameId();
    await db
      .insert(maps)
      .values({ id: TO, gameId, name: "Завод", normalizedName: TO })
      .onConflictDoNothing({ target: maps.id });
    console.log(`✓ строка maps '${TO}' создана (FK-анкор editorial).`);
  }

  const moved = await db
    .update(markers)
    .set({ mapId: TO, updatedAt: new Date() })
    .where(and(eq(markers.mapId, FROM), eq(markers.source, "user")))
    .returning({ id: markers.id });

  const [userFromAfter, userToAfter] = await Promise.all([markerCount(FROM, "user"), markerCount(TO, "user")]);

  console.log("\n── ПЕРЕНОС ──");
  console.log(`✓ перенесено ${moved.length} меток (ожидалось ${userFrom})`);
  console.log("── СОСТОЯНИЕ ПОСЛЕ ──");
  console.log(`user-метки ${FROM}: ${userFromAfter} (ожидаем 0)`);
  console.log(`user-метки ${TO}:   ${userToAfter} (ожидаем ${userFrom})`);

  if (moved.length !== userFrom || userFromAfter !== 0 || userToAfter !== userFrom) {
    console.error("⚠ ЦИФРЫ НЕ СХОДЯТСЯ — проверь вручную (бэкап + restore:factory-hd на месте)!");
    process.exit(1);
  }
  console.log("✅ ОК: перенос консистентен.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
