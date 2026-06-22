import { eq } from 'drizzle-orm';
import { BarterPageClient } from './BarterPageClient';
import type {
  BarterItemBase,
  BarterPrice,
  BarterSearchResult,
  BarterTrade,
} from '@/types/barter';
import { db } from '@/db';
import { barters as bartersTable, items } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';
import type { CtaVendorOffer } from '@/lib/eft-prices';

// Зеркало запросов items(types:[barter]) + barters() — собираем из НАШЕЙ Supabase
// (items + prices + barters). В рантайме в api.tarkov.dev НЕ ходим: данные зеркалит
// крон /api/cron/sync-prices (см. memory autonomy-prices-research / sprint-backend-state).
export const revalidate = 3600; // как было у tarkov.dev-фетча (next.revalidate: 3600)

const toPrices = (offers: CtaVendorOffer[] = []): BarterPrice[] =>
  offers.map((o) => ({
    price: o.price,
    priceRUB: o.priceRUB ?? null,
    vendor: { name: o.vendor.name, normalizedName: o.vendor.normalizedName ?? '' },
  }));

export default async function BarterPage() {
  const gameId = await eftGameId();
  const [itemRows, priceMap, barterRows] = await Promise.all([
    db
      .select({
        inGameId: items.inGameId,
        name: items.name,
        shortName: items.shortName,
        gridWidth: items.gridWidth,
        gridHeight: items.gridHeight,
        basePrice: items.basePrice,
      })
      .from(items)
      .where(eq(items.gameId, gameId)),
    getEftPriceMapFromDb(),
    db.select().from(bartersTable).where(eq(bartersTable.gameId, gameId)),
  ]);

  const catalog = new Map(itemRows.map((r) => [r.inGameId, r]));

  // Полный BarterItemBase из каталога + цен. Иконка — Supabase Storage (itemIconUrl).
  // Мемоизация: один ингредиент встречается в десятках бартеров — строим один раз.
  // ⚠️ backgroundColor (цвет редкости) живёт ТОЛЬКО в зеркале `prices` (в каталоге его нет);
  // если у предмета нет price-строки (рассинхрон barters↔prices) — плитка нейтрально-серая.
  // Это косметика: расчёты/XP идут от priceRUB в sellFor/buyFor, не от цвета.
  const baseCache = new Map<string, BarterItemBase>();
  const base = (id: string): BarterItemBase => {
    const hit = baseCache.get(id);
    if (hit) return hit;
    const c = catalog.get(id);
    const p = priceMap.get(id);
    const built: BarterItemBase = {
      id,
      name: c?.name ?? id,
      shortName: c?.shortName ?? '',
      image512pxLink: itemIconUrl(id),
      backgroundColor: p?.backgroundColor ?? 'default',
      width: c?.gridWidth ?? 1,
      height: c?.gridHeight ?? 1,
      sellFor: toPrices(p?.sellFor),
      buyFor: toPrices(p?.buyFor),
      normalizedName: p?.normalizedName || undefined,
      basePrice: c?.basePrice ?? undefined,
    };
    baseCache.set(id, built);
    return built;
  };

  // initialItems — зеркало items(types:[barter]). Принадлежность к набору теперь зависит от
  // зеркала `prices` (там лежит types[]) — предмет без price-строки в ручной поиск не попадёт.
  // Норма: крон зеркалит весь items(lang:ru). Сами сделки (initialBarters) это НЕ затрагивает.
  const initialItems: BarterSearchResult[] = itemRows
    .filter((r) => priceMap.get(r.inGameId)?.types?.includes('barter'))
    .map((r) => {
      const b = base(r.inGameId);
      const p = priceMap.get(r.inGameId);
      // normalizedName здесь ОБЯЗАТЕЛЕН (BarterSearchBar ищет по нему) → фолбэк на id.
      return { ...b, normalizedName: p?.normalizedName || r.inGameId, buyFor: b.buyFor ?? [] };
    });

  // initialBarters — зеркало barters(): сделки с вложенными required/reward.
  const initialBarters: BarterTrade[] = barterRows.map((b) => ({
    id: b.id,
    trader: { name: b.traderName, normalizedName: b.traderNormalizedName ?? '' },
    level: b.level ?? 1,
    taskUnlock: b.taskUnlockId ? { id: b.taskUnlockId } : null,
    requiredItems: b.requiredItems.map((s) => ({ item: base(s.itemId), count: s.count })),
    rewardItems: b.rewardItems.map((s) => ({ item: base(s.itemId), count: s.count })),
  }));

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <BarterPageClient initialItems={initialItems} initialBarters={initialBarters} />
      </div>
    </main>
  );
}
