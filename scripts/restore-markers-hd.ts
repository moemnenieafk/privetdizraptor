// ВОССТАНОВЛЕНИЕ user-меток factory-hd из снапшота (scripts/data/factory-hd-markers.snapshot.json)
// в БД — аварийное восстановление кураторской выверки после вайпа (db:push --force / каскад строки
// maps / чужой seed). Заливает ТВОЙ актуальный набор из последнего dump'а, а не устаревший стартовый
// из factory-markers.json (это ключевое отличие от seed:factory-hd).
//
// Идемпотентно: сперва чистит все editorial factory-hd, потом вставляет из снапшота (полные поля,
// включая lootItems лут-пулов). Строку maps(factory-hd) при необходимости вернёт seed-map-hd.
// Запуск: npm run restore:factory-hd
import { config } from "dotenv"; config({ path: ".env.local" });
import { readFile } from "node:fs/promises";

// ПОСЛЕ ПРОМОУТА (2026-08-13): восстанавливаем боевой slug 'factory' из factory-markers.snapshot.json.
// Историч. factory-hd-markers.snapshot.json (446, до промоута) — для аварийного отката промоута вручную.
const MAP_ID = "factory";
const SNAP = `scripts/data/${MAP_ID}-markers.snapshot.json`;

type SnapMarker = {
  x: number; z: number; y: number | null; floor: number | null;
  type: string; category: string | null; faction: string | null;
  title: string; description: string | null; screenshots: string[];
  linkKind: string; linkId: string | null; linkStep: number | null;
  polygon: { x: number; z: number }[] | null; sourceMarkerId: string | null;
  hidden: boolean; lootItems: string[] | null;
};

async function main() {
  const { getEditorialMarkers, deleteEditorialMarker, upsertEditorialMarker } = await import("../src/db/editorial-markers.ts");
  const { eftGameId } = await import("../src/db/eft.ts");

  let snapshot: { markers: SnapMarker[]; count?: number };
  try {
    snapshot = JSON.parse(await readFile(SNAP, "utf8"));
  } catch {
    console.error(`❌ нет снапшота ${SNAP} — сначала прогони "npm run dump:factory-hd" (или чистый старт — "npm run seed:factory-hd").`);
    process.exit(1);
  }
  const markers = snapshot.markers ?? [];
  if (markers.length === 0) {
    console.error(`❌ снапшот пуст (${SNAP}) — восстанавливать нечего. Проверь файл.`);
    process.exit(1);
  }

  const gameId = await eftGameId();
  const existing = await getEditorialMarkers(MAP_ID);
  for (const r of existing) await deleteEditorialMarker(r.id);
  console.log(`очищено прошлых editorial ${MAP_ID}: ${existing.length}`);

  let n = 0;
  const byType: Record<string, number> = {};
  for (const m of markers) {
    await upsertEditorialMarker({
      gameId, mapId: MAP_ID,
      x: m.x, z: m.z, y: m.y, floor: m.floor,
      type: m.type, category: m.category, faction: m.faction,
      title: m.title, description: m.description, screenshots: m.screenshots ?? [],
      linkKind: m.linkKind as never, linkId: m.linkId, linkStep: m.linkStep,
      polygon: m.polygon, sourceMarkerId: m.sourceMarkerId, hidden: m.hidden ?? false,
      lootItems: m.lootItems ?? null, authorId: null,
    });
    n++; byType[m.type] = (byType[m.type] || 0) + 1;
  }
  console.log(`✅ восстановлено из снапшота: ${n} меток · по типам: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
