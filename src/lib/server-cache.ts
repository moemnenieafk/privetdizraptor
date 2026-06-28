// In-memory TTL-кэш для тяжёлых серверных чтений (живёт в памяти инстанса Vercel-функции).
//
// Почему не unstable_cache / Vercel Data Cache: полная прайс-карта ~5.5 МБ, а у Data Cache
// лимит 2 МБ на запись — она бы молча не кэшировалась (и revalidateTag не применить).
// In-memory гасит ПОВТОРНЫЕ полнотабличные чтения из БД в рамках тёплого инстанса —
// главное, server-actions (поиск/supply/контекст), которые иначе тянут всю таблицу на
// каждый вызов. Сбрасывается на cold start и по TTL → свежесть ≤ TTL.
//
// Дедуп in-flight: одновременные вызовы делят один промис (один запрос в БД под нагрузкой).
// Ошибки не кэшируем — следующий вызов пробует заново.
type Entry = { promise: Promise<unknown>; expires: number };

const store = new Map<string, Entry>();

export function memoTTL<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.promise as Promise<T>;

  const promise = fn().catch((e) => {
    store.delete(key);
    throw e;
  });
  store.set(key, { promise, expires: now + ttlMs });
  return promise;
}
