// GET /api/eft/verification/queue — очередь заявок на подтверждение ЧВК-профиля.
// Только admin|moderator. Пруф (скрин base64) отдаём — модератору сверять ник в кадре.
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { canModerate } from "@/lib/auth/roles";
import { getPendingVerifications } from "@/db/verification";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Не авторизован");
  if (!canModerate(me.role)) return err(403, "Только для модераторов");

  const items = await getPendingVerifications();
  return NextResponse.json({ items });
}
