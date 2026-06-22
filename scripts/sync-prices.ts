// CLI: засинхронить цены EFT из tarkov.dev в нашу таблицу `prices`.
// Запуск: npm run db:sync-prices  (для первичного сида и ручного обновления).
// В проде то же делает крон /api/cron/sync-prices по расписанию vercel.json.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Импорт ПОСЛЕ config() — db-модуль читает DATABASE_URL лениво при первом запросе.
  const { syncEftPrices } = await import("../src/db/prices.ts");
  const r = await syncEftPrices();
  console.log(`ГОТОВО: цены засинхронены из tarkov.dev, items=${r.items}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
