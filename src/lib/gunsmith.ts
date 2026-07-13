// Квесты «Оружейник»: нормализация порогов из источника + проверка сборки.
//
// Реальные имена порогов от tarkov.dev (сверено на живом синке, 30 спек):
//   ergonomics >=      эргономика собранного ствола
//   recoil <=          СУММА отдачи (верт + гор), в тех же единицах, что у нас
//   weight <= / >=     вес в кг
//   magazineCapacity   ёмкость установленного магазина
//   muzzleVelocity >=  скорость пули (зависит от патрона и ствола)
//   accuracy >=        точность (MOA)
//   durability >=      прочность — свойство ЭКЗЕМПЛЯРА из стеша, не сборки
//   effectiveDistance  прицельная дальность — даёт установленный прицел
//   width <= / height  размер собранного ствола в сетке («сделай компактным»)
//
// Три из них мы посчитать не можем и честно помечаем «проверь сам»:
//   • durability — прочность конкретного ствола, её нет ни в какой сборке;
//   • width/height — размер собранного оружия в сетке; модули меняют его через
//     ExtraSizeLeft/Right/Up/Down, а tarkov.dev эти поля не отдаёт;
//   • effectiveDistance — приедет, когда добавим sightingRange прицелов в weapon_parts.
//
// Пустышки (`weight >= 0`, `accuracy >= 0`) прячем: BSG сыпет их в каждый квест,
// и в чеклисте они только мешают.
import type { GunsmithThreshold } from '@/db/schema-gunsmith';
import type { BuildResult, BuildStats } from '@/lib/weapon-build';

/* ───────────────── нормализация ───────────────── */

export type GunsmithMetric =
  | 'ergonomics'
  | 'recoilSum'
  | 'weight'
  | 'magazineCapacity'
  | 'muzzleVelocity'
  | 'accuracy'
  | 'durability'
  | 'effectiveDistance'
  | 'width'
  | 'height';

export type CompareOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export interface GunsmithRequirement {
  metric: GunsmithMetric;
  op: CompareOp;
  value: number;
  /** Исходное имя из источника — для отладки. */
  rawName: string;
}

/** Порог, который мы не распознали. Показывается в UI, а не проглатывается молча. */
export interface UnknownRequirement {
  rawName: string;
  rawCompare: string;
  value: number;
}

export interface GunsmithSpecParsed {
  requirements: GunsmithRequirement[];
  unknown: UnknownRequirement[];
}

/**
 * Имя из источника → метрика. Матч по подстроке нормализованного имени
 * (без регистра/пробелов/подчёркиваний), чтобы переименование в патче не ломало всё.
 * ПОРЯДОК ЗНАЧИМ: частные раньше общих (magazineCapacity до capacity,
 * muzzleVelocity до velocity, effectiveDistance до distance).
 */
const METRIC_RULES: readonly [needle: string, metric: GunsmithMetric][] = [
  ['magazinecapacity', 'magazineCapacity'],
  ['capacity', 'magazineCapacity'],
  ['muzzlevelocity', 'muzzleVelocity'],
  ['velocit', 'muzzleVelocity'],
  ['effectivedistance', 'effectiveDistance'],
  ['sighting', 'effectiveDistance'],
  ['ergonomic', 'ergonomics'],
  ['recoil', 'recoilSum'],
  ['durabilit', 'durability'],
  ['accuracy', 'accuracy'],
  ['moa', 'accuracy'],
  ['weight', 'weight'],
  ['width', 'width'],
  ['height', 'height'],
] as const;

const COMPARE_RULES: Record<string, CompareOp> = {
  '>': 'gt',
  '>=': 'gte',
  '≥': 'gte',
  '<': 'lt',
  '<=': 'lte',
  '≤': 'lte',
  '=': 'eq',
  '==': 'eq',
  more: 'gt',
  moreorequal: 'gte',
  less: 'lt',
  lessorequal: 'lte',
  equal: 'eq',
};

const norm = (s: string): string => s.toLowerCase().replace(/[\s_\-.]/g, '');

function toMetric(rawName: string): GunsmithMetric | null {
  const k = norm(rawName);
  for (const [needle, metric] of METRIC_RULES) {
    if (k.includes(needle)) return metric;
  }
  return null;
}

function toOp(rawCompare: string): CompareOp | null {
  const k = norm(rawCompare);
  return COMPARE_RULES[k] ?? COMPARE_RULES[rawCompare.trim()] ?? null;
}

/**
 * Порог-пустышка: BSG прописывает в каждый квест `weight >= 0`, `accuracy >= 0`,
 * `muzzleVelocity >= 0` — они выполняются всегда и только засоряют чеклист.
 */
function isNoop(op: CompareOp, value: number): boolean {
  return value === 0 && (op === 'gte' || op === 'gt');
}

/** Сырые пороги из БД → значимые требования + нераспознанные. */
export function parseSpec(thresholds: GunsmithThreshold[]): GunsmithSpecParsed {
  const requirements: GunsmithRequirement[] = [];
  const unknown: UnknownRequirement[] = [];

  for (const t of thresholds) {
    const metric = toMetric(t.name);
    const op = toOp(t.compareMethod);

    if (metric === null || op === null) {
      unknown.push({ rawName: t.name, rawCompare: t.compareMethod, value: t.value });
      continue;
    }
    if (isNoop(op, t.value)) continue;

    requirements.push({ metric, op, value: t.value, rawName: t.name });
  }

  return { requirements, unknown };
}

/* ───────────────── проверка сборки ───────────────── */

export interface RequirementCheck extends GunsmithRequirement {
  /** Что даёт сборка. null — метрику мы не считаем (проверь в игре). */
  actual: number | null;
  /** null → ручная проверка. */
  passed: boolean | null;
  label: string;
  /** Почему не посчитали (для метрик с actual = null). */
  manualReason?: string;
}

export interface GunsmithCheck {
  checks: RequirementCheck[];
  unknown: UnknownRequirement[];
  /** Обязательные детали (containsAll), которых нет в сборке. */
  missingItemIds: string[];
  /** Все ИЗМЕРИМЫЕ проверки пройдены и обязательные детали на месте. */
  passed: boolean;
  /** Есть ли пункты, которые придётся глазами проверить в игре. */
  hasManual: boolean;
}

const LABELS: Record<GunsmithMetric, string> = {
  ergonomics: 'Эргономика',
  recoilSum: 'Сумма отдачи',
  weight: 'Вес',
  magazineCapacity: 'Ёмкость магазина',
  muzzleVelocity: 'Скорость пули',
  accuracy: 'Точность (MOA)',
  durability: 'Прочность',
  effectiveDistance: 'Прицельная дальность',
  width: 'Ширина в сетке',
  height: 'Высота в сетке',
};

const MANUAL_REASONS: Partial<Record<GunsmithMetric, string>> = {
  durability: 'зависит от конкретного ствола в стеше — берите свежий у торговца',
  effectiveDistance: 'даёт установленный прицел',
  width: 'размер собранного ствола в сетке — сверьтесь в игре',
  height: 'размер собранного ствола в сетке — сверьтесь в игре',
};

/** Значение метрики у сборки. null → посчитать не можем (см. MANUAL_REASONS). */
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
    case 'durability':
    case 'effectiveDistance':
    case 'width':
    case 'height':
      return null;
  }
}

function compare(actual: number, op: CompareOp, value: number): boolean {
  switch (op) {
    case 'gt':
      return actual > value;
    case 'gte':
      return actual >= value;
    case 'lt':
      return actual < value;
    case 'lte':
      return actual <= value;
    case 'eq':
      return actual === value;
  }
}

/** Проходит ли сборка спеку квеста. */
export function checkBuild(
  result: BuildResult,
  spec: { thresholds: GunsmithThreshold[]; requiredItemIds: string[] },
): GunsmithCheck {
  const { requirements, unknown } = parseSpec(spec.thresholds);

  const checks: RequirementCheck[] = requirements.map((r) => {
    const actual = actualOf(r.metric, result.stats);
    return {
      ...r,
      actual,
      passed: actual === null ? null : compare(actual, r.op, r.value),
      label: LABELS[r.metric],
      manualReason: MANUAL_REASONS[r.metric],
    };
  });

  const installed = new Set(result.parts.map((p) => p.itemId));
  const missingItemIds = spec.requiredItemIds.filter((id) => !installed.has(id));

  return {
    checks,
    unknown,
    missingItemIds,
    passed: missingItemIds.length === 0 && checks.every((c) => c.passed !== false),
    hasManual: checks.some((c) => c.passed === null),
  };
}

/** Оператор для UI: «≥ 47». */
export function opSymbol(op: CompareOp): string {
  switch (op) {
    case 'gt':
      return '>';
    case 'gte':
      return '≥';
    case 'lt':
      return '<';
    case 'lte':
      return '≤';
    case 'eq':
      return '=';
  }
}