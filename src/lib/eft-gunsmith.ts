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

const ENDPOINT = "https://api.tarkov.dev/graphql";

const RETRIES = 3;
const BACKOFF_MS = [1000, 3000, 7000];

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
interface RawResponse {
  data?: { tasks?: RawTask[] | null } | null;
  errors?: unknown;
}

const QUERY = `
  query {
    tasks(lang: ru) {
      id
      name
      minPlayerLevel
      trader { name }
      objectives {
        id
        type
        ... on TaskObjectiveBuildItem {
          item { id }
          containsAll { id }
          containsCategory { id }
          attributes { name requirement { compareMethod value } }
        }
      }
    }
  }
`;

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

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Запрос с ретраями: tarkov.dev под нагрузкой отдаёт 503. 4xx не ретраим. */
async function gql(query: string): Promise<RawTask[]> {
  let lastError = "";

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1] ?? 7000);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query }),
        cache: "no-store",
      });

      if (res.status >= 400 && res.status < 500) {
        throw new Error(`tarkov.dev [tasks] → ${res.status} (запрос битый, ретрай не поможет)`);
      }
      if (!res.ok) {
        lastError = `tarkov.dev [tasks] → ${res.status}`;
        continue;
      }

      const json = (await res.json()) as RawResponse;
      if (json.errors) {
        throw new Error(`tarkov.dev [tasks] вернул errors: ${JSON.stringify(json.errors)}`);
      }
      return json.data?.tasks ?? [];
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ретрай не поможет") || msg.includes("вернул errors")) throw e;
      lastError = msg;
    }
  }

  throw new Error(`${lastError} — исчерпаны ${RETRIES} ретрая`);
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
  const tasks = await gql(QUERY);
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