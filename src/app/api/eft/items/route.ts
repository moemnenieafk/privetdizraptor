// GET /api/eft/items — список предметов EFT из Supabase (слой 3).
// Параметры: ?search= &category= &type=ammo|armor|weapon|container|medical|generic
//            &limit= (≤1000, по умолч. 100) &offset=
import { NextResponse } from "next/server";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, itemCategories, itemProperties } from "@/db/schema";
import { eftGameId, itemImagePath } from "@/db/eft";
import type { CtaItemsResponse } from "@/lib/cta-api";

export const runtime = "nodejs";

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const category = searchParams.get("category")?.trim();
  const type = searchParams.get("type")?.trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 1), 1000);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  try {
    const gameId = await eftGameId();
    const filters = [eq(items.gameId, gameId)];
    if (search) filters.push(ilike(items.name, `%${search}%`));
    if (category) filters.push(eq(itemCategories.inGameId, category));
    if (type) filters.push(sql`${itemProperties.properties}->>'type' = ${type}`);

    const rows = await db
      .select({
        id: items.inGameId,
        name: items.name,
        shortName: items.shortName,
        category: itemCategories.inGameId,
        weight: items.weight,
        width: items.gridWidth,
        height: items.gridHeight,
        basePrice: items.basePrice,
      })
      .from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
      .where(and(...filters))
      .orderBy(asc(items.name))
      .limit(limit)
      .offset(offset);

    const payload: CtaItemsResponse = {
      count: rows.length,
      items: rows.map((r) => ({ ...r, image: itemImagePath(r.id) })),
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[/api/eft/items]", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
