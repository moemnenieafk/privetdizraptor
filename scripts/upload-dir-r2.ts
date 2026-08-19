// Универсальный залив каталога медиа в Cloudflare R2 (бакет cta-media) — обобщение
// upload-achievements-r2.ts на любой префикс. Байты 1:1 (без пережатия), immutable-кэш на год,
// top-level файлы каталога (без рекурсии в подпапки). R2 не берёт плату за egress.
//
// Запуск:
//   npx tsx scripts/upload-dir-r2.ts --dir=public/images/quests/eft --prefix=quests/eft
//   npx tsx scripts/upload-dir-r2.ts --dir=... --prefix=... --limit=5   (тест)
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/** Рекурсивный обход: возвращает пути файлов ОТНОСИТЕЛЬНО root (posix-слэши для R2-ключа). */
function walk(root: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, r));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("✗ Не хватает R2_* в .env.local (ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET)");
  process.exit(1);
}

const arg = (name: string): string | undefined => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const SRC_DIR = arg("dir");
const PREFIX = arg("prefix");
if (!SRC_DIR || !PREFIX) {
  console.error("✗ Укажи --dir=<public-путь> и --prefix=<r2-ключ-префикс>");
  process.exit(1);
}

const LIMIT = arg("limit") ? Number.parseInt(arg("limit") as string, 10) : Number.POSITIVE_INFINITY;
const RECURSIVE = process.argv.includes("--recursive");
const CONCURRENCY = 12;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const CT: Record<string, string> = {
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp3": "audio/mpeg",
};
const IMG_EXT = new Set(Object.keys(CT));

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function uploadOne(file: string): Promise<void> {
  const ext = path.extname(file).toLowerCase();
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${PREFIX}/${file}`,
      Body: readFileSync(path.join(SRC_DIR as string, file)), // 1:1
      ContentType: CT[ext] ?? "application/octet-stream",
      CacheControl: CACHE_CONTROL,
    }),
  );
}

async function main(): Promise<void> {
  let files = (RECURSIVE
    ? walk(SRC_DIR as string)
    : readdirSync(SRC_DIR as string, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name)
  ).filter((f) => IMG_EXT.has(path.extname(f).toLowerCase())); // desktop.ini и прочий мусор отсекаются
  if (Number.isFinite(LIMIT)) files = files.slice(0, LIMIT);
  console.log(`Заливаю ${files.length} файлов из ${SRC_DIR} → R2 ${R2_BUCKET}/${PREFIX} (1:1, immutable 1y)`);

  let done = 0, failed = 0, idx = 0;
  const failures: string[] = [];
  async function worker(): Promise<void> {
    while (idx < files.length) {
      const file = files[idx++];
      try {
        await uploadOne(file);
        if (++done % 100 === 0) console.log(`  ... ${done}/${files.length}`);
      } catch (e) {
        failed++; failures.push(file);
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
