// ОДНОРАЗОВЫЙ импорт ручной разметки V4DYA в editorial_markers (чтобы метки вернулись
// на factory-hd И стали редактируемыми визардом). Пиксель холста 16384² → CRS.Simple:
// x = px / 2^maxZoom, z = -py / 2^maxZoom (maxZoom=6 → /64). Идемпотентно: сперва чистит
// все editorial factory-hd, потом вставляет из датасета.
// ⚠️ ПОВТОРНЫЙ запуск ЗАТРЁТ правки, сделанные визардом (это миграция стартового набора).
// Запуск: npx tsx scripts/seed-markers-hd.ts
import { config } from "dotenv"; config({ path: ".env.local" });
import { readFile } from "node:fs/promises";

const MAP_ID = "factory-hd";
const S = 64; // 2^maxZoom(6)
const FLOOR: Record<string, number> = { ground: 0, second: 1, third: 2, basement: 3 };
const TYPE: Record<string, { type: string; title: string }> = {
  extract: { type: "extract", title: "Выход" },
  transit: { type: "transit", title: "Переход" },
  spawn: { type: "spawn", title: "Спавн" },
  loot: { type: "loot_loose", title: "Лут" },
  container: { type: "loot_container", title: "Контейнер" },
  lock: { type: "lock", title: "Замок" },
  keydoor: { type: "lock", title: "Дверь-ключ" },
};

async function main() {
  const { getEditorialMarkers, deleteEditorialMarker, upsertEditorialMarker } = await import("../src/db/editorial-markers.ts");
  const { eftGameId } = await import("../src/db/eft.ts");
  const gameId = await eftGameId();

  // чистим прошлый набор (идемпотентность)
  const existing = await getEditorialMarkers(MAP_ID);
  for (const r of existing) await deleteEditorialMarker(r.id);
  console.log(`очищено прошлых editorial ${MAP_ID}: ${existing.length}`);

  const data: Record<string, { type: string; x: number; y: number }[]> =
    JSON.parse(await readFile(`public/maps/${MAP_ID.replace("-hd", "")}/markers/factory-markers.json`, "utf8"));

  let n = 0;
  const byType: Record<string, number> = {};
  for (const [floor, arr] of Object.entries(data)) {
    for (const m of arr) {
      const meta = TYPE[m.type];
      if (!meta) continue;
      await upsertEditorialMarker({
        gameId, mapId: MAP_ID,
        x: +(m.x / S).toFixed(4), z: +(-m.y / S).toFixed(4), y: null,
        floor: FLOOR[floor] ?? 0,
        type: meta.type, category: null, faction: null,
        title: meta.title, description: null, screenshots: [],
        linkKind: "none", linkId: null, linkStep: null,
        polygon: null, sourceMarkerId: null, hidden: false, authorId: null,
      });
      n++; byType[meta.type] = (byType[meta.type] || 0) + 1;
    }
  }
  console.log(`засеяно editorial: ${n} · по типам: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
