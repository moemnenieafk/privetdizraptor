// Фетч спецификаций квестов «Оружейник» из tarkov.dev. ИСТОЧНИК для self-mirror'а:
// вызывает ТОЛЬКО серверный синк (src/db/weapons.ts → /api/cron/sync-weapons).
//
// Зачем отдельно от дампа квестов: src/data/quests/eft-quests.json режет
// TaskObjectiveBuildItem до одного `description` — ни порогов, ни обязательных деталей.
// Перегенерить дамп с телефона нельзя (нужен npm), поэтому спеки едут в таблицу
// gunsmith_specs, а не в статику.
//
// Пороги приходят как AttributeThreshold { name, requirement { compareMethod, value } }.
// Имена — сырые от источника (ergonomics / recoil / weight / …), нормализацию
// делает src/lib/gunsmith.ts. Здесь зеркалим 1:1, без интерпретации.
import type { GunsmithThreshold } from "@/db/schema-gunsmith";
import { fetchTarkovJson } from "@/lib/tarkov-fallback";
import { traderLabelMap } from "@/lib/tarkov-labels";

/* ───────────────── публичная форма ───────────────── */

export interface EftGunsmithSpec {
  objectiveId: string;
  taskId: string;
  taskName: string;
  traderName: string | null;
  minPlayerLevel: number | null;
  /** «Оружейник. Часть 7» → 7. null у именных («Старый друг»). */
  part: number | null;
  baseItemId: string;
  requiredItemIds: string[];
  requiredCategoryIds: string[];
  thresholds: GunsmithThreshold[];
}

/* ───────────────── сырой ответ (без any) ───────────────── */

interface RawRef {
  id: string;
}
interface RawRequirement {
  compareMethod?: string | null;
  value?: number | null;
}
interface RawAttr {
  name?: string | null;
  requirement?: RawRequirement | null;
}
interface RawObjective {
  id?: string | null;
  type?: string | null;
  item?: RawRef | null;
  containsAll?: RawRef[] | null;
  containsCategory?: RawRef[] | null;
  attributes?: RawAttr[] | null;
}
interface RawTask {
  id: string;
  name?: string | null;
  minPlayerLevel?: number | null;
  trader?: { name?: string | null } | null;
  objectives?: (RawObjective | null)[] | null;
}
/* ───────────────── помощники ───────────────── */

const ids = (v: RawRef[] | null | undefined): string[] =>
  (v ?? []).map((r) => r?.id).filter((id): id is string => typeof id === "string");

/**
 * Номер части из названия. Русский дамп: «Оружейник. Часть 7».
 * Английский фолбэк: «Gunsmith - Part 7». Именные квесты («Просьба старого друга»)
 * номера не имеют — там null, они уедут в конец сортировки.
 */
function partNumber(name: string): number | null {
  const m = name.match(/(?:часть|part)\s*[-–—]?\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function mapThresholds(attrs: RawAttr[] | null | undefined): GunsmithThreshold[] {
  const out: GunsmithThreshold[] = [];
  for (const a of attrs ?? []) {
    const name = a?.name;
    const cm = a?.requirement?.compareMethod;
    const v = a?.requirement?.value;
    if (typeof name !== "string" || typeof cm !== "string") continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out.push({ name, compareMethod: cm, value: v });
  }
  return out;
}

/* ───────────────── JSON-плоскость (единственный источник) ─────────────────
 * Рефы — id-строки, buildAttributes — объект (не массив), trader — id (имя резолвим),
 * имя квеста — из /regular/tasks_ru по «<id> name» (part из normalizedName «gunsmith-part-7»). */
interface JsonBuildAttr { value?: number | null; compareMethod?: string | null }
interface JsonObjective {
  id?: string;
  type?: string;
  item?: string | null;
  containsAll?: string[] | null;
  containsCategory?: string[] | null;
  buildAttributes?: Record<string, JsonBuildAttr> | null;
}
interface JsonTask {
  id: string;
  name?: string | null;
  normalizedName?: string | null;
  minPlayerLevel?: number | null;
  trader?: string | null;
  objectives?: JsonObjective[] | null;
}

function jsonTaskToRaw(t: JsonTask, traders: Map<string, { name: string; normalizedName: string }>, tr: Record<string, string>): RawTask {
  return {
    id: t.id,
    name: tr[`${t.id} name`] ?? t.normalizedName ?? t.id,
    minPlayerLevel: t.minPlayerLevel ?? null,
    trader: { name: t.trader ? traders.get(t.trader)?.name ?? null : null },
    objectives: (t.objectives ?? []).map((o) => ({
      id: o.id ?? null,
      type: o.type ?? null,
      item: o.item ? { id: o.item } : null,
      containsAll: (o.containsAll ?? []).map((id) => ({ id })),
      containsCategory: (o.containsCategory ?? []).map((id) => ({ id })),
      attributes: Object.entries(o.buildAttributes ?? {}).map(([name, r]) => ({
        name,
        requirement: { compareMethod: r.compareMethod ?? null, value: r.value ?? null },
      })),
    })),
  };
}

async function getRawGunsmithTasks(): Promise<RawTask[]> {
  // У /tasks коллекция вложена: data.tasks (dict по id). Имена — из /tasks_ru (GraphQL отставлен, §4.12).
  const [tasksData, tr, traders] = await Promise.all([
    fetchTarkovJson<{ tasks?: Record<string, JsonTask> }>("regular/tasks"),
    fetchTarkovJson<Record<string, string>>("regular/tasks_ru"),
    traderLabelMap(),
  ]);
  return Object.values(tasksData.tasks ?? {}).map((t) => jsonTaskToRaw(t, traders, tr));
}

/* ───────────────── публичный фетч ───────────────── */

/**
 * Все квестовые спеки сборок. Бросает при пустом ответе — синк обязан упасть,
 * а не затереть таблицу пустотой.
 *
 * Собираем ПО ЦЕЛЯМ, а не по квестам: у «Просьбы старого друга» три ствола
 * в одном квесте — это три отдельные спеки.
 */
export async function getEftGunsmithSpecs(): Promise<EftGunsmithSpec[]> {
  const tasks = await getRawGunsmithTasks();
  if (tasks.length === 0) throw new Error("tarkov.dev отдал пустой список квестов");

  const specs: EftGunsmithSpec[] = [];

  for (const t of tasks) {
    const taskName = t.name ?? t.id;
    const part = partNumber(taskName);

    for (const o of t.objectives ?? []) {
      // Цель-сборка узнаётся по наличию `item` + type: buildWeapon.
      // Проверяем по item: type у источника менялся, item — нет.
      const baseItemId = o?.item?.id;
      if (!baseItemId) continue;
      if (o?.type !== "buildWeapon") continue;

      const objectiveId = o.id;
      if (typeof objectiveId !== "string") continue;

      specs.push({
        objectiveId,
        taskId: t.id,
        taskName,
        traderName: t.trader?.name ?? null,
        minPlayerLevel: typeof t.minPlayerLevel === "number" ? t.minPlayerLevel : null,
        part,
        baseItemId,
        requiredItemIds: ids(o.containsAll),
        requiredCategoryIds: ids(o.containsCategory),
        thresholds: mapThresholds(o.attributes),
      });
    }
  }

  if (specs.length === 0) {
    throw new Error("не найдено ни одной цели buildWeapon — источник изменил схему");
  }

  return specs;
}