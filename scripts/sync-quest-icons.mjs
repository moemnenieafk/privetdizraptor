// Зеркалит 512px-иконки КВЕСТ-предметов (questItems) из assets.tarkov.dev во все наши плоскости
// иконок: диск (public/images/items/eft/{id}.webp), R2 (items/eft/512/{id}.webp — прод-примари),
// Supabase Storage (cta-media/items/eft/{id}.webp — фолбэк). Эти ~107 предметов НЕ лежат в
// regular/items, поэтому обычные syncEftIcons/upload-icons-r2 их не берут. Источник id — квест-item
// цели из eft-quests.json. Идемпотентно (upsert). Запуск: node scripts/sync-quest-icons.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DISK_DIR = "public/images/items/eft";
const SUPA_PREFIX = "items/eft"; // cta-media/{SUPA_PREFIX}/{id}.webp
const R2_PREFIX = "items/eft/512"; // прод-путь itemIconUrl (версионированный)
const QI_TYPES = new Set(["findQuestItem", "giveQuestItem", "plantQuestItem"]);

async function main() {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("нет Supabase env");
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("нет R2_* env");

  const tasks = JSON.parse(readFileSync("src/data/quests/eft-quests.json", "utf8"));
  const ids = new Set();
  for (const t of tasks) for (const o of t.objectives ?? []) if (QI_TYPES.has(o.type) && o.item?.id) ids.add(o.item.id);
  const list = [...ids];
  console.log(`quest-предметов (уникальных): ${list.length}`);

  mkdirSync(DISK_DIR, { recursive: true });
  const supa = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from("cta-media");
  const s3 = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });

  let ok = 0, missing = 0, failed = 0, cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const id = list[cursor++];
      try {
        const res = await fetch(`https://assets.tarkov.dev/${id}-512.webp`);
        if (res.status === 404) { missing++; continue; }
        if (!res.ok) throw new Error(`fetch HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(`${DISK_DIR}/${id}.webp`, buf);
        await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: `${R2_PREFIX}/${id}.webp`, Body: buf, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
        const { error } = await supa.upload(`${SUPA_PREFIX}/${id}.webp`, buf, { contentType: "image/webp", upsert: true });
        if (error) throw error;
        ok++;
      } catch (e) { console.error(`[quest-icons] ${id}:`, e.message); failed++; }
    }
  }
  await Promise.all(Array.from({ length: 10 }, () => worker()));
  console.log(`ГОТОВО: диск+R2+Supabase залито ${ok}, нет на источнике ${missing}, ошибок ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
