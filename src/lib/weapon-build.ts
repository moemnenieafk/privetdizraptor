// Чистый движок сборок оружия (EFT). Без React, без БД, без сети — только математика.
// Формулы сверены с эталонной реализацией Totov Builder (InventoryItemService) и
// схемой tarkov.dev (recoilModifier/accuracyModifier приходят ДОЛЕЙ: -0.06 = −6%).
//
//   эргономика  = base.ergonomics + Σ mod.ergonomics                (плоско, рекурсивно)
//   отдача      = (base.recoil + ammo.recoilModifier) * (1 + Σ mod.recoilModifier)
//   recoil sum  = верт + гор                                        ← проверяет «Оружейник»
//   точность    = base.moa * (1 + Σ mod.accuracyModifier)
//   вес         = base.weight + Σ mod.weight
//
// Проценты СКЛАДЫВАЮТСЯ, не перемножаются.

/* ───────────────── справочники (из БД: items + weapon_mods + weapon_slots) ───────────────── */

/** Слот-приёмник модулей у оружия или у самого модуля (планка → крышка → прицел). */
export interface WeaponSlotDef {
  /** BSG id слота. */
  slotId: string;
  /** Технический ключ: mod_muzzle / mod_magazine / mod_scope … — стабилен между вайпами. */
  nameId: string;
  /** Отображаемое имя слота. */
  name: string;
  required: boolean;
  /** Плоский список допустимых id (уже с вычтенными excluded). */
  allowedItemIds: string[];
}

/** Оружие-база. */
export interface WeaponBaseDef {
  kind: 'weapon';
  id: string;
  name: string;
  shortName: string;
  caliber: string | null;
  weight: number;
  ergonomics: number;
  recoilVertical: number;
  recoilHorizontal: number;
  fireRate: number | null;
  sightingRange: number | null;
  /** MOA базы (centerOfImpact). */
  moa: number | null;
  slots: WeaponSlotDef[];
  defaultPresetId: string | null;
}

/** Модуль (обвес, магазин, прицел, ствол…). */
export interface WeaponModDef {
  kind: 'mod';
  id: string;
  name: string;
  shortName: string;
  weight: number;
  /** Плоская прибавка к эргономике (может быть отрицательной). */
  ergonomics: number;
  /** Доля: -0.06 = −6% отдачи. */
  recoilModifier: number;
  /** Доля. */
  accuracyModifier: number;
  /** Прибавка к скорости пули, %. */
  velocity: number;
  loudness: number;
  /** Ёмкость (только магазины). */
  capacity: number | null;
  conflictingItemIds: string[];
  conflictingSlotIds: string[];
  slots: WeaponSlotDef[];
}

/** Патрон в патроннике/магазине — влияет на отдачу и скорость. */
export interface WeaponAmmoDef {
  kind: 'ammo';
  id: string;
  name: string;
  shortName: string;
  weight: number;
  caliber: string | null;
  damage: number;
  penetrationPower: number;
  initialSpeed: number;
  /** Плоская добавка к отдаче ДО применения процентов модулей. */
  recoilModifier: number;
  accuracyModifier: number;
}

/** Дискриминированный union справочника. Никакого `any`. */
export type BuildItemDef = WeaponBaseDef | WeaponModDef | WeaponAmmoDef;

/** Карта id → определение. Собирается один раз из БД на страницу конструктора. */
export type BuildItemIndex = ReadonlyMap<string, BuildItemDef>;

/* ───────────────── дерево сборки (persist-форма: Zustand + weapon_builds.tree) ───────────────── */

/**
 * Рекурсивный узел. Ключ — nameId слота (не BSG slotId): он читаемый и переживает вайпы.
 * Совпадает по смыслу с IInventoryItem у Totov, но без лишнего `content`.
 */
export interface BuildNode {
  itemId: string;
  /** Кол-во (для патронов в патроннике = 1). */
  quantity: number;
  /** slotNameId → вложенный узел. Пустой слот в дереве не хранится. */
  mods: Record<string, BuildNode>;
}

/* ───────────────── результат расчёта ───────────────── */

export interface BuildStats {
  ergonomics: number;
  recoilVertical: number;
  recoilHorizontal: number;
  /** Сумма отдачи — цель квестов «Оружейник». */
  recoilSum: number;
  /** MOA, null если у базы нет centerOfImpact. */
  moa: number | null;
  weight: number;
  /** Скорость пули, м/с (null без патрона). */
  velocity: number | null;
  loudness: number;
  /** Ёмкость установленного магазина. */
  capacity: number | null;
  /** Кол-во установленных модулей. */
  modCount: number;
}

/** Дельта «сток → собранное» для панели статов. */
export interface BuildStatsDelta {
  stock: BuildStats;
  current: BuildStats;
  ergonomics: number;
  recoilSum: number;
  weight: number;
}

export type BuildIssue =
  | { type: 'missing_required'; slotNameId: string; slotName: string }
  | { type: 'conflict'; itemId: string; conflictsWithId: string }
  | { type: 'not_allowed'; slotNameId: string; itemId: string }
  | { type: 'unknown_item'; itemId: string };

export interface BuildResult {
  stats: BuildStats;
  issues: BuildIssue[];
  /** Плоский список всех установленных предметов (для shopping list и OG-картинки). */
  parts: { itemId: string; quantity: number; slotNameId: string; depth: number }[];
}

/* ───────────────── внутренние аккумуляторы ───────────────── */

interface ModAcc {
  ergonomics: number;
  recoilModifier: number;
  accuracyModifier: number;
  velocity: number;
  loudness: number;
  weight: number;
  capacity: number | null;
  count: number;
}

const emptyAcc = (): ModAcc => ({
  ergonomics: 0,
  recoilModifier: 0,
  accuracyModifier: 0,
  velocity: 0,
  loudness: 0,
  weight: 0,
  capacity: null,
  count: 0,
});

const isWeapon = (d: BuildItemDef): d is WeaponBaseDef => d.kind === 'weapon';
const isMod = (d: BuildItemDef): d is WeaponModDef => d.kind === 'mod';
const isAmmo = (d: BuildItemDef): d is WeaponAmmoDef => d.kind === 'ammo';

const round = (v: number, digits = 2): number => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};

/** Обходит дерево модулей узла и суммирует модификаторы (рекурсивно, как у Totov). */
function walkMods(
  node: BuildNode,
  index: BuildItemIndex,
  acc: ModAcc,
  ammo: { def: WeaponAmmoDef | null },
  parts: BuildResult['parts'],
  issues: BuildIssue[],
  slots: WeaponSlotDef[],
  depth: number,
): void {
  const slotByName = new Map(slots.map((s) => [s.nameId, s]));

  for (const [slotNameId, child] of Object.entries(node.mods)) {
    const def = index.get(child.itemId);
    if (!def) {
      issues.push({ type: 'unknown_item', itemId: child.itemId });
      continue;
    }

    const slot = slotByName.get(slotNameId);
    if (slot && !slot.allowedItemIds.includes(child.itemId)) {
      issues.push({ type: 'not_allowed', slotNameId, itemId: child.itemId });
    }

    parts.push({ itemId: child.itemId, quantity: child.quantity, slotNameId, depth });

    if (isAmmo(def)) {
      // Патрон в патроннике/магазине: модификатор отдачи плоский, применяется ДО процентов.
      if (!ammo.def) ammo.def = def;
      acc.weight += def.weight * child.quantity;
      acc.count += 1;
      continue;
    }

    if (isMod(def)) {
      acc.ergonomics += def.ergonomics;
      acc.recoilModifier += def.recoilModifier;
      acc.accuracyModifier += def.accuracyModifier;
      acc.velocity += def.velocity;
      acc.loudness += def.loudness;
      acc.weight += def.weight * child.quantity;
      acc.count += 1;
      if (def.capacity != null) acc.capacity = def.capacity;

      walkMods(child, index, acc, ammo, parts, issues, def.slots, depth + 1);
      continue;
    }

    // Оружие внутри слота (подствольник) — считаем как модуль без модификаторов.
    acc.weight += def.weight * child.quantity;
    acc.count += 1;
  }
}

/** Проверка требуемых слотов и конфликтов. */
function collectIssues(
  root: BuildNode,
  base: WeaponBaseDef,
  index: BuildItemIndex,
  parts: BuildResult['parts'],
  issues: BuildIssue[],
): void {
  for (const slot of base.slots) {
    if (slot.required && root.mods[slot.nameId] == null) {
      issues.push({ type: 'missing_required', slotNameId: slot.nameId, slotName: slot.name });
    }
  }

  const installed = new Set(parts.map((p) => p.itemId));
  for (const p of parts) {
    const def = index.get(p.itemId);
    if (!def || !isMod(def)) continue;
    for (const conflictId of def.conflictingItemIds) {
      if (installed.has(conflictId)) {
        issues.push({ type: 'conflict', itemId: p.itemId, conflictsWithId: conflictId });
      }
    }
  }
}

/* ───────────────── публичный API ───────────────── */

/** Пустая сборка на голой базе. */
export function emptyBuild(baseItemId: string): BuildNode {
  return { itemId: baseItemId, quantity: 1, mods: {} };
}

/** Полный расчёт сборки. Никогда не бросает: неизвестные id уходят в issues. */
export function calcBuild(root: BuildNode, index: BuildItemIndex): BuildResult {
  const base = index.get(root.itemId);

  if (!base || !isWeapon(base)) {
    return {
      stats: {
        ergonomics: 0,
        recoilVertical: 0,
        recoilHorizontal: 0,
        recoilSum: 0,
        moa: null,
        weight: 0,
        velocity: null,
        loudness: 0,
        capacity: null,
        modCount: 0,
      },
      issues: [{ type: 'unknown_item', itemId: root.itemId }],
      parts: [],
    };
  }

  const acc = emptyAcc();
  const ammo: { def: WeaponAmmoDef | null } = { def: null };
  const parts: BuildResult['parts'] = [];
  const issues: BuildIssue[] = [];

  walkMods(root, index, acc, ammo, parts, issues, base.slots, 0);
  collectIssues(root, base, index, parts, issues);

  const ammoRecoil = ammo.def?.recoilModifier ?? 0;
  const ammoAccuracy = ammo.def?.accuracyModifier ?? 0;

  const recoilV = (base.recoilVertical + ammoRecoil) * (1 + acc.recoilModifier);
  const recoilH = (base.recoilHorizontal + ammoRecoil) * (1 + acc.recoilModifier);

  const stats: BuildStats = {
    ergonomics: round(base.ergonomics + acc.ergonomics, 1),
    recoilVertical: Math.round(recoilV),
    recoilHorizontal: Math.round(recoilH),
    recoilSum: Math.round(recoilV) + Math.round(recoilH),
    moa:
      base.moa != null
        ? round(base.moa * (1 + acc.accuracyModifier + ammoAccuracy), 2)
        : null,
    weight: round(base.weight + acc.weight, 2),
    velocity:
      ammo.def != null ? Math.round(ammo.def.initialSpeed * (1 + acc.velocity / 100)) : null,
    loudness: Math.round(acc.loudness),
    capacity: acc.capacity,
    modCount: acc.count,
  };

  return { stats, issues, parts };
}

/** Дельта против «стока» (голая база без обвеса) — для панели статов. */
export function calcDelta(root: BuildNode, index: BuildItemIndex): BuildStatsDelta {
  const stock = calcBuild(emptyBuild(root.itemId), index).stats;
  const current = calcBuild(root, index).stats;

  return {
    stock,
    current,
    ergonomics: round(current.ergonomics - stock.ergonomics, 1),
    recoilSum: current.recoilSum - stock.recoilSum,
    weight: round(current.weight - stock.weight, 2),
  };
}

/** Установить модуль в слот (иммутабельно). Слот с вложенными модами очищается. */
export function setMod(
  root: BuildNode,
  path: string[],
  slotNameId: string,
  itemId: string | null,
): BuildNode {
  if (path.length === 0) {
    const mods = { ...root.mods };
    if (itemId == null) delete mods[slotNameId];
    else mods[slotNameId] = { itemId, quantity: 1, mods: {} };
    return { ...root, mods };
  }

  const [head, ...rest] = path;
  const child = root.mods[head];
  if (!child) return root;

  return { ...root, mods: { ...root.mods, [head]: setMod(child, rest, slotNameId, itemId) } };
}

/** Совпадает ли сборка с известным пресетом (мультимножество id) → можно показать его рендер. */
export function matchesPreset(result: BuildResult, presetPartIds: string[]): boolean {
  if (result.parts.length !== presetPartIds.length) return false;
  const a = [...result.parts.map((p) => p.itemId)].sort();
  const b = [...presetPartIds].sort();
  return a.every((id, i) => id === b[i]);
}