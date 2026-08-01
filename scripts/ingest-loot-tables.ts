// Локальный ингест loot-таблиц SPT → зеркало. Требует установленный SPT (SPT_DB_PATH или дефолт).
//   npm run db:ingest-loot -- --dry   — только нормализовать и показать статистику (БЕЗ записи в БД)
//   npm run db:ingest-loot            — записать в зеркало (loot_spawns + loot_container_pools)
// Решение: docs/decisions/heatmap-loot-ev-dataset.md
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const dry = process.argv.includes("--dry");
  const { ingestLootTables } = await import("../src/db/loot-tables.ts");
  console.log(dry ? "DRY-RUN (без записи в БД)\n" : "ИНГЕСТ в зеркало\n");
  const stats = await ingestLootTables({ dryRun: dry });

  let loose = 0, cont = 0;
  for (const s of stats) {
    if (s.skipped) { console.log(`  ⏭  ${s.map} (${s.slug}) — ${s.skipped}`); continue; }
    loose += s.loose; cont += s.containers;
    console.log(`  ✓ ${s.map.padEnd(14)} → ${s.slug.padEnd(18)} loose=${String(s.loose).padStart(5)}  container-типов=${s.containers}`);
  }
  console.log(`\nИТОГО: loose-точек=${loose}, container-пулов=${cont}, карт=${stats.filter((s) => !s.skipped).length}`);
  console.log(dry ? "\n(dry — ничего не записано. Реальный ингест: npm run db:ingest-loot)" : "\n✅ записано в зеркало");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
