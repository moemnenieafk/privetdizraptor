// POST /api/eft/builds/defs — определения предметов для сохранённых сборок.
//
// Сборки живут в localStorage, сервер узнаёт о них только здесь: клиент шлёт плоский
// список id (база + модули + патрон), получает defs + пресеты баз + имена.
// Полный BuildItemIndex ствола сюда не тащим — он на порядок тяжелее и нужен только
// конструктору (там его отдаёт RSC).
import { NextResponse } from "next/server";
import { getBuildDefs } from "@/db/build-defs";
import type { BuildDefsBundle } from "@/lib/build-media";

export const runtime = "nodejs";

/** Потолок: 3 сборки free-тира × ~20 деталей, у платных — с большим запасом. */
const MAX_IDS = 600;

interface DefsBody {
  itemIds?: unknown;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: DefsBody;
  try {
    body = (await req.json()) as DefsBody;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (!Array.isArray(body.itemIds)) {
    return NextResponse.json({ error: "itemIds required" }, { status: 400 });
  }

  const itemIds = [
    ...new Set(body.itemIds.filter((v): v is string => typeof v === "string" && v.length > 0)),
  ].slice(0, MAX_IDS);

  const empty: BuildDefsBundle = { defs: [], presets: [], names: {}, prices: {} };
  if (itemIds.length === 0) return NextResponse.json(empty);

  try {
    const bundle = await getBuildDefs(itemIds);
    return NextResponse.json(bundle, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (e) {
    console.error("[api/eft/builds/defs]", e);
    return NextResponse.json({ error: "weapons layer unavailable" }, { status: 500 });
  }
}
