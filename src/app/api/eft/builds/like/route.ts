// POST /api/eft/builds/like — тоггл лайка публичной сборки. Тело: { slug }.
// Только из сессии (аноним → 401). Дедуп на уровне БД (weapon_build_likes).
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { rateLimit } from "@/lib/rate-limit";
import { toggleBuildLike } from "@/db/public-builds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const SLUG_RE = /^[a-z0-9]{6,16}$/;

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Войдите, чтобы оценивать сборки");

  let body: { slug?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!SLUG_RE.test(slug)) return err(422, "Некорректный slug");

  if (!(await rateLimit(`build-like:${me.id}`, 120, 3600))) {
    return err(429, "Слишком часто. Попробуйте позже");
  }

  const res = await toggleBuildLike(me.id, slug);
  if (!res.ok) return err(409, res.error ?? "Не удалось обновить лайк");

  return NextResponse.json({ ok: true, liked: res.liked, likes: res.likes });
}
