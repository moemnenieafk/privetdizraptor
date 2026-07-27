/**
 * АВТОНОМНЫЙ источник медицинских эффектов — SPT-снимок игровой базы.
 * НЕ зависит от api.tarkov.dev (у него этих данных попросту нет: у всех
 * инъекторов properties = {"__typename":"ItemPropertiesStim"} и ничего больше).
 *
 * Тянет templates/items.json (_props медикаментов) + globals.json
 * (config.Health.Effects.Stimulator.Buffs — таблица стим-баффов) → нормализует
 * в `properties.medEffects` и патчит public/images/items/eft/items_database.json,
 * сохраняя существующие __typename и поля.
 *
 * Правило §11: разовый серверный сбор в наше зеркало (дамп-файл), не рантайм-фетч.
 * После прогона: `tsx scripts/etl-items.ts` (перельёт properties_raw в БД).
 *
 * Запуск: node scripts/dump-med-effects-spt.mjs
 *         node scripts/dump-med-effects-spt.mjs --dry   (без записи, только отчёт)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

// Источник: сперва ЛОКАЛЬНЫЙ SPT (оффлайн, версия установки), иначе Git LFS снимок.
const SPT_LOCAL_DIR = 'D:/Games/SPT/SPT/SPT_Data/database';
const SPT_LFS = 'https://media.githubusercontent.com/media/refringe/spt-id-highlighter/main/assets/database';
const CATALOG = 'public/images/items/eft/items_database.json';

const DRY = process.argv.includes('--dry');

/** Типы медикаментов в нашем каталоге. */
const MED_TYPES = new Set([
  'ItemPropertiesMedKit',
  'ItemPropertiesMedicalItem',
  'ItemPropertiesSurgicalKit',
  'ItemPropertiesPainkiller',
  'ItemPropertiesStim',
]);

/**
 * Правки, ПРОВЕРЕННЫЕ V4DYA В ЖИВОЙ ИГРЕ. Снимок SPT отстаёт от лайва на патч-другой,
 * поэтому точечные расхождения чиним здесь, а не в UI — так единственным источником
 * для интерфейса остаётся наше зеркало.
 *
 * При обновлении установки SPT сверить: если игра догнала снимок — строку убрать.
 */
const LIVE_FIXES = {
  // Grizzly снимает боль (проверено в 1.0.5; фандом согласен). В снимке от 2026-03-03
  // Pain в effects_damage нет — добавлен после этой даты.
  '590c657e86f77412b013051d': {
    label: 'Аптечка Grizzly',
    addDamage: [{ effect: 'Pain', cost: 0, delay: 0, duration: 0, healthPenaltyMin: null, healthPenaltyMax: null }],
  },
};

/** tarkov.dev называет уничтоженную конечность иначе, чем игра. */
const CURE_ALIAS = { LostLimb: 'DestroyedPart' };

async function loadSpt(file) {
  const local = `${SPT_LOCAL_DIR}/${file}`;
  if (existsSync(local)) return JSON.parse(readFileSync(local, 'utf8'));
  console.log(`  локально нет, тяну снимок: ${file}`);
  const res = await fetch(`${SPT_LFS}/${file}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`SPT ${file}: HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** effects_damage → плоский список снимаемых состояний с ценой в HP. */
function mapDamage(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw).map(([effect, v]) => ({
    effect,
    cost: num(v?.cost) ?? 0,
    delay: num(v?.delay) ?? 0,
    duration: num(v?.duration) ?? 0,
    // Только у DestroyedPart: диапазон HP, до которого восстанавливается конечность.
    healthPenaltyMin: num(v?.healthPenaltyMin),
    healthPenaltyMax: num(v?.healthPenaltyMax),
  }));
}

/** effects_health → мгновенное изменение шкал (энергия/гидрация). */
function mapHealth(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .map(([resource, v]) => ({ resource, value: num(v?.value) ?? 0 }))
    .filter((r) => r.value !== 0);
}

/** Стим-баффы из globals по имени бакета. */
function mapBuffs(bucket, buffTable) {
  const arr = bucket ? buffTable[bucket] : null;
  if (!Array.isArray(arr)) return [];
  return arr.map((b) => ({
    type: b.BuffType,
    skill: b.SkillName || null,
    chance: num(b.Chance) ?? 1,
    delay: num(b.Delay) ?? 0,
    duration: num(b.Duration) ?? 0,
    value: num(b.Value) ?? 0,
    absolute: b.AbsoluteValue === true,
  }));
}

console.log(existsSync(SPT_LOCAL_DIR) ? `SPT: локальная установка ${SPT_LOCAL_DIR}` : 'SPT: снимок с GitHub LFS');
const [tpl, globals] = await Promise.all([loadSpt('templates/items.json'), loadSpt('globals.json')]);
const buffTable = globals?.config?.Health?.Effects?.Stimulator?.Buffs ?? {};
console.log(`  item-templates: ${Object.keys(tpl).length} · бакетов баффов: ${Object.keys(buffTable).length}`);

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));

let patched = 0;
const fromCatalog = [];
const fixed = [];
const stats = { damage: 0, health: 0, buffs: 0 };

for (const item of catalog) {
  const typename = item.properties?.__typename;
  if (!MED_TYPES.has(typename)) continue;

  const props = tpl[item.id]?._props;
  let effects;

  if (props) {
    effects = {
      // MedKit: запас HP аптечки. Остальные типы: количество применений (0 → одноразовый).
      hpResource: num(props.MaxHpResource) ?? 0,
      hpPerUse: num(props.hpResourceRate) ?? 0,
      useTime: num(props.medUseTime) ?? 0,
      damage: mapDamage(props.effects_damage),
      health: mapHealth(props.effects_health),
      buffs: mapBuffs(props.StimulatorBuffs, buffTable),
    };
  } else {
    // Предмет добавлен патчем позже снимка SPT — собираем из того, что уже есть
    // в каталоге. Списки эффектов беднее, зато метрики и снимаемые состояния верные.
    const p = item.properties;
    effects = {
      hpResource: num(p.hitpoints) ?? num(p.uses) ?? 0,
      hpPerUse: num(p.maxHealPerUse) ?? 0,
      useTime: num(p.useTime) ?? 0,
      damage: (Array.isArray(p.cures) ? p.cures : []).map((c) => ({
        effect: CURE_ALIAS[c] ?? c,
        cost: 0,
        delay: 0,
        duration: 0,
        healthPenaltyMin: null,
        healthPenaltyMax: null,
      })),
      health: [],
      buffs: [],
    };
    fromCatalog.push(`${item.id} · ${item.names?.ru ?? item.names?.en ?? '?'}`);
  }

  const fix = LIVE_FIXES[item.id];
  if (fix?.addDamage) {
    const known = new Set(effects.damage.map((d) => d.effect));
    const added = fix.addDamage.filter((d) => !known.has(d.effect));
    if (added.length) {
      effects.damage.push(...added);
      fixed.push(`${fix.label}: +${added.map((d) => d.effect).join(', ')}`);
    }
  }

  item.properties.medEffects = effects;

  patched += 1;
  if (effects.damage.length) stats.damage += 1;
  if (effects.health.length) stats.health += 1;
  if (effects.buffs.length) stats.buffs += 1;
}

console.log(`\nМедикаментов пропатчено: ${patched}`);
console.log(`  со снимаемыми состояниями: ${stats.damage}`);
console.log(`  с изменением шкал:         ${stats.health}`);
console.log(`  со стим-баффами:           ${stats.buffs}`);
if (fromCatalog.length) {
  console.log(`\n⚠️ Нет в снимке SPT (${fromCatalog.length}) — собраны из каталога:`);
  fromCatalog.forEach((m) => console.log(`   ${m}`));
}
if (fixed.length) {
  console.log(`\nПравки по живой игре (${fixed.length}):`);
  fixed.forEach((m) => console.log(`   ${m}`));
}

if (DRY) {
  console.log('\n--dry: файл не тронут.');
} else {
  writeFileSync(CATALOG, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`\n✅ Записано: ${CATALOG}`);
  console.log('Дальше: tsx scripts/etl-items.ts');
}
