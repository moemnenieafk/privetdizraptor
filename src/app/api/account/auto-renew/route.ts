// POST /api/account/auto-renew — пользователь включает/выключает продление СВОЕЙ подписки.
// Тело: { enabled: boolean }.
//
// Почему это вообще работает без обращения к платёжному провайдеру: у ЮKassa рекуррент
// merchant-initiated — следующее списание инициируем МЫ по сохранённому методу. Значит
// «отключить автопродление» = наш флаг, по которому мы просто не списываем дальше.
// Именно это обещает §2 публичной оферты, и обещание обеспечено кодом, а не намерением.
//
// Пишем owner-клиентом (Drizzle) после проверки сессии: в public.subscriptions запись
// разрешена только серверной роли (RLS даёт пользователю лишь SELECT своей строки).
// Строка адресуется по userId из сессии — чужую подписку этим роутом не тронуть.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getMe } from "@/lib/auth/me";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let enabled: unknown;
  try {
    enabled = (await req.json())?.enabled;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 422 });
  }

  try {
    const updated = await db
      .update(subscriptions)
      .set({ autoRenew: enabled, updatedAt: new Date() })
      .where(eq(subscriptions.userId, me.id))
      .returning({ autoRenew: subscriptions.autoRenew });

    // Строки нет — у пользователя вообще нет подписки, продлевать нечего.
    if (updated.length === 0) {
      return NextResponse.json({ error: "no_subscription" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, autoRenew: updated[0].autoRenew });
  } catch (e) {
    // Самый вероятный случай — колонка auto_renew ещё не накатана (её ставят правами
    // supabase_admin). Отвечаем честным 503, а не 500: это не поломка, а незавершённая
    // миграция, и кабинет в этом состоянии строку вообще не показывает.
    console.error("[account/auto-renew]", e);
    return NextResponse.json({ error: "auto_renew_unavailable" }, { status: 503 });
  }
}
