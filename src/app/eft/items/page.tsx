import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';
import { ItemsCategoryClient, CategoryItem } from './[...category]/ItemsCategoryClient';
import { HubNav } from '@/components/features/items/HubNav';
import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';

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

async function getAllItems(): Promise<CategoryItem[]> {
  const query = `
    query {
      items(lang: ru) {
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
          ... on ItemPropertiesWeaponMod {
            ergonomics
            recoilModifier
            accuracyModifier
          }
          ... on ItemPropertiesAmmo {
            caliber
            damage
            penetrationPower
            armorDamage
          }
          ... on ItemPropertiesWeapon {
            caliber
            ergonomics
            recoilVertical
            recoilHorizontal
          }
          ... on ItemPropertiesArmor {
            class
            durability
            armorType
          }
          ... on ItemPropertiesHelmet {
            class
            durability
            armorType
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
      next: { revalidate: 3600 },
    });

    const json = await res.json();
    if (json.errors) return [];

     
    return (json.data?.items || []).map((item: any) => {
      const bestSell = item.sellFor?.reduce(
         
        (prev: any, current: any) => (prev.price > current.price ? prev : current),
        { price: 0 }
      );
       
      const rubVal = (p: any) => p.priceRUB ?? p.price;
       
      const validBuyFor = item.buyFor?.filter((b: any) => rubVal(b) > 0) || [];
      const bestBuy =
        validBuyFor.length > 0
          ?  
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

  const pageContent = PAGE_CONTENT_DICTIONARY['eft-items'];
  const itemsData = await getAllItems();

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
