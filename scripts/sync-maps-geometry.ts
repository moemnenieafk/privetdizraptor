// CLI: засинхронить геометрию карт (map_assets/map_markers) из tarkov.dev.
// Требует, чтобы таблицы уже существовали (npm run db:push + db:sql). Запуск: npm run db:sync-maps-geometry
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { syncEftMapsGeometry } = await import("../src/db/maps.ts");
  const r = await syncEftMapsGeometry();
  const skip = r.markersPruneSkipped > 0 ? `, прюн пропущен у ${r.markersPruneSkipped} карт (частичный ответ?)` : "";
  console.log(
    `ГОТОВО: maps=${r.maps}, assets=${r.assets} (−${r.assetsDeleted} стейл), ` +
      `markers=${r.markers} (−${r.markersDeleted} стейл${skip})`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
