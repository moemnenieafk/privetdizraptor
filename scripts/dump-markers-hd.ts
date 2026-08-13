// ЭКСПОРТ-СНАПШОТ user-меток factory-hd из БД в трекаемый файл (бэкап кураторской выверки).
// БД = живой источник правды (правки идут визардом); dump фиксирует её состояние в git, чтобы
// авария (db:push --force / каскад строки maps / чужой seed) не стёрла ручную работу безвозвратно.
//
// Процесс: выверяешь метки визардом → `npm run dump:factory-hd` → коммит снапшота. Восстановление —
// `npm run restore:factory-hd` (заливает ТВОЙ актуальный набор, не устаревший стартовый из seed).
//
// Снимок ПОЛНЫЙ: все поля метки (title/category/lootItems/floor/linkKind/polygon…), а не бедный
// {type,x,y} из factory-markers.json — иначе восстановление потеряло бы лут-пулы и правки.
// Кладём в scripts/ (public/maps/** в .gitignore → туда бэкап нельзя).
// Запуск: npm run dump:factory-hd
import { config } from "dotenv"; config({ path: ".env.local" });
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// ПОСЛЕ ПРОМОУТА (2026-08-13, docs/decisions/factory-hd-promote.md): editorial-метки живут под боевым
// slug 'factory' → бэкапим ЕГО. Старый scripts/data/factory-hd-markers.snapshot.json (446, до промоута)
// оставлен как историч. бэкап; новый OUT — factory-markers.snapshot.json (не затирает старый).
const MAP_ID = "factory";
const OUT = `scripts/data/${MAP_ID}-markers.snapshot.json`;

async function main() {
  const { getEditorialMarkers } = await import("../src/db/editorial-markers.ts");
  const rows = await getEditorialMarkers(MAP_ID);

  // id/mapId/gameId отбрасываем (restore проставит свои); остальное — 1:1 для точного round-trip.
  const markers = rows
    .map(({ id: _id, mapId: _mapId, gameId: _gameId, ...rest }) => rest)
    .sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0) || a.type.localeCompare(b.type) || a.x - b.x);

  const byType: Record<string, number> = {};
  for (const m of markers) byType[m.type] = (byType[m.type] || 0) + 1;

  const snapshot = {
    mapId: MAP_ID,
    exportedAt: new Date().toISOString(),
    count: markers.length,
    byType,
    markers,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(`💾 снапшот ${MAP_ID}: ${markers.length} меток → ${OUT}`);
  console.log(`   по типам: ${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`   закоммить файл, чтобы выверка была защищена от вайпа.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
