// Заливает SVG-подложки интерактивных карт в Cloudflare R2 (S3-совместимый, бакет
// cta-media, ключ maps/eft/{slug}.svg) с immutable-кэшем на год. R2 не берёт плату за
// egress — снимает основной оставшийся сток Supabase Storage после переезда иконок.
//
// Источник — тот же, что у Supabase-версии (scripts/upload-map-assets.ts): CDN
// assets.tarkov.dev/maps/svg. Пишем и локальный фолбэк в public/images/maps/eft.
// После прогона задай в Vercel NEXT_PUBLIC_MAP_BASE_URL = тот же base, что и у иконок
// (NEXT_PUBLIC_ICON_BASE_URL) → mapImageUrl начнёт отдавать карты из R2.
//
// Запуск:  npx tsx scripts/upload-maps-r2.ts   (или npm run db:upload-maps-r2)
//
// ⚠️ Подложки — авторский арт (Shebuka и др.) под CC BY-NC-SA: некоммерческое зеркало
// с обязательной атрибуцией (author/authorLink в map_assets выводятся на странице карты).
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { EFT_MAP_CONFIG } from "../src/data/eft-map-config.ts";

const PREFIX = "maps/eft";
const SRC_CDN = "https://assets.tarkov.dev/maps/svg";
const LOCAL_DIR = "public/images/maps/eft";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("✗ Не хватает R2_* в .env.local (ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET)");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function main(): Promise<void> {
  // Статичные карты (наш арт) живут в /public, в R2 их не льём.
  const targets = Object.values(EFT_MAP_CONFIG).filter((c) => c.svgFile && !c.staticMap);
  console.log(`карт с SVG-подложкой: ${targets.length}`);

  mkdirSync(LOCAL_DIR, { recursive: true });

  let done = 0;
  let failed = 0;
  for (const cfg of targets) {
    const key = `${cfg.slug}.svg`;
    try {
      const r = await fetch(`${SRC_CDN}/${cfg.svgFile}`);
      if (!r.ok) throw new Error(`CDN HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(path.join(LOCAL_DIR, key), buf); // локальный фолбэк /public
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: `${PREFIX}/${key}`,
          Body: buf,
          ContentType: "image/svg+xml",
          CacheControl: CACHE_CONTROL,
        }),
      );
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
