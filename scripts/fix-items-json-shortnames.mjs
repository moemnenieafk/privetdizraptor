// Durability-фикс: правит shortNames (ru+en) 4 стример-предметов в ИСТОЧНИКЕ ETL
// public/images/items/eft/items_database.json — чтобы db:etl не откатил правку в БД.
// ТОЧЕЧНАЯ текст-замена (scoped-regex от id до его shortNames) — минимальный дифф, остальной
// файл (5266 предметов, unicode-эскейпы) не трогаем. Запуск: node scripts/fix-items-json-shortnames.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'public/images/items/eft/items_database.json';
// id → верный shortName
const FIXES = {
  '6a3532423ec9d7082a05d430': 'GigaBeef',
  '6a4ce086b5644e9f0a08d08a': 'KC-130',
  '6a35322b81d315afe1018ef3': 'Cocaoo_',
  '6a3557f841667bc4bb00fea4': 'YMXC',
};

let text = readFileSync(FILE, 'utf8');
let ok = 0;

for (const [id, short] of Object.entries(FIXES)) {
  // От "id":"<ID>" (нежадно) до ПЕРВОГО его shortNames-блока → заменяем ru и en.
  const re = new RegExp(
    `("id":\\s*"${id}"[\\s\\S]*?"shortNames":\\s*\\{\\s*"ru":\\s*)"[^"]*"(,\\s*"en":\\s*)"[^"]*"`,
  );
  const m = text.match(re);
  if (!m) {
    console.warn(`⚠ ${id}: shortNames-блок не найден — пропуск`);
    continue;
  }
  text = text.replace(re, `$1${JSON.stringify(short)}$2${JSON.stringify(short)}`);
  console.log(`✓ ${id} → shortName «${short}»`);
  ok++;
}

if (ok > 0) {
  writeFileSync(FILE, text);
  console.log(`Записано ${ok}/4 в ${FILE}`);
}
