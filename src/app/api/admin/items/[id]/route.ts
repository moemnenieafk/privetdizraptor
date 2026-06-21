// PUT /api/admin/items/[id] — правка предмета из CMS. Только для role='admin'.
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { getAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";

interface ItemPatch {
  name: string;
  shortName: string | null;
  description: string | null;
  basePrice: number | null;
  categoryId: string | null;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const optStr = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

const optNum = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function parsePatch(body: unknown): ItemPatch | null {
  if (!isObject(body)) return null;
  if (typeof body.name !== "string" || !body.name.trim()) return null; // name обязателен
  return {
    name: body.name.trim(),
    shortName: optStr(body.shortName),
    description: optStr(body.description),
    basePrice: optNum(body.basePrice),
    categoryId: optStr(body.categoryId),
  };
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const patch = parsePatch(body);
  if (!patch) return NextResponse.json({ error: "bad payload" }, { status: 422 });

  const gameId = await eftGameId();
  const updated = await db
    .update(items)
    .set({
      name: patch.name,
      shortName: patch.shortName,
      description: patch.description,
      basePrice: patch.basePrice,
      categoryId: patch.categoryId,
      updatedAt: sql`now()`,
    })
    .where(and(eq(items.gameId, gameId), eq(items.inGameId, id)))
    .returning({ id: items.inGameId });

  if (updated.length === 0) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
