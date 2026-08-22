// GET /api/eft/items/meta?ids=<csv inGameId> — мета предметов для сетки «Схрона».
// Read-only поверх НАШЕГО зеркала (items + prices, join по inGameId) — рантайм
// без внешних API (§4.11 автономность данных). Отсутствующие id просто не в ответе.
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { items, prices } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import type { StashItemMeta } from "@/lib/stash-types";

export const runtime = "nodejs";

const MAX_IDS = 500;
const BSG_ID_RE = /^[a-f0-9]{24}$/i;

interface MetaResponse {
  items: Record<string, StashItemMeta>;
}

export async function GET(req: Request): Promise<NextResponse<MetaResponse>> {
  const idsParam = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(idsParam.split(",").filter((s) => BSG_ID_RE.test(s)))].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ items: {} });

  try {
    const gameId = await eftGameId();
    const rows = await db
      .select({
        inGameId: items.inGameId,
        name: items.name,
        shortName: items.shortName,
        gridWidth: items.gridWidth,
        gridHeight: items.gridHeight,
        backgroundColor: prices.backgroundColor,
        normalizedName: prices.normalizedName,
      })
      .from(items)
      .leftJoin(prices, and(eq(prices.gameId, items.gameId), eq(prices.inGameId, items.inGameId)))
      .where(and(eq(items.gameId, gameId), inArray(items.inGameId, ids)));

    const out: Record<string, StashItemMeta> = {};
    for (const r of rows) {
      const meta: StashItemMeta = {
        inGameId: r.inGameId,
        name: r.name,
        shortName: r.shortName ?? "",
        gridWidth: r.gridWidth ?? 1,
        gridHeight: r.gridHeight ?? 1,
        backgroundColor: r.backgroundColor,
      };
      if (r.normalizedName) meta.slug = r.normalizedName;
      out[r.inGameId] = meta;
    }
    return NextResponse.json({ items: out });
  } catch (e) {
    console.error("[/api/eft/items/meta]", e);
    return NextResponse.json({ items: {} }, { status: 500 });
  }
}
