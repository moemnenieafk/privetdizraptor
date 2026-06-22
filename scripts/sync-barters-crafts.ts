// CLI: засинхронить бартеры+крафты из tarkov.dev в наши таблицы `barters`/`crafts`.
// Запуск: npm run db:sync-barters-crafts (первичный сид / ручное обновление).
// В проде то же делает крон /api/cron/sync-prices.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { syncEftBartersCrafts } = await import("../src/db/barters-crafts.ts");
  const r = await syncEftBartersCrafts();
  const note = (skipped: boolean) => (skipped ? ", ПРЮН ПРОПУЩЕН (частичный ответ?)" : "");
  console.log(
    `ГОТОВО: barters=${r.barters} (−${r.bartersDeleted} стейл${note(r.bartersPruneSkipped)}), ` +
      `crafts=${r.crafts} (−${r.craftsDeleted} стейл${note(r.craftsPruneSkipped)})`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
