// CLI: засинхронить требования апгрейдов убежища из tarkov.dev в `hideout_upgrades`.
// Запуск: npm run db:sync-hideout (первичный сид / ручное обновление после вайпа).
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { syncEftHideout } = await import("../src/db/hideout.ts");
  const r = await syncEftHideout();
  console.log(`ГОТОВО: станций=${r.stations}, апгрейдов=${r.upgrades}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
