// CLI: зеркалит недостающие 512px-иконки EFT из tarkov.dev в Supabase Storage.
// Запуск: npm run db:sync-icons  (ручной прогон / первичная заливка уже отрисованных).
// В проде то же делает best-effort крон /api/cron/sync-prices.
// Цели — src/data/icon-backfill-eft.json (ген. `node scripts/find-missing-icons.mjs`).
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { syncEftIcons } = await import("../src/db/icons.ts");
  const r = await syncEftIcons();
  console.log(
    `ГОТОВО: проверено ${r.iconsChecked}, готовы у tarkov.dev ${r.iconsReady}, ` +
      `залито ${r.iconsFilled}, ошибок ${r.iconsFailed}, ещё ждут ${r.iconsStillMissing}`,
  );
  process.exit(r.iconsFailed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
