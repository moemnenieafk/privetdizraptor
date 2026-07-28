/**
 * Аудит RLS: какие публичные таблицы реально существуют в базе и включён ли на них
 * row level security. Читает ТОЛЬКО системный каталог Postgres, ничего не меняет.
 *
 * Поводом стало письмо линтера Supabase «RLS Disabled in Public» (2026-07-26):
 * список в письме короче реального, и сверять глазами по supabase/*.sql ненадёжно —
 * таблица может быть заведена в ddl-модуле и не попасть ни в один RLS-скрипт.
 *
 * Запуск: npx tsx scripts/audit-rls.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

async function main() {
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL не задан");

const sql = postgres(url, { prepare: false });

const rows = await sql<{ table_name: string; rls: boolean; policies: number }[]>`
  select c.relname            as table_name,
         c.relrowsecurity     as rls,
         count(p.polname)::int as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname, c.relrowsecurity
  order by c.relrowsecurity asc, c.relname asc
`;

const off = rows.filter((r) => !r.rls);
const on = rows.filter((r) => r.rls);

console.log(`Публичных таблиц в базе: ${rows.length}`);
console.log(`  RLS включён:  ${on.length}`);
console.log(`  RLS ВЫКЛЮЧЕН: ${off.length}`);

if (off.length) {
  console.log(`\n⚠️ БЕЗ RLS (любой с anon-ключом может писать через PostgREST):`);
  for (const r of off) console.log(`   ${r.table_name}`);
}

const noPolicy = on.filter((r) => r.policies === 0);
if (noPolicy.length) {
  console.log(`\nRLS включён, но политик нет (значит доступ закрыт полностью):`);
  for (const r of noPolicy) console.log(`   ${r.table_name}`);
}

await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
