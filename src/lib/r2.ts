// Cloudflare R2 (S3-совместимый) — единый СЕРВЕРНЫЙ клиент для загрузки медиа CMS.
// Тот же бакет и публичная раздача, что у иконок/карт (см. scripts/upload-icons-r2.ts):
//   • запись — приватный S3-endpoint `<account>.r2.cloudflarestorage.com` (креды R2_*);
//   • отдача — публичный корень бакета (NEXT_PUBLIC_ICON_BASE_URL / R2_PUBLIC_BASE), zero-egress.
// Секреты только в env (.env.local / Vercel), в репо НИКОГДА (cta-backend §Gotcha 4).
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;
// Публичный корень бакета: отдельный R2_PUBLIC_BASE либо общий с иконками NEXT_PUBLIC_ICON_BASE_URL.
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE ?? process.env.NEXT_PUBLIC_ICON_BASE_URL ?? "").replace(/\/$/, "");

/** Настроен ли R2 (все креды + публичный корень) — иначе роут отдаёт 500, не падая. */
export function r2Configured(): boolean {
  return !!(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET && PUBLIC_BASE);
}

let cached: S3Client | null = null;
function client(): S3Client {
  if (!cached) {
    cached = new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY_ID as string, secretAccessKey: SECRET_ACCESS_KEY as string },
    });
  }
  return cached;
}

/** Публичный URL объекта R2 по его ключу. */
export const r2PublicUrl = (key: string): string => `${PUBLIC_BASE}/${key}`;

/** Кладёт объект в R2 (immutable-кэш на год) и возвращает публичный URL. */
export async function r2Put(key: string, body: Buffer, contentType: string): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return r2PublicUrl(key);
}

/** Удаляет объект из R2 по ключу. */
export async function r2Delete(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
