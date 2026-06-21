// GET /api/eft/items/[id] — детальная карточка предмета EFT из Supabase (слой 3).
// id = 24-символьный BSG inGameId. Возвращает универсальные поля + типизированный
// properties (union из схемы) + локальный путь иконки.
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, itemCategories, itemProperties } from "@/db/schema";
import { eftGameId, itemImagePath } from "@/db/eft";
import type { CtaEftItemDetail } from "@/lib/cta-api";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;

  try {
    const gameId = await eftGameId();
    const [row] = await db
      .select({
        id: items.inGameId,
        name: items.name,
        shortName: items.shortName,
        description: items.description,
        category: itemCategories.inGameId,
        categoryName: itemCategories.name,
        weight: items.weight,
        width: items.gridWidth,
        height: items.gridHeight,
        basePrice: items.basePrice,
        properties: itemProperties.properties,
      })
      .from(items)
      .leftJoin(itemCategories, eq(items.categoryId, itemCategories.id))
      .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
      .where(and(eq(items.gameId, gameId), eq(items.inGameId, id)))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "item not found" }, { status: 404 });
    }

    const payload: CtaEftItemDetail = {
      ...row,
      image: itemImagePath(row.id),
      properties: row.properties ?? { type: "generic" },
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error(`[/api/eft/items/${id}]`, e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
