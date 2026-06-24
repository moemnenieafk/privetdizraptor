// Драйвер пиксель-точного Unity-рендера иконок EFT (родной движок + реальные шейдеры).
// Цепочка: resolve_bundle.py -> extract_item.py(meta) -> jobs.json -> Unity batch (IconRenderer) -> PNG [-> webp/upload].
//
// Запуск:
//   node scripts/icon-render/render_unity.mjs --ids a,b        # PNG в out-unity/
//   node scripts/icon-render/render_unity.mjs --items items.json --upload
// Требуется: Unity 2022.3.43f1 (версия EFT), python+UnityPy. ЛОКАЛЬНЫЙ инструмент.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const WIN = arg("win", "C:/Battlestate Games/Escape from Tarkov/EscapeFromTarkov_Data/StreamingAssets/Windows");
const UNITY = arg("unity", "C:/Program Files/Unity/Hub/Editor/2022.3.43f1/Editor/Unity.exe");
const PROJECT = arg("project", join(HERE, "unity", "_project"));
const PY = arg("python", "python");
const ITEMS = arg("items", "");
const RES = arg("res", "512");
const UPLOAD = flag("upload");
const OUT = join(HERE, "out-unity");
const WORK = join(HERE, ".work-unity");
const LIST = arg("list", join(ROOT, "src", "data", "icon-backfill-eft.json"));
const ids = (arg("ids", "") ? arg("ids", "").split(",") : JSON.parse(readFileSync(LIST, "utf8"))).map(s => s.trim()).filter(Boolean);

mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const run = (cmd, a, o = {}) => execFileSync(cmd, a, { encoding: "buffer", ...o });

// --- 1. Unity-проект: создать при отсутствии + положить IconRenderer.cs ---
if (!existsSync(UNITY)) { console.error(`Unity не найден: ${UNITY}  (--unity <путь>)`); process.exit(1); }
if (!existsSync(join(PROJECT, "Assets"))) {
  console.log("создаю Unity-проект:", PROJECT);
  run(UNITY, ["-batchmode", "-quit", "-createProject", PROJECT, "-logFile", "-"], { stdio: "inherit" });
}
const editorDir = join(PROJECT, "Assets", "Editor");
mkdirSync(editorDir, { recursive: true });
cpSync(join(HERE, "unity", "IconRenderer.cs"), join(editorDir, "IconRenderer.cs"));

// --- 2. собрать jobs ---
const jobs = [];
for (const id of ids) {
  try {
    const rargs = ["scripts/icon-render/resolve_bundle.py", "--id", id, "--win", WIN];
    if (ITEMS) rargs.push("--items", ITEMS);
    const key = run(PY, rargs, { cwd: ROOT }).toString("utf8").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#")).pop();
    if (!key) { console.log(`  SKIP ${id}: не разрешён`); continue; }
    const w = join(WORK, id);
    run(PY, ["scripts/icon-render/extract_item.py", "--bundle", join(WIN, key), "--out", w, "--win", WIN], { cwd: ROOT });
    const m = JSON.parse(readFileSync(join(w, "meta.json"), "utf8"));
    jobs.push({
      prefabName: m.prefabName || "",
      bundlePath: join(WIN, m.bundleKey || key),
      depPaths: (m.depKeys || []).map(k => join(WIN, k)),
      iconRotation: m.iconRotation,
      pivotRotation: m.pivotRotation,
      perspective: m.perspective, boundsScale: m.boundsScale,
      orthographic: m.orthographic | 0, orthographicSize: m.orthographicSize || 10,
      outPath: join(OUT, `${id}.png`), res: parseInt(RES, 10),
    });
  } catch (e) { console.log(`  FAIL prep ${id}: ${String(e.message || e).split("\n")[0]}`); }
}
if (!jobs.length) { console.error("нет заданий"); process.exit(1); }
const jobsFile = join(WORK, "jobs.json");
writeFileSync(jobsFile, JSON.stringify({ jobs }, null, 2));
console.log(`заданий: ${jobs.length} -> Unity batch render...`);

// --- 3. Unity batch render ---
try {
  run(UNITY, ["-batchmode", "-quit", "-projectPath", PROJECT, "-executeMethod", "IconRenderer.RenderBatch", "-jobsFile", jobsFile, "-logFile", "-"], { stdio: "inherit" });
} catch (e) {
  console.error("Unity вернул ненулевой код (часть заданий могла упасть) — смотри лог выше");
}

// --- 4. собрать PNG (+ опц. webp/upload) ---
const png = readdirSync(OUT).filter(f => f.endsWith(".png"));
console.log(`готово PNG: ${png.length} в ${OUT}`);
if (UPLOAD && png.length) {
  const { config } = await import("dotenv"); config({ path: join(ROOT, ".env.local") });
  const { createClient } = await import("@supabase/supabase-js");
  const sharp = (await import("sharp")).default;
  const bucket = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from("cta-media");
  let up = 0;
  for (const f of png) {
    const id = f.replace(".png", "");
    const webp = await sharp(join(OUT, f)).webp({ quality: 92 }).toBuffer();
    const { error } = await bucket.upload(`items/eft/${id}.webp`, webp, { contentType: "image/webp", upsert: true });
    if (error) console.log(`  upload FAIL ${id}: ${error.message}`); else up++;
  }
  console.log(`залито в cta-media: ${up}`);
}
