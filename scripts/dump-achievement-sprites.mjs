// scripts/dump-achievement-sprites.mjs
// Скачивает СПРАЙТЫ ВСЕХ достижений EFT (imageLink из tarkov.dev) в одну папку +
// пишет человекочитаемый индекс. Для ручного прогона через Gemini (апскейл+рамка).
//
//   node scripts/dump-achievement-sprites.mjs
//
// Выход: !non-related/achievement-sprites/<id>.png  +  _index.md

import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const OUT = path.resolve('C:\\cta-project\\!non-related\\achievement-sprites');
const LOCAL = path.resolve('C:\\cta-project\\public\\images\\achievements\\eft');

const q = `query { achievements { id name rarity normalizedRarity side normalizedSide hidden imageLink } }`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const localWebp = new Set((await readdir(LOCAL)).filter(f => f.endsWith('.webp')).map(f => f.replace('.webp', '')));

  const res = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }),
  });
  const json = await res.json();
  if (json.errors) { console.error('tarkov.dev API лежит:', JSON.stringify(json.errors)); process.exitCode = 1; return; }
  const all = json.data?.achievements ?? [];
  console.log(`tarkov.dev достижений: ${all.length} | наших локальных webp: ${localWebp.size}`);

  let ok = 0, fail = 0, noLink = 0, cursor = 0;
  async function worker() {
    while (cursor < all.length) {
      const a = all[cursor++];
      if (!a.imageLink) { noLink++; continue; }
      try {
        const r = await fetch(a.imageLink, { headers: { 'User-Agent': 'cta/dev' } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await writeFile(path.join(OUT, `${a.id}.png`), Buffer.from(await r.arrayBuffer()));
        ok++;
      } catch (e) { fail++; console.error(`  ! ${a.id} ${a.name}: ${e.message}`); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(os.cpus().length, 8) }, worker));

  // индекс
  const sorted = [...all].sort((x, y) => (x.rarity || '').localeCompare(y.rarity || '') || (x.name || '').localeCompare(y.name || ''));
  const rows = sorted.map(a => `| ${a.id} | ${a.name} | ${a.rarity ?? ''} | ${a.side ?? ''} | ${a.hidden ? 'скрытое' : ''} | ${localWebp.has(a.id) ? '' : '🆕 нет у нас'} |`);
  const md = `# Спрайты достижений EFT (${all.length})\n\nИсточник: tarkov.dev imageLink. Файлы: \`<id>.png\` в этой папке.\nПрогнать через Gemini (апскейл+рамка) → сохранить как \`<id>.webp\` в \`public/images/achievements/eft/\`.\n\n| id | название | класс | сторона | тип | статус |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
  await writeFile(path.join(OUT, '_index.md'), md, 'utf8');

  console.log(`\n--- ИТОГ --- скачано PNG: ${ok} | ошибок: ${fail} | без imageLink: ${noLink}`);
  console.log(`Папка: ${OUT}`);
  console.log(`Индекс: ${path.join(OUT, '_index.md')}`);
}
main();
