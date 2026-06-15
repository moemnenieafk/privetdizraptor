import { PageHeader } from '@/components/ui/PageHeader';
import { notFound } from 'next/navigation';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';
import { ItemsCategoryClient, CategoryItem } from './[...category]/ItemsCategoryClient';
import { CategoryTabs, type CategoryTabConfig } from '@/components/features/items/CategoryTabs';

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

async function getBarterItems(): Promise<CategoryItem[]> {
  const query = `
    query {
      items(types: [barter], lang: ru) {
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
          ... on ItemPropertiesWeaponMod {
            ergonomics
            recoilModifier
            accuracyModifier
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

    const json = await res.json();
    if (json.errors) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.data?.items || []).map((item: any) => {
      const bestSell = item.sellFor?.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prev: any, current: any) => (prev.price > current.price ? prev : current),
        { price: 0 }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rubVal = (p: any) => p.priceRUB ?? p.price;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validBuyFor = item.buyFor?.filter((b: any) => rubVal(b) > 0) || [];
      const bestBuy =
        validBuyFor.length > 0
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            validBuyFor.reduce((prev: any, current: any) =>
              rubVal(current) < rubVal(prev) ? current : prev
            )
          : null;
      const minPrice = bestBuy ? rubVal(bestBuy) : item.basePrice || 0;
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
  } catch {
    return [];
  }
}

export default async function ItemsHubPage() {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const itemsNode = findNodeByPath(eftMenu, '/eft/items');

  if (!itemsNode) notFound();

  const topLevelTabs: CategoryTabConfig[] = (itemsNode.children || []).map((child) => ({
    id: child.id,
    title: child.label,
    href: child.path || '#',
    iconPath: child.iconUrl || child.iconUrlBear || '',
  }));

  const itemsData = await getBarterItems();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-items" />

        {topLevelTabs.length > 0 && (
          <CategoryTabs tabs={topLevelTabs} className="mb-8" />
        )}

        <ItemsCategoryClient initialData={itemsData} categorySlug="barter" gpCoinBarters={{}} />
      </div>
    </main>
  );
}
