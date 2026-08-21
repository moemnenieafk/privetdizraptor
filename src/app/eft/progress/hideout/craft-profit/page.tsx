import { eq, and, inArray } from 'drizzle-orm';
import type { Metadata } from 'next';
import { db } from '@/db';
import { crafts as craftsTable, items, prices } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { getHideoutUnlockMap, getHideoutStations } from '@/db/hideout';
import { itemIconUrl } from '@/lib/item-icon';
import { EFT_QUESTS } from '@/data/quests';
import { CraftProfitClient, type ProcessedCraft, type CraftSlotItem } from './CraftProfitClient';

// id квеста → имя (для лейбла чипа квест-анлока). Статичный набор квестов, не внешний фетч.
const QUEST_NAME = new Map(EFT_QUESTS.map((q) => [q.id, q.name]));

export const metadata: Metadata = { title: 'Прибыль убежища | Убежище ЦТА' };

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

// Топливные баки: обычный requiredItem, но тумблер «Пустой бак» считает их по 10% продажи трейдеру
// (§1.5 ресёрча). Небольшой хардкод BSG-id — расширяется одной строкой.
const FUEL_ITEM_IDS = new Set([
  '5d1b371186f774253763a656', // Expeditionary fuel tank
  '5d1b36a186f7742523398433', // Metal fuel tank
]);

// Отдельный роут у фермы биткоинов (§9 спеки) — её крафты из раздела прибыли исключаем.
const EXCLUDED_STATION = 'bitcoin-farm';

// Сборка из НАШЕГО зеркала (crafts + items + цены). В рантайме в tarkov.dev НЕ ходим (§4.11).
// Отдаём СЫРЫЕ компоненты цены — профит клиент считает реактивно (слайдеры навыков).
async function fetchCrafts(): Promise<ProcessedCraft[]> {
  const gameId = await eftGameId();
  const [craftRows, priceMap, unlockMap] = await Promise.all([
    db.select().from(craftsTable).where(eq(craftsTable.gameId, gameId)),
    getEftPriceMapFromDb(),
    getHideoutUnlockMap(),
  ]);

  // Только предметы, участвующие в крафтах (входы + выходы), — для имён/basePrice/slug/фона.
  const involved = new Set<string>();
  for (const c of craftRows) {
    if (c.stationNormalizedName === EXCLUDED_STATION) continue;
    for (const s of c.requiredItems) involved.add(s.itemId);
    for (const s of c.rewardItems) involved.add(s.itemId);
  }
  const ids = [...involved];
  const [itemRows, priceMetaRows] = ids.length
    ? await Promise.all([
        db
          .select({
            inGameId: items.inGameId,
            name: items.name,
            shortName: items.shortName,
            basePrice: items.basePrice,
          })
          .from(items)
          .where(and(eq(items.gameId, gameId), inArray(items.inGameId, ids))),
        db
          .select({
            inGameId: prices.inGameId,
            normalizedName: prices.normalizedName,
            backgroundColor: prices.backgroundColor,
          })
          .from(prices)
          .where(and(eq(prices.gameId, gameId), inArray(prices.inGameId, ids))),
      ])
    : [[], []];
  const itemMap = new Map(itemRows.map((r) => [r.inGameId, r]));
  const metaMap = new Map(priceMetaRows.map((r) => [r.inGameId, r]));

  const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
  const isFlea = (v: { name: string; normalizedName?: string }) =>
    v.name === 'Flea Market' || v.normalizedName === 'flea-market';

  const slotItem = (id: string): CraftSlotItem => {
    const meta = metaMap.get(id);
    return {
      id,
      name: itemMap.get(id)?.name ?? id,
      shortName: itemMap.get(id)?.shortName ?? '',
      image512pxLink: itemIconUrl(id),
      ...(meta?.backgroundColor ? { backgroundColor: meta.backgroundColor } : {}),
      ...(meta?.normalizedName ? { slug: meta.normalizedName } : {}),
    };
  };

  // Дешевейшая cash-покупка из buyFor (₽) — стоимость входа.
  const cheapestBuy = (id: string): number => {
    const buys = (priceMap.get(id)?.buyFor ?? []).filter((x) => rubVal(x) > 0);
    if (!buys.length) return 0;
    return rubVal(buys.reduce((mn, cur) => (rubVal(cur) < rubVal(mn) ? cur : mn), buys[0]));
  };
  // Лучшая продажа трейдеру за штуку (БЕЗ барахолки) — база «пустого бака» / канал трейдера.
  const bestTraderSell = (id: string): number => {
    const sells = (priceMap.get(id)?.sellFor ?? []).filter((x) => !isFlea(x.vendor));
    if (!sells.length) return 0;
    return rubVal(sells.reduce((mx, cur) => (rubVal(cur) > rubVal(mx) ? cur : mx), sells[0]));
  };

  return craftRows
    .filter((c) => c.stationNormalizedName !== EXCLUDED_STATION)
    .map((c): ProcessedCraft => {
      const stationNormalized = c.stationNormalizedName ?? '';
      const level = c.level ?? 1;

      const required = c.requiredItems.map((s) => ({
        item: slotItem(s.itemId),
        count: s.count,
        unitBuy: cheapestBuy(s.itemId),
        isFuel: FUEL_ITEM_IDS.has(s.itemId),
        sellTrader: bestTraderSell(s.itemId),
        ...(s.tool ? { isTool: true } : {}),
      }));

      const reward = c.rewardItems.map((s) => {
        const p = priceMap.get(s.itemId);
        return {
          item: slotItem(s.itemId),
          count: s.count,
          basePrice: itemMap.get(s.itemId)?.basePrice ?? 0,
          bestTraderSell: bestTraderSell(s.itemId),
          fleaPrice: p?.lastLowPrice ?? p?.avg24hPrice ?? 0,
        };
      });

      return {
        id: c.id,
        stationName: c.stationName,
        stationNormalized,
        stationIcon: stationIcon(c.stationNormalizedName, c.stationName),
        level,
        duration: c.duration ?? 0,
        required,
        reward,
        gate: unlockMap[`${stationNormalized}|${level}`]
          ? {
              stations: unlockMap[`${stationNormalized}|${level}`].stations.map((x) => ({ name: x.name, level: x.level })),
              traders: unlockMap[`${stationNormalized}|${level}`].traders.map((x) => ({ name: x.name, level: x.level })),
              skills: unlockMap[`${stationNormalized}|${level}`].skills.map((x) => ({ name: x.name, level: x.level })),
            }
          : undefined,
        ...(c.taskUnlockId ? { taskUnlock: c.taskUnlockId } : {}),
        ...(c.taskUnlockId && QUEST_NAME.has(c.taskUnlockId)
          ? { taskUnlockName: QUEST_NAME.get(c.taskUnlockId) }
          : {}),
        ...(c.gameEditions?.length ? { gameEditions: c.gameEditions } : {}),
        ...(c.requiredQuestItems?.length ? { requiredQuestItems: c.requiredQuestItems } : {}),
      };
    });
}

export default async function CraftProfitPage() {
  const [crafts, stations] = await Promise.all([fetchCrafts(), getHideoutStations()]);

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <CraftProfitClient crafts={crafts} hideoutStations={stations} />
      </div>
    </main>
  );
}
