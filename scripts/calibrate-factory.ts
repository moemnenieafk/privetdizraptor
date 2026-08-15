// Калибровка game→canvas для тайловой карты по «маркерам-опорам»: куратор ставит POI-метки точно
// на приметные места арта и называет каждую ИМЕНЕМ СКРИНШОТА EFT (в нём зашиты игровые x,y,z).
// Скрипт читает метки карты, парсит игровые координаты из title, пару (game ↔ canvas=marker.x/z)
// прогоняет через solveAffine → печатает worldTransform [a,b,c,d,e,f] + невязку по каждой точке.
// Вставь итоговый worldTransform в EFT_MAP_CONFIG.<map>. Решение: docs/decisions/marker-by-screenshot.md.
//
// Запуск:  npx tsx scripts/calibrate-factory.ts [mapId=factory]
import { config } from "dotenv";
config({ path: ".env.local" });

import { getEditorialMarkers } from "../src/db/editorial-markers";
import { parseScreenshotName } from "../src/lib/eft-screenshot";
import { solveAffine, applyAffine, maxResidual, type CalibPoint, type WorldTransform as WT } from "../src/lib/map-calibration";

async function main() {
  const mapId = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "factory";
  const rows = await getEditorialMarkers(mapId);
  const pts: (CalibPoint & { title: string; floor: number | null })[] = [];
  for (const m of rows) {
    const pose = parseScreenshotName(m.title);
    if (!pose) continue; // обычная POI без координат в имени — пропуск
    pts.push({ gameX: pose.x, gameZ: pose.z, canvasX: m.x, canvasY: m.z, title: m.title, floor: m.floor });
  }

  console.log(`\n🗺  Калибровка ${mapId}: найдено маркеров-опор ${pts.length} (из ${rows.length} меток карты)\n`);
  if (pts.length < 3) {
    console.error("❌ Нужно ≥3 маркера с именем-скриншотом (расставь и назови их именами PNG из папки).");
    process.exit(1);
  }

  const REJECT = 3.0; // порог «чистой» точки (единицы холста ≈ 1.7 ед/м → ~1.8 м)

  const resid = (tr: WT, p: (typeof pts)[number]) => {
    const q = applyAffine(tr, p.gameX, p.gameZ);
    return Math.hypot(q.x - p.canvasX, q.z - p.canvasY);
  };

  // Итеративная отбраковка: фит → пока худшая точка > REJECT и точек > 3, убираем ОДНУ худшую и пересчёт.
  // Так уходят настоящие выбросы по одному, а годные точки не выкидываются шумным стартовым фитом.
  let kept = [...pts];
  let t = solveAffine(kept);
  if (!t) {
    console.error("❌ Точки коллинеарны/вырождены — разнеси опоры пошире по карте.");
    process.exit(1);
  }
  while (kept.length > 3) {
    let wi = 0;
    let we = -1;
    kept.forEach((p, i) => {
      const e = resid(t as WT, p);
      if (e > we) { we = e; wi = i; }
    });
    if (we <= REJECT) break;
    kept.splice(wi, 1);
    const tn = solveAffine(kept);
    if (!tn) break;
    t = tn;
  }
  const dropped = pts.filter((p) => !kept.includes(p));

  console.log("worldTransform (по чистым точкам):");
  console.log(`  [${t.map((n) => Number(n.toFixed(6))).join(", ")}]\n`);
  console.log("Невязка по ВСЕМ точкам (ед. холста, ~1.7/м):");
  for (const p of pts) {
    const err = resid(t, p);
    const flag = err > REJECT ? "  ⚠ ОТБРОШЕНА — переставь/удали эту метку" : "";
    console.log(`  ${err.toFixed(2).padStart(6)}  этаж ${String(p.floor ?? "—").padEnd(2)}  ${p.title.slice(0, 58)}${flag}`);
  }
  console.log(`\n  Использовано ${kept.length}/${pts.length} точек. Макс. невязка по чистым: ${maxResidual(t, kept).toFixed(2)} (хорошо < ~2–3).`);
  if (dropped.length) console.log(`  Отброшено ${dropped.length} — их лучше переставить точнее или удалить.`);
  console.log("");
}

main()
  .then(() => process.exit(0)) // DB-пул держит процесс живым — выходим явно
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
