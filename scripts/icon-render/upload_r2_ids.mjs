// Таргетная заливка иконок КОНКРЕТНЫХ id в Cloudflare R2 (прод-путь items/eft/512/{id}.webp)
// + синк копии в public/images/items/eft/{id}.webp (источник для полного upload-icons-r2 и find-missing).
// Источник картинки: out-unity/{id}.webp (свежий рендер) или public/ как фолбэк.
//
// Запуск: node scripts/icon-render/upload_r2_ids.mjs --ids a,b,c
import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
config({ path: join(ROOT, ".env.local") });

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("✗ нет R2_* в .env.local"); process.exit(1);
}
const argVal = (n) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 ? process.argv[i + 1] : null; };
let ids = (argVal("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
const listF = argVal("list");
if (listF && existsSync(listF)) ids = JSON.parse(readFileSync(listF, "utf8"));
if (!ids.length) { console.error("✗ нужен --ids a,b,c или --list ids.json"); process.exit(1); }
// --src <webp>: один образ на ВСЕ id (фан-аут — напр. Twitch-кейс одной редкости на всю группу)
const SRC = argVal("src");

const OUT = join(HERE, "out-unity");
const PUBLIC = join(ROOT, "public", "images", "items", "eft");
const PREFIX = "items/eft/512";
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

let ok = 0;
for (const id of ids) {
  const src = SRC ? SRC : (existsSync(join(OUT, `${id}.webp`)) ? join(OUT, `${id}.webp`) : join(PUBLIC, `${id}.webp`));
  if (!existsSync(src)) { console.log(`  SKIP ${id}: нет webp (${src})`); continue; }
  // нормализуем ≤512 q80 (как upload-icons-r2.ts), чтобы прод-ключ был единообразен
  const buf = await sharp(readFileSync(src)).resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  // синк копии в public (перетираем плейсхолдер) — источник для полного R2-синка и find-missing
  copyFileSync(src, join(PUBLIC, `${id}.webp`));
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: `${PREFIX}/${id}.webp`, Body: buf,
    ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable",
  }));
  console.log(`  ✓ R2 ${PREFIX}/${id}.webp (${buf.length} B) + public синк`);
  ok++;
}
console.log(`\nзалито в R2: ${ok}/${ids.length}`);
