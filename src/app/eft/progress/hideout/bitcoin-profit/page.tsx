import type { Metadata } from 'next';
import { getEftPriceMapFromDb } from '@/db/prices';
import { getEftCatalog } from '@/lib/eft-catalog';
import { BitcoinProfitClient, type BtcPrices } from './BitcoinProfitClient';

export const metadata: Metadata = { title: 'Прибыль Bitcoin | Убежище ЦТА' };

// Статический маршрут — перекрывает hideout/[metric]. Цены ТОЛЬКО из зеркала.
async function fetchBtcPrices(): Promise<BtcPrices> {
  try {
    const [priceMap, catalog] = await Promise.all([getEftPriceMapFromDb(), getEftCatalog()]);
    const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
    const isFlea = (v: { name: string; normalizedName?: string }) =>
      v.name === 'Flea Market' || v.normalizedName === 'flea-market';

    let btcId: string | undefined;
    let gpuId: string | undefined;
    for (const [id, p] of priceMap) {
      if (p.normalizedName === 'physical-bitcoin') btcId = id;
      else if (p.normalizedName === 'graphics-card') gpuId = id;
    }

    const btc = btcId ? priceMap.get(btcId) : undefined;
    const gpu = gpuId ? priceMap.get(gpuId) : undefined;

    const btcTraderVals = (btc?.sellFor ?? []).filter((x) => !isFlea(x.vendor)).map(rubVal).filter((v) => v > 0);
    const btcTherapist = btcTraderVals.length ? Math.max(...btcTraderVals) : 0;
    const btcFleaEntry = (btc?.sellFor ?? []).find((x) => isFlea(x.vendor));
    const btcFlea = btcFleaEntry ? rubVal(btcFleaEntry) : 0;
    const gpuBuys = (gpu?.buyFor ?? []).map(rubVal).filter((v) => v > 0);
    const gpuCost = gpuBuys.length ? Math.min(...gpuBuys) : 0;
    const btcBase = (btcId ? catalog.find((i) => i.id === btcId)?.basePrice : 0) ?? 0;

    return { btcTherapist, btcFlea, btcBase, gpuCost };
  } catch (e) {
    console.error('[bitcoin-profit] зеркало недоступно:', e);
    return { btcTherapist: 0, btcFlea: 0, btcBase: 0, gpuCost: 0 };
  }
}

export default async function BitcoinProfitPage() {
  const prices = await fetchBtcPrices();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">Прибыль Bitcoin</h1>
          <p className="mt-2 text-sm text-text-secondary font-blender-book">
            Калькулятор биткоин-фермы: скорость добычи по числу видеокарт, прибыль и окупаемость GPU. Цены — из нашего
            зеркала.
          </p>
        </header>
        <BitcoinProfitClient prices={prices} />
      </div>
    </main>
  );
}
