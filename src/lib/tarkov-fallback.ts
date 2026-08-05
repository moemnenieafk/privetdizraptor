// Общий слой доступа к данным tarkov.dev для серверных синков (крон/CLI, §4.11).
// Источник — статическая JSON-плоскость `json.tarkov.dev/{path}` (плоские файлы за CDN,
// перегенерируются каждые ~минуты). GraphQL `api.tarkov.dev/graphql` ОТСТАВЛЕН (§4.12):
// схлопнут самими the-hideout ради экономии (issue #312), лежит с 21.07 — фолбэка на него
// больше НЕТ. Устойчивость даёт no-wipe: источник лёг/пуст → синк получает `[]`, а
// last-known-good в БД не затирается. Диагностика: docs/decisions/eft-data-autonomy-research.md.

const JSON_BASE = "https://json.tarkov.dev";

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

/**
 * Безопасный фетч строк зеркала из JSON-плоскости: возвращает строки, либо `[]` при
 * ошибке источника (не роняет процесс — синк сам решает не затирать last-known-good по
 * пустому набору). GraphQL-фолбэка больше нет (§4.12) — имя историческое, оставлено
 * простым «безопасным JSON-фетчем».
 */
export async function fetchMirrorRows<T>(
  jsonSource: () => Promise<T[]>,
  label: string,
): Promise<T[]> {
  try {
    return await jsonSource();
  } catch (e) {
    console.error(`[${label}] JSON-плоскость не дала данных: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
