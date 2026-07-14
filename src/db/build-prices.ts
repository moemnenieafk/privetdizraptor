// Цены деталей сборки: дешёвейшее из «торговец» и «барахолка», в рублях.
// Читает нашу таблицу `prices` (в tarkov.dev в рантайме не ходим).
//
// ВАЖНОЕ ОГРАНИЧЕНИЕ: требуемый уровень лояльности торговца мы НЕ зеркалим
// (в prices.buyFor его нет). Значит солвер может предложить деталь, которая
// у вас ещё не открыта. Пока помечаем источник (торговец/барахолка) и показываем
// его в списке покупок — человек видит, у кого брать. Фильтр «только мои LL»
// приедет, когда добавим requiredPlayerLevel в синк цен.
//
// Только для сервера (прямой доступ к БД). Импортировать из RSC.
// Типы BuildPrice/PriceSource переехали в @/lib/build-price — их тянут и клиентские
// компоненты; здесь ре-экспорт, чтобы не ломать существующие импорты.
import { getEftPricesByIds } from "@/db/prices";
import type { BuildPrice } from "@/lib/build-price";

export type { BuildPrice, PriceSource } from "@/lib/build-price";

const FLEA = new Set(["flea-market", "Барахолка", "Flea Market"]);

const isFlea = (v: { name: string; normalizedName?: string }): boolean =>
  FLEA.has(v.normalizedName ?? "") || FLEA.has(v.name);

/**
 * Карта itemId → лучшая цена покупки. Предметы без единого предложения в карту
 * не попадают: солвер трактует отсутствие как «недоступно» и штрафует, а не
 * считает бесплатным.
 */
export async function getBuildPriceMap(
  itemIds: string[],
): Promise<Map<string, BuildPrice>> {
  if (itemIds.length === 0) return new Map();

  const prices = await getEftPricesByIds(itemIds);
  const out = new Map<string, BuildPrice>();

  for (const [id, p] of prices) {
    let best: BuildPrice | null = null;

    for (const offer of p.buyFor ?? []) {
      const rub = offer.priceRUB ?? offer.price;
      if (!rub || rub <= 0) continue;

      const candidate: BuildPrice = {
        rub,
        source: isFlea(offer.vendor) ? "flea" : "trader",
        vendor: offer.vendor.name,
      };

      if (!best || candidate.rub < best.rub) best = candidate;
    }

    if (best) out.set(id, best);
  }

  return out;
}

/** Готовая функция цены для солвера (см. lib/gunsmith-solver.ts). */
export function priceOfFrom(map: Map<string, BuildPrice>) {
  return (itemId: string): number | null => map.get(itemId)?.rub ?? null;
}
