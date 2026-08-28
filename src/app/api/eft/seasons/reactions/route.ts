// POST /api/eft/seasons/reactions — лайк/дизлайк расшаренной сборки перков.
// Тело: { code: string, value: 1 | -1 }. Повтор той же реакции снимает её (toggle).
// Только из сессии (аноним → 401). Дедуп и счётчики — на уровне БД (season_build_social).
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { rateLimit } from "@/lib/rate-limit";
import { CURRENT_SEASON } from "@/data/eft-seasons";
import { decodeBuild, encodeBuild } from "@/lib/season-points";
import { setReaction } from "@/db/season-build-social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Войдите, чтобы оценивать сборки");

  let body: { code?: unknown; value?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const rawCode = typeof body.code === "string" ? body.code.trim() : "";
  const value = body.value === 1 || body.value === -1 ? body.value : null;
  if (!rawCode || value === null) return err(422, "Некорректная реакция");

  // Валидация + канонизация кода: неизвестные id отсеиваются, порядок нормализуется.
  // Пустой билд (мусорный код) не заводит строку и не копит реакции.
  const ids = decodeBuild(CURRENT_SEASON, rawCode);
  if (ids.length === 0) return err(422, "Пустая сборка");
  const canon = encodeBuild(ids);

  if (!(await rateLimit(`season-react:${me.id}`, 120, 3600))) {
    return err(429, "Слишком часто. Попробуйте позже");
  }

  const res = await setReaction(me.id, CURRENT_SEASON.slug, canon, value);
  if (!res.ok || !res.state) return err(409, res.error ?? "Не удалось обновить реакцию");

  return NextResponse.json({ ok: true, ...res.state });
}
