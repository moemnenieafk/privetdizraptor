import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { db } from '@/db';
import { crafts as craftsTable, items } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';
import { CraftProfitClient, type ProcessedCraft } from './CraftProfitClient';

export const metadata: Metadata = { title: 'Прибыль крафта | Убежище ЦТА' };

// tarkov.dev station.normalizedName → локальная иконка станции.
const STATION_ICON: Record<string, string> = {
  workbench: 'workbench',
  lavatory: 'lavatory',
  medstation: 'med_station',
  watercollector: 'water_collector',
  nutritionunit: 'nutrition_unit',
  intelligencecenter: 'intelligence_centre',
  intelligencecentre: 'intelligence_centre',
  boozegenerator: 'booze_generator',
  bitcoinfarm: 'bitcoin_farm',
  scavcase: 'scav_case',
};

function stationIcon(normalized?: string | null, name?: string | null): string | null {
  const key = (normalized ?? name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const slug = STATION_ICON[key];
  return slug ? `/icons/eft/04-progression/hideout-modules/${slug}.svg` : null;
}

// Сборка из НАШЕЙ БД (crafts + items + цены). В рантайме в tarkov.dev НЕ ходим.
async function fetchCrafts(): Promise<ProcessedCraft[]> {
  const gameId = await eftGameId();
  const [craftRows, itemRows, priceMap] = await Promise.all([
    db.select().from(craftsTable).where(eq(craftsTable.gameId, gameId)),
    db
      .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName })
      .from(items)
      .where(eq(items.gameId, gameId)),
    getEftPriceMapFromDb(),
  ]);
  const nameMap = new Map(itemRows.map((r) => [r.inGameId, r]));

  const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
  const isFlea = (v: { name: string; normalizedName?: string }) =>
    v.name === 'Flea Market' || v.normalizedName === 'flea-market';
  const slot = (id: string) => {
    const i = nameMap.get(id);
    return { id, name: i?.name ?? id, shortName: i?.shortName ?? '', image512pxLink: itemIconUrl(id) };
  };

  return craftRows
    .map((c): ProcessedCraft => {
      const required = c.requiredItems.map((s) => {
        const buys = (priceMap.get(s.itemId)?.buyFor ?? []).filter((x) => rubVal(x) > 0);
        const cheapest = buys.length ? buys.reduce((mn, cur) => (rubVal(cur) < rubVal(mn) ? cur : mn), buys[0]) : null;
        return { item: slot(s.itemId), count: s.count, unitPrice: cheapest ? rubVal(cheapest) : 0 };
      });
      const reward = c.rewardItems.map((s) => {
        const sells = priceMap.get(s.itemId)?.sellFor ?? [];
        const traderSells = sells.filter((x) => !isFlea(x.vendor));
        const best = traderSells.length
          ? traderSells.reduce((mx, cur) => (rubVal(cur) > rubVal(mx) ? cur : mx), traderSells[0])
          : sells.length
            ? sells.reduce((mx, cur) => (rubVal(cur) > rubVal(mx) ? cur : mx), sells[0])
            : null;
        return { item: slot(s.itemId), count: s.count, unitPrice: best ? rubVal(best) : 0 };
      });

      const totalCost = required.reduce((s, x) => s + x.unitPrice * x.count, 0);
      const totalValue = reward.reduce((s, x) => s + x.unitPrice * x.count, 0);
      const profit = totalValue - totalCost;
      const duration = c.duration ?? 0;
      const profitPerHour = duration > 0 ? Math.round(profit / (duration / 3600)) : 0;
      const roi = totalCost > 0 ? Math.round((profit / totalCost) * 100) : 0;

      return {
        id: c.id,
        stationName: c.stationName,
        stationNormalized: c.stationNormalizedName ?? '',
        stationIcon: stationIcon(c.stationNormalizedName, c.stationName),
        level: c.level ?? 1,
        duration,
        required,
        reward,
        totalCost,
        totalValue,
        profit,
        profitPerHour,
        roi,
      };
    })
    .sort((a, b) => b.profitPerHour - a.profitPerHour);
}

export default async function CraftProfitPage() {
  const crafts = await fetchCrafts();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">Прибыль крафта</h1>
          <p className="mt-2 text-sm text-text-secondary font-blender-book">
            Рентабельность крафтов убежища: затраты на ингредиенты против выручки, сгруппировано по станциям и
            отсортировано по прибыли в час.
          </p>
        </header>
        <CraftProfitClient crafts={crafts} />
      </div>
    </main>
  );
}
