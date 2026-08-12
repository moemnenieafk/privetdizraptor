// Проекция quest_zone Завода(день) на factory-hd: world→пиксель по калибровке + этаж по world-Y.
// Пишет public/maps/factory/markers/factory-hd-quests.json (сгруппировано по этажам, как ручной
// factory-markers.json), провенанс отдельно (авто-регенерируемый). Запуск: npx tsx scripts/project-factory-quests.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFile, writeFile } from "node:fs/promises";

const FACTORY_DAY = "55f2d3fd4bdc2d5f408b4567";
const CALIB = "public/maps/factory/markers/factory-hd-calibration.json";
const OUT = "public/maps/factory/markers/factory-hd-quests.json";

// world-Y → этаж-строка (полосы из интерактивного factory config: ground[-1,3] 2-й[3,6] 3-й[6,∞] тоннели[-∞,-1]).
function floorForY(y) {
  if (y == null) return "ground";
  if (y < -1) return "basement";
  if (y < 3) return "ground";
  if (y < 6) return "second";
  return "third";
}

async function main() {
  const calib = JSON.parse(await readFile(CALIB, "utf8"));
  const A = calib.affine; // [a,b,c,d,e,f]: px=ax+bz+c, py=dx+ez+f
  const apply = (x, z) => [A[0] * x + A[1] * z + A[2], A[3] * x + A[4] * z + A[5]];

  const { db } = await import("../src/db/index.ts");
  const { sql } = await import("drizzle-orm");
  const res = await db.execute(
    sql`select label, linked_quest_id, position from map_markers
        where map_id = ${FACTORY_DAY} and type = 'quest_zone' order by label`,
  );
  const rows = Array.isArray(res) ? res : res.rows ?? [];

  const out = { ground: [], second: [], third: [], basement: [] };
  const perFloor = {};
  let n = 0;
  for (const r of rows) {
    const p = r.position;
    if (!p || p.x == null || p.z == null) continue;
    const [px, py] = apply(p.x, p.z);
    // клэмп в холст 16384² (на всякий, если зона у самого края)
    const cx = Math.min(16383, Math.max(0, px));
    const cy = Math.min(16383, Math.max(0, py));
    const floor = floorForY(p.y);
    out[floor].push({
      type: "quest",
      x: +cx.toFixed(1),
      y: +cy.toFixed(1),
      linkId: r.linked_quest_id,
      label: r.label ?? null,
    });
    perFloor[floor] = (perFloor[floor] || 0) + 1;
    n++;
  }

  await writeFile(OUT, JSON.stringify(out, null, 2), "utf8");
  console.log(`Спроецировано quest_zone: ${n}`);
  console.log("По этажам:", Object.entries(perFloor).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log("Уникальных квестов:", new Set(rows.map((r) => r.linked_quest_id)).size);
  console.log(`Файл → ${OUT}`);
  // Примеры по этажам
  for (const f of ["ground", "second", "third", "basement"]) {
    const s = out[f].slice(0, 4).map((m) => `${JSON.stringify(m.label)}@[${m.x},${m.y}]`).join(", ");
    if (out[f].length) console.log(`  ${f} (${out[f].length}): ${s}${out[f].length > 4 ? " …" : ""}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
