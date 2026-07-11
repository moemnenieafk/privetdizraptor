'use client';

import { useEffect, useState } from 'react';

/** id → slug (normalizedName). Пусто, если предмет не в каталоге или БД недоступна. */
export type ItemLinkMap = Record<string, string>;

let cache: ItemLinkMap | null = null;
let inflight: Promise<ItemLinkMap> | null = null;

function load(): Promise<ItemLinkMap> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch('/api/eft/prestige-items')
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: ItemLinkMap) => {
        cache = m ?? {};
        return cache;
      })
      .catch(() => ({}) as ItemLinkMap);
  }
  return inflight;
}

/** Ленивая загрузка карты id→slug с модульным кэшем (один фетч на сессию). */
export function useItemLinks(): ItemLinkMap {
  const [map, setMap] = useState<ItemLinkMap>(cache ?? {});
  useEffect(() => {
    let alive = true;
    load().then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return map;
}
