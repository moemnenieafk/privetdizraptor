// Серверная читалка: плоский слепок всех бартеров (торговец + УЛ + имена предметов).
// Нужен разделу «События», чтобы понять, дожил ли ивентовый бартер до сегодня, —
// не по ручному флажку, а по живой базе. Читает ТОЛЬКО нашу БД (barters + items).
import { eq } from 'drizzle-orm';
import { db } from './index';
import { barters, items } from './schema';
import { eftGameId } from './eft';

export interface BarterSlim {
  id: string;
  /** normalizedName торговца. */
  trader: string;
  level: number;
  rewardNames: string[];
  requiredNames: string[];
}

export async function getEftBarterIndex(): Promise<BarterSlim[]> {
  try {
    const gameId = await eftGameId();
    const [rows, itemRows] = await Promise.all([
      db.select().from(barters).where(eq(barters.gameId, gameId)),
      db
        .select({ inGameId: items.inGameId, name: items.name })
        .from(items)
        .where(eq(items.gameId, gameId)),
    ]);

    const nameById = new Map(itemRows.map((r) => [r.inGameId, r.name]));
    const resolve = (slots: { itemId: string; count: number }[] | null) =>
      (slots ?? []).map((s) => nameById.get(s.itemId) ?? '').filter(Boolean);

    return rows.map((b) => ({
      id: b.id,
      trader: b.traderNormalizedName ?? '',
      level: b.level ?? 1,
      rewardNames: resolve(b.rewardItems),
      requiredNames: resolve(b.requiredItems),
    }));
  } catch (e) {
    console.error('[getEftBarterIndex]', e);
    return [];
  }
}
