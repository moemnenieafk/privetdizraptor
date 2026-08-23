// Движок «воронки оптимальной добычи предмета» — чистая логика, без БД/DOM/стора.
//
// Отвечает на вопрос «как ВЫГОДНЕЕ ВСЕГО получить предмет прямо сейчас»: сравнивает
// покупку у торговца (константа = min buyFor без флиа), барахолку (флиа-оффер),
// бартеры по уровням лояльности и крафты; для КАЖДОГО инпута бартера/крафта
// рекурсивно спускается («а его дешевле добыть иначе?»), пока не упрётся в лист
// (предмет, который только «купить/найти»). Возвращает теоретический минимум по всем
// путям (без гейта по прогрессу игрока) с деревом выбранного пути для UI.
//
// Правила оценки (грил §10 спеки, tickets/01):
//  • стоимость узла бартер/крафт = Σ(стоимость инпутов, рекурсивно) / outCount;
//  • инпуты-инструменты (TradeSlot.tool === true) исключаются из стоимости;
//  • время крафта игнорируется (деньги, не время);
//  • циклы — visited-множество по ТЕКУЩЕМУ пути (предмет уже в пути → ветку не разворачиваем);
//  • кэш итога по itemId в пределах одного прогона (одна карта на верхний вызов);
//  • отсутствие предмета нигде → total = Infinity, path.reason = 'unavailable' (не падаем).
//
// ───────────────────────── WORKED-EXAMPLE (ручная сверка) ─────────────────────────
// Металлическая канистра для топлива (itemId 5d1b36a186f7742523398433).
// Известная величина, разобранная ВРУЧНУЮ по ideas/2026-08-23-0352 (НЕ по этому коду):
//   • Константа-покупка у Егеря (Jaeger)               ≈ 238 944 ₽
//   • Барахолка (продать выгодно, купить — нет)         ≈ 330 000 ₽
//   • Бартер Прапор LL1 (8 спичек + 5 охотничьих)       ≈ 250 000 ₽  (дороже константы)
//   • Бартер Прапор LL2 (2 пропана + 2 присадки)        ≈ 175 000 ₽  ← дешевле константы на ~71к
// Ожидание сверки: bestAcquisitionCost для metal-канистры должен выбрать путь
// «Барахольщик/Прапор LL2» и вернуть perUnit ≈ 175 000 < 238 944 (константа Егеря),
// пометив источник barter + traderLevel 2. Пропан/присадка не бартерятся/крафтятся →
// воронка на них останавливается на листе (купить). Числа сверяются на живом зеркале,
// точные значения плавают с ценами барахолки; инвариант — barter LL2 дешевле константы.
// ──────────────────────────────────────────────────────────────────────────────────

import type { TradeSlot } from "@/db/schema";

/** Дешевейшая денежная покупка предмета (₽). trader — min buyFor без флиа; flea — флиа-оффер. */
export interface FunnelBuy {
  /** min buyFor у торговцев (без барахолки), в ₽; null если ни один торговец не продаёт. */
  trader: number | null;
  /** цена барахолки (₽); null если предмета нет на флиа. */
  flea: number | null;
  /** имя дешевейшего торговца (для листа «купить у …»). */
  traderName?: string;
  /** normalizedName дешевейшего торговца (для аватара/тинта — traderImg ждёт его, а не display-имя). */
  traderNormalizedName?: string;
  /** уровень лояльности дешевейшего торговца (в зеркале для buyFor обычно отсутствует). */
  traderLevel?: number;
}

/** Бартер/крафт, где предмет НА ВЫХОДЕ. inputs — требуемые слоты; outCount — сколько штук на выходе. */
export interface FunnelRecipe {
  id: string;
  /** имя торговца (бартер) или станции (крафт) — для подписи источника в UI. */
  sourceName: string;
  /** уровень лояльности торговца / уровень станции; null если неизвестен. */
  level: number | null;
  inputs: TradeSlot[];
  outCount: number;
}

/** Граф для рекурсии — всё, что движку нужно, без обращения к БД. */
export interface FunnelGraph {
  /** itemId → дешевейшая денежная покупка. */
  buy: Map<string, FunnelBuy>;
  /** itemId → бартеры, где этот предмет на выходе. */
  bartersByReward: Map<string, FunnelRecipe[]>;
  /** itemId → крафты, где этот предмет на выходе. */
  craftsByReward: Map<string, FunnelRecipe[]>;
}

/** Тип источника выбранного шага пути. */
export type FunnelSource = "trader" | "flea" | "barter" | "craft" | "unavailable" | "cycle";

/** Один инпут выбранного бартер/крафт-шага — вложенный под-путь (для дерева «что нужно купить»). */
export interface FunnelStep {
  itemId: string;
  /** сколько штук инпута требуется на один запуск рецепта. */
  count: number;
  /** оптимальный под-путь добычи этого инпута. */
  node: FunnelNode;
}

/** Узел дерева выбранного (дешевейшего) пути получения предмета. */
export interface FunnelNode {
  itemId: string;
  /** источник выбранного пути. */
  source: FunnelSource;
  /** цена за 1 шт выбранного пути (₽); Infinity если недоступно. */
  perUnit: number;
  /** имя торговца/станции для barter/craft/trader; 'Барахолка' для flea. */
  sourceName?: string;
  /** normalizedName торговца для source==='trader' (аватар/тинт — traderImg ждёт его, не display-имя). */
  sourceNn?: string;
  /** уровень лояльности/станции для barter/craft. */
  level?: number;
  /** id рецепта (barter/craft). */
  recipeId?: string;
  /** сколько штук даёт рецепт на выходе (barter/craft). */
  outCount?: number;
  /** инпуты выбранного рецепта с их под-путями (barter/craft). */
  steps?: FunnelStep[];
  /** пояснение для нетривиальных источников (unavailable/cycle). */
  reason?: string;
}

/** Итог верхнего вызова: total = perUnit (за 1 шт); path — дерево выбранного пути. */
export interface FunnelResult {
  total: number;
  perUnit: number;
  path: FunnelNode;
}

export interface FunnelOptions {
  /** Игнорировать барахолку как источник (напр. предмет заблокирован флиа). По умолчанию false. */
  ignoreFlea?: boolean;
  /**
   * Прямой путь (1 уровень) вместо полной рекурсии. По умолчанию false.
   * В flat-режиме инпуты бартера/крафта оцениваются ПО РЫНКУ (min trader/flea, buyLeaf),
   * без спуска «а его дешевле добыть иначе?». count инпутов — ЦЕЛЫЙ из рецепта (без деления
   * на outCount → дробей нет). Итог сходится с карточкой бартера/крафта на странице предмета.
   * Полная рекурсия (flat не задан) даёт идеализированный минимум с дробными количествами —
   * это для будущей фичи, не для исполнимого «купи столько-то и обменяй».
   */
  flat?: boolean;
}

/** Лист «купить»: min(trader без флиа, флиа) из graph.buy. */
function buyLeaf(itemId: string, graph: FunnelGraph, opts: FunnelOptions): FunnelNode {
  const buy = graph.buy.get(itemId);
  const traderPrice = buy?.trader ?? null;
  const fleaPrice = opts.ignoreFlea ? null : buy?.flea ?? null;

  // trader строго дешевле флиа ИЛИ флиа отсутствует → лист-торговец.
  const traderWins =
    traderPrice != null && (fleaPrice == null || traderPrice <= fleaPrice);
  if (traderWins) {
    return {
      itemId,
      source: "trader",
      perUnit: traderPrice as number,
      ...(buy?.traderName ? { sourceName: buy.traderName } : {}),
      ...(buy?.traderNormalizedName ? { sourceNn: buy.traderNormalizedName } : {}),
      ...(buy?.traderLevel != null ? { level: buy.traderLevel } : {}),
    };
  }
  if (fleaPrice != null) {
    return { itemId, source: "flea", perUnit: fleaPrice, sourceName: "Барахолка" };
  }
  return {
    itemId,
    source: "unavailable",
    perUnit: Infinity,
    reason: "нет покупки, бартера и крафта в зеркале",
  };
}

/**
 * Оценивает один рецепт (бартер/крафт): рекурсивно считает каждый инпут, суммирует
 * стоимость (инструменты пропускает) и нормирует на outCount. Возвращает узел выбранного
 * пути этого рецепта. Недостижимый инпут → рецепт целиком Infinity.
 */
function evalRecipe(
  itemId: string,
  recipe: FunnelRecipe,
  source: "barter" | "craft",
  graph: FunnelGraph,
  visited: Set<string>,
  cache: Map<string, FunnelNode>,
  opts: FunnelOptions,
): FunnelNode {
  const steps: FunnelStep[] = [];
  let sum = 0;
  for (const input of recipe.inputs) {
    if (input.tool === true) continue; // инструмент возвращается в станок — не стоимость
    const node = resolve(input.itemId, graph, visited, cache, opts);
    if (!Number.isFinite(node.perUnit)) {
      return {
        itemId,
        source,
        perUnit: Infinity,
        sourceName: recipe.sourceName,
        ...(recipe.level != null ? { level: recipe.level } : {}),
        recipeId: recipe.id,
        outCount: recipe.outCount,
        reason: `инпут недоступен: ${input.itemId}`,
      };
    }
    sum += node.perUnit * input.count;
    steps.push({ itemId: input.itemId, count: input.count, node });
  }
  const outCount = recipe.outCount > 0 ? recipe.outCount : 1;
  return {
    itemId,
    source,
    perUnit: sum / outCount,
    sourceName: recipe.sourceName,
    ...(recipe.level != null ? { level: recipe.level } : {}),
    recipeId: recipe.id,
    outCount,
    steps,
  };
}

/**
 * Оценивает один рецепт в flat-режиме: инпуты берутся ПО РЫНКУ (buyLeaf, min trader/flea),
 * без рекурсии вглубь. Стоимость = Σ(рыночная цена инпута × ЦЕЛЫЙ count) / outCount.
 * count в steps — целый из рецепта (никакого деления count на outCount). Недостижимый
 * инпут (нельзя купить нигде) → рецепт целиком Infinity.
 */
function flatEvalRecipe(
  itemId: string,
  recipe: FunnelRecipe,
  source: "barter" | "craft",
  graph: FunnelGraph,
  opts: FunnelOptions,
): FunnelNode {
  const steps: FunnelStep[] = [];
  let sum = 0;
  for (const input of recipe.inputs) {
    if (input.tool === true) continue; // инструмент возвращается в станок — не стоимость
    const node = buyLeaf(input.itemId, graph, opts); // рынок, без спуска
    if (!Number.isFinite(node.perUnit)) {
      return {
        itemId,
        source,
        perUnit: Infinity,
        sourceName: recipe.sourceName,
        ...(recipe.level != null ? { level: recipe.level } : {}),
        recipeId: recipe.id,
        outCount: recipe.outCount,
        reason: `инпут недоступен: ${input.itemId}`,
      };
    }
    sum += node.perUnit * input.count;
    steps.push({ itemId: input.itemId, count: input.count, node });
  }
  const outCount = recipe.outCount > 0 ? recipe.outCount : 1;
  return {
    itemId,
    source,
    perUnit: sum / outCount,
    sourceName: recipe.sourceName,
    ...(recipe.level != null ? { level: recipe.level } : {}),
    recipeId: recipe.id,
    outCount,
    steps,
  };
}

/**
 * Flat-путь (1 уровень) для itemId: сравнивает покупку (buyLeaf) с каждым бартером/крафтом,
 * чьи инпуты оценены по рынку. Возвращает дешевейший узел. Никакой рекурсии/циклов/кэша —
 * ровно один уровень. Для исполнимого «купи по рынку и обменяй» (сходится с карточкой).
 */
function flatResolve(itemId: string, graph: FunnelGraph, opts: FunnelOptions): FunnelNode {
  const candidates: FunnelNode[] = [buyLeaf(itemId, graph, opts)];
  for (const b of graph.bartersByReward.get(itemId) ?? []) {
    candidates.push(flatEvalRecipe(itemId, b, "barter", graph, opts));
  }
  for (const c of graph.craftsByReward.get(itemId) ?? []) {
    candidates.push(flatEvalRecipe(itemId, c, "craft", graph, opts));
  }
  let best = candidates[0];
  for (const c of candidates) {
    if (c.perUnit < best.perUnit) best = c;
  }
  return best;
}

/**
 * Рекурсивно находит дешевейший путь для itemId. visited защищает от циклов (предмет
 * уже в текущем пути → ветку не разворачиваем, отдаём buy-лист/недоступно). cache
 * мемоизирует итог по itemId в пределах прогона.
 */
function resolve(
  itemId: string,
  graph: FunnelGraph,
  visited: Set<string>,
  cache: Map<string, FunnelNode>,
  opts: FunnelOptions,
): FunnelNode {
  const cached = cache.get(itemId);
  if (cached) return cached;

  // Цикл: предмет уже в текущем пути. Разворачивать нельзя — оцениваем только как покупку.
  // (НЕ кэшируем: результат зависит от пути, а не только от itemId.)
  if (visited.has(itemId)) {
    const leaf = buyLeaf(itemId, graph, opts);
    if (leaf.source === "unavailable") {
      return {
        itemId,
        source: "cycle",
        perUnit: Infinity,
        reason: "цикл в графе рецептов — ветка оборвана",
      };
    }
    return leaf;
  }

  visited.add(itemId);

  const candidates: FunnelNode[] = [buyLeaf(itemId, graph, opts)];

  for (const b of graph.bartersByReward.get(itemId) ?? []) {
    candidates.push(evalRecipe(itemId, b, "barter", graph, visited, cache, opts));
  }
  for (const c of graph.craftsByReward.get(itemId) ?? []) {
    candidates.push(evalRecipe(itemId, c, "craft", graph, visited, cache, opts));
  }

  visited.delete(itemId);

  let best = candidates[0];
  for (const c of candidates) {
    if (c.perUnit < best.perUnit) best = c;
  }

  cache.set(itemId, best);
  return best;
}

/**
 * Дешевейший путь получения предмета по графу зеркала. Чистая, детерминированная функция.
 * @returns { total, perUnit, path } — total === perUnit (цена за 1 шт выбранного пути);
 *   path — дерево выбранного пути с ценами/источниками. Недоступно → perUnit = Infinity,
 *   path.source = 'unavailable'.
 */
export function bestAcquisitionCost(
  itemId: string,
  graph: FunnelGraph,
  opts: FunnelOptions = {},
): FunnelResult {
  // flat: прямой путь (1 уровень, инпуты по рынку, целые количества) — исполнимый и
  // сходится с карточкой предмета. Иначе — полная рекурсия (идеализированный минимум).
  const path = opts.flat
    ? flatResolve(itemId, graph, opts)
    : resolve(itemId, graph, new Set<string>(), new Map<string, FunnelNode>(), opts);
  return { total: path.perUnit, perUnit: path.perUnit, path };
}
