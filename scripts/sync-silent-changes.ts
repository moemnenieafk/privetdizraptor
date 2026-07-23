// CLI: бэкфил «тихих изменений» BSG (changes.tarkov-changes.com) в таблицу `silent_changes`.
// Запуск: npm run db:sync-silent-changes [-- <кол-во_пулов>]  (по умолчанию 500 — вся история).
// В проде инкремент делает крон /api/cron/sync-silent-changes (по 8 новых за прогон).
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const arg = Number(process.argv[2]);
  const maxNewPulls = Number.isInteger(arg) && arg > 0 ? arg : 500;

  const { syncSilentChanges } = await import("../src/db/silent-changes.ts");
  const r = await syncSilentChanges({ maxNewPulls, delayMs: 400 });
  console.log(
    `ГОТОВО: в источнике пулов=${r.scannedPulls}, новых обработано=${r.newPulls}, вставлено строк=${r.inserted}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
