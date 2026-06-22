// CLI: засинхронить achievements/maps/traders из tarkov.dev. Запуск: npm run db:sync-landing
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { syncEftLandingData } = await import("../src/db/landing.ts");
  const r = await syncEftLandingData();
  const note = (skipped: boolean) => (skipped ? ", ПРЮН ПРОПУЩЕН (частичный ответ?)" : "");
  console.log(
    `ГОТОВО: achievements=${r.achievements} (−${r.achievementsDeleted} стейл${note(r.achievementsPruneSkipped)}), ` +
      `maps=${r.maps} (−${r.mapsDeleted} стейл${note(r.mapsPruneSkipped)}), ` +
      `traders=${r.traders} (−${r.tradersDeleted} стейл${note(r.tradersPruneSkipped)})`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
