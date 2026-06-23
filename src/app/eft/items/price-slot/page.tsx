import type { Metadata } from 'next';
import { getEftCatalog } from '@/lib/eft-catalog';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';
import { calcFleaFee } from '@/lib/barter-calc';
import { PriceSlotClient, type PriceSlotItem } from './PriceSlotClient';

export const metadata: Metadata = { title: 'Цена за слот | ЦТА' };

const TOP_N = 500;

// Статический маршрут — перекрывает items/[...category]. Данные ТОЛЬКО из зеркала.
async function fetchPriceSlot(): Promise<PriceSlotItem[]> {
  let catalog: Awaited<ReturnType<typeof getEftCatalog>>;
  let priceMap: Awaited<ReturnType<typeof getEftPriceMapFromDb>>;
  try {
    [catalog, priceMap] = await Promise.all([getEftCatalog(), getEftPriceMapFromDb()]);
  } catch (e) {
    console.error('[price-slot] зеркало недоступно:', e);
    return [];
  }
  const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
  const isFlea = (v: { name: string; normalizedName?: string }) =>
    v.name === 'Flea Market' || v.normalizedName === 'flea-market';

  const out: PriceSlotItem[] = [];
  for (const it of catalog) {
    const pm = priceMap.get(it.id);
    if (!pm) continue;
    const sells = pm.sellFor ?? [];
    const traderSells = sells.filter((x) => !isFlea(x.vendor) && rubVal(x) > 0);
    const bestTrader = traderSells.length
      ? traderSells.reduce((mx, cur) => (rubVal(cur) > rubVal(mx) ? cur : mx), traderSells[0])
      : null;
    const fleaEntry = sells.find((x) => isFlea(x.vendor));
    const fleaSell = fleaEntry ? rubVal(fleaEntry) : 0;
    if (!bestTrader && fleaSell <= 0) continue;

    out.push({
      id: it.id,
      name: it.name,
      shortName: it.shortName,
      icon: itemIconUrl(it.id),
      width: it.width,
      height: it.height,
      basePrice: it.basePrice,
      backgroundColor: pm.backgroundColor,
      bestTraderSell: bestTrader ? rubVal(bestTrader) : 0,
      bestTraderName: bestTrader ? bestTrader.vendor.name : '',
      fleaSell,
      changeLast48h: pm.changeLast48hPercent,
    });
  }

  // Грубый ранг по ₽/слот (без модификаторов убежища) → топ-N.
  const rough = (i: PriceSlotItem) => {
    const slots = Math.max(1, i.width * i.height);
    const fleaNet = i.fleaSell > 0 ? i.fleaSell - calcFleaFee(i.basePrice, i.fleaSell, 1) : 0;
    return Math.max(i.bestTraderSell, fleaNet) / slots;
  };
  return out.sort((a, b) => rough(b) - rough(a)).slice(0, TOP_N);
}

export default async function PriceSlotPage() {
  const items = await fetchPriceSlot();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">Цена за слот</h1>
          <p className="mt-2 text-sm text-text-secondary font-blender-book">
            Рейтинг предметов по чистой выручке за ячейку инвентаря (₽/слот) — для стиля «loot vacuum». Учитывает
            налог барахолки и модификаторы убежища, сравнивает маршруты сбыта (торговец vs барахолка).
          </p>
        </header>
        <PriceSlotClient items={items} />
      </div>
    </main>
  );
}
