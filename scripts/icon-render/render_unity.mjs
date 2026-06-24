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

// авто-тинт стекла: средний цвет иконки tarkov.dev (RGB норм. 0..1) или null
async function glassTintFromTarkovDev(id, sharp) {
  const res = await fetch("https://api.tarkov.dev/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ items(ids:["${id}"]){ iconLink } }` }) });
  const link = (await res.json())?.data?.items?.[0]?.iconLink;
  if (!link || link.includes("unknown")) return null;
  const buf = Buffer.from(await (await fetch(link)).arrayBuffer());
  const { data } = await sharp(buf).resize(16, 16, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 40) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  return n ? [r / n / 255, g / n / 255, b / n / 255] : null;
}

// --- 2. собрать jobs ---
const jobs = [];
const glassToFix = [];
for (const id of ids) {
  try {
    const rargs = ["scripts/icon-render/resolve_bundle.py", "--id", id, "--win", WIN];
    if (ITEMS) rargs.push("--items", ITEMS);
    const key = run(PY, rargs, { cwd: ROOT }).toString("utf8").split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#")).pop();
    if (!key) { console.log(`  SKIP ${id}: не разрешён`); continue; }
    const w = join(WORK, id);
    run(PY, ["scripts/icon-render/extract_item.py", "--bundle", join(WIN, key), "--out", w, "--win", WIN], { cwd: ROOT });
    const m = JSON.parse(readFileSync(join(w, "meta.json"), "utf8"));
    const job = {
      prefabName: m.prefabName || "",
      bundlePath: join(WIN, m.bundleKey || key),
      depPaths: (m.depKeys || []).map(k => join(WIN, k)),
      iconRotation: m.iconRotation,
      pivotRotation: m.pivotRotation,
      cameraMode: 5, // предмет=identity, камера=Inverse(Icon.rotation) — пиксель-точно (сверено: 0.0° vs tarkov.dev)
      perspective: m.perspective, boundsScale: m.boundsScale,
      orthographic: m.orthographic | 0, orthographicSize: m.orthographicSize || 10,
      outPath: join(OUT, `${id}.png`), res: parseInt(arg("master", "2048"), 10),
    };
    jobs.push(job);
    if (m.isGlass) glassToFix.push({ job, id }); // стекло -> авто-тинт из иконки tarkov.dev
  } catch (e) { console.log(`  FAIL prep ${id}: ${String(e.message || e).split("\n")[0]}`); }
}
if (!jobs.length) { console.error("нет заданий"); process.exit(1); }

// авто-тинт для стеклянных предметов (из иконки tarkov.dev)
if (glassToFix.length) {
  const sharp = (await import("sharp")).default;
  console.log(`стеклянных предметов: ${glassToFix.length} -> авто-тинт из tarkov.dev`);
  for (const { job, id } of glassToFix) {
    try {
      const tint = await glassTintFromTarkovDev(id, sharp);
      if (tint) { job.glassTint = tint; console.log(`  glass ${id}: тинт [${tint.map(x => x.toFixed(2)).join(", ")}]`); }
      else console.log(`  glass ${id}: тинт не получен (нет иконки tarkov.dev) — рендер как есть`);
    } catch (e) { console.log(`  glass ${id}: ${e.message}`); }
  }
}

const jobsFile = join(WORK, "jobs.json");
writeFileSync(jobsFile, JSON.stringify({ jobs }, null, 2));
console.log(`заданий: ${jobs.length} -> Unity batch render...`);

// --- 3. Unity batch render ---
try {
  run(UNITY, ["-batchmode", "-quit", "-projectPath", PROJECT, "-executeMethod", "IconRenderer.RenderBatch", "-jobsFile", jobsFile, "-logFile", "-"], { stdio: "inherit" });
} catch (e) {
  console.error("Unity вернул ненулевой код (часть заданий могла упасть) — смотри лог выше");
}

// --- 4. из мастер-PNG -> webp 512 (+ 1024 для зума) [+ опц. заливка] ---
const png = readdirSync(OUT).filter(f => f.endsWith(".png"));
console.log(`готово мастер-PNG: ${png.length} в ${OUT}`);
const sharp = (await import("sharp")).default;
const SIZES = [{ suffix: "", px: 512 }, { suffix: "-1024", px: 1024 }]; // {id}.webp + {id}-1024.webp
let bucket = null;
if (UPLOAD) {
  const { config } = await import("dotenv"); config({ path: join(ROOT, ".env.local") });
  const { createClient } = await import("@supabase/supabase-js");
  bucket = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage.from("cta-media");
}
let made = 0, up = 0;
for (const f of png) {
  const id = f.replace(".png", "");
  for (const s of SIZES) {
    const webp = await sharp(join(OUT, f)).resize(s.px, s.px, { fit: "inside" }).webp({ quality: 90 }).toBuffer();
    const name = `${id}${s.suffix}.webp`;
    writeFileSync(join(OUT, name), webp); made++;
    if (bucket) {
      const { error } = await bucket.upload(`items/eft/${name}`, webp, { contentType: "image/webp", upsert: true });
      if (error) console.log(`  upload FAIL ${name}: ${error.message}`); else up++;
    }
  }
}
console.log(`webp создано: ${made}${UPLOAD ? `, залито в cta-media: ${up}` : ` в ${OUT}`}`);
