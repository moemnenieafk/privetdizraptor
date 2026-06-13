import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { notFound } from 'next/navigation';
import { HubCard } from '@/components/ui/HubCard';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';
import { ItemsCategoryClient, CategoryItem } from './ItemsCategoryClient';

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
    'armor': 'armor',
    'backpacks': 'backpack',
    'components': 'armorPlate',
    'glasses': 'glasses',
    'headphones': 'headphones',
    'helmets': 'helmet',
    'masks': 'wearable',
    'rigs': 'rig',
    'visors': 'mods',
    'ammo': 'ammo',
    'ar': 'gun',
    'bolt': 'gun',
    'carbine': 'gun',
    'dmr': 'gun',
    'gl': 'gun',
    'grenades': 'grenade',
    'guns': 'gun',
    'lmg': 'gun',
    'shotgun': 'gun',
    'sidearm': 'gun',
    'smg': 'gun',
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
    'injury': 'meds',
    'injectors': 'injectors',
    'medkits': 'meds',
    'meds': 'meds',
    'pills': 'meds',
    'keycards': 'keys',
    'keys': 'keys',
    'mechanical': 'keys',
    'cases': 'container',
    'secure': 'container',
    'drinks': 'provisions',
    'food': 'provisions',
  };

  const gqlType = typeMapping[slug];
  const typeFilter = gqlType ? `types: [${gqlType}]` : '';

  const query = `
    query {
      items(${typeFilter ? typeFilter + ',' : ''} lang: ru) {
        id
        name
        shortName
        width
        height
        basePrice
        image512pxLink
        types
        properties {
          ... on ItemPropertiesHelmet {
            class
            durability
            deafening
            blocksHeadset
          }
          ... on ItemPropertiesArmor {
            class
            durability
          }
          ... on ItemPropertiesHeadphone {
            ambientVolume
          }
          ... on ItemPropertiesAmmo {
            caliber
            damage
            penetrationPower
            armorDamage
            fragmentationChance
          }
          ... on ItemPropertiesWeaponMod {
            ergonomics
            recoilModifier
          }
        }
        sellFor { price, vendor { name, normalizedName } }
        buyFor { price, vendor { name, normalizedName } }
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
      console.error('GraphQL Errors:', json.errors);
      return [];
    }

    let items = json.data?.items || [];

    // Фолбэк-фильтрация на сервере для специфичных категорий (например, Кейсы)
    if (slug === 'cases') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = items.filter((i: any) => i.types.includes('container') || (i.name && (i.name.toLowerCase().includes('кейс') || i.name.toLowerCase().includes('ящик'))));
    } else if (slug === 'medkits') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = items.filter((i: any) => i.name && i.name.toLowerCase().includes('аптечка'));
    }

    return items;
  } catch (error) {
    console.error('Fetch error in getCategoryItems:', error);
    return [];
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

  // Если это конечная категория (нет детей), загружаем данные предметов
  const itemsData = !hasChildren ? await getCategoryItems(slug) : [];

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-[28px] pb-[56px]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        <PageHeader 
          pageId={`eft-items-${resolvedParams.category.join('-')}`}
          title={currentNode.label}
          description={`Подробная информация и база предметов в категории «${currentNode.label}».`}
        />

        {/* Рендер хаба (если есть вложенные пункты) или заглушка для таблицы */}
        {hasChildren ? (
          <div className="tactical-grid">
            {currentNode.children!.map((child, index) => (
              <HubCard 
                key={child.id} 
                gameId="eft" 
                id={child.id}
                title={child.label}
                description={`Подробная информация и предметы в категории «${child.label}».`}
                href={child.path || '#'}
                iconPath={child.iconUrl || child.iconUrlBear || ''}
                variant="rectangle"
                index={index} 
              />
            ))}
          </div>
        ) : (
          <ItemsCategoryClient initialData={itemsData} categorySlug={slug} />
        )}
      </div>
    </main>
  );
}
