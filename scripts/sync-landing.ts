// CLI: засинхронить achievements/maps/traders из tarkov.dev. Запуск: npm run db:sync-landing
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { syncEftLandingData } = await import("../src/db/landing.ts");
  const r = await syncEftLandingData();
  console.log(`ГОТОВО: achievements=${r.achievements}, maps=${r.maps}, traders=${r.traders}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
