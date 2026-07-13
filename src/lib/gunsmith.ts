// Квесты «Оружейник»: нормализация порогов из источника + проверка сборки.
//
// tarkov.dev отдаёт пороги как AttributeThreshold { name, compareMethod, value } —
// имена сырые и могут менять регистр/написание между патчами. Поэтому НЕ хардкодим
// точные строки, а матчим по смыслу (нормализованный ключ). Нераспознанное не
// проглатываем молча: оно уезжает в `unknown` и показывается в UI — иначе сборка
// «проходит» квест, который на самом деле требует чего-то ещё.
//
// Единицы: сумма отдачи в квесте («меньше 850») — это те же единицы, что
// recoilVertical + recoilHorizontal у tarkov.dev. Никаких коэффициентов.
import type { GunsmithThreshold } from '@/db/schema-gunsmith';
import type { BuildResult, BuildStats } from '@/lib/weapon-build';

/* ───────────────── нормализация ───────────────── */

/** Метрика, к которой сводится порог. */
export type GunsmithMetric =
  | 'ergonomics'
  | 'recoilSum'
  | 'weight'
  | 'durability'
  | 'sightingRange'
  | 'velocity'
  | 'accuracy'
  | 'slots';

/** Оператор сравнения. */
export type CompareOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export interface GunsmithRequirement {
  metric: GunsmithMetric;
  op: CompareOp;
  value: number;
  /** Исходное имя из источника — для отладки и подписи в UI. */
  rawName: string;
}

/** Порог, который мы не смогли распознать. Показывается в UI как «проверьте вручную». */
export interface UnknownRequirement {
  rawName: string;
  rawCompare: string;
  value: number;
}

export interface GunsmithSpecParsed {
  requirements: GunsmithRequirement[];
  unknown: UnknownRequirement[];
}

/** Ключ → метрика. Матчим по подстроке нормализованного имени (без регистра/пробелов/_). */
const METRIC_RULES: readonly [needle: string, metric: GunsmithMetric][] = [
  ['ergonomic', 'ergonomics'],
  ['эргоном', 'ergonomics'],
  ['recoil', 'recoilSum'],
  ['отдач', 'recoilSum'],
  ['weight', 'weight'],
  ['вес', 'weight'],
  ['durabilit', 'durability'],
  ['прочност', 'durability'],
  ['sighting', 'sightingRange'],
  ['sightrange', 'sightingRange'],
  ['прицельн', 'sightingRange'],
  ['velocit', 'velocity'],
  ['скорост', 'velocity'],
  ['accuracy', 'accuracy'],
  ['moa', 'accuracy'],
  ['centerofimpact', 'accuracy'],
  ['точност', 'accuracy'],
  ['slot', 'slots'],
  ['size', 'slots'],
  ['ячее', 'slots'],
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

/** Сырые пороги из БД → распознанные требования + список нераспознанных. */
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
    requirements.push({ metric, op, value: t.value, rawName: t.name });
  }

  return { requirements, unknown };
}

/* ───────────────── проверка сборки ───────────────── */

export interface RequirementCheck extends GunsmithRequirement {
  /** Что даёт сборка по этой метрике. null — метрика неизмерима (напр. прочность). */
  actual: number | null;
  /** null → проверить вручную (метрику не считаем). */
  passed: boolean | null;
  label: string;
}

export interface GunsmithCheck {
  checks: RequirementCheck[];
  unknown: UnknownRequirement[];
  /** Обязательные детали, которых нет в сборке. */
  missingItemIds: string[];
  /** Все измеримые проверки пройдены и обязательные детали на месте. */
  passed: boolean;
}

const LABELS: Record<GunsmithMetric, string> = {
  ergonomics: 'Эргономика',
  recoilSum: 'Сумма отдачи',
  weight: 'Вес',
  durability: 'Прочность',
  sightingRange: 'Прицельная дальность',
  velocity: 'Скорость пули',
  accuracy: 'Точность',
  slots: 'Ячеек',
};

/**
 * Значение метрики у сборки. Прочность (durability) — свойство КОНКРЕТНОГО ствола
 * в стеше, а не сборки, поэтому её мы не считаем: возвращаем null → «проверь сам».
 * То же с числом ячеек: размер собранного ствола в сетке нам ниоткуда не приходит.
 */
function actualOf(metric: GunsmithMetric, stats: BuildStats): number | null {
  switch (metric) {
    case 'ergonomics':
      return stats.ergonomics;
    case 'recoilSum':
      return stats.recoilSum;
    case 'weight':
      return stats.weight;
    case 'velocity':
      return stats.velocity;
    case 'accuracy':
      return stats.moa;
    case 'sightingRange':
      return null; // дальность даёт прицел; в статах сборки её пока нет
    case 'durability':
      return null; // свойство экземпляра, не сборки
    case 'slots':
      return null; // размер в сетке не зеркалим
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
    };
  });

  const installed = new Set(result.parts.map((p) => p.itemId));
  const missingItemIds = spec.requiredItemIds.filter((id) => !installed.has(id));

  const passed =
    missingItemIds.length === 0 && checks.every((c) => c.passed !== false);

  return { checks, unknown, missingItemIds, passed };
}

/** Человекочитаемый оператор для UI: «≥ 45». */
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