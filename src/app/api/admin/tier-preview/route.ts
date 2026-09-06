// POST /api/admin/tier-preview — включить/снять «просмотр от лица тира».
// Тело: { tier: string | null } — slug тира либо null (снять превью).
//
// Превью НИКОГДА не повышает права: понижение применяется в resolveEntitlements через
// min с реальным рангом (см. src/lib/gating/preview.ts). Даже если кто-то подделает куку,
// максимум, что он получит — УРЕЗАННЫЙ доступ. Роут всё равно закрыт гардом админа:
// иначе любой юзер мог бы поставить себе куку и путать собственный интерфейс.
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { TIER_PREVIEW_COOKIE } from "@/lib/gating/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  if (!(await getAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let tier: unknown = null;
  try {
    tier = (await req.json())?.tier ?? null;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  if (typeof tier === "string" && tier.trim() !== "") {
    // Сессионная кука (без maxAge): закрыл браузер — вышел из превью, не залипает.
    res.cookies.set({
      name: TIER_PREVIEW_COOKIE,
      value: tier.trim(),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    res.cookies.set({ name: TIER_PREVIEW_COOKIE, value: "", path: "/", maxAge: 0 });
  }

  return res;
}
