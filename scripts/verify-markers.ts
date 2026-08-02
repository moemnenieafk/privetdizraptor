// Верификация Ф3-бэкфилла единой `markers` (docs/decisions/unified-markers.md): сверка счётчиков,
// сохранности override-связей (source_marker_id → external_id sync-строки) и ремапа вокабуляра.
// Read-only. Запуск: npx tsx scripts/verify-markers.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const postgres = (await import("postgres")).default;
  const url = process.env.DATABASE_URL_SESSION;
  if (!url) throw new Error("DATABASE_URL_SESSION не задан в .env.local");
  const sql = postgres(url, { prepare: false, onnotice: () => {} });

  const [mm] = await sql<{ n: number }[]>`select count(*)::int n from public.map_markers`;
  const [em] = await sql<{ n: number }[]>`select count(*)::int n from public.editorial_markers`;
  const [msync] = await sql<{ n: number }[]>`select count(*)::int n from public.markers where source='sync'`;
  const [muser] = await sql<{ n: number }[]>`select count(*)::int n from public.markers where source='user'`;
  const [ov] = await sql<{ n: number }[]>`select count(*)::int n from public.markers where source='user' and source_marker_id is not null`;
  const [ovok] = await sql<{ n: number }[]>`
    select count(*)::int n from public.markers u
    where u.source='user' and u.source_marker_id is not null
      and exists (select 1 from public.markers s where s.source='sync' and s.external_id = u.source_marker_id)`;
  const remap = await sql<{ type: string; n: number }[]>`
    select type, count(*)::int n from public.markers where source='user' group by type order by n desc`;
  const [nullpos] = await sql<{ n: number }[]>`select count(*)::int n from public.markers where source='sync' and x is null`;

  console.log("СЧЁТЧИКИ:");
  console.log(`  map_markers ${mm.n}  →  markers(sync) ${msync.n}   ${mm.n === msync.n ? "✓" : "✗ РАСХОЖДЕНИЕ"}`);
  console.log(`  editorial   ${em.n}  →  markers(user) ${muser.n}   ${em.n === muser.n ? "✓" : "✗ РАСХОЖДЕНИЕ"}`);
  console.log(`OVERRIDE-СВЯЗИ (source_marker_id → sync.external_id):`);
  console.log(`  user с override: ${ov.n}, из них резолвятся в sync: ${ovok.n}   ${ov.n === ovok.n ? "✓ все связаны" : "✗ ОТВЯЗАЛИСЬ"}`);
  console.log(`ВОКАБУЛЯР user-типов (ожидаем НАТИВНЫЙ editorial: loot/container/stationary — НЕ ремапим для Б):`);
  for (const r of remap) console.log(`  ${r.type}: ${r.n}`);
  console.log(`sync без координат (боссы/зоны, ожидаемо >0): ${nullpos.n}`);

  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
