// Заливка иконок предметов EFT в Supabase Storage (бакет cta-media, public).
// Ключи: items/eft/{inGameId}.webp. Резюмируемо: пропускает уже залитые.
// Запуск: npx tsx scripts/upload-icons.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const BUCKET = "cta-media";
const PREFIX = "items/eft";
const SRC_DIR = "public/images/items/eft";
const CONCURRENCY = 20;

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const bucket = admin.storage.from(BUCKET);

  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".webp"));
  console.log(`всего локальных иконок: ${files.length}`);

  // Уже залитые (для резюма) — листим пачками по 1000.
  const existing = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(PREFIX, { limit: 1000, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    data.forEach((o) => existing.add(o.name));
    if (data.length < 1000) break;
  }
  console.log(`уже в бакете: ${existing.size}`);

  const todo = files.filter((f) => !existing.has(f));
  console.log(`к заливке: ${todo.length}`);

  let done = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < todo.length) {
      const f = todo[cursor++];
      try {
        const buf = readFileSync(path.join(SRC_DIR, f));
        const { error } = await bucket.upload(`${PREFIX}/${f}`, buf, {
          contentType: "image/webp",
          upsert: true,
        });
        if (error) throw error;
      } catch {
        failed++;
      }
      done++;
      if (done % 250 === 0) console.log(`  …${done}/${todo.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(
    `ГОТОВО: успешно ${done - failed}, ошибок ${failed}, итого в бакете ~${existing.size + done - failed}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
