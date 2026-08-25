import { db } from '@/db';
import { itemIconHashes } from '@/db/schema/vision';
import { hamming } from './phash';
import type { ItemCandidate } from './types';

export const MATCH_TUNING = {
  /** уверенное совпадение — сразу принимаем */
  acceptDistance: 8,
  /** выше — считаем неопознанным и в vision не гоним */
  rejectDistance: 22,
  candidateLimit: 5,
  cacheTtlMs: 60 * 60 * 1000,
} as const;

type IndexedItem = {
  itemId: string;
  name: string;
  normalizedName: string;
  gridW: number;
  gridH: number;
  dhash: string;
};

let cache: { items: IndexedItem[]; loadedAt: number } | null = null;

/** Несколько тысяч записей по 16 байт — держим целиком в памяти, БД не трогаем на каждый скан. */
async function loadIndex(): Promise<IndexedItem[]> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < MATCH_TUNING.cacheTtlMs) return cache.items;

  const rows = await db
    .select({
      itemId: itemIconHashes.itemId,
      name: itemIconHashes.name,
      normalizedName: itemIconHashes.normalizedName,
      gridW: itemIconHashes.gridW,
      gridH: itemIconHashes.gridH,
      dhash: itemIconHashes.dhash,
    })
    .from(itemIconHashes);

  cache = { items: rows, loadedAt: now };
  return rows;
}

export function invalidateItemIndex(): void {
  cache = null;
}

/**
 * Фильтр по габаритам режет пространство поиска на порядок:
 * предмет 2x3 сравнивается только с предметами 2x3.
 */
export async function findCandidates(
  hash: string,
  gridW: number,
  gridH: number,
): Promise<ItemCandidate[]> {
  const items = await loadIndex();

  const scored: ItemCandidate[] = [];
  for (const item of items) {
    if (item.gridW !== gridW || item.gridH !== gridH) continue;
    const distance = hamming(hash, item.dhash);
    if (distance > MATCH_TUNING.rejectDistance) continue;
    scored.push({
      itemId: item.itemId,
      name: item.name,
      normalizedName: item.normalizedName,
      distance,
    });
  }

  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, MATCH_TUNING.candidateLimit);
}
