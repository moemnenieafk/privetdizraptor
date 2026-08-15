// Сид реестра `marked_rooms` из синканных lock-маркеров (Фаза 1.5, docs/decisions/done/marked-rooms.md).
// Меченый замок опознаём тем же классификатором `lockKind` из map-marker-icons.ts (точка правды).
// Идемпотентно: снести существующие kind='marked' (eft) → вставить свежие; kind='lab_color' НЕ трогаем.
//   npx tsx scripts/seed-marked-rooms.ts --dry   — превью без записи
//   npm run db:seed-marked-rooms                 — записать
import { config } from "dotenv";
config({ path: ".env.local" });

// Компактная RU→lat транслитерация для читаемого slug маршрута /eft/maps/<map>/rooms/<slug>.
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
const slugify = (s: string): string =>
  s.toLowerCase().split("").map((c) => TRANSLIT[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

// «Ключ от комнаты 314 общежития (Меченый)» → «Комнаты 314 общежития»
const cleanName = (label: string): string =>
  label.replace(/\s*\(Мечен[^)]*\)\s*$/i, "").replace(/^Ключ(-карта)?\s+(от\s+)?/i, "").trim();
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Явные override'ы по keyItemId — где авто-классификация/slug/title из label выходят кривыми.
// «Ключ-карта от склада TerraGroup»: содержит «карт» → lockKind='keycard', в marked-набор НЕ попадает,
// а у ключа-карты 2 лока (Завод 55f2… + Лаба 59fc…). Override и force-включает лок нужной карты,
// и задаёт человеческие slug/title. mapId фиксирует, какой из локов сеем комнатой.
const ROOM_OVERRIDES: Record<string, { slug: string; title: string; mapId: string }> = {
  "66acd6702b17692df20144c0": {
    slug: "sklad-terragroup",
    title: "Склад Terragroup",
    mapId: "55f2d3fd4bdc2d5f408b4567",
  },
};

async function main() {
  const dry = process.argv.includes("--dry");
  const { db } = await import("../src/db/index.ts");
  const { games, maps } = await import("../src/db/schema.ts");
  const { markers } = await import("../src/db/schema-markers.ts");
  const { markedRooms } = await import("../src/db/schema-marked-rooms.ts");
  const { lockKind } = await import("../src/data/map-marker-icons.ts");
  const { eq, and } = await import("drizzle-orm");

  const [eft] = await db.select().from(games).where(eq(games.code, "eft"));
  if (!eft) throw new Error("игра eft не найдена в БД");
  const mapIds = new Set((await db.select().from(maps)).map((m) => m.id));

  const locks = await db
    .select()
    .from(markers)
    .where(and(eq(markers.source, "sync"), eq(markers.type, "lock")));
  // Лок сеем комнатой, если lockKind='marked' ИЛИ он назван в override'е (тогда пиннится по mapId,
  // чтобы из нескольких локов одного ключа взять именно нужную карту).
  const marked = locks.filter((m) => {
    const ov = m.linkedItemId ? ROOM_OVERRIDES[m.linkedItemId] : undefined;
    if (ov) return m.mapId === ov.mapId;
    return lockKind({ category: m.category ?? undefined, label: m.label ?? undefined } as never) === "marked";
  });

  const seen = new Set<string>();
  const rows: (typeof markedRooms.$inferInsert)[] = [];
  const skipped: string[] = [];
  for (const m of marked) {
    if (!m.mapId || !mapIds.has(m.mapId)) { skipped.push(`${m.label} — нет карты ${m.mapId}`); continue; }
    const override = m.linkedItemId ? ROOM_OVERRIDES[m.linkedItemId] : undefined;
    const base = cleanName(m.label ?? "");
    const title = override?.title ?? (cap(base) || (m.label ?? "Меченая комната"));
    let slug = override?.slug ?? (slugify(base) || `marked-${(m.linkedItemId ?? m.id).slice(-6)}`);
    if (seen.has(`${m.mapId}::${slug}`)) slug = `${slug}-${(m.linkedItemId ?? m.id).slice(-4)}`;
    seen.add(`${m.mapId}::${slug}`);
    rows.push({
      gameId: eft.id,
      mapId: m.mapId,
      slug,
      kind: "marked",
      keyItemId: m.linkedItemId ?? null,
      title,
      description: m.label ?? null, // сырое имя ключа — для трассировки; V4DYA уточнит названия/границы
    });
  }

  console.log(`marked-локов: ${marked.length} · к вставке: ${rows.length} · пропущено: ${skipped.length}\n`);
  for (const r of rows) {
    console.log(`  ${String(r.mapId).padEnd(24)} | ${r.slug.padEnd(30)} | key=${r.keyItemId ?? "∅"} | ${r.title}`);
  }
  if (skipped.length) console.log("\nпропуск:\n  " + skipped.join("\n  "));

  if (dry) { console.log("\n(dry — ничего не записано. Запуск: npm run db:seed-marked-rooms)"); process.exit(0); }

  await db.delete(markedRooms).where(and(eq(markedRooms.gameId, eft.id), eq(markedRooms.kind, "marked")));
  if (rows.length) await db.insert(markedRooms).values(rows);
  console.log(`\n✅ засеяно marked_rooms (kind='marked'): ${rows.length}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
