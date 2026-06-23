// Скачивает SVG-подложки интерактивных карт (the-hideout/tarkov-dev-svg-maps, CDN
// assets.tarkov.dev) в public/images/maps/eft/{slug}.svg и заливает в Supabase Storage
// (бакет cta-media, ключ maps/eft/{slug}.svg). Запуск: npm run db:upload-maps
//
// ⚠️ Подложки — авторский арт (Shebuka и др.) под CC BY-NC-SA: используем как
// некоммерческое зеркало с обязательной атрибуцией (author/authorLink в map_assets
// выводятся на странице карты). Координаты маркеров — отдельная чистая (MIT) сущность.
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EFT_MAP_CONFIG } from "../src/data/eft-map-config.ts";

const BUCKET = "cta-media";
const PREFIX = "maps/eft";
const SRC_CDN = "https://assets.tarkov.dev/maps/svg";
const LOCAL_DIR = "public/images/maps/eft";

async function main() {
  const targets = Object.values(EFT_MAP_CONFIG).filter((c) => c.svgFile);
  console.log(`карт с SVG-подложкой: ${targets.length}`);

  mkdirSync(LOCAL_DIR, { recursive: true });

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const bucket = admin.storage.from(BUCKET);

  let done = 0;
  let failed = 0;
  for (const cfg of targets) {
    const key = `${cfg.slug}.svg`;
    try {
      const r = await fetch(`${SRC_CDN}/${cfg.svgFile}`);
      if (!r.ok) throw new Error(`CDN HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(path.join(LOCAL_DIR, key), buf); // локальный фолбэк /public
      const { error } = await bucket.upload(`${PREFIX}/${key}`, buf, {
        contentType: "image/svg+xml",
        upsert: true,
      });
      if (error) throw error;
      done++;
      console.log(`  ✓ ${cfg.slug} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${cfg.slug}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`ГОТОВО: залито ${done}, ошибок ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
