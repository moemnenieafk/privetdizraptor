// Live-verify Ф4-ридеров единой `markers` (docs/decisions/unified-markers.md) ДО катовера:
// вызывает РЕАЛЬНЫЕ getEftMapData/getEditorialMarkers против прод-данных, проверяет форму/счётчики.
// Read-only. Запуск: npx tsx scripts/verify-readers.ts [slug]
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { getEftMapData } = await import("../src/db/maps.ts");
  const { getEditorialMarkers } = await import("../src/db/editorial-markers.ts");
  const slug = process.argv[2] ?? "customs";

  const data = await getEftMapData(slug);
  if (!data) {
    console.error(`✗ нет данных для «${slug}» (getEftMapData вернул null)`);
    process.exit(1);
  }
  const byType = new Map<string, number>();
  let nullPos = 0;
  let nullId = 0;
  for (const m of data.markers) {
    byType.set(m.type, (byType.get(m.type) ?? 0) + 1);
    if (!m.position) nullPos++;
    if (!m.id) nullId++;
  }
  console.log(`Карта «${slug}» (${data.name}): markers(sync) = ${data.markers.length}`);
  console.log("  по типам:", Object.fromEntries([...byType].sort((a, b) => b[1] - a[1])));
  console.log(`  без позиции: ${nullPos} (боссы/зоны — ок), без id: ${nullId} ${nullId === 0 ? "✓" : "✗ ПУСТОЙ id!"}`);

  const ed = await getEditorialMarkers(data.asset.mapId);
  console.log(`  editorial(user) = ${ed.length}`);
  for (const e of ed.slice(0, 5)) {
    console.log(`    • type=${e.type} title="${e.title}" override=${e.sourceMarkerId ? e.sourceMarkerId.slice(0, 10) : "—"} x=${e.x} z=${e.z}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
