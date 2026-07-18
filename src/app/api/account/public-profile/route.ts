// /api/account/public-profile — opt-in публичной страницы /u/[username].
//   GET — { public, username } текущего юзера.
//   PUT — { public: boolean } переключить. Пользователь — ТОЛЬКО из сессии.
// Пишем Drizzle owner-ролью (мимо RLS) — безопасность держит сессия (паттерн
// /api/account/notifications).
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { revalidateProfileByUsername } from "@/lib/revalidate-profile";

export const runtime = "nodejs";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return err(401, "Не авторизован");

  const [row] = await db
    .select({ publicProfile: profiles.publicProfile, username: profiles.username })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return NextResponse.json({
    public: row?.publicProfile ?? false,
    username: row?.username ?? null,
  });
}

export async function PUT(req: Request): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return err(401, "Не авторизован");

  if (!(await rateLimit(`account-public:u:${userId}`, 20, 300))) {
    return err(429, "Слишком много запросов, попробуйте позже");
  }

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { public?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }
  if (typeof body.public !== "boolean") return err(422, "«public»: ожидается boolean");

  // Публичным профиль имеет смысл делать только с заданным логином (это URL /u/username).
  const [row] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (body.public && !row?.username) {
    return err(409, "Сначала задайте логин в профиле");
  }

  await db
    .update(profiles)
    .set({ publicProfile: body.public, updatedAt: sql`now()` })
    .where(eq(profiles.id, userId));

  revalidateProfileByUsername(row?.username);

  return NextResponse.json({ ok: true, public: body.public, username: row?.username ?? null });
}
