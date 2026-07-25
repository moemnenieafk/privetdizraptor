// Прогоняет ВСЕ src/db/*-ddl.ts (таблицы разделов вне schema.ts: Связь/comlink,
// codex, media, stories, comments, weapons-builds, verification, subscriptions, …).
// Все стейтменты идемпотентны (create/index if not exists) → безопасно гонять всегда.
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
  let pending = stmts;
  for (let pass = 1; pass <= 4 && pending.length; pass++) {
    const failed: typeof pending = [];
    for (const item of pending) {
      try {
        await sql.unsafe(item.sql);
      } catch (e) {
        failed.push(item);
        if (pass === 4) console.error(`✗ [${item.group}] ${(e as Error).message}\n   ${item.sql.slice(0, 100)}`);
      }
    }
    console.log(`pass ${pass}: ok ${pending.length - failed.length}, failed ${failed.length}`);
    if (failed.length === pending.length) break; // нет прогресса → дальше бессмысленно
    pending = failed;
  }

  await sql.end();
  if (pending.length) {
    console.error(`❌ осталось нерешённых стейтментов: ${pending.length}`);
    process.exit(1);
  }
  console.log("✓ все DDL-модули применены");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
