// Локальный оркестратор: рендерит НЕДОСТАЮЩИЕ иконки EFT из файлов клиента и заливает в Supabase.
// Цепочка на каждый id: resolve_bundle.py -> extract_item.py -> Blender render_item.py -> sharp webp -> upload.
//
// ЛОКАЛЬНЫЙ инструмент (нужны: установка EFT, Blender, python+UnityPy) — НЕ для Vercel.
// Дополняет серверный крон sync-icons (тот зеркалит готовые 512px с tarkov.dev; этот рендерит
// то, чего у tarkov.dev ещё НЕТ — самые свежие предметы). Запускать после патча.
//
// Запуск:
//   node scripts/icon-render/render_missing.mjs                 # dry-run: рендер+webp в out/, без заливки
//   node scripts/icon-render/render_missing.mjs --upload        # + заливка в cta-media (service-role)
//   node scripts/icon-render/render_missing.mjs --ids a,b,c     # конкретные id (для теста)
//   node scripts/icon-render/render_missing.mjs --items items.json   # маппинг по Prefab.path (надёжнее)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const WIN = arg("win", "C:/Battlestate Games/Escape from Tarkov/EscapeFromTarkov_Data/StreamingAssets/Windows");
const BLENDER = arg("blender", "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe");
const PY = arg("python", "python");
const ITEMS = arg("items", "");
const UPLOAD = flag("upload");
const OUT = join(HERE, "out");
const WORK = join(HERE, ".work");
const LIST = arg("list", join(ROOT, "src", "data", "icon-backfill-eft.json"));

const ids = (arg("ids", "") ? arg("ids", "").split(",") : JSON.parse(readFileSync(LIST, "utf8"))).map(s => s.trim()).filter(Boolean);
mkdirSync(OUT, { recursive: true });

let bucket = null;
if (UPLOAD) {
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env.local") });
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  bucket = admin.storage.from("cta-media");
}
const sharp = (await import("sharp")).default;

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "buffer", stdio: ["ignore", "pipe", "pipe"], ...opts });
}

let done = 0, skipped = 0, failed = 0;
console.log(`${ids.length} id, upload=${UPLOAD}, items.json=${ITEMS ? "да" : "нет (name-fallback)"}`);

for (const id of ids) {
  const work = join(WORK, id);
  try {
    // 1. resolve id -> bundle key
    const rargs = ["scripts/icon-render/resolve_bundle.py", "--id", id, "--win", WIN];
    if (ITEMS) rargs.push("--items", ITEMS);
    const bundleKey = run(PY, rargs, { cwd: ROOT }).toString("utf8").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#")).pop();
    if (!bundleKey) { console.log(`  SKIP ${id}: не разрешён в бандл`); skipped++; continue; }
    const bundlePath = join(WIN, bundleKey);
    // 2. extract
    mkdirSync(work, { recursive: true });
    run(PY, ["scripts/icon-render/extract_item.py", "--bundle", bundlePath, "--out", work, "--win", WIN], { cwd: ROOT });
    // 3. render
    const png = join(work, "icon.png");
    run(BLENDER, ["--background", "--python", "scripts/icon-render/render_item.py", "--", "--meta", join(work, "meta.json"), "--out", png], { cwd: ROOT });
    // 4. webp
    const webp = await sharp(png).webp({ quality: 92 }).toBuffer();
    if (UPLOAD) {
      const { error } = await bucket.upload(`items/eft/${id}.webp`, webp, { contentType: "image/webp", upsert: true });
      if (error) throw error;
    } else {
      writeFileSync(join(OUT, `${id}.webp`), webp);
    }
    console.log(`  OK ${id}  (${bundleKey.split("/").pop()})`);
    done++;
  } catch (e) {
    console.log(`  FAIL ${id}: ${String(e.message || e).split("\n")[0]}`);
    failed++;
  } finally {
    if (existsSync(work)) rmSync(work, { recursive: true, force: true });
  }
}
console.log(`\nГОТОВО: отрендерено ${done}, пропущено ${skipped}, ошибок ${failed}. ${UPLOAD ? "Залито в cta-media." : `webp в ${OUT}`}`);
