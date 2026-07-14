// GET /api/eft/prices?ids=<id,id,...> — плитки EftItemTile по конкретным предметам.
// Для домена «Избранное» вкладки «Трекинг»: избранное живёт в localStorage, сервер
// ids не знает → клиент фетчит этот роут. Read-only поверх НАШЕГО зеркала
// (items + prices, getEftPricesByIds) — рантайм без внешних API (BACKEND AUTONOMY).
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { getEftPricesByIds } from "@/db/prices";
import { itemIconUrl } from "@/lib/item-icon";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { EftItemData, EftPriceEntry } from "@/components/features/items/EftItemTile";
import type { EftCurrency } from "@/lib/formatters";

export const runtime = "nodejs";

const MAX_IDS = 200;
const BSG_ID_RE = /^[a-f0-9]{24}$/i;

interface OfferRaw {
  price: number;
  priceRUB?: number;
  currency?: string;
  vendor: { name: string; normalizedName?: string };
}

const rub = (o: OfferRaw) => o.priceRUB ?? o.price;
const isFlea = (o: OfferRaw) =>
  o.vendor.normalizedName === "flea-market" || o.vendor.name === "Flea Market";
const entry = (o?: OfferRaw): EftPriceEntry | undefined =>
  o
    ? {
        price: o.price,
        priceRUB: o.priceRUB,
        currency: o.currency as EftCurrency | undefined,
        vendor: { name: o.vendor.name, normalizedName: o.vendor.normalizedName },
      }
    : undefined;

export async function GET(req: Request): Promise<NextResponse> {
  // Публичная ручка без сессии: до 200 предметов с ценами за запрос → лимит по IP.
  if (!(await rateLimit(`eft-prices:ip:${clientIp(req)}`, 120, 300))) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const idsParam = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(idsParam.split(",").filter((s) => BSG_ID_RE.test(s)))].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ items: [] });

  const gameId = await eftGameId();
  const [priceMap, rows] = await Promise.all([
    getEftPricesByIds(ids),
    db
      .select({
        inGameId: items.inGameId,
        name: items.name,
        shortName: items.shortName,
        width: items.gridWidth,
        height: items.gridHeight,
      })
      .from(items)
      .where(and(eq(items.gameId, gameId), inArray(items.inGameId, ids))),
  ]);
  const infoById = new Map(rows.map((r) => [r.inGameId, r]));

  // Порядок ответа = порядок запрошенных ids (как в избранном пользователя).
  const out: EftItemData[] = [];
  for (const id of ids) {
    const info = infoById.get(id);
    const p = priceMap.get(id);
    if (!info && !p) continue; // неизвестный предмет — пропускаем

    const sells = ((p?.sellFor ?? []) as OfferRaw[]).filter((o) => rub(o) > 0);
    const buys = ((p?.buyFor ?? []) as OfferRaw[]).filter((o) => rub(o) > 0);
    const traderSells = sells.filter((o) => !isFlea(o));
    const traderBuys = buys.filter((o) => !isFlea(o));

    out.push({
      id,
      normalizedName: p?.normalizedName ?? "",
      name: info?.name ?? id,
      shortName: info?.shortName ?? "",
      width: info?.width ?? 1,
      height: info?.height ?? 1,
      backgroundColor: p?.backgroundColor,
      image512pxLink: itemIconUrl(id),
      pricing: {
        traderBuy: entry(traderBuys.length ? traderBuys.reduce((m, c) => (rub(c) < rub(m) ? c : m)) : undefined),
        fleaBuy: entry(buys.find(isFlea)),
        traderSell: entry(traderSells.length ? traderSells.reduce((m, c) => (rub(c) > rub(m) ? c : m)) : undefined),
        fleaSell: entry(sells.find(isFlea)),
      },
    });
  }

  return NextResponse.json({ items: out });
}
