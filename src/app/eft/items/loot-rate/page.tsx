import { PageHeader } from '@/components/ui/PageHeader';
import { LootRateClient, type LootItem } from './LootRateClient';

// ─── GQL Fetch ────────────────────────────────────────────────────────────────

async function fetchLootItems(): Promise<LootItem[]> {
  const query = `
    query {
      items(
        types: [armor, backpack, armorPlate, glasses, headphones, helmet, wearable, rig,
                gun, mods, ammo, grenade,
                meds, injectors, keys, container, provisions],
        lang: ru
      ) {
        id name shortName width height image512pxLink backgroundColor types
        sellFor { price priceRUB currency vendor { name normalizedName } }
        buyFor  { price priceRUB currency vendor { name normalizedName } }
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
    if (json.errors) { console.error('LootRate GQL errors:', json.errors); return []; }

    const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
    const isFlea = (v: { name: string; normalizedName?: string }) =>
      v.name === 'Flea Market' || v.normalizedName === 'flea-market';

     
    return (json.data?.items || []).map((raw: any): LootItem => {
      const slots = (raw.width || 1) * (raw.height || 1);
      const traderSells = (raw.sellFor || []).filter((s: { vendor: { name: string; normalizedName?: string } }) => !isFlea(s.vendor));
      const bestTrader = traderSells.length
        ? traderSells.reduce((mx: typeof traderSells[0], cur: typeof traderSells[0]) => rubVal(cur) > rubVal(mx) ? cur : mx, traderSells[0])
        : null;
      const fleaSell = (raw.sellFor || []).find((s: { vendor: { name: string; normalizedName?: string } }) => isFlea(s.vendor));
      const bestSell = (raw.sellFor || []).length
        ? (raw.sellFor as { price: number; priceRUB?: number; vendor: { name: string; normalizedName?: string } }[]).reduce((mx, cur) => rubVal(cur) > rubVal(mx) ? cur : mx, raw.sellFor[0])
        : null;
      const validBuys = (raw.buyFor || []).filter((b: { price: number; priceRUB?: number }) => rubVal(b) > 0);
      const bestBuy = validBuys.length
        ? validBuys.reduce((mn: typeof validBuys[0], cur: typeof validBuys[0]) => rubVal(cur) < rubVal(mn) ? cur : mn, validBuys[0])
        : null;

      const traderPrice = bestTrader ? rubVal(bestTrader) : 0;
      const fleaPrice   = fleaSell   ? rubVal(fleaSell)   : 0;
      const bestPrice   = bestSell   ? rubVal(bestSell)   : 0;

      return {
        id:           raw.id,
        name:         raw.name,
        shortName:    raw.shortName,
        width:        raw.width || 1,
        height:       raw.height || 1,
        image512pxLink: raw.image512pxLink,
        backgroundColor: raw.backgroundColor,
        types:        raw.types || [],
        slots,
        traderSell:   traderPrice,
        traderSellVendor: bestTrader?.vendor,
        fleaSell:     fleaPrice,
        vps:          slots > 0 && bestPrice > 0 ? Math.floor(bestPrice / slots) : 0,
        minBuy:       bestBuy ? rubVal(bestBuy) : 0,
        minBuyVendor: bestBuy?.vendor,
        minBuyCurrency: bestBuy?.currency,
        minBuyRawPrice: bestBuy?.price,
      };
    });
  } catch (err) {
    console.error('LootRate fetch error:', err);
    return [];
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LootRatePage() {
  const items = await fetchLootItems();
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader
          title="Рейтинг предметов"
          description="Все предметы игры, отсортированные по цене за клеточку инвентаря. Используйте иконки категорий для фильтрации."
          iconClass="icon-eft-items-loot-tier"
        />
        <LootRateClient items={items} />
      </div>
    </main>
  );
}
