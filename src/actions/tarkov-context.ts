"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { getEftPriceMapFromDb } from "@/db/prices";
import { getEftTraders } from "@/db/landing";

export type FleaItem = {
  name: string;
  avg24hPrice: number;
  changeLast48hPercent: number;
};

export type TarkovContextData = {
  serverOnline: boolean;
  serverLabel: string;
  fleaItems: FleaItem[];
  nearestTrader: { name: string; resetTime: string } | null;
};

// Контекст-виджет из НАШЕЙ БД. Без tarkov.dev. Статус сервера BSG реал-таймовый —
// не зеркалим, считаем «онлайн» (виджет деградирует мягко).
export async function fetchTarkovContext(): Promise<TarkovContextData> {
  try {
    const gameId = await eftGameId();
    const [itemRows, priceMap, traderRows] = await Promise.all([
      db.select({ inGameId: items.inGameId, name: items.name }).from(items).where(eq(items.gameId, gameId)),
      getEftPriceMapFromDb(),
      getEftTraders(),
    ]);
    const nameMap = new Map(itemRows.map((r) => [r.inGameId, r.name]));

    // Тикер барахолки — топ по абсолютному изменению за 48ч
    const flea: FleaItem[] = [];
    for (const [id, px] of priceMap) {
      if (px.avg24hPrice == null || px.avg24hPrice <= 0 || px.changeLast48hPercent == null) continue;
      flea.push({ name: nameMap.get(id) ?? id, avg24hPrice: px.avg24hPrice, changeLast48hPercent: px.changeLast48hPercent });
    }
    flea.sort((a, b) => Math.abs(b.changeLast48hPercent) - Math.abs(a.changeLast48hPercent));

    // Ближайший сброс торговца
    const now = Date.now();
    const withReset = traderRows.filter((t): t is typeof t & { resetTime: string } => !!t.resetTime);
    let nearestTrader: TarkovContextData["nearestTrader"] = null;
    if (withReset.length > 0) {
      const nearest = withReset.reduce((best, t) => {
        const diff = (((new Date(t.resetTime).getTime() - now) % 86_400_000) + 86_400_000) % 86_400_000;
        const bestDiff = (((new Date(best.resetTime).getTime() - now) % 86_400_000) + 86_400_000) % 86_400_000;
        return diff < bestDiff ? t : best;
      });
      nearestTrader = { name: nearest.name, resetTime: nearest.resetTime };
    }

    return { serverOnline: true, serverLabel: "EFT SERVER", fleaItems: flea.slice(0, 6), nearestTrader };
  } catch {
    return { serverOnline: true, serverLabel: "EFT SERVER", fleaItems: [], nearestTrader: null };
  }
}
