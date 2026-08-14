// POST /api/account/reset-progress — полный сброс прогресса ЧВК текущего юзера (EFT).
// DESTRUCTIVE + необратимо. Пользователь ТОЛЬКО из сессии. Чистит таблицы юзер-прогресса:
// quest_progress / barter_progress / player_profiles / achievement_progress / battlepass_progress.
// Прогресс убежища — только localStorage
// (DB-таблицы нет), его чистит клиент. После 200 клиент чистит localStorage-сторы + reload
// (см. AccountCenter → GameResetCard). Drizzle owner-роль (мимо RLS) — безопасность держит сессия.
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { questProgress, barterProgress, playerProfiles, achievementProgress, battlePassProgress } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  try {
    const gameId = await eftGameId();
    await Promise.all([
      db.delete(questProgress).where(and(eq(questProgress.userId, user.id), eq(questProgress.gameId, gameId))),
      db.delete(barterProgress).where(and(eq(barterProgress.userId, user.id), eq(barterProgress.gameId, gameId))),
      db.delete(playerProfiles).where(and(eq(playerProfiles.userId, user.id), eq(playerProfiles.gameId, gameId))),
      db.delete(achievementProgress).where(and(eq(achievementProgress.userId, user.id), eq(achievementProgress.gameId, gameId))),
      db.delete(battlePassProgress).where(and(eq(battlePassProgress.userId, user.id), eq(battlePassProgress.gameId, gameId))),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset-progress]", e);
    return NextResponse.json({ error: "Не удалось сбросить прогресс" }, { status: 500 });
  }
}
