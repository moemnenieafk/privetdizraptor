// Заливает тайл-пирамиду HD-карты (по умолчанию Завод) в Cloudflare R2 (S3-совместимый,
// bucket cta-media). Снимает блокер прода: 21 849 тайлов / 56 МБ лежат под /public/maps,
// а вся эта папка — в .gitignore → на Vercel их нет; без R2 боевая карта Завод была бы
// пустой (тайлы 404). R2 не берёт плату за egress. Источник — локальная нарезка (skill
// map-stitch), артефакт сборки, не исходник.
//
// Ключ R2 = POSIX-путь тайла относительно public/ — 1:1 зеркалит рантайм-URL из
// MapViewerClient (L.tileLayer):
//   public/maps/factory/tiles/ground/0/0/0.jpg  →  key maps/factory/tiles/ground/0/0/0.jpg
//   рантайм:  {mapAssetBase}/maps/factory/tiles/{floor}/{z}/{y}/{x}.jpg
// После прогона: задать NEXT_PUBLIC_MAP_TILE_BASE_URL (или общую NEXT_PUBLIC_MAP_BASE_URL,
// когда SVG-подложки тоже переедут на R2) = R2-base → тайлы отдаются с R2.
//
// Запуск:  npx tsx scripts/upload-tiles-r2.ts [map=factory] [--skip-existing] [--floor=ground]
//          (или npm run db:upload-tiles-r2)
//   --skip-existing: HEAD перед PUT, уже залитые пропускать (дёшевый resume прерванного прогона).
//   --floor=<folder>: залить только один этаж (пересобрали его мастер — не гонять всю карту).
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const MAP = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "factory";
const SKIP_EXISTING = process.argv.includes("--skip-existing");
// --floor=ground: залить только пирамиду одного этажа (пересобрали один мастер — не гонять всю карту).
const FLOOR = process.argv.find((a) => a.startsWith("--floor="))?.slice("--floor=".length);
const PUBLIC_DIR = "public";
const TILES_DIR = path.join(PUBLIC_DIR, "maps", MAP, "tiles", ...(FLOOR ? [FLOOR] : []));
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const CONCURRENCY = 64;
const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".png": "image/png",
};

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

// Рекурсивный обход каталога тайлов → абсолютные пути только картинок (vips-properties.xml и пр. мимо).
function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (CONTENT_TYPE[path.extname(ent.name).toLowerCase()]) acc.push(full);
  }
  return acc;
}

// R2-ключ = путь относительно public/, слэши POSIX (на Windows path.sep = '\').
const keyOf = (file: string): string => path.relative(PUBLIC_DIR, file).split(path.sep).join("/");

async function existsInR2(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  let files: string[];
  try {
    files = walk(TILES_DIR);
  } catch {
    console.error(`✗ Нет каталога тайлов: ${TILES_DIR}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`✗ В ${TILES_DIR} не найдено тайлов`);
    process.exit(1);
  }

  console.log(
    `карта: ${MAP}${FLOOR ? ` · этаж: ${FLOOR}` : ""} · тайлов: ${files.length} · bucket: ${R2_BUCKET}${SKIP_EXISTING ? " · режим: skip-existing" : ""}`,
  );

  const total = files.length;
  let cursor = 0;
  let done = 0;
  let skipped = 0;
  let failed = 0;
  const t0 = Date.now();

  async function worker(): Promise<void> {
    while (cursor < total) {
      const file = files[cursor++];
      const key = keyOf(file);
      try {
        if (SKIP_EXISTING && (await existsInR2(key))) {
          skipped++;
        } else {
          const body = await readFile(file);
          await s3.send(
            new PutObjectCommand({
              Bucket: R2_BUCKET,
              Key: key,
              Body: body,
              ContentType: CONTENT_TYPE[path.extname(file).toLowerCase()] ?? "application/octet-stream",
              CacheControl: CACHE_CONTROL,
            }),
          );
          done++;
        }
      } catch (e) {
        failed++;
        if (failed <= 10) console.error(`  ✗ ${key}:`, e instanceof Error ? e.message : e);
      }
      const seen = done + skipped + failed;
      if (seen % 1000 === 0 || seen === total) {
        const pct = ((seen / total) * 100).toFixed(1);
        console.log(`  … ${seen}/${total} (${pct}%) — залито ${done}, пропущено ${skipped}, ошибок ${failed}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()));

  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(
    `ГОТОВО за ${secs}s: залито ${done}, пропущено ${skipped}, ошибок ${failed} · ключ maps/${MAP}/tiles/{floor}/{z}/{y}/{x}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
