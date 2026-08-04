// scripts/extract-achievement-icons.mjs
// Разовое ДЕВ-извлечение иконок достижений EFT, которых ещё нет локально.
//
// Контекст (2026-08-04, патч 1.1.0 «Kord Breach», сутки от роду):
//  • Иконки достижений — плоские PNG, которые BSG раздаёт с CDN; в бандлах клиента их НЕТ,
//    на диске live-клиента тоже НЕТ (кеш по хешу). SPT отстаёт (0.16.9) → готового дампа нет.
//  • Единственный чистый машиночитаемый источник свежего патча = tarkov.dev GraphQL,
//    у типа Achievement есть поле `imageLink` (официальный PNG). Качаем ОДИН раз, кладём
//    СВОЮ копию в public/ — UI читает наш зеркальный файл (§4.11), а не хотлинк.
//  • Данные (имя/описание/класс=rarity/сторона) отдельно зеркалит крон sync-landing.ts →
//    таблица achievements → страница. ЭТОТ скрипт закрывает ТОЛЬКО локальные иконки.
//
// Размерность существующих 109 иконок: 98x112 webp (~4-5КБ). Новые конвертим тем же sharp.
//
// Запуск:
//   node scripts/extract-achievement-icons.mjs            // DRY: список новых + imageLink, без записи
//   node scripts/extract-achievement-icons.mjs --write    // скачать + конвертировать в webp
//   node scripts/extract-achievement-icons.mjs --write --match  // + ужать до 98x112 (как старые)
//   node scripts/extract-achievement-icons.mjs --q=82     // качество webp (по умолчанию 82)

import { readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const value = (n, d) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : d;
};

const API = 'https://api.tarkov.dev/graphql';
const ICON_DIR = path.resolve('C:\\cta-project\\public\\images\\achievements\\eft');
const QUALITY = Number(value('q', '82'));
const WRITE = flag('write');
const MATCH = flag('match'); // ужать до канона 98x112
const CONCURRENCY = Math.max(1, Math.min(os.cpus().length, 6));

const fmtKB = (b) => `${(b / 1024).toFixed(1)}KB`;

// ── 1. Данные из tarkov.dev (тот же источник, что санкционированный крон) ──
async function fetchAchievements() {
  const query = `query { achievements { id name rarity normalizedRarity side normalizedSide hidden imageLink } }`;
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'cta-portal/dev-achievement-icons' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`tarkov.dev GraphQL: ${JSON.stringify(json.errors)}`);
  }
  return json.data?.achievements ?? [];
}

// ── 2. Скачать PNG по imageLink → webp ──
async function downloadWebp(url, destPath) {
  const res = await fetch(url, { headers: { 'User-Agent': 'cta-portal/dev-achievement-icons' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let pipe = sharp(buf);
  if (MATCH) pipe = pipe.resize(98, 112, { fit: 'inside', withoutEnlargement: true });
  const out = await pipe.webp({ quality: QUALITY, effort: 6, smartSubsample: true }).toBuffer();
  const meta = await sharp(out).metadata();
  await writeFile(destPath, out);
  return { size: out.length, w: meta.width, h: meta.height };
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true });
  const existing = new Set(
    (await readdir(ICON_DIR)).filter((f) => f.endsWith('.webp')).map((f) => f.replace('.webp', '')),
  );

  let all;
  try {
    all = await fetchAchievements();
  } catch (e) {
    console.error(`\n❌ ${e.message}`);
    console.error('   API tarkov.dev недоступен (патч 1.1.0 суточный — вероятно, обновляются). Повторить позже.');
    process.exitCode = 1;
    return;
  }

  const withIcon = all.filter((a) => existing.has(a.id));
  const missingLink = all.filter((a) => !existing.has(a.id) && !a.imageLink);
  const todo = all.filter((a) => !existing.has(a.id) && a.imageLink);

  console.log(`\ntarkov.dev достижений: ${all.length} | локальных webp: ${existing.size}`);
  console.log(`  уже с иконкой: ${withIcon.length}`);
  console.log(`  БЕЗ imageLink (не скачать): ${missingLink.length}`);
  console.log(`  К ИЗВЛЕЧЕНИЮ (новые, есть imageLink): ${todo.length}`);
  if (todo.length === 0) {
    console.log('\nНовых иконок нет — раздел актуален.');
    return;
  }

  console.log('\n=== НОВЫЕ ДОСТИЖЕНИЯ ===');
  for (const a of todo) {
    console.log(`  ${a.id}  ${String(a.rarity).padEnd(11)} ${String(a.side).padEnd(6)} ${a.hidden ? 'H' : ' '}  ${a.name}`);
    console.log(`      ↳ ${a.imageLink}`);
  }
  if (missingLink.length) {
    console.log('\n⚠️  Без imageLink (иконку взять неоткуда — вручную):');
    missingLink.forEach((a) => console.log(`  ${a.id}  ${a.name}`));
  }

  if (!WRITE) {
    console.log('\n── DRY-режим. Запись НЕ выполнялась. Прогнать с --write, чтобы скачать+сконвертировать. ──');
    return;
  }

  console.log(`\n── ЗАПИСЬ: ${todo.length} иконок → ${ICON_DIR} ──`);
  let ok = 0, fail = 0, cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const a = todo[cursor++];
      const dest = path.join(ICON_DIR, `${a.id}.webp`);
      try {
        const r = await downloadWebp(a.imageLink, dest);
        ok++;
        console.log(`  + ${a.id}.webp  ${r.w}x${r.h}  ${fmtKB(r.size)}  (${a.name})`);
      } catch (e) {
        fail++;
        console.error(`  ! ${a.id}  ${a.name}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n--- ИТОГ --- записано: ${ok} | ошибок: ${fail}`);
  console.log('Данные (описание/класс) подтянет крон sync-landing.ts. Проверить страницу /eft/progress/achievements.');
}

main();
