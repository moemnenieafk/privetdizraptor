import { eq } from 'drizzle-orm';
import { PageHeader } from '@/components/ui/PageHeader';
import { BartersClient } from './BartersClient';
import { db } from '@/db';
import { barters as bartersTable, items } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedBarterSlot {
  item: { id: string; name: string; shortName: string; image512pxLink?: string; normalizedName?: string };
  count: number;
  unitPrice: number; // RUB
}

export interface ProcessedBarter {
  id:       string;
  trader:   { name: string; normalizedName: string };
  level:    number;
  taskUnlock?: { id: string; name?: string } | null; // квест-гейт бартера (кросс-линк на карту квестов)
  required: ProcessedBarterSlot[];
  reward:   ProcessedBarterSlot[];
  totalCost:  number;
  totalValue: number;
  profit:     number;
  roi:        number;
}

// ─── Сборка из НАШЕЙ БД (бартеры + items + цены). В tarkov.dev не ходим. ────────

async function fetchBarters(): Promise<ProcessedBarter[]> {
  const gameId = await eftGameId();
  const [barterRows, itemRows, priceMap] = await Promise.all([
    db.select().from(bartersTable).where(eq(bartersTable.gameId, gameId)),
    db.select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName }).from(items).where(eq(items.gameId, gameId)),
    getEftPriceMapFromDb(),
  ]);
  const nameMap = new Map(itemRows.map((r) => [r.inGameId, r]));

  const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
  const isFlea = (v: { name: string; normalizedName?: string }) =>
    v.name === 'Flea Market' || v.normalizedName === 'flea-market';
  const slot = (id: string): { id: string; name: string; shortName: string; image512pxLink?: string; normalizedName?: string } => {
    const i = nameMap.get(id);
    return { id, name: i?.name ?? id, shortName: i?.shortName ?? '', image512pxLink: itemIconUrl(id), normalizedName: priceMap.get(id)?.normalizedName ?? undefined };
  };

  return barterRows.map((b): ProcessedBarter => {
    const required: ProcessedBarterSlot[] = b.requiredItems.map((s) => {
      const validBuys = (priceMap.get(s.itemId)?.buyFor ?? []).filter((x) => rubVal(x) > 0);
      const cheapest = validBuys.length
        ? validBuys.reduce((mn, cur) => (rubVal(cur) < rubVal(mn) ? cur : mn), validBuys[0])
        : null;
      return { item: slot(s.itemId), count: s.count, unitPrice: cheapest ? rubVal(cheapest) : 0 };
    });

    const reward: ProcessedBarterSlot[] = b.rewardItems.map((s) => {
      const sells = priceMap.get(s.itemId)?.sellFor ?? [];
      const traderSells = sells.filter((x) => !isFlea(x.vendor));
      const bestSell = traderSells.length
        ? traderSells.reduce((mx, cur) => (rubVal(cur) > rubVal(mx) ? cur : mx), traderSells[0])
        : sells.length
          ? sells.reduce((mx, cur) => (rubVal(cur) > rubVal(mx) ? cur : mx), sells[0])
          : null;
      return { item: slot(s.itemId), count: s.count, unitPrice: bestSell ? rubVal(bestSell) : 0 };
    });

    const totalCost = required.reduce((s, x) => s + x.unitPrice * x.count, 0);
    const totalValue = reward.reduce((s, x) => s + x.unitPrice * x.count, 0);
    const profit = totalValue - totalCost;
    const roi = totalCost > 0 ? Math.round((profit / totalCost) * 100) : 0;

    return {
      id: b.id,
      trader: { name: b.traderName, normalizedName: b.traderNormalizedName ?? '' },
      level: b.level ?? 1,
      taskUnlock: b.taskUnlockId ? { id: b.taskUnlockId, name: b.taskUnlockName ?? undefined } : null,
      required,
      reward,
      totalCost,
      totalValue,
      profit,
      roi,
    };
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BartersPage() {
  const barters = await fetchBarters();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-4 pb-14">
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
