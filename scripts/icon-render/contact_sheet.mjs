// Контактный лист из webp в out-unity/ по списку id (+подпись). Для быстрой глаз-сверки пачки рендеров.
// Запуск: node scripts/icon-render/contact_sheet.mjs <out.png> <label:id> <label:id> ...
import sharp from "sharp";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out-unity");
const [outPath, ...pairs] = process.argv.slice(2);
const CELL = 230, IMG = 200, COLS = 6, PAD = 6, LABEL = 24;
const items = pairs.map((p) => { const i = p.indexOf(":"); return { label: p.slice(0, i), id: p.slice(i + 1) }; });
const rows = Math.ceil(items.length / COLS);
const W = COLS * CELL, H = rows * (CELL + LABEL);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const composites = [];
for (let k = 0; k < items.length; k++) {
  const { label, id } = items[k];
  const col = k % COLS, row = Math.floor(k / COLS);
  const x = col * CELL, y = row * (CELL + LABEL);
  const src = join(OUT, `${id}.webp`);
  if (existsSync(src)) {
    const cell = await sharp({ create: { width: CELL, height: CELL, channels: 4, background: { r: 30, g: 30, b: 34, alpha: 1 } } })
      .composite([{ input: await sharp(src).resize(IMG, IMG, { fit: "inside" }).toBuffer(), gravity: "center" }]).png().toBuffer();
    composites.push({ input: cell, left: x, top: y });
  }
  const lbl = Buffer.from(`<svg width="${CELL}" height="${LABEL}"><rect width="100%" height="100%" fill="#111"/><text x="4" y="17" font-family="monospace" font-size="14" fill="#8f8">${esc(label)}</text></svg>`);
  composites.push({ input: lbl, left: x, top: y + CELL });
}
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 17, g: 17, b: 17, alpha: 1 } } })
  .composite(composites).png().toFile(outPath);
console.log(`контактный лист: ${outPath} (${items.length} шт, ${W}x${H})`);
