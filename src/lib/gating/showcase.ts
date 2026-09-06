import 'server-only';

/**
 * Витрина тарифов: «что входит в тариф» ВЫВОДИТСЯ из матрицы гейтов, а не пишется руками.
 * Поэтому карточка тарифа не может разойтись с пейволом: поменял порог в /admin/billing —
 * строка сама переехала в другую карточку. Editorial-буллеты (tiers.perks) кладутся сверху
 * как маркетинговый слой — гибридная модель, решение V4DYA 06.09.
 *
 * Читаем те же кешированные снимки, что и гейтинг (getTiers/getGateMap), поэтому своих
 * cache-тегов здесь НЕТ: существующий invalidateGating() из админ-роутов обновляет и
 * витрину. Это и есть замыкание петли администрирования.
 *
 * Доменная логика живёт тут, а не в JSX (CLAUDE.md §4.7).
 */

import { allGateDefs, gateLabel, PRICING_GATE_KEY } from '@/data/gate-registry';
import { getTiers, getGateMap, type GateMap, type TierSnapshot } from '@/lib/gating/resolve';
import { tierRankOf, type TierLike } from '@/lib/gating/tiers';

/** Строка состава тарифа. */
export interface ShowcaseLine {
  key: string;
  label: string;
}

/** Карточка тарифа для витрины (кабинет и /pricing рисуют одну и ту же форму). */
export interface ShowcaseTier {
  slug: string;
  name: string;
  /** ₽/мес. Показывать только при опубликованной витрине. */
  price: number;
  rank: number;
  /** Авто-состав: гейты, чей порог указывает ровно на этот тир. */
  features: ShowcaseLine[];
  /** Editorial-буллеты из tiers.perks. */
  perks: string[];
  /** Имя тира рангом ниже — для строки «Всё из ‹…›». null у нижнего платного и у free. */
  inheritsFrom: string | null;
}

/** Ключи системных переключателей — не права доступа, в витрине им не место. */
function systemKeys(): Set<string> {
  return new Set(allGateDefs().filter((d) => d.kind === 'system').map((d) => d.key));
}

/** Порядок строк = порядок реестра (фичи, затем разделы) — стабильный и осмысленный. */
function registryOrder(): Map<string, number> {
  return new Map(allGateDefs().map((d, i) => [d.key, i]));
}

/**
 * Чистая сборка витрины из снимков. Правила отбора строк тира T (все обязательны):
 *  - `enabled` — выключенный гейт не применяется (фича открыта всем), рекламировать нечего;
 *  - `behavior !== 'hide'` — то, что намеренно прячем от неплательщика, не афишируем:
 *    это и нечестно, и палит скрытое;
 *  - порог указывает РОВНО на T — иначе строка задвоилась бы во всех тирах выше.
 *
 * У free (rank 0) авто-состава НЕТ намеренно: секционные гейты по умолчанию free, и
 * автовывод дал бы сотню строк «Карты, Задания, Предметы…». Карточка «Бойца» держится
 * на editorial-перках.
 */
export function buildTierShowcase(tiers: TierSnapshot[], gates: GateMap): ShowcaseTier[] {
  const visible = tiers
    .filter((t) => !t.archived && t.gameId === null)
    .sort((a, b) => a.rank - b.rank);

  const tierLikes: TierLike[] = visible.map((t) => ({ slug: t.slug, rank: t.rank }));
  const skip = systemKeys();
  const order = registryOrder();

  // Порог → ранг считаем один раз на ключ, а не в цикле по тирам.
  const byRank = new Map<number, ShowcaseLine[]>();
  for (const [key, gate] of Object.entries(gates)) {
    if (skip.has(key)) continue;
    if (!gate.enabled) continue;
    if (gate.behavior === 'hide') continue;
    const rank = tierRankOf(gate.minTier, tierLikes);
    if (rank <= 0) continue; // free-пороги — не «что входит в платный тариф»
    const bucket = byRank.get(rank) ?? [];
    bucket.push({ key, label: gateLabel(key) });
    byRank.set(rank, bucket);
  }
  for (const bucket of byRank.values()) {
    bucket.sort((a, b) => (order.get(a.key) ?? 1e9) - (order.get(b.key) ?? 1e9));
  }

  return visible.map((t, i) => {
    const prev = i > 0 ? visible[i - 1] : null;
    return {
      slug: t.slug,
      name: t.name,
      price: t.price,
      rank: t.rank,
      features: t.rank > 0 ? (byRank.get(t.rank) ?? []) : [],
      perks: t.perks ?? [],
      // «Всё из ‹Боец›» бессмысленно — каскад показываем только поверх платного тира.
      inheritsFrom: prev && prev.rank > 0 ? prev.name : null,
    };
  });
}

/** Витрина из БД (кеш общий с гейтингом). */
export async function getTierShowcase(): Promise<ShowcaseTier[]> {
  const [tiers, gates] = await Promise.all([getTiers(), getGateMap()]);
  return buildTierShowcase(tiers, gates);
}

/**
 * Опубликована ли витрина цен. ⚠️ Читаем строку гейта НАПРЯМУЮ, минуя requireTier:
 * у feature_gates.enabled семантика обратная нашей (там false = «гейт снят, открыто всем»),
 * поэтому системный переключатель через энфорсмент гонять нельзя. Единственное такое место
 * в проекте — см. шапку data/gate-registry.ts.
 */
export async function isPricingPublished(): Promise<boolean> {
  const gates = await getGateMap();
  return gates[PRICING_GATE_KEY]?.enabled ?? false;
}
