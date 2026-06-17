import { PageHeader } from '@/components/ui/PageHeader';
import { BartersClient } from './BartersClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawBarterItem {
  item: {
    id: string;
    name: string;
    shortName: string;
    image512pxLink?: string;
    buyFor:  { price: number; priceRUB?: number; currency?: string; vendor: { name: string; normalizedName?: string } }[];
    sellFor: { price: number; priceRUB?: number; currency?: string; vendor: { name: string; normalizedName?: string } }[];
  };
  count: number;
}

interface RawBarter {
  id?: string;
  trader: { name: string; normalizedName: string };
  level: number;
  requiredItems: RawBarterItem[];
  rewardItems:   RawBarterItem[];
}

export interface ProcessedBarterSlot {
  item: { id: string; name: string; shortName: string; image512pxLink?: string };
  count: number;
  unitPrice: number; // RUB
}

export interface ProcessedBarter {
  id:       string;
  trader:   { name: string; normalizedName: string };
  level:    number;
  required: ProcessedBarterSlot[];
  reward:   ProcessedBarterSlot[];
  totalCost:  number;
  totalValue: number;
  profit:     number;
  roi:        number;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchBarters(): Promise<ProcessedBarter[]> {
  const query = `
    query {
      barters {
        trader { name normalizedName }
        level
        requiredItems {
          item {
            id name shortName image512pxLink
            buyFor  { price priceRUB currency vendor { name normalizedName } }
          }
          count
        }
        rewardItems {
          item {
            id name shortName image512pxLink
            sellFor { price priceRUB currency vendor { name normalizedName } }
          }
          count
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
    if (json.errors) { console.error('Barters GQL errors:', json.errors); return []; }

     
    const raw: RawBarter[] = json.data?.barters || [];
    const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
    const isFlea = (v: { name: string; normalizedName?: string }) =>
      v.name === 'Flea Market' || v.normalizedName === 'flea-market';

    return raw.map((b, idx): ProcessedBarter => {
      const required: ProcessedBarterSlot[] = b.requiredItems.map(r => {
        const validBuys = (r.item.buyFor || []).filter(x => rubVal(x) > 0);
        const cheapest  = validBuys.length
          ? validBuys.reduce((mn, cur) => rubVal(cur) < rubVal(mn) ? cur : mn, validBuys[0])
          : null;
        return {
          item: { id: r.item.id, name: r.item.name, shortName: r.item.shortName, image512pxLink: r.item.image512pxLink },
          count: r.count,
          unitPrice: cheapest ? rubVal(cheapest) : 0,
        };
      });

      const reward: ProcessedBarterSlot[] = b.rewardItems.map(r => {
        const sells = (r.item.sellFor || []);
        // Предпочитаем продажу торговцу (без комиссии барахолки), затем барахолку
        const traderSells = sells.filter(s => !isFlea(s.vendor));
        const bestSell = traderSells.length
          ? traderSells.reduce((mx, cur) => rubVal(cur) > rubVal(mx) ? cur : mx, traderSells[0])
          : sells.length
          ? sells.reduce((mx, cur) => rubVal(cur) > rubVal(mx) ? cur : mx, sells[0])
          : null;
        return {
          item: { id: r.item.id, name: r.item.name, shortName: r.item.shortName, image512pxLink: r.item.image512pxLink },
          count: r.count,
          unitPrice: bestSell ? rubVal(bestSell) : 0,
        };
      });

      const totalCost  = required.reduce((s, x) => s + x.unitPrice * x.count, 0);
      const totalValue = reward.reduce((s, x) => s + x.unitPrice * x.count, 0);
      const profit     = totalValue - totalCost;
      const roi        = totalCost > 0 ? Math.round((profit / totalCost) * 100) : 0;

      return {
        id:    `barter-${idx}-${b.trader.normalizedName}`,
        trader: b.trader,
        level:  b.level,
        required,
        reward,
        totalCost,
        totalValue,
        profit,
        roi,
      };
    });
  } catch (err) {
    console.error('Barters fetch error:', err);
    return [];
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BartersPage() {
  const barters = await fetchBarters();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader
          pageId="eft-barters"
          title="Выгодные Бартеры"
          description="Все бартерные сделки торговцев, отсортированные по прибыльности. Рассчитывается как разница между стоимостью покупки нужных предметов и выручкой от продажи полученных."
        />
        <BartersClient barters={barters} />
      </div>
    </main>
  );
}
