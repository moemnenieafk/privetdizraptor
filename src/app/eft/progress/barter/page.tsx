import { BarterPageClient } from './BarterPageClient';
import type { BarterSearchResult, BarterTrade } from '@/types/barter';

const TARKOV_API = 'https://api.tarkov.dev/graphql';
const REVALIDATE = { next: { revalidate: 3600 } };

const BARTER_ITEMS_QUERY = `
  query BarterStashItems {
    items(types: [barter], lang: ru) {
      id
      name
      shortName
      normalizedName
      width
      height
      image512pxLink
      backgroundColor
      sellFor { price priceRUB vendor { name normalizedName } }
      buyFor  { price priceRUB vendor { name normalizedName } }
    }
  }
`;

const BARTER_TRADES_QUERY = `
  query BarterTrades {
    barters(lang: ru) {
      id
      trader { name normalizedName }
      level
      taskUnlock { id }
      requiredItems {
        count
        item {
          id name shortName image512pxLink backgroundColor width height
          sellFor { price priceRUB vendor { name normalizedName } }
        }
      }
      rewardItems {
        count
        item {
          id name shortName image512pxLink backgroundColor width height
          sellFor { price priceRUB vendor { name normalizedName } }
          buyFor  { price priceRUB vendor { name normalizedName } }
        }
      }
    }
  }
`;

async function gql<T>(query: string): Promise<T> {
  try {
    const res = await fetch(TARKOV_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      ...REVALIDATE,
    });
    const json = await res.json();
    return json.data as T;
  } catch {
    return {} as T;
  }
}

export default async function BarterPage() {
  const [itemsData, bartersData] = await Promise.all([
    gql<{ items: BarterSearchResult[] }>(BARTER_ITEMS_QUERY),
    gql<{ barters: BarterTrade[] }>(BARTER_TRADES_QUERY),
  ]);

  const initialItems = itemsData.items ?? [];
  const initialBarters = bartersData.barters ?? [];

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <BarterPageClient initialItems={initialItems} initialBarters={initialBarters} />
      </div>
    </main>
  );
}
