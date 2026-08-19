// Заливает иконки достижений (public/images/achievements/eft/{id}.webp) в Cloudflare R2
// (S3-совместимый, бакет cta-media, ключ achievements/eft/{id}.webp) с immutable-кэшем на год.
// Зеркало upload-icons-r2.ts, НО без resize/re-encode: эмблемы — авторский арт V4DYA (mixed
// 98×112 / 512²), заливаем ИСХОДНЫЕ байты 1:1, чтобы не пережимать. R2 не берёт плату за egress.
//
// Запуск:  npx tsx scripts/upload-achievements-r2.ts            (все)
//          npx tsx scripts/upload-achievements-r2.ts --limit=5  (тест на 5 файлах)
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("✗ Не хватает R2_* в .env.local (ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET)");
  process.exit(1);
}

const SRC_DIR = "public/images/achievements/eft";
const PREFIX = "achievements/eft";
const CONCURRENCY = 12;
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number.parseInt(limitArg.slice("--limit=".length), 10) : Number.POSITIVE_INFINITY;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function uploadOne(file: string): Promise<void> {
  const body = readFileSync(path.join(SRC_DIR, file)); // 1:1, без пережатия
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${PREFIX}/${file}`,
      Body: body,
      ContentType: "image/webp",
      CacheControl: CACHE_CONTROL,
    }),
  );
}

async function main(): Promise<void> {
  let files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".webp"));
  if (Number.isFinite(LIMIT)) files = files.slice(0, LIMIT);
  console.log(`Заливаю ${files.length} иконок достижений → R2 ${R2_BUCKET}/${PREFIX} (1:1, immutable 1y)`);

  let done = 0;
  let failed = 0;
  const failures: string[] = [];
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < files.length) {
      const file = files[idx++];
      try {
        await uploadOne(file);
        done++;
        if (done % 50 === 0) console.log(`  ... ${done}/${files.length}`);
      } catch (e) {
        failed++;
        failures.push(file);
        if (failed <= 10) console.error(`  ✗ ${file}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`\n✓ Готово: ${done} залито, ${failed} ошибок.`);
  if (failures.length) console.log("  Провалились:", failures.slice(0, 20).join(", "));
  if (failed) process.exit(1);
}

void main();
