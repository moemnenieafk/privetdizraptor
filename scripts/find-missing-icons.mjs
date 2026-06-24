// Поиск предметов БЕЗ реальной иконки (по факту хранится плейсхолдер-заглушка).
//
// Логика: все {id}.webp на диске есть, но у части из них содержимое = сам плейсхолдер
// (у предмета нет настоящей иконки на источнике). Сверяем каждую иконку с образом
// плейсхолдера ПОБАЙТОВО (sha256) — заглушка копируется идентично, поэтому точного
// сравнения достаточно. Дальше тянем категории из tarkov.dev, группируем и пишем отчёт.
//
// Запуск:
//   node scripts/find-missing-icons.mjs
//   node scripts/find-missing-icons.mjs --dir public/images/items/eft --placeholder "!non-related/no-icon-placeholder-img.webp"
//   node scripts/find-missing-icons.mjs --perceptual        # доп. проход sharp: ловит перекодированные заглушки
//   node scripts/find-missing-icons.mjs --game eft --out scripts/reports
//
// Выход: scripts/reports/missing-icons-<game>.json (структура) + .txt (читаемый, по категориям).

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---- аргументы ----
const argv = process.argv.slice(2);
const getArg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};
const hasFlag = (name) => argv.includes(`--${name}`);

const GAME = getArg("game", "eft");
const DIR = getArg("dir", `public/images/items/${GAME}`);
const PLACEHOLDER = getArg("placeholder", "!non-related/no-icon-placeholder-img.webp");
const OUT_DIR = getArg("out", "scripts/reports");
const PERCEPTUAL = hasFlag("perceptual");
const AHASH_THRESHOLD = Number(getArg("threshold", "5")); // макс. расстояние Хэмминга для «похоже на заглушку»

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

// ---- 1. хешируем все иконки, группируем по содержимому ----
if (!existsSync(DIR)) {
  console.error(`Каталог иконок не найден: ${DIR}`);
  process.exit(1);
}
const files = readdirSync(DIR).filter((f) => f.endsWith(".webp"));
const byHash = new Map(); // hash -> [file]
for (const f of files) {
  const h = sha(readFileSync(join(DIR, f)));
  if (!byHash.has(h)) byHash.set(h, []);
  byHash.get(h).push(f);
}
const clusters = [...byHash.entries()].sort((a, b) => b[1].length - a[1].length);

// ---- 2. определяем хеш плейсхолдера ----
let placeholderHash = null;
let placeholderSource = "";
if (existsSync(PLACEHOLDER)) {
  placeholderHash = sha(readFileSync(PLACEHOLDER));
  placeholderSource = `образ ${PLACEHOLDER}`;
} else {
  // авто-детект: крупнейший кластер одинаковых файлов — почти наверняка заглушка
  placeholderHash = clusters[0][0];
  placeholderSource = `авто-детект (крупнейший кластер, ${clusters[0][1].length} шт.) — образ ${PLACEHOLDER} не найден`;
  console.warn(`⚠ ${placeholderSource}`);
}

const missingFiles = (byHash.get(placeholderHash) || []).slice().sort();
const missingIds = missingFiles.map((f) => f.replace(".webp", ""));

// предупреждение, если заглушка по образу — не крупнейший кластер (повод проверить образ)
if (clusters[0][0] !== placeholderHash) {
  console.warn(
    `⚠ Хеш плейсхолдера НЕ крупнейший кластер (${missingFiles.length} шт. против ${clusters[0][1].length} у топового). Проверь образ плейсхолдера.`,
  );
}

// ---- 3. (опц.) перцептивный проход: перекодированные заглушки ----
let perceptualExtra = [];
if (PERCEPTUAL) {
  const sharp = (await import("sharp")).default;
  const aHash = async (buf) => {
    const px = await sharp(buf).greyscale().resize(8, 8, { fit: "fill" }).raw().toBuffer();
    const avg = px.reduce((s, v) => s + v, 0) / px.length;
    let bits = 0n;
    for (let i = 0; i < px.length; i++) if (px[i] >= avg) bits |= 1n << BigInt(i);
    return bits;
  };
  const popcount = (x) => { let c = 0; while (x) { c += Number(x & 1n); x >>= 1n; } return c; };
  const phBits = await aHash(readFileSync(existsSync(PLACEHOLDER) ? PLACEHOLDER : join(DIR, missingFiles[0])));
  const exact = new Set(missingFiles);
  for (const f of files) {
    if (exact.has(f)) continue;
    const d = popcount(phBits ^ (await aHash(readFileSync(join(DIR, f)))));
    if (d <= AHASH_THRESHOLD) perceptualExtra.push({ id: f.replace(".webp", ""), distance: d });
  }
  perceptualExtra.sort((a, b) => a.distance - b.distance);
  console.log(`перцептивно похожих на заглушку (не байт-в-байт, d≤${AHASH_THRESHOLD}): ${perceptualExtra.length}`);
}

// ---- 4. категории из tarkov.dev (только eft) ----
const meta = new Map(); // id -> { name, category }
if (GAME === "eft") {
  try {
    const res = await fetch("https://api.tarkov.dev/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ items { id name category { name } } }` }),
    });
    const json = await res.json();
    for (const it of json.data.items) {
      meta.set(it.id, { name: it.name, category: it.category?.name ?? "Без категории" });
    }
  } catch (e) {
    console.warn("⚠ не удалось получить категории из tarkov.dev:", e.message);
  }
}

// ---- 5. группировка ----
const byCategory = new Map(); // category -> [{id,name}]
for (const id of missingIds) {
  const m = meta.get(id) ?? { name: "(нет в каталоге tarkov.dev)", category: "НЕ в каталоге tarkov.dev" };
  if (!byCategory.has(m.category)) byCategory.set(m.category, []);
  byCategory.get(m.category).push({ id, name: m.name });
}
const grouped = [...byCategory.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .map(([category, items]) => ({ category, count: items.length, items: items.sort((a, b) => a.name.localeCompare(b.name)) }));

// ---- 6. запись ----
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString();
const report = {
  generatedAt: stamp,
  game: GAME,
  iconsDir: DIR,
  placeholder: { path: PLACEHOLDER, sha256: placeholderHash, source: placeholderSource },
  totals: { scanned: files.length, missing: missingIds.length, withIcon: files.length - missingIds.length },
  perceptualExtra,
  byCategory: grouped,
  missingIds,
};
const jsonPath = join(OUT_DIR, `missing-icons-${GAME}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

const txt = [];
txt.push(`ПРЕДМЕТЫ БЕЗ ИКОНКИ (= плейсхолдер-заглушка) — ${GAME}`);
txt.push(`Сгенерировано: ${stamp}`);
txt.push(`Источник заглушки: ${placeholderSource}`);
txt.push(`Плейсхолдер sha256: ${placeholderHash}`);
txt.push(`Без иконки: ${missingIds.length} из ${files.length}`);
if (PERCEPTUAL) txt.push(`Перцептивно похожих (перекодированные?): ${perceptualExtra.length}`);
txt.push("");
for (const g of grouped) {
  txt.push(`== ${g.category} (${g.count}) ==`);
  for (const it of g.items) txt.push(`  ${it.id}  ${it.name}`);
  txt.push("");
}
const txtPath = join(OUT_DIR, `missing-icons-${GAME}.txt`);
writeFileSync(txtPath, txt.join("\n"), "utf8");

// ---- плоский список id для синк-крона зеркалирования (src/db/icons.ts его импортирует) ----
const DATA_DIR = "src/data";
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const backfillPath = join(DATA_DIR, `icon-backfill-${GAME}.json`);
writeFileSync(backfillPath, JSON.stringify(missingIds), "utf8");

// ---- консольная сводка ----
console.log(`\n=== БЕЗ ИКОНКИ: ${missingIds.length} из ${files.length} (${GAME}) ===`);
for (const g of grouped) console.log(`  ${String(g.count).padStart(4)}  ${g.category}`);
console.log(`\nОтчёт: ${jsonPath}`);
console.log(`       ${txtPath}`);
console.log(`Список для крона: ${backfillPath} (${missingIds.length} id)`);
