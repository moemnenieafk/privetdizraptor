// Заливает иконки предметов (public/images/items/eft/{id}.webp, 512px-оригиналы)
// в Cloudflare R2 (S3-совместимый, бакет cta-media, ключ items/eft/512/{id}.webp)
// в полном 512px/q80 с immutable-кэшем на год. Путь версионирован (…/512/) —
// новый URL обходит immutable-кэш старых 256px-иконок. R2 не берёт плату за egress.
//
// Запуск:  npx tsx scripts/upload-icons-r2.ts            (все 5044)
//          npx tsx scripts/upload-icons-r2.ts --limit=5  (тест на 5 файлах)
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("✗ Не хватает R2_* в .env.local (ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET)");
  process.exit(1);
}

const SRC_DIR = "public/images/items/eft";
const PREFIX = "items/eft/512";
const MAX_PX = 512;
const QUALITY = 80;
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
  const buf = readFileSync(path.join(SRC_DIR, file));
  const out = await sharp(buf)
    .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${PREFIX}/${file}`,
      Body: out,
      ContentType: "image/webp",
      CacheControl: CACHE_CONTROL,
    }),
  );
}

async function main(): Promise<void> {
  let files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".webp"));
  if (Number.isFinite(LIMIT)) files = files.slice(0, LIMIT);
  console.log(`Заливаю ${files.length} иконок → R2 ${R2_BUCKET}/${PREFIX} (≤${MAX_PX}px, q${QUALITY}, immutable 1y)`);

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
        if (done % 250 === 0) console.log(`  ... ${done}/${files.length}`);
      } catch (e) {
        failed++;
        failures.push(file);
        if (failed <= 10) console.error(`  ✗ ${file}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`ГОТОВО: залито ${done}, ошибок ${failed}`);
  if (failures.length) console.log(`Сбои (до 10): ${failures.slice(0, 10).join(", ")}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
