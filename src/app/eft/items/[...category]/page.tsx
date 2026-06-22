import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';
import { ItemsCategoryClient, CategoryItem } from './ItemsCategoryClient';
import { HubNav } from '@/components/features/items/HubNav';
import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';
import {
  buildBarterData,
  buildCraftData,
  buildQuestIndicators,
  type RawBarter,
  type RawCraft,
  type BarterUnlockInfo,
} from '@/lib/eft-indicators.economics';
import type { EftBarterData, EftCraftData } from '@/components/features/items/EftItemTile';
import { EFT_QUESTS } from '@/data/quests';

interface Props {
  params: Promise<{ category: string[] }>;
}

// Вспомогательная функция для рекурсивного поиска узла в меню
function findNodeByPath(items: MenuItem[], targetPath: string): MenuItem | null {
  for (const item of items) {
    if (item.path === targetPath) return item;
    if (item.children) {
      const found = findNodeByPath(item.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

// Извлекает уникальные предметы из всех квест-заданий (тип giveItem)
async function getQuestItems(): Promise<CategoryItem[]> {
  const query = `
    query {
      tasks(lang: ru) {
        objectives {
          type
          ... on TaskObjectiveItem {
            items {
              id
              normalizedName
              name
              shortName
              width
              height
              weight
              basePrice
              image512pxLink
              types
              bsgCategoryId
              backgroundColor
              sellFor { price priceRUB currency vendor { name normalizedName } }
              buyFor  { price priceRUB currency vendor { name normalizedName } }
            }
            count
            foundInRaid
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 },
    });

    const json = await res.json();

    if (json.errors) {
      console.error('GraphQL Errors in getQuestItems:', JSON.stringify(json.errors, null, 2));
      return [];
    }

    const tasks: any[] = json.data?.tasks || [];  
    const itemMap = new Map<string, any>();  

    for (const task of tasks) {
      for (const obj of (task.objectives || [])) {
        if (obj.type === 'giveItem') {
          for (const item of (obj.items || [])) {
            if (item?.id && !itemMap.has(item.id)) {
              itemMap.set(item.id, item);
            }
          }
        }
      }
    }

     
    return Array.from(itemMap.values()).map((item: any) => {
      const bestSell = item.sellFor?.reduce((prev: any, current: any) =>
        (prev.price > current.price) ? prev : current
      , { price: 0 });

      const rubVal = (p: any) => p.priceRUB ?? p.price;  
      const validBuyFor = item.buyFor?.filter((b: any) => rubVal(b) > 0) || [];  
      const bestBuy = validBuyFor.length > 0
        ? validBuyFor.reduce((prev: any, current: any) => rubVal(current) < rubVal(prev) ? current : prev)  
        : null;

      const minPrice = bestBuy ? rubVal(bestBuy) : (item.basePrice || 0);
      const slots = (item.width || 1) * (item.height || 1);
      const vps = slots > 0 ? Math.round((bestSell?.price || 0) / slots) : 0;

      return {
        ...item,
        eco: {
          bestSell: { price: bestSell?.price || 0, vendor: bestSell?.vendor },
          bestBuy: bestBuy ? { vendor: bestBuy.vendor } : undefined,
          minPrice,
          vps,
        },
      };
    });
  } catch (error) {
    console.error('Fetch error in getQuestItems:', error);
    return [];
  }
}

// ─── Shared eco mapping helper ────────────────────────────────────────────────

 
function mapItemsToEco(items: any[]): CategoryItem[] {
   
  return items.map((item: any) => {
     
    const bestSell = item.sellFor?.reduce((prev: any, current: any) =>
      (prev.price > current.price) ? prev : current
    , { price: 0 });
     
    const rubVal = (p: any) => p.priceRUB ?? p.price;
     
    const validBuyFor = item.buyFor?.filter((b: any) => rubVal(b) > 0) || [];
    const bestBuy = validBuyFor.length > 0
       
      ? validBuyFor.reduce((prev: any, current: any) => rubVal(current) < rubVal(prev) ? current : prev)
      : null;
    const minPrice = bestBuy ? rubVal(bestBuy) : (item.basePrice || 0);
    const slots = (item.width || 1) * (item.height || 1);
    const vps = slots > 0 ? Math.round((bestSell?.price || 0) / slots) : 0;
    return {
      ...item,
      eco: {
        bestSell: { price: bestSell?.price || 0, vendor: bestSell?.vendor },
        bestBuy: bestBuy ? { vendor: bestBuy.vendor } : undefined,
        minPrice,
        vps,
      },
    };
  });
}

// ─── Gear hub: поля GQL для параллельных запросов ─────────────────────────────

const GEAR_GQL_FIELDS = `
  id
  normalizedName
  name
  shortName
  width
  height
  weight
  basePrice
  image512pxLink
  types
  bsgCategoryId
  backgroundColor
  properties {
    __typename
    ... on ItemPropertiesHelmet {
      class
      durability
      deafening
      blocksHeadset
      blindnessProtection
      ergoPenalty
      speedPenalty
      turnPenalty
      armorType
    }
    ... on ItemPropertiesArmor {
      class
      durability
      ergoPenalty
      speedPenalty
      turnPenalty
      armorType
    }
    ... on ItemPropertiesGlasses {
      class
      durability
      blindnessProtection
      ergoPenalty
    }
    ... on ItemPropertiesArmorAttachment {
      class
      durability
      blindnessProtection
      ergoPenalty
      speedPenalty
      turnPenalty
      armorType
    }
    ... on ItemPropertiesChestRig {
      class
      durability
      capacity
      ergoPenalty
      speedPenalty
      turnPenalty
      armorType
    }
    ... on ItemPropertiesBackpack {
      capacity
      ergoPenalty
      speedPenalty
      turnPenalty
    }
    ... on ItemPropertiesContainer {
      capacity
    }
    ... on ItemPropertiesHeadphone {
      ambientVolume
      distanceModifier
    }
  }
  sellFor { price priceRUB currency vendor { name normalizedName } }
  buyFor { price priceRUB currency vendor { name normalizedName } }
`;

 
async function fetchGearItems(filterClause: string): Promise<any[]> {
  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        query: `query { items(${filterClause} lang: ru) { ${GEAR_GQL_FIELDS} } }`,
      }),
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    if (json.errors) return [];
    return json.data?.items || [];
  } catch {
    return [];
  }
}

// ─── Gear hub: BSG-категории Спецоборудования (wearable type overlap) ─────────

const SPECIALEQUIPMENT_BSG_IDS = new Set([
  '5a2c3a9486f774688b05e574', // NVG-устройства (ПНВ, GPNVG)
  '5d21f59b6dbe99052b54ef83', // Тепловизоры (T-7)
  '5b3f15d486f77432d0509248', // Нарукавные повязки
  '5f4fbaaca5573a5ac31db429', // Компас
]);

// ─── Карабины: дефолтные пресеты (полные сборки «По умолчанию») ───────────────
// BSG-категории базовых карабинов:
//   5447b5f1… — общая AR/Carbine (карабины = base.name начинается с «Карабин»)
//   5447b5fc… — полуавтоматические карабины (СКС, СВТ-40, АС «Вал», ВПО-101, СР-3М…)
const CARBINE_BASE_AR = '5447b5f14bdc2d61278b4567';
const CARBINE_BASE_SEMI = '5447b5fc4bdc2d87278b4567';

interface PresetWeaponProps {
  caliber?: string | null;
  fireRate?: number | null;
}
interface PresetProps {
  default?: boolean | null;
  ergonomics?: number | null;
  recoilVertical?: number | null;
  recoilHorizontal?: number | null;
  baseItem?: { name?: string | null; bsgCategoryId?: string | null; properties?: PresetWeaponProps | null } | null;
}
interface PresetRaw extends Omit<CategoryItem, 'properties'> {
  bsgCategoryId?: string;
  properties: PresetProps | null;
}

async function getCarbinePresets(): Promise<CategoryItem[]> {
  const query = `
    query {
      items(types: [preset], lang: ru) {
        id
        normalizedName
        name
        shortName
        width
        height
        weight
        basePrice
        image512pxLink
        types
        bsgCategoryId
        backgroundColor
        properties {
          ... on ItemPropertiesPreset {
            default
            ergonomics
            recoilVertical
            recoilHorizontal
            baseItem {
              name
              bsgCategoryId
              properties { ... on ItemPropertiesWeapon { caliber fireRate } }
            }
          }
        }
        sellFor { price priceRUB currency vendor { name normalizedName } }
        buyFor { price priceRUB currency vendor { name normalizedName } }
      }
    }
  `;

  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 },
    });
    const json = await res.json() as { data?: { items: PresetRaw[] }; errors?: unknown };
    if (json.errors) {
      console.error('GraphQL Errors in getCarbinePresets:', JSON.stringify(json.errors, null, 2));
      return [];
    }

    const carbines = (json.data?.items ?? []).filter((i) => {
      const p = i.properties;
      if (!p?.default) return false;
      const base = p.baseItem;
      if (!base) return false;
      return (
        (base.bsgCategoryId === CARBINE_BASE_AR && /^Карабин/i.test(base.name ?? '')) ||
        base.bsgCategoryId === CARBINE_BASE_SEMI
      );
    });

    // Уплощаем статы пресета + калибр/темп из базового оружия в плоский CategoryItemProperties
    const flattened: CategoryItem[] = carbines.map((i) => {
      const p = i.properties!;
      return {
        ...i,
        properties: {
          ergonomics: p.ergonomics ?? null,
          recoilVertical: p.recoilVertical ?? null,
          recoilHorizontal: p.recoilHorizontal ?? null,
          caliber: p.baseItem?.properties?.caliber ?? null,
          fireRate: p.baseItem?.properties?.fireRate ?? null,
        },
      };
    });

    return mapItemsToEco(flattened);
  } catch (error) {
    console.error('Fetch error in getCarbinePresets:', error);
    return [];
  }
}

// BFF Pattern: Серверный запрос к GraphQL с маппингом категорий
async function getCategoryItems(slug: string): Promise<CategoryItem[]> {
  if (slug === 'quest-items') return getQuestItems();

  // Карабины показываем как дефолтные пресеты (полные сборки), а не голые ресиверы
  if (slug === 'carbine') return getCarbinePresets();

  // Снаряжение (gear hub): агрегирует 9 подразделов через 3 параллельных запроса.
  // types-запрос покрывает 7 подразделов; маски и компоненты снаряжения —
  // отдельные BSG-категории, недоступные через types[].
  if (slug === 'gear') {
    const [typeItems, maskItems, componentItems] = await Promise.all([
      fetchGearItems('types: [armor, backpack, container, glasses, headphones, helmet, wearable, rig],'),
      fetchGearItems('bsgCategoryId: "5a341c4686f77469e155819e",'), // Маски
      fetchGearItems('bsgCategoryId: "57bef4c42459772e8d35a53b",'), // Компоненты снаряжения
    ]);
    const seen = new Set<string>();
     
    const merged = [...typeItems, ...maskItems, ...componentItems].filter((item: any) => {
      if (!item.id || seen.has(item.id) || SPECIALEQUIPMENT_BSG_IDS.has(item.bsgCategoryId)) return false;
      seen.add(item.id);
      return true;
    });
    return mapItemsToEco(merged);
  }

  // Расширенный маппинг наших URL-категорий на типы GraphQL tarkov.dev
  const typeMapping: Record<string, string> = {
    // Снаряжение
    'gear': 'armor, backpack, container, glasses, headphones, helmet, wearable, rig',
    'armor': 'armor',
    'backpacks': 'backpack',
    'glasses': 'glasses',
    'headphones': 'headphones',
    'helmets': 'helmet, wearable',
    'rigs': 'rig',
    'visors': 'mods',
    // Контейнеры (перенесены под gear)
    'containers': 'container',
    'cases': 'container',
    'secure': 'noFlea',
    'secure-containers': 'noFlea',
    'storage-containers': 'container',
    // Оружие (новая плоская структура)
    'weapons': 'gun',
    'ar': 'gun',
    'bolt': 'gun',
    'dmr': 'gun',
    'gl': 'gun',
    'grenades': 'grenade',
    'lmg': 'gun',
    // 'melee' → bsgCategoryMapping (wearable type, не gun)
    'shotgun': 'gun',
    'sidearm': 'gun',
    'smg': 'gun',
    'special': 'gun', // bsgMultiCategoryFilter сужает до двух BSG-категорий
    // 'gl' → bsgCategoryMapping (RShG-2)
    // Моды (перенесены на верхний уровень)
    'mods': 'mods',
    'vitalparts': 'mods',
    'functional': 'mods',
    'elements': 'mods',
    'auxiliary': 'mods',
    'auxiliary-parts': 'mods',
    'barrels': 'mods',
    'bipods': 'mods',
    'charginghandles': 'mods',
    'foregrips': 'mods',
    'gasblocks': 'mods',
    'handguards': 'mods',
    'laser': 'mods',
    'launchers': 'mods',
    'light-laser-devices': 'mods',
    'magazines': 'mods',
    'mounts': 'mods',
    'muzzle': 'mods',
    'pistolgrips': 'mods',
    'receivers': 'mods',
    'receivers-slides': 'mods',
    'sights': 'mods',
    'stocks': 'mods',
    // Боеприпасы
    // ammo = агрегат (одиночные + пачки), rounds = только одиночные (post-filter), ammo-boxes = только пачки
    'ammo': 'ammo, ammoBox',
    'rounds': 'ammo',
    'ammo-boxes': 'ammoBox',
    // Бартер-предметы
    'barter': 'barter',
    'valuables': 'barter',
    'electronics': 'barter',
    'tools': 'barter',
    'flammable-materials': 'barter',
    'building-materials': 'barter',
    'household-materials': 'barter',
    'medical-supplies': 'barter',
    'energy-elements': 'barter',
    'others': 'barter',
    'specialequipment': 'mods, wearable',
    // Медикаменты
    'meds': 'meds',
    'injury': 'meds',
    'injectors': 'injectors',
    'medkits': 'meds',
    'pills': 'meds',
    // Ключи
    'keys': 'keys',
    'mechanical': 'keys',
    'keycards': 'keys',
    // Провизия
    'provisions': 'provisions',
    'drinks': 'provisions',
    'food': 'provisions',
    // Агрегированная категория: Очки, ПНВ/Тепловизоры (glasses), Визоры (mods+armorType)
    'eyewear': 'glasses, mods',
    // Легаси slugs (обратная совместимость)
    'guns': 'gun, ammo, grenade, mods',
    'firearms': 'gun',
    'equipment': 'meds, keys, container, provisions',
    'marked': 'keys',
    'quest': 'keys',
  };

  // Категории, фильтруемые по bsgCategoryId (нет в ItemType enum)
  const bsgCategoryMapping: Record<string, string> = {
    'info': '5448ecbe4bdc2d60728b4568',
    'info-items': '5448ecbe4bdc2d60728b4568',
    // Штурмовые винтовки: AK-серия, M4A1, HK 416, SCAR, AUG и др.
    // BSG смешивает AR и карабины в одной категории → post-filter убирает "Карабин"-префикс
    'ar': '5447b5f14bdc2d61278b4567',
    // carbine: НЕ здесь — обрабатывается отдельно через getCarbinePresets() (types:[preset], default-сборки)
    // Пистолеты-пулемёты: MP5, MP7, PP-19, KRISS Vector, ПП-91 и др.
    'smg': '5447b5e04bdc2d62278b4567',
    // Пистолеты: Glock, M9A3, TT, ПМ, Desert Eagle и др.
    'sidearm': '5447b5cf4bdc2d65278b4567',
    // Пулемёты: PKM, PKP, RPK-16, M60, RPD и др.
    'lmg': '5447bed64bdc2d97278b4568',
    // Дробовики: МП-133, МП-153, Mossberg 590A1, Remington 870, Saiga-12 и др.
    'shotgun': '5447b6094bdc2dc3278b4567',
    // Болтовые винтовки: СВ-98, ДВЛ-10, Мосина и др.
    'bolt': '5447b6254bdc2dc3278b4568',
    // Пехотные винтовки (DMR): ВСС, СВД, МК-18, SCAR-H, M1A и др.
    'dmr': '5447b6194bdc2d67278b4567',
    // Холодное оружие: ножи, топоры, сабли, штыки — тип wearable, не gun
    'melee': '5447e1d04bdc2dff2f8b4567',
    // Специальное оружие: РШГ-2 — вручную в Гранатомёты
    'gl': '67446d4f04141c10630604e7',
    'masks': '5a341c4686f77469e155819e',
    'facecovers': '5a341c4686f77469e155819e',
    // Компоненты снаряжения (gear-components): визоры, бронезабрало, мандибулы, доп.бронирование
    'components': '57bef4c42459772e8d35a53b',
    // Провизия — прямой запрос по BSG (обходим засорение медикаментами из типа `provisions`)
    'food':   '5448e8d04bdc2ddf718b4569',
    'drinks': '5448e8d64bdc2dce718b4568',
    // Бартер-подкатегории
    'others':              '590c745b86f7743cc433c5f2',
    'valuables':           '57864a3d24597754843f8721',
    'electronics':         '57864a66245977548f04a81f',
    'tools':               '57864bb7245977548b3b66c2',
    'household-materials': '57864c322459775490116fbf',
    'building-materials':  '57864ada245977548638de91',
    'medical-supplies':    '57864c8c245977548867e7f1',
    'energy-elements':     '57864ee62459775490116fc1',
    // Ключи-подкатегории
    'mechanical': '5c99f98d86f7745c314214b3', // все механические (227)
    'marked':     '5c99f98d86f7745c314214b3', // + post-filter normalizedName.includes('marked')
    'quest':      '5c99f98d86f7745c314214b3', // + post-filter types.includes('noFlea')
    'keycards':   '5c164d2286f774194c5e69fa', // лабораторные карты (29)
    // Мод-подкатегории: types[] содержит только 'mods' — фильтр по bsgCategoryId обязателен
    'gasblocks':        '56ea9461d2720b67698b456f',
    'receivers':        '55818a304bdc2db5418b457d',
    'receivers-slides': '55818a304bdc2db5418b457d',
    'pistolgrips':      '55818a684bdc2ddd698b456d',
    'barrels':          '555ef6e44bdc2de9068b457e',
    'handguards':       '55818a104bdc2db9688b4569',
    'auxiliary':        '5a74651486f7744e73386dd1',
    'auxiliary-parts':  '5a74651486f7744e73386dd1',
    'bipods':           '55818afb4bdc2dde698b456d',
    'foregrips':        '55818af64bdc2d5b648b4570',
    'mounts':           '55818b224bdc2dde698b456f',
    'magazines':        '5448bc234bdc2d3c308b4569',
    'stocks':           '55818a594bdc2db9688b456a',
    'charginghandles':  '55818a6f4bdc2db9688b456b',
    'launchers':        '55818b014bdc2ddc698b456b',
  };

  // Мод-категории с несколькими BSG-разделами: запрос types:[mods] + post-filter по bsgCategoryId
  const bsgMultiCategoryFilter: Record<string, Set<string>> = {
    // Хаб-категории (агрегируют дочерние BSG-разделы)
    'vitalparts': new Set([
      '56ea9461d2720b67698b456f', // gasblocks
      '55818a304bdc2db5418b457d', // receivers
      '55818a684bdc2ddd698b456d', // pistolgrips
      '555ef6e44bdc2de9068b457e', // barrels
      '55818a104bdc2db9688b4569', // handguards
    ]),
    'functional': new Set([
      '5a74651486f7744e73386dd1', // auxiliary
      '550aa4bf4bdc2dd6348b456b', // flash hiders
      '550aa4cd4bdc2dd8348b456c', // suppressors
      '550aa4dd4bdc2dc9348b4569', // chokes
      '55818ad54bdc2ddc698b4569', // red dots / holo
      '55818add4bdc2d5b648b456f', // hybrid scopes
      '55818ac54bdc2d5b648b456e', // iron sights
      '55818ae44bdc2dde698b456c', // riflescopes
      '55818acf4bdc2dde698b456b', // reflex sights
      '55818aeb4bdc2ddc698b456a', // thermal scopes
      '55818b164bdc2ddc698b456c', // tactical devices
      '55818b084bdc2d5b648b4571', // flashlights
      '55818afb4bdc2dde698b456d', // bipods
      '55818af64bdc2d5b648b4570', // foregrips
    ]),
    'elements': new Set([
      '55818b224bdc2dde698b456f', // mounts
      '5448bc234bdc2d3c308b4569', // magazines
      '55818a594bdc2db9688b456a', // stocks
      '55818a6f4bdc2db9688b456b', // charginghandles
      '55818b014bdc2ddc698b456b', // launchers
    ]),
    // Бартер-категории с несколькими BSG-разделами
    'flammable-materials': new Set(['57864e4c24597754843f8723', '5d650c3e815116009f6201d2']),
    // Листовые мод-категории с несколькими BSG-разделами
    'muzzle': new Set(['550aa4bf4bdc2dd6348b456b', '550aa4cd4bdc2dd8348b456c', '550aa4dd4bdc2dc9348b4569']),
    'sights': new Set(['55818ad54bdc2ddc698b4569', '55818add4bdc2d5b648b456f', '55818ac54bdc2d5b648b456e', '55818ae44bdc2dde698b456c', '55818acf4bdc2dde698b456b', '55818aeb4bdc2ddc698b456a']),
    'laser': new Set(['55818b164bdc2ddc698b456c', '55818b084bdc2d5b648b4571']),
    'light-laser-devices': new Set(['55818b164bdc2ddc698b456c', '55818b084bdc2d5b648b4571']),
    // Провизия-агрегат: тип provisions засорён медикаментами, оставляем только еду и напитки
    'provisions': new Set(['5448e8d04bdc2ddf718b4569', '5448e8d64bdc2dce718b4568']),
    // Специальное оружие: revolvers + Milkor | SP-81 + RSP-30/ROP-30 + FN40GL Mk2
    'special': new Set([
      '617f1ef5e8b54b0998387733', // RSh-12, MTs-255-12, Chiappa Rhino, Milkor M32A1
      '5447bedf4bdc2d87278b4568', // SP-81, RSP-30, ROP-30, FN40GL Mk2 standalone
    ]),
    // Спецоборудование: ПНВ + тепловизоры + повязки + компас
    'specialequipment': new Set([
      '5a2c3a9486f774688b05e574', // NVG devices (PVS-14, GPNVG-18, PVS-31A)
      '5d21f59b6dbe99052b54ef83', // Thermal devices (T-7)
      '5b3f15d486f77432d0509248', // Armbands (повязки на плечо)
      '5f4fbaaca5573a5ac31db429', // Compass (компас)
    ]),
  };

  const gqlType = typeMapping[slug];
  const bsgCategoryId = bsgCategoryMapping[slug];

  const typeFilter = gqlType ? `types: [${gqlType}]` : '';
  const bsgFilter = bsgCategoryId ? `bsgCategoryId: "${bsgCategoryId}"` : '';
  const activeFilter = bsgFilter || typeFilter;

  const query = `
    query {
      items(${activeFilter ? activeFilter + ',' : ''} lang: ru) {
        id
        normalizedName
        name
        shortName
        width
        height
        weight
        basePrice
        image512pxLink
        types
        bsgCategoryId
        backgroundColor
        properties {
          __typename
          ... on ItemPropertiesHelmet {
            class
            durability
            deafening
            blocksHeadset
            blindnessProtection
            ergoPenalty
            speedPenalty
            turnPenalty
            armorType
          }
          ... on ItemPropertiesArmor {
            class
            durability
            ergoPenalty
            speedPenalty
            turnPenalty
            armorType
          }
          ... on ItemPropertiesGlasses {
            class
            durability
            blindnessProtection
            ergoPenalty
          }
          ... on ItemPropertiesNightVision {
            nvgIntensity: intensity
            noiseIntensity
          }
          ... on ItemPropertiesArmorAttachment {
            class
            durability
            blindnessProtection
            ergoPenalty
            speedPenalty
            turnPenalty
            armorType
          }
          ... on ItemPropertiesChestRig {
            class
            durability
            capacity
            ergoPenalty
            speedPenalty
            turnPenalty
            armorType
          }
          ... on ItemPropertiesBackpack {
            capacity
            ergoPenalty
            speedPenalty
            turnPenalty
          }
          ... on ItemPropertiesHeadphone {
            ambientVolume
            distanceModifier
          }
          ... on ItemPropertiesAmmo {
            caliber
            damage
            penetrationPower
            armorDamage
            fragmentationChance
          }
          ... on ItemPropertiesWeapon {
            caliber
            ergonomics
            recoilVertical
            recoilHorizontal
            fireRate
            sightingRange
          }
          ... on ItemPropertiesWeaponMod {
            ergonomics
            recoilModifier
            accuracyModifier
          }
          ... on ItemPropertiesScope {
            ergonomics
            recoilModifier
            zoomLevels
            sightingRange
          }
          ... on ItemPropertiesGrenade {
            type
            fragments
            fuse
            maxExplosionDistance
          }
          ... on ItemPropertiesContainer {
            capacity
          }
          ... on ItemPropertiesMedKit {
            hitpoints
            useTime
            cures
          }
          ... on ItemPropertiesMedicalItem {
            uses
            useTime
            cures
          }
          ... on ItemPropertiesPainkiller {
            uses
            useTime
            cures
          }
          ... on ItemPropertiesSurgicalKit {
            uses
            useTime
            cures
          }
        }
        sellFor { price priceRUB currency vendor { name normalizedName } }
        buyFor { price priceRUB currency vendor { name normalizedName } }
      }
    }
  `;

  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 }, // Кэшируем на 1 час (ISR)
    });

    const json = await res.json();
    
    if (json.errors) {
      console.error('GraphQL Errors:', JSON.stringify(json.errors, null, 2));
      return [];
    }

    let items = json.data?.items || [];

    // Фолбэк-фильтрация на сервере для специфичных категорий (например, Кейсы)
    if (slug === 'secure' || slug === 'secure-containers') {
      // Настоящие защищённые контейнеры (Alpha/Beta/Gamma/Kappa…): types = ['noFlea'] only, без 'container'
       
      items = items.filter((i: any) =>
        i.properties?.__typename === 'ItemPropertiesContainer' &&
        !i.types?.includes('container')
      );
    } else if (slug === 'storage-containers') {
       
      items = items.filter((i: any) => !i.types?.includes('markedOnly'));
    } else if (slug === 'cases') {
       
      items = items.filter((i: any) => /кейс/i.test(i.name ?? ''));
    } else if (slug === 'medkits') {
       
      items = items.filter((i: any) => i.properties?.__typename === 'ItemPropertiesMedKit');
    } else if (slug === 'injury') {
      // Обработка ранений: бинты/шины/жгуты (MedicalItem) + хирургические наборы (SurgicalKit)
      // BSG category 5448f3ac4bdc2dce718b4569
       
      items = items.filter((i: any) =>
        i.properties?.__typename === 'ItemPropertiesMedicalItem' ||
        i.properties?.__typename === 'ItemPropertiesSurgicalKit'
      );
    } else if (slug === 'pills') {
      // Только таблетки: ItemPropertiesPainkiller с именем "Таблетки …" (мази и шприцы — в других разделах)
       
      items = items.filter((i: any) =>
        i.properties?.__typename === 'ItemPropertiesPainkiller' &&
        /^таблетки/i.test(i.name ?? '')
      );
    } else if (slug === 'ar') {
      // BSG смешивает AR и Карабины в одной категории 5447b5f14bdc2d61278b4567.
      // Убираем «Карабин»-префиксные позиции (ADAR, TX-15, ВПО-136 и др.) — они идут в carbine.
       
      items = items.filter((i: any) => !/^Карабин/i.test(i.name ?? ''));
    } else if (slug === 'rounds') {
      // Только одиночные патроны — исключаем пачки и гранаты (ammo+grenade dual-type)
       
      items = items.filter((i: any) => !i.types?.includes('ammoBox') && !i.types?.includes('grenade'));
    } else if (slug === 'helmets') {
      // Шлемы + крепёжные элементы шлема (бронезабрало, мандибулы, доп.бронирование) из gear-components
      const helmetAttachPattern = /бронезабрало|мандибул|дополнительное бронирование/i;
       
      items = items.filter((i: any) =>
        i.types?.includes('helmet') ||
        (i.bsgCategoryId === '57bef4c42459772e8d35a53b' && helmetAttachPattern.test(i.name ?? ''))
      );
    } else if (slug === 'components') {
      // Компоненты снаряжения (gear-components): из 47 предметов исключаем те, что идут в шлемы
      const helmetAttachPattern = /бронезабрало|мандибул|дополнительное бронирование/i;
       
      items = items.filter((i: any) => !helmetAttachPattern.test(i.name ?? ''));
    } else if (slug === 'eyewear') {
      // Из mods оставляем: визоры (armorType), ПНВ-устройства (nvgIntensity или имя)
      // Бронезабрало исключаем — они идут в шлемы
       
      items = items.filter((i: any) =>
        !/бронезабрало/i.test(i.name ?? '') &&
        (
          !i.types?.includes('mods') ||
          i.properties?.armorType != null ||
          i.properties?.nvgIntensity != null ||
          /прибор ночного видения/i.test(i.name ?? '')
        )
      );
    } else if (slug === 'marked') {
      // Меченые ключи: нет отдельного типа в API, идентифицируем по normalizedName
       
      items = items.filter((i: any) => i.normalizedName?.includes('marked'));
    } else if (slug === 'quest') {
      // Квестовые ключи: quest-тип для ключей отсутствует в API — используем noFlea
      // (квест-ключи запрещены к торговле на барахолке)
       
      items = items.filter((i: any) => i.types?.includes('noFlea'));
    }

    // Мод-подкатегории с несколькими BSG-разделами: запрос вернул все mods → фильтруем по bsgCategoryId
    const bsgMultiSet = bsgMultiCategoryFilter[slug];
    if (bsgMultiSet) {
       
      items = items.filter((i: any) => bsgMultiSet.has(i.bsgCategoryId));
    }

    return mapItemsToEco(items);
  } catch (error) {
    console.error('Fetch error in getCategoryItems:', error);
    return [];
  }
}

// Загружаем бартеры Рефа (Забора) за ГП монеты: item.id → кол-во ГП монет
async function getGpCoinBarters(): Promise<Record<string, number>> {
  const query = `
    query {
      barters {
        trader { normalizedName }
        requiredItems { item { shortName } count }
        rewardItems { item { id } count }
      }
    }
  `;
  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 },
    });
    const json = await res.json();
    const result: Record<string, number> = {};
     
    for (const barter of (json.data?.barters || []) as any[]) {
      if (barter.trader?.normalizedName !== 'fence') continue;
       
      const gpReq = barter.requiredItems?.find((r: any) => r.item?.shortName === 'GP');
      if (!gpReq) continue;
       
      for (const reward of (barter.rewardItems || []) as any[]) {
        if (reward.item?.id) result[reward.item.id] = gpReq.count || 1;
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ─── Индикаторы плитки: бартеры/крафты, компактные карты по id предмета-награды ──

const INDICATOR_TRADE_ITEM_FIELDS = `
  id name shortName image512pxLink basePrice types
  buyFor  { price priceRUB currency vendor { name normalizedName } }
  sellFor { price priceRUB currency vendor { name normalizedName } }
`;

// Сырой fetch без data-cache (ответ >2MB не кэшируется Next) — кэшируем КОМПАКТНЫЙ
// результат через unstable_cache ниже (ключ + revalidate 1ч).
async function fetchIndicatorBarters(): Promise<{
  barterDataMap: Record<string, EftBarterData>;
  barterUnlockMap: Record<string, BarterUnlockInfo>;
}> {
  const query = `
    query {
      barters(lang: ru) {
        trader { name normalizedName }
        level
        taskUnlock { id name }
        requiredItems { count item { ${INDICATOR_TRADE_ITEM_FIELDS} } }
        rewardItems   { count item { ${INDICATOR_TRADE_ITEM_FIELDS} } }
      }
    }
  `;
  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });
    const json = await res.json();
    if (json.errors) {
      console.error('GraphQL Errors in getIndicatorBarters:', JSON.stringify(json.errors, null, 2));
      return { barterDataMap: {}, barterUnlockMap: {} };
    }
    const barters: RawBarter[] = json.data?.barters ?? [];
    const grouped: Record<string, RawBarter[]> = {};
    const barterUnlockMap: Record<string, BarterUnlockInfo> = {};
    for (const b of barters) {
      for (const r of b.rewardItems ?? []) {
        const id = r.item?.id;
        if (!id) continue;
        if (!grouped[id]) grouped[id] = [];
        grouped[id].push(b);
        if (b.taskUnlock?.id && !barterUnlockMap[id]) {
          barterUnlockMap[id] = {
            taskId: b.taskUnlock.id,
            trader: { name: b.trader.name, normalizedName: b.trader.normalizedName },
          };
        }
      }
    }
    const barterDataMap: Record<string, EftBarterData> = {};
    for (const [id, list] of Object.entries(grouped)) {
      const data = buildBarterData(list);
      if (data) barterDataMap[id] = data;
    }
    return { barterDataMap, barterUnlockMap };
  } catch (error) {
    console.error('Fetch error in getIndicatorBarters:', error);
    return { barterDataMap: {}, barterUnlockMap: {} };
  }
}

const getIndicatorBarters = unstable_cache(
  fetchIndicatorBarters,
  ['eft-indicator-barters'],
  { revalidate: 3600 },
);

async function fetchIndicatorCrafts(): Promise<Record<string, EftCraftData>> {
  const query = `
    query {
      crafts(lang: ru) {
        station { name normalizedName }
        level
        duration
        requiredItems { count item { ${INDICATOR_TRADE_ITEM_FIELDS} } }
        rewardItems   { count item { ${INDICATOR_TRADE_ITEM_FIELDS} } }
      }
    }
  `;
  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query }),
      cache: 'no-store',
    });
    const json = await res.json();
    if (json.errors) {
      console.error('GraphQL Errors in getIndicatorCrafts:', JSON.stringify(json.errors, null, 2));
      return {};
    }
    const crafts: RawCraft[] = json.data?.crafts ?? [];
    const grouped: Record<string, RawCraft[]> = {};
    for (const c of crafts) {
      for (const r of c.rewardItems ?? []) {
        const id = r.item?.id;
        if (!id) continue;
        if (!grouped[id]) grouped[id] = [];
        grouped[id].push(c);
      }
    }
    const craftDataMap: Record<string, EftCraftData> = {};
    for (const [id, list] of Object.entries(grouped)) {
      const data = buildCraftData(list);
      if (data) craftDataMap[id] = data;
    }
    return craftDataMap;
  } catch (error) {
    console.error('Fetch error in getIndicatorCrafts:', error);
    return {};
  }
}

const getIndicatorCrafts = unstable_cache(
  fetchIndicatorCrafts,
  ['eft-indicator-crafts'],
  { revalidate: 3600 },
);

/** Сужает карту индикаторов до предметов текущей категории — не шлём лишнее в клиент. */
function pickByIds<T>(map: Record<string, T>, ids: Set<string>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const id of ids) {
    const v = map[id];
    if (v !== undefined) out[id] = v;
  }
  return out;
}

export default async function ItemsDynamicPage({ params }: Props) {
  // В Next.js 15+ params является асинхронным (Promise), поэтому его нужно "дождаться"
  const resolvedParams = await params;
  
  // Собираем текущий путь из сегментов URL
  const currentPath = `/eft/items/${resolvedParams.category.join('/')}`;
  const slug = resolvedParams.category[resolvedParams.category.length - 1]; // Получаем последний сегмент (например, cases)
  
  // Получаем дерево EFT меню
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  
  // Ищем текущий узел в конфигурации
  const currentNode = findNodeByPath(eftMenu, currentPath);

  if (!currentNode) {
    notFound(); // Если пути нет в конфиге, выдаем страницу 404
  }

  const hasChildren = currentNode.children && currentNode.children.length > 0;

  const parentPath = currentPath.split('/').slice(0, -1).join('/');
  const parentNode = findNodeByPath(eftMenu, parentPath);

  const tabSource = hasChildren
    ? currentNode.children!
    : (parentNode && parentNode.path !== '/eft/items' && parentNode.children)
      ? parentNode.children
      : null;

  const tabs = tabSource?.map(child => ({
    id: child.id,
    label: child.label,
    menuTitle: child.menuTitle,
    href: child.path || '#',
    iconUrl: child.iconUrl || child.iconUrlBear || '',
    preserveIconColor: child.path?.startsWith('/eft/items/mods/') ?? false,
  }));

  const pageId = `eft-items-${resolvedParams.category.join('-')}`;
  const pageContent = PAGE_CONTENT_DICTIONARY[pageId];

  const [itemsData, gpCoinBarters, indicatorBarters, craftDataMap] = await Promise.all([
    getCategoryItems(slug),
    getGpCoinBarters(),
    getIndicatorBarters(),
    getIndicatorCrafts(),
  ]);

  // Квест-индикаторы: определения из статического EFT_QUESTS (на сервере, не в клиент-бандле);
  // живой прогресс накладывается на клиенте из персистентного quest-стора.
  const { dataMap: questDataMap, refMap: questRefMap } = buildQuestIndicators(
    EFT_QUESTS,
    indicatorBarters.barterUnlockMap,
  );

  // Сужаем карты до предметов текущей категории (отображаемые предметы ⊆ itemsData).
  const itemIds = new Set(itemsData.map((i) => i.id));
  const barterDataMap = pickByIds(indicatorBarters.barterDataMap, itemIds);
  const craftDataMapForCategory = pickByIds(craftDataMap, itemIds);
  const questDataMapForCategory = pickByIds(questDataMap, itemIds);
  const questRefMapForCategory = pickByIds(questRefMap, itemIds);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <HubNav
          iconClass={pageContent?.iconClass}
          iconUrl={pageContent?.iconClass ? undefined : (currentNode.iconUrl || currentNode.iconUrlBear)}
          title={pageContent?.title ?? currentNode.label}
          description={pageContent?.description}
          count={itemsData.length}
          tabs={tabs}
        />

        <Suspense>
          <ItemsCategoryClient
            initialData={itemsData}
            categorySlug={slug}
            gpCoinBarters={gpCoinBarters}
            barterDataMap={barterDataMap}
            craftDataMap={craftDataMapForCategory}
            questDataMap={questDataMapForCategory}
            questRefMap={questRefMapForCategory}
          />
        </Suspense>
      </div>
    </main>
  );
}
