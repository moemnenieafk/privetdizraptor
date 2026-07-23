// /api/admin/anomalies — действия модератора над очередью аномалий companion-цен.
//   POST { inGameId, action: 'approve'|'reject'|'ban' }
// Гейт — canModerate (admin/moderator). Бан = zero-tolerance (см. resolveAnomaly).
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { canModerate } from "@/lib/auth/roles";
import { resolveAnomaly } from "@/db/companion-anomalies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const IN_GAME_ID_RE = /^[0-9a-f]{24}$/i;

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canModerate(me.role)) return err(403, "Недостаточно прав");

  let body: { inGameId?: unknown; action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const inGameId = typeof body.inGameId === "string" ? body.inGameId : "";
  const action = body.action;
  if (!IN_GAME_ID_RE.test(inGameId)) return err(422, "Некорректный предмет");
  if (action !== "approve" && action !== "reject" && action !== "ban") return err(422, "Некорректное действие");

  const ok = await resolveAnomaly(inGameId, action, me.id);
  return ok ? NextResponse.json({ ok: true }) : err(500, "Не удалось");
}
