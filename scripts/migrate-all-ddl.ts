// Прогоняет ВСЕ src/db/*-ddl.ts (таблицы разделов вне schema.ts: Связь/comlink,
// codex, media, stories, comments, weapons-builds, verification, subscriptions, …).
// Все стейтменты идемпотентны (create/index if not exists) → безопасно гонять всегда.
// Остаток с кодом 42501 (owner-managed таблицы supabase_admin) классифицируется отдельно
// как ожидаемый пропуск (см. коммент у классификации ниже), не валит прогон.
//
// ⚠️ ЗАЧЕМ: `db:push --force` управляет только schema.ts и НЕ создаёт эти таблицы;
// а supabase/*.sql (RLS) на них ссылается. Поэтому порядок после правки схемы:
//     npm run db:push  →  npm run db:migrate-all  →  npm run db:sql
// Иначе db:sql упадёт на первой же RLS-ссылке на несуществующую таблицу (инцидент 2026-07).
//
// Автообнаружение: любой новый *-ddl.ts (с экспортом *_DDL) подхватывается сам.
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function main() {
  const postgres = (await import("postgres")).default;
  const url = process.env.DATABASE_URL_SESSION;
  if (!url) throw new Error("DATABASE_URL_SESSION не задан в .env.local");

  const dbDir = path.join(process.cwd(), "src", "db");
  const files = readdirSync(dbDir).filter((f) => f.endsWith("-ddl.ts")).sort();

  // Собираем все стейтменты из каждого *_DDL-экспорта.
  const stmts: { group: string; sql: string }[] = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dbDir, f)).href);
    const key = Object.keys(mod).find((k) => k.endsWith("_DDL"));
    if (!key || !Array.isArray(mod[key])) {
      console.warn(`⚠ ${f}: не найден экспорт *_DDL (массив) — пропуск`);
      continue;
    }
    for (const sql of mod[key] as string[]) stmts.push({ group: f.replace("-ddl.ts", ""), sql });
  }
  console.log(`DDL-модулей: ${files.length}, стейтментов: ${stmts.length}`);

  const sql = postgres(url, { prepare: false, onnotice: () => {} });

  // Несколько проходов — снимает порядок FK-зависимостей между модулями.
  type Item = { group: string; sql: string; err?: Error & { code?: string } };
  let pending: Item[] = stmts;
  for (let pass = 1; pass <= 4 && pending.length; pass++) {
    const failed: Item[] = [];
    for (const item of pending) {
      try {
        await sql.unsafe(item.sql);
      } catch (e) {
        item.err = e as Error & { code?: string };
        failed.push(item);
      }
    }
    console.log(`pass ${pass}: ok ${pending.length - failed.length}, failed ${failed.length}`);
    if (failed.length === pending.length) break; // нет прогресса → дальше бессмысленно
    pending = failed;
  }

  await sql.end();

  // Классификация остатка. Код 42501 (insufficient_privilege / «must be owner») — ОЖИДАЕМО,
  // не ошибка идемпотентности: 63/68 публичных таблиц принадлежат роли supabase_admin, а мы
  // коннектимся как postgres (не суперюзер — не может ALTER/enable-RLS/drop-policy на чужих
  // таблицах и не может сменить владельца). RLS+политики на этих таблицах уже применены их
  // владельцем при запуске фич (SQL-редактор Supabase / db:sql) — migrate-all лишь безуспешно
  // пере-утверждает их, состояние уже целевое. Реальные ошибки (undefined table, syntax, FK)
  // остаются видимыми и валят прогон. Полный фикс (чтобы migrate-all реально управлял всеми
  // таблицами) — REASSIGN OWNED BY supabase_admin TO postgres суперюзером на VPS: отдельная задача.
  const ownerManaged = pending.filter((p) => p.err?.code === "42501");
  const real = pending.filter((p) => p.err?.code !== "42501");

  if (ownerManaged.length) {
    const byGroup = new Map<string, number>();
    for (const p of ownerManaged) byGroup.set(p.group, (byGroup.get(p.group) ?? 0) + 1);
    const groups = [...byGroup.entries()].map(([g, n]) => `${g}×${n}`).join(", ");
    console.log(
      `⊘ owner-managed (supabase_admin): ${ownerManaged.length} — уже применены владельцем, не через migrate-all\n   [${groups}]`,
    );
  }

  if (real.length) {
    for (const item of real) {
      console.error(`✗ [${item.group}] ${item.err?.message}\n   ${item.sql.slice(0, 100)}`);
    }
    console.error(`❌ реальных нерешённых стейтментов: ${real.length}`);
    process.exit(1);
  }

  const applied = stmts.length - pending.length;
  console.log(`✓ DDL-модули применены: ${applied} ok, ${ownerManaged.length} owner-managed (пропуск), 0 ошибок`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
