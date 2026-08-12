// ПРОЕКЦИЯ синканных меток боевого factory (зеркало map_markers, tarkov.dev) → editorial factory-hd.
// «Последний синк-сверка»: берём АКТУАЛЬНЫЕ метки игры (спавны/выходы/замки/контейнеры/лут) с их
// привязками, проецируем world→пиксель той же калибровкой, что и квесты (factory-hd-calibration.json),
// конвертируем в типы визарда → заливаем в БД (source='user', редактируемо). Позиции ПРИБЛИЗИТЕЛЬНЫЕ
// (калибровка ~2 юнита) — V4DYA доводит руками. Квесты НЕ трогаем (спроецированы отдельно).
//
// ⚠️ РЕШЕНИЕ V4DYA: ЗАМЕНА — сносит текущие user-метки factory-hd и заливает синканные. Старый набор
// уже в scripts/data/factory-hd-markers.snapshot.json (dump) → откат `npm run restore:factory-hd`.
// Квест-метки (linkKind='quest') сохраняем (их источник — factory-hd-quests.json, отдельный конвейер).
// Запуск: npm run project:factory-synced
import { config } from "dotenv"; config({ path: ".env.local" });
import { readFile, writeFile } from "node:fs/promises";

const MAP_ID = "factory-hd";
const FACTORY_DAY = "55f2d3fd4bdc2d5f408b4567";
const CALIB = "public/maps/factory/markers/factory-hd-calibration.json";
const SNAP = `scripts/data/${MAP_ID}-synced.snapshot.json`;
const S = 64; // 2^maxZoom(6): пиксель холста → CRS.Simple

// world-Y → floor (полосы как в project-factory-quests / интерактивный factory config)
const floorForY = (y: number | null) =>
  y == null ? 0 : y < -1 ? 3 : y < 3 ? 0 : y < 6 ? 1 : 2;

// faction синканного выхода → editorial extract category
const extractCat = (f: string | null) => (f === "scav" ? "scav" : f === "shared" ? "shared" : "pmc");

async function main() {
  const calib = JSON.parse(await readFile(CALIB, "utf8"));
  const A = calib.affine as number[]; // px=ax+bz+c, py=dx+ez+f
  const apply = (x: number, z: number) => [A[0] * x + A[1] * z + A[2], A[3] * x + A[4] * z + A[5]];
  // world (x,z) → editorial CRS (x=px/64, z=-py/64), с клэмпом в холст 16384²
  const toCrs = (wx: number, wz: number) => {
    const [px, py] = apply(wx, wz);
    const cx = Math.min(16383, Math.max(0, px));
    const cy = Math.min(16383, Math.max(0, py));
    return { x: +(cx / S).toFixed(4), z: +(-cy / S).toFixed(4) };
  };

  const { db } = await import("../src/db/index.ts");
  const { sql } = await import("drizzle-orm");
  const res = await db.execute(
    sql`select type, label, faction, categories, position, outline, linked_item_id
        from map_markers where map_id=${FACTORY_DAY}
        and type in ('spawn','extract','lock','loot_container','loot_loose','boss','transit')`,
  );
  const rows = (Array.isArray(res) ? res : res.rows ?? []) as Record<string, unknown>[];

  type M = {
    floor: number; x: number; z: number; y: null;
    type: string; category: string | null; faction: string | null;
    title: string; description: null; screenshots: never[];
    linkKind: string; linkId: string | null; linkStep: null;
    polygon: { x: number; z: number }[] | null; sourceMarkerId: null;
    hidden: boolean; lootItems: string[] | null;
  };
  const markers: M[] = [];
  let skipped = 0;

  for (const r of rows) {
    const pos = r.position as { x: number; y: number; z: number } | null;
    if (!pos || pos.x == null || pos.z == null) { skipped++; continue; }
    const { x, z } = toCrs(pos.x, pos.z);
    const floor = floorForY(pos.y ?? null);
    const label = (r.label as string) || null;
    const item = (r.linked_item_id as string) || null;
    const cats = (r.categories as string[]) ?? [];

    const base = {
      floor, x, z, y: null as null, description: null, screenshots: [] as never[],
      linkStep: null as null, polygon: null as { x: number; z: number }[] | null,
      sourceMarkerId: null as null, hidden: false, lootItems: null as string[] | null,
      category: null as string | null, faction: null as string | null,
      linkKind: "none", linkId: null as string | null,
    };

    switch (r.type as string) {
      case "loot_loose": // → лут-пул визарда (1 предмет), имя из label
        markers.push({ ...base, type: "loot", title: label || "Лут", category: item, lootItems: item ? [item] : null });
        break;
      case "loot_container":
        markers.push({ ...base, type: "container", title: label || "Контейнер" });
        break;
      case "spawn":
        markers.push({ ...base, type: "spawn", category: cats.includes("boss") ? "boss" : "pmc", title: label && !/^[0-9a-f-]{36}$/.test(label) ? label : "Спавн" });
        break;
      case "boss":
        markers.push({ ...base, type: "spawn", category: "boss", title: label || "Босс" });
        break;
      case "extract": { // faction→category, outline→polygon (спроецированный), связь с ключом если есть
        const ol = (r.outline as { x: number; z: number }[] | null) ?? null;
        const poly = ol?.length ? ol.map((p) => toCrs(p.x, p.z)) : null;
        markers.push({
          ...base, type: "extract", category: extractCat(r.faction as string | null),
          faction: (r.faction as string) ?? null, title: label || "Выход", polygon: poly,
          linkKind: item ? "item" : "none", linkId: item,
        });
        break;
      }
      case "transit":
        markers.push({ ...base, type: "transit", title: label || "Переход" });
        break;
      case "lock": // замок→ключ: linked_item_id = ключ
        markers.push({ ...base, type: "lock", title: label || "Замок", linkKind: item ? "item" : "none", linkId: item });
        break;
      default: skipped++;
    }
  }

  const byType: Record<string, number> = {};
  for (const m of markers) byType[m.type] = (byType[m.type] || 0) + 1;

  await writeFile(SNAP, JSON.stringify({ mapId: MAP_ID, source: "synced-projection", exportedAt: new Date().toISOString(), count: markers.length, byType, markers }, null, 2) + "\n", "utf8");
  console.log(`🎯 спроецировано синканных → editorial: ${markers.length} (пропущено ${skipped})`);
  console.log(`   по типам: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`   снапшот → ${SNAP}`);

  // ЗАЛИВ (замена): сносим НЕ-квестовые user-метки, вставляем синканные. Квесты (linkKind='quest') целы.
  const { getEditorialMarkers, deleteEditorialMarker, upsertEditorialMarker } = await import("../src/db/editorial-markers.ts");
  const { eftGameId } = await import("../src/db/eft.ts");
  const gameId = await eftGameId();
  const existing = await getEditorialMarkers(MAP_ID);
  const nonQuest = existing.filter((r) => r.linkKind !== "quest");
  for (const r of nonQuest) await deleteEditorialMarker(r.id);
  console.log(`🗑  снесено старых не-квестовых: ${nonQuest.length} (квесты ${existing.length - nonQuest.length} сохранены)`);

  let n = 0;
  for (const m of markers) {
    await upsertEditorialMarker({
      gameId, mapId: MAP_ID, x: m.x, z: m.z, y: null, floor: m.floor,
      type: m.type, category: m.category, faction: m.faction,
      title: m.title, description: null, screenshots: [],
      linkKind: m.linkKind as never, linkId: m.linkId, linkStep: null,
      polygon: m.polygon, sourceMarkerId: null, hidden: false,
      lootItems: m.lootItems, authorId: null,
    });
    n++;
  }
  console.log(`✅ залито синканных: ${n}. Двигай позиции визардом; откат старых — npm run restore:factory-hd.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
