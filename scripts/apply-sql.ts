// Применяет все supabase/*.sql (идемпотентно, в алфавитном порядке).
//
// ⚠️ ЗАПУСКАТЬ ПОСЛЕ КАЖДОГО `npm run db:push`.
// drizzle-kit управляет только тем, что описано в schema.ts, и push --force
// ОТКАТЫВАЕТ всё остальное: RLS, политики, кросс-схемные FK (на auth.users),
// триггеры. Эти объекты живут в supabase/*.sql и накатываются этим скриптом.
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

async function main() {
  const postgres = (await import("postgres")).default;
  const url = process.env.DATABASE_URL_SESSION;
  if (!url) throw new Error("DATABASE_URL_SESSION не задан");

  const dir = path.join(process.cwd(), "supabase");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const sql = postgres(url, { prepare: false, onnotice: () => {} });
  for (const f of files) {
    await sql.unsafe(readFileSync(path.join(dir, f), "utf8"));
    console.log(`✓ применён ${f}`);
  }
  await sql.end();
  console.log("Готово.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
