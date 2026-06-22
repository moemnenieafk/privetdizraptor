import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';
import { ItemsCategoryClient, CategoryItem } from './[...category]/ItemsCategoryClient';
import { HubNav } from '@/components/features/items/HubNav';
import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';
import { getEftCatalog } from '@/lib/eft-catalog';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';

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

async function getItemsData(): Promise<CategoryItem[]> {
  // Каталог И цены — всё из нашей Supabase. Цены зеркалит крон /api/cron/sync-prices
  // из tarkov.dev; в рантайме страница в tarkov.dev НЕ ходит. Пустая карта (синк ещё
  // не прогонялся) → список всё равно рендерится из каталога (без цен).
  const [catalog, priceMap] = await Promise.all([getEftCatalog(), getEftPriceMapFromDb()]);

  return catalog.map((c): CategoryItem => {
    const px = priceMap.get(c.id);
    return {
      id: c.id,
      normalizedName: px?.normalizedName ?? '',
      name: c.name,
      shortName: c.shortName,
      width: c.width,
      height: c.height,
      weight: c.weight,
      backgroundColor: px?.backgroundColor,
      basePrice: c.basePrice,
      image512pxLink: itemIconUrl(c.id), // иконка из нашего Supabase Storage
      types: px?.types,
      properties: c.properties,
      sellFor: px?.sellFor ?? [],
      buyFor: px?.buyFor ?? [],
    };
  });
}

export default async function ItemsHubPage() {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const itemsNode = findNodeByPath(eftMenu, '/eft/items');

  if (!itemsNode) notFound();

  const pageContent = PAGE_CONTENT_DICTIONARY['eft-items'];
  const itemsData = await getItemsData();

  const tabs = (itemsNode.children || []).map((child) => ({
    id: child.id,
    label: child.label,
    menuTitle: child.menuTitle,
    href: child.path || '#',
    iconUrl: child.iconUrl || child.iconUrlBear || '',
  }));

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <HubNav
          iconClass={pageContent?.iconClass}
          title={pageContent?.title ?? itemsNode.label}
          description={pageContent?.description}
          count={itemsData.length}
          tabs={tabs}
        />

        <Suspense>
          <ItemsCategoryClient initialData={itemsData} categorySlug="" gpCoinBarters={{}} />
        </Suspense>
      </div>
    </main>
  );
}
