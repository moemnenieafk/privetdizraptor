// sync-style-debt.mjs — звено цепи code → docs (Вариант 2 «Гибрид»-синка).
// Сканит src/ на NIGHTFALL/TS стиль-долг и переписывает авто-блок в docs/state/snapshot-*.md
// между маркерами <!-- debt:auto --> … <!-- /debt:auto -->.
//
// Чистая функция «посчитал → переписал»: НЕ трогает git, НЕ интерактивен → безопасен в pre-commit хуке
// и запускается руками (`npm run debt:sync`) или из скилла /execute-decision.
//
// Флаги:
//   (без флага) — переписать блок, если изменился; exit 0.
//   --check     — не писать; exit 1, если блок устарел (для CI/проверки). exit 0, если синхронно.
//
// Счётчики — ЭВРИСТИКА (regex по src/), нужны как тренд (вниз = хорошо), не как форензика.

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'src');
const STATE_DIR = join(ROOT, 'docs', 'state');

const START = '<!-- debt:auto -->';
const END = '<!-- /debt:auto -->';
const SKIP_DIRS = new Set(['node_modules', '.next', 'graphify-out', '.git']);

/** Рекурсивно собрать .ts/.tsx из src/. */
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

// `any` в типовой позиции: после `as `, либо после : < , | & ( — один матч на каждое `any`.
const RE_ANY = /(?:\bas\s+|[:<,|&(]\s*)any\b/g;
const RE_HEX = /\[#[0-9a-fA-F]{3,8}\b/g; // сырой HEX в произвольном Tailwind-значении: bg-[#9146FF]
const RE_ROUNDED = /\brounded-\[[0-9.]+px\]/g; // rounded-[2px] вместо rounded-xs
const RE_FONTMONO = /\bfont-mono\b/; // запрещён проектом (должно быть font-blender-medium)
const RE_V3 = [/\bbg-gradient-to-[trbl]\b/g, /\bbg-\[var\(/g]; // v3-утечки (должно быть 0)

function scan() {
  const files = walk(SRC);
  let anyN = 0;
  const anyF = new Set();
  const fontMonoF = new Set();
  let hexN = 0;
  const hexF = new Set();
  let roundedN = 0;
  let v3N = 0;
  const v3F = new Set();

  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f).replace(/\\/g, '/');

    // any — построчно, мимо чистых комментариев (TSДок/баннеры не считаем).
    for (const line of text.split('\n')) {
      if (isCommentLine(line)) continue;
      const m = line.match(RE_ANY);
      if (m) {
        anyN += m.length;
        anyF.add(rel);
      }
    }

    const hx = text.match(RE_HEX);
    if (hx) {
      hexN += hx.length;
      hexF.add(rel);
    }
    const rd = text.match(RE_ROUNDED);
    if (rd) roundedN += rd.length;
    if (RE_FONTMONO.test(text)) fontMonoF.add(rel);
    for (const re of RE_V3) {
      const v = text.match(re);
      if (v) {
        v3N += v.length;
        v3F.add(rel);
      }
    }
  }

  return {
    filesScanned: files.length,
    anyN,
    anyFiles: anyF.size,
    fontMonoFiles: fontMonoF.size,
    hexN,
    hexFiles: hexF.size,
    roundedN,
    v3N,
    v3Files: v3F.size,
  };
}

/** Детерминированная строка-блок (без даты → идемпотентна: те же src = те же байты). */
function renderBlock(m) {
  const v3 = m.v3N === 0 ? '✅ нет' : `⚠️ ${m.v3N} (в ${m.v3Files} файлах)`;
  return (
    `**NIGHTFALL** (авто): ` +
    `\`any\` — ${m.anyN} шт / ${m.anyFiles} файлов · ` +
    `\`font-mono\` — ${m.fontMonoFiles} файлов · ` +
    `сырой HEX \`[#…]\` — ${m.hexN} шт / ${m.hexFiles} файлов · ` +
    `\`rounded-[Npx]\` — ${m.roundedN} шт · ` +
    `v3-синтаксис (\`bg-gradient-to-*\`, \`bg-[var(…)]\`) — ${v3}.`
  );
}

function findSnapshot() {
  const snaps = readdirSync(STATE_DIR)
    .filter((f) => /^snapshot-.*\.md$/.test(f))
    .sort();
  if (!snaps.length) throw new Error(`нет snapshot-*.md в ${STATE_DIR}`);
  return join(STATE_DIR, snaps[snaps.length - 1]); // самый свежий месяц
}

function main() {
  const check = process.argv.includes('--check');
  const metrics = scan();
  const block = renderBlock(metrics);

  const snapPath = findSnapshot();
  const content = readFileSync(snapPath, 'utf8');
  const s = content.indexOf(START);
  const e = content.indexOf(END);
  if (s === -1 || e === -1) {
    console.error(`❌ маркеры ${START} … ${END} не найдены в ${relative(ROOT, snapPath)}`);
    process.exit(2);
  }

  const next = content.slice(0, s + START.length) + `\n${block}\n` + content.slice(e);
  const changed = next !== content;
  const rel = relative(ROOT, snapPath).replace(/\\/g, '/');

  if (check) {
    if (changed) {
      console.error(`⚠️  ${rel}: NIGHTFALL-счётчики устарели. Запусти: npm run debt:sync`);
      console.error(`    → ${block}`);
      process.exit(1);
    }
    console.log(`✅ ${rel}: стиль-долг синхронен (просканено ${metrics.filesScanned} файлов).`);
    return;
  }

  if (changed) {
    writeFileSync(snapPath, next);
    console.log(`✅ ${rel}: обновлено (${metrics.filesScanned} файлов src/).`);
    console.log(`   ${block}`);
  } else {
    console.log(`= ${rel}: без изменений (${metrics.filesScanned} файлов src/).`);
  }
}

main();
