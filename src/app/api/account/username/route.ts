// PUT /api/account/username — смена логина текущего юзера (Фаза 2-идентичность).
// Пользователь берётся ТОЛЬКО из сессии. Валидация 3–15 [A-Za-z0-9_-],
// уникальность (case-insensitive), серверный кулдаун 2 месяца.
import { NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const USERNAME_RE = /^[A-Za-z0-9_-]{3,15}$/;
const COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000; // 2 мес ≈ 60 дней
const DAY_MS = 24 * 60 * 60 * 1000;

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

// 23505 — unique_violation от индекса profiles_username_lower_uniq (гонка двух
// одновременных запросов на один ник). Драйвер кладёт код в .code или .cause.code.
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  const causeCode = (e as { cause?: { code?: unknown } }).cause?.code;
  return code === "23505" || causeCode === "23505";
}

export async function PUT(req: Request): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return err(401, "Не авторизован");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "Некорректный запрос");
  }
  const raw = typeof (body as { username?: unknown })?.username === "string"
    ? (body as { username: string }).username.trim()
    : "";
  if (!USERNAME_RE.test(raw)) {
    return err(422, "Логин: 3–15 символов, латиница, цифры, _ и -");
  }

  const [me] = await db
    .select({ username: profiles.username, changedAt: profiles.usernameChangedAt })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (me?.username && me.username.toLowerCase() === raw.toLowerCase()) {
    return err(422, "Это ваш текущий логин");
  }

  if (me?.changedAt) {
    const elapsed = Date.now() - new Date(me.changedAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      const daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / DAY_MS);
      return err(429, `Сменить логин можно раз в 2 месяца. Осталось ~${daysLeft} дн.`);
    }
  }

  // Уникальность без учёта регистра, исключая себя.
  const [taken] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(sql`lower(${profiles.username}) = lower(${raw})`, ne(profiles.id, userId)))
    .limit(1);
  if (taken) return err(409, "Этот логин уже занят");

  try {
    await db
      .update(profiles)
      .set({ username: raw, usernameChangedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(profiles.id, userId));
  } catch (e) {
    // Гонка: ник заняли между нашим SELECT и UPDATE — индекс ловит атомарно.
    if (isUniqueViolation(e)) return err(409, "Этот логин уже занят");
    throw e;
  }

  return NextResponse.json({ ok: true });
}
