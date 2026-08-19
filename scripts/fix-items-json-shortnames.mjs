// Durability-фикс: правит names+shortNames 4 стример-предметов в ИСТОЧНИКЕ ETL
// public/images/items/eft/items_database.json — чтобы db:etl не откатил правку в БД.
// У новых предметов патча 1.1.0 и имя (EN-капс, местами с опечаткой), и shortName («первые 2 слова»)
// залились мангл. ТОЧЕЧНАЯ scoped-regex замена (минимальный дифф), остальной файл не трогаем.
// Запуск: node scripts/fix-items-json-shortnames.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'public/images/items/eft/items_database.json';
// id → { nameRu, nameEn, short }
const FIXES = {
  '6a3532423ec9d7082a05d430': { nameRu: 'Консервированное мясо', nameEn: 'Can of GigaBeef meat', short: 'GigaBeef' },
  '6a4ce086b5644e9f0a08d08a': { nameRu: 'Модель самолёта LM KC-130', nameEn: 'LM KC-130 model aircraft', short: 'KC-130' },
  '6a35322b81d315afe1018ef3': { nameRu: 'Багет из французской пекарни', nameEn: 'French bakery baguette', short: 'Cocaoo_' },
  '6a3557f841667bc4bb00fea4': { nameRu: 'Бутылка воды YMXC', nameEn: 'Bottle of YMXC water', short: 'YMXC' },
};

let text = readFileSync(FILE, 'utf8');
let ok = 0;

// scoped-замена блока {ru,en} после якоря "<field>": { … } для конкретного id (нежадно от id).
function patchBlock(id, field, ru, en) {
  const re = new RegExp(
    `("id":\\s*"${id}"[\\s\\S]*?"${field}":\\s*\\{\\s*"ru":\\s*)"[^"]*"(,\\s*"en":\\s*)"[^"]*"`,
  );
  if (!re.test(text)) {
    console.warn(`⚠ ${id}: блок "${field}" не найден`);
    return false;
  }
  text = text.replace(re, `$1${JSON.stringify(ru)}$2${JSON.stringify(en)}`);
  return true;
}

for (const [id, f] of Object.entries(FIXES)) {
  const a = patchBlock(id, 'names', f.nameRu, f.nameEn);
  const b = patchBlock(id, 'shortNames', f.short, f.short);
  if (a && b) {
    console.log(`✓ ${id} → «${f.nameRu}» / «${f.short}»`);
    ok++;
  }
}

if (ok > 0) {
  writeFileSync(FILE, text);
  console.log(`Записано ${ok}/4 в ${FILE}`);
}
