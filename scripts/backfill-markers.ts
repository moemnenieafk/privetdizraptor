// Ф3 единой системы маркеров (docs/decisions/unified-markers.md): РАЗОВЫЙ бэкфилл
// map_markers + editorial_markers → единая `markers`. Запуск ПОСЛЕ `db:migrate-all` (Ф1 накат),
// ДО катовера ридеров (Ф4). Идемпотентен (WHERE NOT EXISTS — повторный прогон не дублит, НЕ truncate),
// обратим (откат = `delete from markers`). Гоняется вручную: `npx tsx scripts/backfill-markers.ts`.
//
// Маппинг (как в markers-ddl.ts): synced id → external_id; position jsonb → x/y/z; outline → polygon.
// ВОКАБУЛЯР типов НЕ ремапим: для мерж-рендерера (Б) каждый source рендерится в СВОём вокабуляре
// (sync — synced-имена, user — editorial-имена loot/container/stationary), ридер ветвится по source;
// кросс-вокабуляр для drawer-дериваций делает мост Ф0 (editorial-bridge.ts). Override-связь сохраняется
// САМА: editorial.source_marker_id = старый map_markers.id = markers(sync).external_id (значения не меняем).
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const postgres = (await import("postgres")).default;
  const url = process.env.DATABASE_URL_SESSION;
  if (!url) throw new Error("DATABASE_URL_SESSION не задан в .env.local");
  const sql = postgres(url, { prepare: false, onnotice: () => {} });

  // Санити: таблица markers должна существовать (Ф1 накат). Иначе — стоп с понятным сообщением.
  const [{ exists: hasMarkers }] = await sql<{ exists: boolean }[]>`
    select exists (select 1 from information_schema.tables
      where table_schema='public' and table_name='markers') as exists`;
  if (!hasMarkers) {
    console.error("❌ таблицы public.markers нет — сперва: npm run db:migrate-all (Ф1 накат)");
    await sql.end();
    process.exit(1);
  }

  const before = await sql<{ source: string; n: bigint }[]>`
    select source, count(*)::bigint as n from public.markers group by source`;
  console.log("markers ДО:", Object.fromEntries(before.map((r) => [r.source, Number(r.n)])) || {});

  // ── source='sync' ← map_markers (position jsonb → x/y/z; outline → polygon; id → external_id) ──
  const syncRes = await sql`
    insert into public.markers
      (game_id, map_id, source, external_id, type, x, y, z, top, bottom, polygon,
       label, faction, sides, categories, linked_item_id, linked_quest_id, meta, synced_at)
    select
      mm.game_id, mm.map_id, 'sync', mm.id, mm.type,
      (mm.position->>'x')::real, (mm.position->>'y')::real, (mm.position->>'z')::real,
      mm.top, mm.bottom, mm.outline,
      mm.label, mm.faction, mm.sides, mm.categories, mm.linked_item_id, mm.linked_quest_id, mm.meta, mm.synced_at
    from public.map_markers mm
    where not exists (
      select 1 from public.markers m
      where m.source='sync' and m.map_id = mm.map_id and m.external_id = mm.id
    )`;
  console.log(`  sync ← map_markers: +${syncRes.count}`);

  // ── source='user' ← editorial_markers (uuid сохраняем как id; вокабуляр → synced-имена) ──
  const userRes = await sql`
    insert into public.markers
      (id, game_id, map_id, source, type, floor, x, y, z, polygon,
       category, faction, title, description, screenshots, link_kind, link_id, link_step,
       source_marker_id, hidden, author_id, created_at, updated_at)
    select
      em.id, em.game_id, em.map_id, 'user', em.type,
      em.floor, em.x, em.y, em.z, em.polygon,
      em.category, em.faction, em.title, em.description, em.screenshots, em.link_kind, em.link_id, em.link_step,
      em.source_marker_id, em.hidden, em.author_id, em.created_at, em.updated_at
    from public.editorial_markers em
    where not exists (select 1 from public.markers m where m.id = em.id)`;
  console.log(`  user ← editorial_markers: +${userRes.count}`);

  const after = await sql<{ source: string; n: bigint }[]>`
    select source, count(*)::bigint as n from public.markers group by source`;
  console.log("markers ПОСЛЕ:", Object.fromEntries(after.map((r) => [r.source, Number(r.n)])));

  await sql.end();
  console.log("✓ бэкфилл готов. Сверь: sync ≈ строки map_markers, user ≈ строки editorial_markers.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
