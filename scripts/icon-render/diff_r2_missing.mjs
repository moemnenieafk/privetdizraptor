// ШАГ-0 свипа иконок: ПОЛНЫЙ список дыр = дифф R2-бакета `items/eft/512/` vs каталог зеркала.
// НЕ find-missing (тот видит только существующие webp и тянет категории с tarkov.dev — против self-render).
//
// Логика:
//   1) S3 ListObjectsV2 Bucket=R2_BUCKET Prefix="items/eft/512/" → Set существующих inGameId
//   2) все EFT item-id: items where game=(games.code='eft') → {inGameId,name}
//   3) missing = каталог − R2 ; split по имени (isWeapon-regex)
// Выход: scripts/reports/{missing-r2-eft,missing-weapons,missing-other}.json + счётчики.
//
// Запуск: node scripts/icon-render/diff_r2_missing.mjs
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
config({ path: join(ROOT, ".env.local") });

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) { console.error(`✗ нет ${k} в .env.local`); process.exit(1); }
}

const PREFIX = "items/eft/512/";
const OUT_DIR = join(ROOT, "scripts", "reports");
// «оружие» = оружейный пресет по имени (собирается через Gate-3), остальное — item-рендер / фан-аут.
const WEAPON_RE = /assault rifle|submachine|machine gun|sniper|carbine|marksman|grenade launcher|shotgun|pistol|revolver|bolt action|special assault/i;

// ---- 1) R2: множество существующих id ----
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});
const inR2 = new Set();
let token;
do {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: PREFIX, ContinuationToken: token, MaxKeys: 1000 }));
  for (const o of r.Contents || []) {
    const name = o.Key.slice(PREFIX.length);
    if (name.endsWith(".webp")) inR2.add(name.slice(0, -5)); // id может быть не-hex (напр. customdogtags…)
  }
  token = r.IsTruncated ? r.NextContinuationToken : undefined;
} while (token);
console.log(`R2 items/eft/512/: ${inR2.size} иконок`);

// ---- 2) каталог зеркала: все EFT item-id ----
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: game, error: ge } = await db.from("games").select("id").eq("code", "eft").single();
if (ge || !game) { console.error("✗ игра eft не найдена:", ge?.message); process.exit(1); }

const catalog = []; // {inGameId,name}
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db.from("items").select("in_game_id,name").eq("game_id", game.id).range(from, from + PAGE - 1);
  if (error) { console.error("✗ items:", error.message); process.exit(1); }
  catalog.push(...data.map((r) => ({ id: r.in_game_id, name: r.name })));
  if (data.length < PAGE) break;
}
console.log(`каталог EFT: ${catalog.length} предметов`);

// ---- 3) missing = каталог − R2, split ----
const missing = catalog.filter((it) => !inR2.has(it.id));
const weapons = missing.filter((it) => WEAPON_RE.test(it.name));
const other = missing.filter((it) => !WEAPON_RE.test(it.name));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "missing-r2-eft.json"), JSON.stringify(missing.map((m) => m.id)));
writeFileSync(join(OUT_DIR, "missing-weapons.json"), JSON.stringify(weapons, null, 1));
writeFileSync(join(OUT_DIR, "missing-other.json"), JSON.stringify(other, null, 1));

console.log(`\n=== ДЫР: ${missing.length} (${weapons.length} оружие + ${other.length} прочее) ===`);
console.log(`→ scripts/reports/missing-{r2-eft,weapons,other}.json`);
if (missing.length && missing.length <= 80) {
  for (const m of missing) console.log(`  ${WEAPON_RE.test(m.name) ? "W" : " "} ${m.id}  ${m.name}`);
}
