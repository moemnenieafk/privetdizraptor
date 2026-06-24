// CLI: засинхронить зоны объективов квестов (map_markers type='quest_zone') из tarkov.dev.
// Требует уже синхронизированных карт (map_assets с imageKey). Запуск: npm run db:sync-quest-zones
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { syncEftQuestZones } = await import("../src/db/maps.ts");
  const r = await syncEftQuestZones();
  const skip = r.pruneSkipped ? " (прюн пропущен — пустой ответ?)" : "";
  console.log(`ГОТОВО: quest_zone=${r.zones} (−${r.deleted} стейл)${skip}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
