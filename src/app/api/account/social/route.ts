// PUT /api/account/social — привязка/отвязка соц-аккаунта (ручной хендл, без OAuth).
// Платформа + хендл из тела; пользователь — ТОЛЬКО из сессии. Пустой хендл = отвязать.
// Пишем Drizzle owner-ролью (мимо RLS) — безопасность держит сессия (см. [[supabase-jwt-fix]]).
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import type { SocialPlatform } from "@/lib/auth/me";

export const runtime = "nodejs";

const PLATFORMS: readonly SocialPlatform[] = ["twitch", "youtube", "discord", "steam"];
const MAX_HANDLE = 32;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function PUT(req: Request): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return err(401, "Не авторизован");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "Некорректный запрос");
  }

  const platform = (body as { platform?: unknown }).platform;
  if (typeof platform !== "string" || !PLATFORMS.includes(platform as SocialPlatform)) {
    return err(422, "Неизвестная платформа");
  }
  const handleRaw = (body as { handle?: unknown }).handle;
  const handle = typeof handleRaw === "string" ? handleRaw.trim() : "";
  if (handle.length > MAX_HANDLE) return err(422, `Хендл не длиннее ${MAX_HANDLE} символов`);

  // Пустой хендл → отвязка (NULL). Запись по конкретной колонке платформы.
  await db
    .update(profiles)
    .set({ [platform as SocialPlatform]: handle || null, updatedAt: sql`now()` })
    .where(eq(profiles.id, userId));

  return NextResponse.json({ ok: true, platform, handle: handle || null });
}
