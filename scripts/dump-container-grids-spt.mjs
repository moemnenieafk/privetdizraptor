/**
 * АВТОНОМНЫЙ источник сеток контейнеров/рюкзаков — SPT-снимок game item-templates
 * (refringe/spt-id-highlighter, Git LFS). НЕ зависит от api.tarkov.dev.
 *
 * Тянет items.json → по предметам с `_props.Grids` берёт cellsH/cellsV (размеры)
 * и filters.Filter (id разрешённых категорий/предметов) → резолвит категории в
 * русские имена, предметы — в имена из НАШЕГО каталога → патчит
 * public/images/items/eft/items_database.json (properties.grids), сохраняя
 * существующие __typename/capacity.
 *
 * Правило §11: разовый серверный сбор в наше зеркало (дамп-файл), не рантайм-фетч.
 * После прогона: `tsx scripts/etl-items.ts` (перельёт properties_raw в БД).
 *
 * Запуск: node scripts/dump-container-grids-spt.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

// Источник item-templates: сперва ЛОКАЛЬНЫЙ SPT (оффлайн, актуален версии установки),
// иначе — Git LFS снимок refringe/spt-id-highlighter.
const SPT_LOCAL = 'D:/Games/SPT/SPT/SPT_Data/database/templates/items.json';
const SPT_ITEMS_URL =
  'https://media.githubusercontent.com/media/refringe/spt-id-highlighter/main/assets/database/templates/items.json';

async function loadSpt() {
  if (existsSync(SPT_LOCAL)) {
    console.log(`SPT из локальной установки: ${SPT_LOCAL}`);
    return JSON.parse(readFileSync(SPT_LOCAL, 'utf8'));
  }
  console.log('Локальный SPT не найден — качаю снимок с GitHub LFS...');
  const res = await fetch(SPT_ITEMS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`SPT items.json: HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

// Класс-узел SPT (_name) → русская категория для блока «Вмещает».
// Неизвестный класс → показываем _name как есть (лучше, чем пусто).
const CAT_RU = {
  Equipment: 'Снаряжение',
  BarterItem: 'Предметы для бартера',
  Mod: 'Модификации',
  Info: 'Инфо предметы',
  Key: 'Ключи', KeyMechanical: 'Ключи', Keycard: 'Ключ-карты',
  Map: 'Карты',
  Meds: 'Медикаменты', MedicalSupplies: 'Медматериалы', Stimulator: 'Стимуляторы', MedKit: 'Аптечки', Drugs: 'Лекарства',
  FoodDrink: 'Провизия',
  Knife: 'Ножи',
  StackableItem: 'Расходники',
  SpecItem: 'Спецоборудование',
  Money: 'Деньги',
  Weapon: 'Оружие', Pistol: 'Пистолеты', Smg: 'ПП', AssaultCarbine: 'Карабины',
  AssaultRifle: 'Штурмовые винтовки', Shotgun: 'Дробовики', SniperRifle: 'Снайперские винтовки',
  MarksmanRifle: 'Марксманские винтовки', MachineGun: 'Пулемёты',
  Ammo: 'Боеприпасы', AmmoBox: 'Патроны',
  ThrowWeap: 'Гранаты',
  Backpack: 'Рюкзаки', Vest: 'Разгрузки',
  Magazine: 'Магазины',
  Compass: 'Компасы', PortableRangeFinder: 'Дальномеры',
  RepairKits: 'Ремкомплекты',
  Fuel: 'ГСМ', Jewelry: 'Ценности', Tool: 'Инструменты',
  Headphones: 'Наушники', Headwear: 'Шлемы', FaceCover: 'Маски', Visors: 'Очки и визоры', Eyewear: 'Очки',
  Armor: 'Бронежилеты', ArmorVest: 'Бронежилеты', ChestRig: 'Разгрузки', ArmBand: 'Повязки',
};

async function main() {
  const spt = await loadSpt();
  const gridCount = Object.values(spt).filter((t) => t?._props?.Grids?.length).length;
  console.log(`SPT: ${Object.keys(spt).length} шаблонов, с Grids: ${gridCount}`);

  const file = path.join(process.cwd(), 'public/images/items/eft/items_database.json');
  const db = JSON.parse(readFileSync(file, 'utf8'));
  const ours = new Map(db.map((it) => [it.id, it]));

  const resolveFilters = (filters) => {
    const cats = new Map();
    const items = new Map();
    for (const f of filters || []) {
      for (const fid of f.Filter || []) {
        const t = spt[fid];
        if (!t) continue;
        if (t._type === 'Node') {
          if (t._name === 'Item') continue; // корневой «любой предмет» — неинформативно
          cats.set(fid, CAT_RU[t._name] || t._name);
        } else if (t._type === 'Item') {
          const o = ours.get(fid);
          items.set(fid, { id: fid, name: o?.names?.ru, shortName: o?.shortNames?.ru });
        }
      }
    }
    const allowedCategories = [...cats].map(([id, name]) => ({ id, name }));
    const allowedItems = [...items.values()];
    if (!allowedCategories.length && !allowedItems.length) return undefined;
    return { allowedCategories, allowedItems };
  };

  let patched = 0;
  for (const it of db) {
    const grids = spt[it.id]?._props?.Grids;
    if (!Array.isArray(grids) || !grids.length) continue;
    it.properties = {
      ...(it.properties ?? {}),
      grids: grids.map((g) => ({
        width: g._props?.cellsH ?? 0,
        height: g._props?.cellsV ?? 0,
        filters: resolveFilters(g._props?.filters),
      })),
    };
    patched++;
  }
  console.log(`Пропатчено из SPT: ${patched}`);

  // Ручные оверрайды: сетки, проставленные вручную для свежих предметов, которых
  // ещё нет в SPT (src/data/container-grid-overrides.json). Заполненные (>0) —
  // накладываются поверх; allowedCats (строка через запятую) → «вмещает».
  const ovPath = path.join(process.cwd(), 'src/data/container-grid-overrides.json');
  let ovApplied = 0;
  if (existsSync(ovPath)) {
    const ov = JSON.parse(readFileSync(ovPath, 'utf8'));
    const byId = new Map(db.map((it) => [it.id, it]));
    for (const [id, entry] of Object.entries(ov.items ?? {})) {
      const grids = (entry.grids ?? [])
        .filter((g) => Number(g.width) > 0 && Number(g.height) > 0)
        .map((g) => ({ width: Number(g.width), height: Number(g.height) }));
      if (!grids.length) continue;
      const it = byId.get(id);
      if (!it) continue;
      const cats = String(entry.allowedCats ?? '')
        .split(',').map((s) => s.trim()).filter(Boolean)
        .map((name) => ({ id: name, name }));
      if (cats.length) grids[0] = { ...grids[0], filters: { allowedCategories: cats, allowedItems: [] } };
      it.properties = {
        ...(it.properties ?? {}),
        __typename: it.properties?.__typename ?? 'ItemPropertiesContainer',
        capacity: grids.reduce((s, g) => s + g.width * g.height, 0),
        grids,
      };
      ovApplied++;
    }
  }
  console.log(`Применено ручных оверрайдов: ${ovApplied}`);

  writeFileSync(file, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`Готово: ${path.basename(file)}. Дальше: tsx scripts/etl-items.ts`);
}

main().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exit(1);
});
