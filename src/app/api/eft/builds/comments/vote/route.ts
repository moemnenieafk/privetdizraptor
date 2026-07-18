// POST /api/eft/builds/comments/vote — тоггл «Полезно». Тело: { id }.
// Голосовать может ЛЮБОЙ залогиненный, включая free: платные пишут, бесплатные
// сортируют. Дедуп — составной PK build_comment_votes. За себя голосовать нельзя.
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { rateLimit } from "@/lib/rate-limit";
import { toggleCommentVote } from "@/db/build-comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Войдите, чтобы оценивать комментарии");

  let body: { id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!UUID_RE.test(id)) return err(422, "Некорректный id");

  if (!(await rateLimit(`comment-vote:${me.id}`, 200, 3600))) {
    return err(429, "Слишком часто. Попробуйте позже");
  }

  const res = await toggleCommentVote(id, me.id);
  if (!res.ok) return err(409, res.error ?? "Не удалось учесть голос");

  return NextResponse.json({ ok: true, voted: res.voted, score: res.score });
}
