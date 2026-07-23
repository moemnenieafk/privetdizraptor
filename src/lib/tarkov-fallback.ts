// Общий слой устойчивости для ВСЕХ серверных синков tarkov.dev (крон/CLI, §4.11).
// Паттерн: primary — JSON-плоскость `json.tarkov.dev/{path}` (плоские файлы за CDN,
// перегенерируются каждые ~минуты), fallback — GraphQL `api.tarkov.dev/graphql`.
// Повод: 2026-07-21 лёг ТОЛЬКО GraphQL-слой (503, the-hideout/tarkov-api#474), а
// JSON-плоскость оставалась жива — но мы 3 суток стояли, потому что каждый синк
// зависел ровно от одного слоя. Теперь жив любой из двух → синк работает.
// Идентично тому, что уже сделано в src/lib/eft-prices.ts (там свой инлайн-вариант
// под Map<>, здесь — переиспользуемый под массивы). Диагностика:
// docs/decisions/eft-data-autonomy-research.md.

const JSON_BASE = "https://json.tarkov.dev";
const GRAPHQL_ENDPOINT = "https://api.tarkov.dev/graphql";

/** GET json.tarkov.dev/<path> → `data` (или бросает). path без ведущего слэша,
 *  напр. "regular/barters", "regular/tasks", "regular/items?lang=ru". */
export async function fetchTarkovJson<T>(path: string): Promise<T> {
  const res = await fetch(`${JSON_BASE}/${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} от json.tarkov.dev/${path}`);
  const json = (await res.json()) as { data?: T };
  if (json?.data === undefined) throw new Error(`json.tarkov.dev/${path}: ответ без data`);
  return json.data;
}

/** POST api.tarkov.dev/graphql → `data` (или бросает при HTTP/GraphQL-ошибке). */
export async function fetchTarkovGraphQL<T>(query: string): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} от api.tarkov.dev/graphql`);
  const json = (await res.json()) as { data?: T; errors?: { message?: string }[] };
  if (json.errors?.length) {
    throw new Error(`GraphQL: ${json.errors.map((e) => e?.message ?? "").join(" | ").slice(0, 200)}`);
  }
  if (json.data === undefined) throw new Error("GraphQL: ответ без data");
  return json.data;
}

/**
 * Оркестратор устойчивости: primary (JSON-плоскость) → fallback (GraphQL) → пусто.
 * Возвращает первый НЕПУСТОЙ массив. Полный провал → `[]` (синк сам решает, что
 * делать с пустотой — как правило, НЕ затирает last-known-good). Ни один источник
 * не роняет процесс: их ошибки логируются и глотаются.
 */
export async function fetchWithFallback<T>(
  jsonSource: () => Promise<T[]>,
  graphqlSource: () => Promise<T[]>,
  label: string,
): Promise<T[]> {
  try {
    const rows = await jsonSource();
    if (rows.length > 0) return rows;
    console.warn(`[${label}] JSON-плоскость пуста — фолбэк на GraphQL`);
  } catch (e) {
    console.warn(`[${label}] JSON-плоскость ошибка (${e instanceof Error ? e.message : String(e)}) — фолбэк на GraphQL`);
  }
  try {
    return await graphqlSource();
  } catch (e) {
    console.error(`[${label}] и GraphQL-фолбэк не дал данных: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
