// POST /api/eft/seasons/build-link — короткая ссылка на расшаренную сборку перков.
// Тело: { code }. Заводит (лениво) строку season_builds по канон-коду и возвращает
// её короткий slug. Публично (шаринг без регистрации). Идемпотентно по коду.
import { NextResponse } from "next/server";
import { CURRENT_SEASON } from "@/data/eft-seasons";
import { decodeBuild, encodeBuild } from "@/lib/season-points";
import { getSeasonBuildState } from "@/db/season-build-social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request): Promise<NextResponse> {
  let body: { code?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const rawCode = typeof body.code === "string" ? body.code.trim() : "";
  if (!rawCode) return err(422, "Пустой код");

  const ids = decodeBuild(CURRENT_SEASON, rawCode);
  if (ids.length === 0) return err(422, "Пустая сборка");
  const canon = encodeBuild(ids);

  const state = await getSeasonBuildState(CURRENT_SEASON.slug, canon, null);
  if (!state) return err(500, "Не удалось выделить ссылку");

  return NextResponse.json({ ok: true, slug: state.slug });
}
