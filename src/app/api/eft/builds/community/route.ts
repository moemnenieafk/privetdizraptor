// GET /api/eft/builds/community — глобальная витрина публичных сборок.
//   ?sort=new|popular  ?base=<itemId>  ?offset=<n>
// Отдаёт страницу с автором, статами-снимком и флагом likedByMe (по сессии, опц.).
// Имя ствола резолвится сервером по baseItemId (тот же справочник, что вьюер).
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { getBuildDefs } from "@/db/build-defs";
import { getCommunityBuilds, type CommunitySort } from "@/db/public-builds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const sort: CommunitySort = url.searchParams.get("sort") === "popular" ? "popular" : "new";
  const base = (url.searchParams.get("base") ?? "").trim() || null;
  const offsetRaw = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

  const me = await getMe();

  const page = await getCommunityBuilds({
    sort,
    baseItemId: base,
    offset,
    viewerId: me?.id ?? null,
  });

  // Имена стволов: одна выборка справочника по уникальным базам страницы.
  const baseIds = [...new Set(page.items.map((i) => i.baseItemId))];
  const nameById = new Map<string, string>();
  if (baseIds.length > 0) {
    const bundle = await getBuildDefs(baseIds);
    for (const d of bundle.defs) {
      if (d.kind === "weapon") nameById.set(d.id, d.name);
    }
  }

  const items = page.items.map((i) => ({
    ...i,
    baseName: nameById.get(i.baseItemId) ?? i.baseItemId,
  }));

  return NextResponse.json({ items, nextOffset: page.nextOffset });
}
