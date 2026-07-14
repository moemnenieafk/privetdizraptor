// Цена сборки. Типы живут здесь (а не в @/db/build-prices), чтобы их могли
// импортировать и клиентские компоненты, не утаскивая за собой drizzle.
import type { BuildResult } from '@/lib/weapon-build';

export type PriceSource = 'trader' | 'flea';

export interface BuildPrice {
  /** Рубли. */
  rub: number;
  source: PriceSource;
  /** Имя вендора: «Прапор», «Барахолка»… */
  vendor: string;
}

export interface BuildTotal {
  /** Ствол-база. null — в продаже нет (квестовая выдача, крафт). */
  weapon: number | null;
  /** Сумма обвеса без ствола. */
  mods: number;
  /** Ствол + обвес. */
  total: number;
  /** Детали без предложений — в total НЕ вошли, иначе итог врал бы в меньшую сторону. */
  unpricedIds: string[];
}

/**
 * Итог по ценам последнего синка. Ствол считаем отдельно: его часто выдают за квест
 * или он уже лежит в стеше — человеку важно видеть, сколько стоит именно ОБВЕС.
 */
export function buildTotal(
  baseItemId: string,
  result: BuildResult,
  prices: Record<string, BuildPrice>,
): BuildTotal {
  const weapon = prices[baseItemId]?.rub ?? null;

  let mods = 0;
  const unpricedIds: string[] = [];

  for (const p of result.parts) {
    const price = prices[p.itemId];
    if (!price) {
      unpricedIds.push(p.itemId);
      continue;
    }
    mods += price.rub * p.quantity;
  }

  return { weapon, mods, total: (weapon ?? 0) + mods, unpricedIds };
}

export const formatRub = (n: number): string =>
  `${Math.round(n).toLocaleString('ru-RU')} ₽`;
