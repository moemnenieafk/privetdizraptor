import type { Metadata } from 'next';
import { getEftPriceMapFromDb } from '@/db/prices';
import { getEftCatalog } from '@/lib/eft-catalog';
import { getAcquisitionGraph } from '@/db/acquisition-funnel';
import { bestAcquisitionCost, type FunnelNode } from '@/lib/acquisition-funnel';
import { BitcoinProfitClient, type BtcPrices } from './BitcoinProfitClient';

export const metadata: Metadata = { title: 'Прибыль Bitcoin | Убежище ЦТА' };

// id зеркала (tarkov.dev) обоих баков — фиксированные, воронка считается по ним напрямую.
const EXPEDITIONARY_FUEL_ID = '5d1b371186f774253763a656';
const METAL_FUEL_ID = '5d1b36a186f7742523398433';

/** Оптимальная добыча одного бака по воронке: цена за штуку + дерево пути. */
export interface BtcFuelInfo {
  /** цена за 1 канистру по дешевейшему пути воронки (₽); 0 если недоступно/пустое зеркало. */
  perUnit: number;
  /** дерево выбранного пути (источник/LL/инпуты) для блока «что нужно купить»; null если недоступно. */
  path: FunnelNode | null;
}

/**
 * Форма данных, которую page.tsx отдаёт клиенту. Расширяет BtcPrices (T04) БЕЗ ломки:
 * старое плоское `fuel: { expeditionary; metal }` сохранено (клиент читает его сейчас);
 * добавлены funnel-цены `fuelFunnel` по каждому баку и признак дешевейшего бака `cheapestTank`.
 * T04 переключит клиент на `fuelFunnel`/`cheapestTank`; до тех пор `fuel` держит совместимость.
 */
export interface BtcPricesExtended extends BtcPrices {
  /** оптимальная цена по воронке + путь для каждого бака. */
  fuelFunnel: { expeditionary: BtcFuelInfo; metal: BtcFuelInfo };
  /** какой бак дешевле по perUnit воронки — дефолт-выбор клиента; null если оба недоступны. */
  cheapestTank: 'expeditionary' | 'metal' | null;
}

// Статический маршрут — перекрывает hideout/[metric]. Цены ТОЛЬКО из зеркала.
async function fetchBtcPrices(): Promise<BtcPricesExtended> {
  try {
    const [priceMap, catalog, graph] = await Promise.all([
      getEftPriceMapFromDb(),
      getEftCatalog(),
      getAcquisitionGraph(),
    ]);
    const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
    const isFlea = (v: { name: string; normalizedName?: string }) =>
      v.name === 'Flea Market' || v.normalizedName === 'flea-market';

    let btcId: string | undefined;
    let gpuId: string | undefined;
    let expedId: string | undefined;
    let metalId: string | undefined;
    for (const [id, p] of priceMap) {
      if (p.normalizedName === 'physical-bitcoin') btcId = id;
      else if (p.normalizedName === 'graphics-card') gpuId = id;
      else if (p.normalizedName === 'expeditionary-fuel-tank') expedId = id;
      else if (p.normalizedName === 'metal-fuel-tank') metalId = id;
    }

    const btc = btcId ? priceMap.get(btcId) : undefined;
    const gpu = gpuId ? priceMap.get(gpuId) : undefined;

    // Дешевейшая cash-закупка предмета из buyFor (как gpuCost); 0 если купить негде.
    const cheapestBuy = (id: string | undefined) => {
      const buys = ((id ? priceMap.get(id) : undefined)?.buyFor ?? []).map(rubVal).filter((v) => v > 0);
      return buys.length ? Math.min(...buys) : 0;
    };

    // Оптимальная добыча бака по воронке (T01). Недоступно (Infinity/нет) → { perUnit:0, path:null }.
    const fuelFunnelFor = (itemId: string): BtcFuelInfo => {
      const result = bestAcquisitionCost(itemId, graph);
      if (!Number.isFinite(result.perUnit)) return { perUnit: 0, path: null };
      return { perUnit: result.perUnit, path: result.path };
    };

    const btcTraderVals = (btc?.sellFor ?? []).filter((x) => !isFlea(x.vendor)).map(rubVal).filter((v) => v > 0);
    const btcTherapist = btcTraderVals.length ? Math.max(...btcTraderVals) : 0;
    const btcFleaEntry = (btc?.sellFor ?? []).find((x) => isFlea(x.vendor));
    const btcFlea = btcFleaEntry ? rubVal(btcFleaEntry) : 0;
    const gpuBuys = (gpu?.buyFor ?? []).map(rubVal).filter((v) => v > 0);
    const gpuCost = gpuBuys.length ? Math.min(...gpuBuys) : 0;
    const btcBase = (btcId ? catalog.find((i) => i.id === btcId)?.basePrice : 0) ?? 0;

    const expeditionaryFunnel = fuelFunnelFor(EXPEDITIONARY_FUEL_ID);
    const metalFunnel = fuelFunnelFor(METAL_FUEL_ID);

    // Дешевейший бак по воронке — только среди доступных (perUnit > 0). Оба недоступны → null.
    const cheapestTank: BtcPricesExtended['cheapestTank'] = pickCheapestTank(
      expeditionaryFunnel.perUnit,
      metalFunnel.perUnit,
    );

    return {
      btcTherapist,
      btcFlea,
      btcBase,
      gpuCost,
      fuel: { expeditionary: cheapestBuy(expedId), metal: cheapestBuy(metalId) },
      fuelFunnel: { expeditionary: expeditionaryFunnel, metal: metalFunnel },
      cheapestTank,
    };
  } catch (e) {
    console.error('[bitcoin-profit] зеркало недоступно:', e);
    return {
      btcTherapist: 0,
      btcFlea: 0,
      btcBase: 0,
      gpuCost: 0,
      fuel: { expeditionary: 0, metal: 0 },
      fuelFunnel: {
        expeditionary: { perUnit: 0, path: null },
        metal: { perUnit: 0, path: null },
      },
      cheapestTank: null,
    };
  }
}

/** Дешевейший бак по perUnit воронки среди доступных (>0); оба недоступны → null. */
function pickCheapestTank(exped: number, metal: number): 'expeditionary' | 'metal' | null {
  const expedOk = exped > 0;
  const metalOk = metal > 0;
  if (expedOk && metalOk) return exped <= metal ? 'expeditionary' : 'metal';
  if (expedOk) return 'expeditionary';
  if (metalOk) return 'metal';
  return null;
}

export default async function BitcoinProfitPage() {
  const prices = await fetchBtcPrices();

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <BitcoinProfitClient prices={prices} />
      </div>
    </main>
  );
}
