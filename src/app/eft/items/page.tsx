import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';
import { ItemsCategoryClient, CategoryItem } from './[...category]/ItemsCategoryClient';
import { HubNav } from '@/components/features/items/HubNav';
import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';
import { getEftCatalog } from '@/lib/eft-catalog';
import { getSubcategoryMembership } from '@/lib/eft-category';
import { getHideoutRequirementMap } from '@/db/hideout';
import { getEftIndicatorsFromDb } from '@/db/indicators';
import { getEftPriceMapFromDb, getCurrencyRates } from '@/db/prices';
import { buildQuestIndicators } from '@/lib/eft-indicators.economics';
import { EFT_QUESTS } from '@/data/quests';
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

// Рендер в рантайме: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function ItemsHubPage() {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const itemsNode = findNodeByPath(eftMenu, '/eft/items');

  if (!itemsNode) notFound();

  const pageContent = PAGE_CONTENT_DICTIONARY['eft-items'];

  // «Выбор категорий» для общей выборки = топ-уровневые разделы каталога.
  const subcatChildren = (itemsNode.children || []).filter((c) => c.path?.startsWith('/eft/items/'));
  const subcatOptions = subcatChildren.map((c) => ({
    id: c.path!.split('/').pop()!,
    label: c.menuTitle ?? c.label,
    iconUrl: c.iconUrl || c.iconUrlBear || '',
    preserveIconColor: c.path?.startsWith('/eft/items/mods/') ?? false,
  }));

  const [itemsData, subcatMembership, hideoutReqMap, indicators, rates] = await Promise.all([
    getItemsData(),
    getSubcategoryMembership(subcatOptions.map((o) => o.id)),
    getHideoutRequirementMap(),
    getEftIndicatorsFromDb(),
    getCurrencyRates(''),
  ]);

  // Квест-индикаторы: определения из статического EFT_QUESTS (на сервере, не в
  // клиент-бандле); живой прогресс накладывается на клиенте из quest-стора.
  // Корень = все предметы, поэтому карты индикаторов передаём целиком (без сужения).
  const { dataMap: questDataMap, refMap: questRefMap } = buildQuestIndicators(
    EFT_QUESTS,
    indicators.barterUnlockMap,
  );

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
          <ItemsCategoryClient
            initialData={itemsData}
            categorySlug=""
            gpCoinBarters={indicators.gpCoinBarters}
            barterDataMap={indicators.barterDataMap}
            craftDataMap={indicators.craftDataMap}
            questDataMap={questDataMap}
            questRefMap={questRefMap}
            rates={rates}
            subcatOptions={subcatOptions}
            subcatMembership={subcatMembership}
            hideoutReqMap={hideoutReqMap}
          />
        </Suspense>
      </div>
    </main>
  );
}
