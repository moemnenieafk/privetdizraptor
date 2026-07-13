// Солвер сборок: подбирает САМУЮ ДЕШЁВУЮ конфигурацию, проходящую заданные пороги.
//
// Один движок — три продукта:
//   • «Оружейник»: min ₽ при порогах квеста (эрго ≥, отдача ≤, вес ≤, ёмкость ≥)
//   • «Мета»:      min отдача при эрго ≥ N, бюджет ∞
//   • «Бюджет»:    min ₽ при отдача ≤ N
// Отличаются только набором Requirement и целевой функцией.
//
// Задача — дерево-ранец (выбор предмета в каждый слот, слоты рекурсивно открываются
// поставленными модулями). Точный перебор экспоненциален (у M4 сотни прицелов на
// десятке планок), поэтому берём жадный локальный поиск: он даёт результат, который
// на практике совпадает с ручной мета-сборкой, и укладывается в сотни миллисекунд.
//
// Алгоритм:
//   1. Протащить обязательные детали квеста (containsAll) — включая цепочку
//      промежуточных модулей (планка → крышка → прицел), самую дешёвую.
//   2. Заполнить required-слоты и патронник самым дешёвым.
//   3. Пока пороги не выполнены — применять ход, который сильнее всего снижает
//      суммарное нарушение (за рубль). Ходы: поставить/сменить/снять модуль.
//   4. Удешевление: снять или заменить на более дешёвое всё, что не роняет пороги.
import {
  calcBuild,
  emptyBuild,
  setMod,
  type BuildItemDef,
  type BuildItemIndex,
  type BuildNode,
  type BuildResult,
  type BuildStats,
  type WeaponSlotDef,
} from '@/lib/weapon-build';
import {
  parseSpec,
  type GunsmithMetric,
  type GunsmithRequirement,
} from '@/lib/gunsmith';
import type { GunsmithThreshold } from '@/db/schema-gunsmith';

/* ───────────────── вход/выход ───────────────── */

/** Цена предмета в рублях. null → предмет недоступен (нет у торговцев и на барахолке). */
export type PriceOf = (itemId: string) => number | null;

export interface SolveInput {
  baseItemId: string;
  index: BuildItemIndex;
  priceOf: PriceOf;
  /** Пороги. Для квеста — из gunsmith_specs; для «меты» — свои. */
  requirements: GunsmithRequirement[];
  /** Обязательные детали (containsAll квеста). */
  requiredItemIds?: string[];
  /** Что минимизируем при выполненных порогах. */
  objective?: 'price' | 'recoil' | 'ergonomics';
}

export interface SolveResult {
  node: BuildNode;
  result: BuildResult;
  /** Итог в рублях (без базы: ствол выдаётся/покупается отдельно). */
  price: number;
  /** Все пороги выполнены? */
  solved: boolean;
  /** Пороги, которые дожать не удалось (для честного сообщения в UI). */
  unmet: GunsmithRequirement[];
  /** Детали без цены — попали в сборку, но стоимость неизвестна. */
  unpricedItemIds: string[];
  iterations: number;
}

/* ───────────────── лимиты (чтобы не молотить вечно) ───────────────── */

const MAX_ITERATIONS = 80;
const MAX_CANDIDATES_PER_ITER = 2500;
const UNAVAILABLE_PRICE = 10_000_000; // «нет цены» ≠ «бесплатно»: иначе солвер обожает недоступное

/* ───────────────── хелперы ───────────────── */

const isModdable = (d: BuildItemDef | undefined): boolean =>
  d?.kind === 'weapon' || d?.kind === 'mod';

function slotsOf(itemId: string, index: BuildItemIndex): WeaponSlotDef[] {
  const d = index.get(itemId);
  if (d?.kind === 'weapon' || d?.kind === 'mod') return d.slots;
  return [];
}

/** Все установленные предметы дерева. */
function installedIds(node: BuildNode, out: Set<string> = new Set()): Set<string> {
  for (const child of Object.values(node.mods)) {
    out.add(child.itemId);
    installedIds(child, out);
  }
  return out;
}

/** Цена всей сборки (без базы). */
function priceOfBuild(result: BuildResult, priceOf: PriceOf): { price: number; unpriced: string[] } {
  let price = 0;
  const unpriced: string[] = [];
  for (const p of result.parts) {
    const v = priceOf(p.itemId);
    if (v === null) unpriced.push(p.itemId);
    else price += v * p.quantity;
  }
  return { price, unpriced };
}

const priceOrPenalty = (itemId: string, priceOf: PriceOf): number =>
  priceOf(itemId) ?? UNAVAILABLE_PRICE;

/* ───────────────── нарушение порогов ───────────────── */

function actualOf(metric: GunsmithMetric, stats: BuildStats): number | null {
  switch (metric) {
    case 'ergonomics':
      return stats.ergonomics;
    case 'recoilSum':
      return stats.recoilSum;
    case 'weight':
      return stats.weight;
    case 'magazineCapacity':
      return stats.capacity;
    case 'muzzleVelocity':
      return stats.velocity;
    case 'accuracy':
      return stats.moa;
    default:
      return null; // durability / width / height / effectiveDistance — не считаем
  }
}

/**
 * Насколько сборка НЕ дотягивает до порога, в долях от требуемого значения.
 * 0 = порог выполнен. Нормировка нужна, чтобы «не хватает 3 эрго» и «перебор 200
 * отдачи» сравнивались в одной шкале.
 */
function violationOf(req: GunsmithRequirement, stats: BuildStats): number {
  const actual = actualOf(req.metric, stats);
  if (actual === null) return 0; // неизмеримое не штрафуем

  const scale = Math.max(1, Math.abs(req.value));

  switch (req.op) {
    case 'gt':
    case 'gte':
      return Math.max(0, (req.value - actual) / scale);
    case 'lt':
    case 'lte':
      return Math.max(0, (actual - req.value) / scale);
    case 'eq':
      return Math.abs(actual - req.value) / scale;
  }
}

const totalViolation = (reqs: GunsmithRequirement[], stats: BuildStats): number =>
  reqs.reduce((sum, r) => sum + violationOf(r, stats), 0);

const unmetOf = (reqs: GunsmithRequirement[], stats: BuildStats): GunsmithRequirement[] =>
  reqs.filter((r) => violationOf(r, stats) > 0);

/* ───────────────── открытые слоты дерева ───────────────── */

interface OpenSlot {
  /** Путь до ВЛАДЕЛЬЦА слота (цепочка slotNameId от корня). */
  path: string[];
  slot: WeaponSlotDef;
  /** Что стоит в слоте сейчас. */
  currentItemId: string | null;
}

function collectOpenSlots(
  node: BuildNode,
  index: BuildItemIndex,
  path: string[],
  out: OpenSlot[],
): void {
  for (const slot of slotsOf(node.itemId, index)) {
    const child = node.mods[slot.nameId];
    out.push({ path, slot, currentItemId: child?.itemId ?? null });
    if (child) collectOpenSlots(child, index, [...path, slot.nameId], out);
  }
}

const openSlots = (node: BuildNode, index: BuildItemIndex): OpenSlot[] => {
  const out: OpenSlot[] = [];
  collectOpenSlots(node, index, [], out);
  return out;
};

/* ───────────────── протаскивание обязательной детали ───────────────── */

/**
 * Цепочка «база → … → слот, принимающий target». BFS по ПОТЕНЦИАЛЬНОМУ дереву
 * (не по установленному): чтобы поставить прицел, может понадобиться сперва
 * планка, а на неё — крышка. Промежуточные звенья берём самые дешёвые.
 */
function chainTo(
  baseItemId: string,
  targetId: string,
  index: BuildItemIndex,
  priceOf: PriceOf,
): { slotNameId: string; itemId: string }[] | null {
  interface Step {
    itemId: string;
    chain: { slotNameId: string; itemId: string }[];
  }

  const queue: Step[] = [{ itemId: baseItemId, chain: [] }];
  const seen = new Set<string>([baseItemId]);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;

    for (const slot of slotsOf(cur.itemId, index)) {
      // Цель влезает прямо сюда — готово.
      if (slot.allowedItemIds.includes(targetId)) {
        return [...cur.chain, { slotNameId: slot.nameId, itemId: targetId }];
      }

      // Иначе идём вглубь через модули, у которых есть свои слоты.
      // Сортируем по цене: дешёвый переходник предпочтительнее дорогого.
      const carriers = slot.allowedItemIds
        .filter((id) => !seen.has(id) && isModdable(index.get(id)) && slotsOf(id, index).length > 0)
        .sort((a, b) => priceOrPenalty(a, priceOf) - priceOrPenalty(b, priceOf));

      for (const id of carriers) {
        seen.add(id);
        queue.push({
          itemId: id,
          chain: [...cur.chain, { slotNameId: slot.nameId, itemId: id }],
        });
      }
    }
  }

  return null;
}

/** Ставит цепочку в дерево. Возвращает новое дерево. */
function applyChain(
  node: BuildNode,
  chain: { slotNameId: string; itemId: string }[],
): BuildNode {
  let out = node;
  const path: string[] = [];

  for (const step of chain) {
    // Уже стоит нужное — не перетираем (иначе снесём вложенное).
    const existing = nodeAt(out, path)?.mods[step.slotNameId];
    if (existing?.itemId !== step.itemId) {
      out = setMod(out, path, step.slotNameId, step.itemId);
    }
    path.push(step.slotNameId);
  }

  return out;
}

function nodeAt(node: BuildNode, path: string[]): BuildNode | undefined {
  let cur: BuildNode | undefined = node;
  for (const key of path) {
    cur = cur?.mods[key];
    if (!cur) return undefined;
  }
  return cur;
}

/* ───────────────── солвер ───────────────── */

export function solveBuild(input: SolveInput): SolveResult {
  const { baseItemId, index, priceOf, requirements, objective = 'price' } = input;
  const requiredItemIds = input.requiredItemIds ?? [];

  let node = emptyBuild(baseItemId);

  // 1. Обязательные детали квеста — с цепочкой промежуточных модулей.
  const locked = new Set<string>(requiredItemIds);
  for (const id of requiredItemIds) {
    const chain = chainTo(baseItemId, id, index, priceOf);
    if (!chain) continue; // деталь не влезает в этот ствол — источник соврал, не падаем
    node = applyChain(node, chain);
    for (const step of chain) locked.add(step.itemId); // переходники тоже трогать нельзя
  }

  // 2. Обязательные слоты (магазин, патронник, ствол…) — самым дешёвым допустимым.
  for (const os of openSlots(node, index)) {
    if (!os.slot.required || os.currentItemId !== null) continue;
    const cheapest = [...os.slot.allowedItemIds]
      .filter((id) => index.has(id))
      .sort((a, b) => priceOrPenalty(a, priceOf) - priceOrPenalty(b, priceOf))[0];
    if (cheapest) node = setMod(node, os.path, os.slot.nameId, cheapest);
  }

  // 3. Жадное дожатие порогов.
  let iterations = 0;
  let result = calcBuild(node, index);

  while (totalViolation(requirements, result.stats) > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    const baseViolation = totalViolation(requirements, result.stats);
    const basePrice = priceOfBuild(result, priceOf).price;

    let bestNode: BuildNode | null = null;
    let bestScore = 0; // «снижение нарушения на рубль»; принимаем только > 0
    let evaluated = 0;

    for (const os of openSlots(node, index)) {
      // Кандидаты: любой допустимый модуль + «снять» (если стоит и не заблокирован).
      const candidates: (string | null)[] = [...os.slot.allowedItemIds.filter((id) => index.has(id))];
      if (os.currentItemId !== null && !locked.has(os.currentItemId)) candidates.push(null);

      for (const cand of candidates) {
        if (cand === os.currentItemId) continue;
        if (os.currentItemId !== null && locked.has(os.currentItemId)) continue; // не трогаем квестовые
        if (++evaluated > MAX_CANDIDATES_PER_ITER) break;

        const next = setMod(node, os.path, os.slot.nameId, cand);
        const nextResult = calcBuild(next, index);

        // Ход, выбивший обязательную деталь, — недопустим.
        const has = installedIds(next);
        if (requiredItemIds.some((id) => !has.has(id))) continue;

        const gain = baseViolation - totalViolation(requirements, nextResult.stats);
        if (gain <= 0) continue;

        const cost = priceOfBuild(nextResult, priceOf).price - basePrice;
        // Дешевле и лучше — идеально. Дороже — делим выигрыш на цену.
        const score = cost <= 0 ? gain * 1000 : gain / (cost / 10_000 + 1);

        if (score > bestScore) {
          bestScore = score;
          bestNode = next;
        }
      }
    }

    if (!bestNode) break; // улучшающих ходов нет — дожали, сколько смогли
    node = bestNode;
    result = calcBuild(node, index);
  }

  // 4. Удешевление: снять/заменить всё, что не роняет пороги.
  //    Для objective='recoil'/'ergonomics' вместо цены минимизируем метрику.
  const solvedNow = totalViolation(requirements, result.stats) === 0;
  if (solvedNow) {
    let improved = true;
    let guard = 0;

    while (improved && guard < MAX_ITERATIONS) {
      improved = false;
      guard++;

      const curCost = objectiveCost(result, priceOf, objective);

      for (const os of openSlots(node, index)) {
        if (os.currentItemId !== null && locked.has(os.currentItemId)) continue;
        if (os.slot.required && os.currentItemId === null) continue;

        const candidates: (string | null)[] = [
          ...os.slot.allowedItemIds.filter((id) => index.has(id)),
        ];
        if (!os.slot.required && os.currentItemId !== null) candidates.push(null);

        for (const cand of candidates) {
          if (cand === os.currentItemId) continue;

          const next = setMod(node, os.path, os.slot.nameId, cand);
          const nextResult = calcBuild(next, index);

          if (totalViolation(requirements, nextResult.stats) > 0) continue;

          const has = installedIds(next);
          if (requiredItemIds.some((id) => !has.has(id))) continue;

          if (objectiveCost(nextResult, priceOf, objective) < curCost - 0.001) {
            node = next;
            result = nextResult;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }
  }

  const { price, unpriced } = priceOfBuild(result, priceOf);

  return {
    node,
    result,
    price,
    solved: totalViolation(requirements, result.stats) === 0,
    unmet: unmetOf(requirements, result.stats),
    unpricedItemIds: unpriced,
    iterations,
  };
}

/** Целевая функция фазы удешевления. */
function objectiveCost(
  result: BuildResult,
  priceOf: PriceOf,
  objective: 'price' | 'recoil' | 'ergonomics',
): number {
  if (objective === 'recoil') return result.stats.recoilSum;
  if (objective === 'ergonomics') return -result.stats.ergonomics; // максимизируем
  return priceOfBuild(result, priceOf).price;
}

/* ───────────────── обёртка под квест ───────────────── */

export interface SolveQuestInput {
  baseItemId: string;
  index: BuildItemIndex;
  priceOf: PriceOf;
  spec: { thresholds: GunsmithThreshold[]; requiredItemIds: string[] };
}

/** Самая дешёвая сборка, проходящая квест «Оружейник». */
export function solveQuest(input: SolveQuestInput): SolveResult {
  const { requirements } = parseSpec(input.spec.thresholds);

  return solveBuild({
    baseItemId: input.baseItemId,
    index: input.index,
    priceOf: input.priceOf,
    requirements,
    requiredItemIds: input.spec.requiredItemIds,
    objective: 'price',
  });
}

/** Мета-сборка: минимум отдачи при заданной планке эргономики. */
export function solveMeta(
  baseItemId: string,
  index: BuildItemIndex,
  priceOf: PriceOf,
  minErgonomics = 50,
): SolveResult {
  return solveBuild({
    baseItemId,
    index,
    priceOf,
    requirements: [
      { metric: 'ergonomics', op: 'gte', value: minErgonomics, rawName: 'ergonomics' },
    ],
    objective: 'recoil',
  });
}

/** Бюджетная сборка: минимум цены при потолке отдачи. */
export function solveBudget(
  baseItemId: string,
  index: BuildItemIndex,
  priceOf: PriceOf,
  maxRecoilSum: number,
): SolveResult {
  return solveBuild({
    baseItemId,
    index,
    priceOf,
    requirements: [{ metric: 'recoilSum', op: 'lte', value: maxRecoilSum, rawName: 'recoil' }],
    objective: 'price',
  });
}