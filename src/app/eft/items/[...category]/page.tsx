import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { notFound } from 'next/navigation';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';
import { ItemsCategoryClient, CategoryItem } from './ItemsCategoryClient';
import { CategoryTabs, type CategoryTabConfig } from "@/components/features/items/CategoryTabs";

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

// BFF Pattern: Серверный запрос к GraphQL с маппингом категорий
async function getCategoryItems(slug: string): Promise<CategoryItem[]> {
  // Расширенный маппинг наших URL-категорий на типы GraphQL tarkov.dev
  const typeMapping: Record<string, string> = {
    // Снаряжение
    'gear': 'armor, backpack, armorPlate, glasses, headphones, helmet, wearable, rig',
    'armor': 'armor',
    'backpacks': 'backpack',
    'components': 'armorPlate',
    'glasses': 'glasses',
    'headphones': 'headphones',
    'helmets': 'helmet',
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
    'carbine': 'gun',
    'dmr': 'gun',
    'gl': 'gun',
    'grenades': 'grenade',
    'lmg': 'gun',
    'melee': 'gun',
    'shotgun': 'gun',
    'sidearm': 'gun',
    'smg': 'gun',
    'special': 'gun',
    // Моды (перенесены на верхний уровень)
    'mods': 'mods',
    'vitalparts': 'mods',
    'functional': 'mods',
    'elements': 'mods',
    'auxiliary': 'mods',
    'barrels': 'mods',
    'bipods': 'mods',
    'charginghandles': 'mods',
    'foregrips': 'mods',
    'gasblocks': 'mods',
    'handguards': 'mods',
    'laser': 'mods',
    'magazines': 'mods',
    'mounts': 'mods',
    'muzzle': 'mods',
    'pistolgrips': 'mods',
    'receivers': 'mods',
    'sights': 'mods',
    'stocks': 'mods',
    // Боеприпасы
    'ammo': 'ammo',
    'rounds': 'ammo',
    'ammo-boxes': 'ammo',
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
    'specialequipment': 'barter',
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
    'masks': '5a341c4686f77469e155819e',
    'facecovers': '5a341c4686f77469e155819e',
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = items.filter((i: any) =>
        i.properties?.__typename === 'ItemPropertiesContainer' &&
        !i.types?.includes('container')
      );
    } else if (slug === 'storage-containers') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = items.filter((i: any) => !i.types?.includes('markedOnly'));
    } else if (slug === 'cases') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = items.filter((i: any) => /кейс/i.test(i.name ?? ''));
    } else if (slug === 'medkits') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = items.filter((i: any) => i.name && i.name.toLowerCase().includes('аптечка'));
    } else if (slug === 'eyewear') {
      // Из mods оставляем: визоры (armorType), ПНВ-устройства (nvgIntensity или имя)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = items.filter((i: any) =>
        !i.types?.includes('mods') ||
        i.properties?.armorType != null ||
        i.properties?.nvgIntensity != null ||
        /прибор ночного видения/i.test(i.name ?? '')
      );
    }

    // Маппинг данных (BFF) для добавления eco (экономики)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items.map((item: any) => {
      // Ищем лучшую цену продажи (максимальную)
      const bestSell = item.sellFor?.reduce((prev: any, current: any) => 
        (prev.price > current.price) ? prev : current
      , { price: 0 });

      // Ищем лучшую цену покупки (минимальную) — сравниваем по priceRUB для корректного сравнения валют
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
          vps
        }
      };
    });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const barter of (json.data?.barters || []) as any[]) {
      if (barter.trader?.normalizedName !== 'fence') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gpReq = barter.requiredItems?.find((r: any) => r.item?.shortName === 'GP');
      if (!gpReq) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const reward of (barter.rewardItems || []) as any[]) {
        if (reward.item?.id) result[reward.item.id] = gpReq.count || 1;
      }
    }
    return result;
  } catch {
    return {};
  }
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

  // --- ГЕНЕРАЦИЯ ВЛОЖЕННЫХ ТАБОВ ---
  let subTabs: CategoryTabConfig[] = [];
  const parentPath = currentPath.split('/').slice(0, -1).join('/');
  const parentNode = findNodeByPath(eftMenu, parentPath);

  if (hasChildren) {
    // Если у текущего узла есть дети (например, /gear), показываем их как табы
    subTabs = currentNode.children!.map(child => ({
      id: child.id,
      title: child.label,
      href: child.path || '#',
      iconPath: child.iconUrl || child.iconUrlBear || ''
    }));
  } else if (parentNode && parentNode.path && parentNode.path !== '/eft/items' && parentNode.children) {
    // Если это конечная категория, показываем ее соседей (всю группу)
    subTabs = parentNode.children.map(child => ({
      id: child.id,
      title: child.label,
      href: child.path || '#',
      iconPath: child.iconUrl || child.iconUrlBear || ''
    }));
  }

  // Загружаем предметы и GP-бартеры параллельно
  const [itemsData, gpCoinBarters] = await Promise.all([
    getCategoryItems(slug),
    getGpCoinBarters(),
  ]);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        
        <PageHeader
          pageId={`eft-items-${resolvedParams.category.join('-')}`}
          title={currentNode.label}
          description={`Подробная информация и база предметов в категории «${currentNode.label}».`}
          count={itemsData.length}
        />

        {subTabs.length > 0 && (
          <CategoryTabs tabs={subTabs} className="mb-8" />
        )}

        {/* Всегда рендерим таблицу/сетку для текущей категории или группы */}
        <Suspense>
          <ItemsCategoryClient initialData={itemsData} categorySlug={slug} gpCoinBarters={gpCoinBarters} />
        </Suspense>
      </div>
    </main>
  );
}
