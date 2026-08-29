// PUT /api/account/social — батч-привязка/отвязка соц-аккаунтов (ручные хендлы, без OAuth).
// Тело: { socials: { twitch?, youtube?, discord?, steam? } }. Пустая строка = отвязать (NULL).
// Пользователь — ТОЛЬКО из сессии. Пишем Drizzle owner-ролью (мимо RLS) — безопасность держит
// сессия (см. [[supabase-jwt-fix]]). Один атомарный апдейт → без частичного сохранения.
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { revalidateProfileByUserId } from "@/lib/revalidate-profile";
import type { SocialPlatform } from "@/lib/auth/me";

export const runtime = "nodejs";

const PLATFORMS: readonly SocialPlatform[] = ["twitch", "youtube", "discord", "steam"];
const MAX_HANDLE = 32;

// Формат хендла под площадку. Хендлы публично видны в Комлинке → whitelist символов
// против мусора/URL/impersonation в чужой выдаче (XSS браузер и так экранирует).
const HANDLE_RULES: Record<SocialPlatform, RegExp> = {
  twitch: /^[a-zA-Z0-9_]{3,25}$/,
  youtube: /^@?[a-zA-Z0-9._-]{3,30}$/,
  discord: /^(?:[a-zA-Z0-9._]{2,32}|[a-zA-Z0-9._]{2,27}#[0-9]{4})$/,
  steam: /^[a-zA-Z0-9_-]{2,32}$/,
};
const HANDLE_HINT: Record<SocialPlatform, string> = {
  twitch: "3–25 символов: буквы, цифры, _",
  youtube: "3–30 символов: буквы, цифры, . _ - (можно с @)",
  discord: "2–32 символа: буквы, цифры, . _ (или legacy name#1234)",
  steam: "2–32 символа: буквы, цифры, _ -",
};

type SocialPatch = Partial<Record<SocialPlatform, string | null>>;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Динамический рендер: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export async function PUT(req: Request): Promise<NextResponse> {
  const userId = await currentUserId();
  if (!userId) return err(401, "Не авторизован");

  if (!(await rateLimit(`account-social:u:${userId}`, 20, 300))) {
    return err(429, "Слишком много запросов, попробуйте позже");
  }

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "Некорректный запрос");
  }

  const socials = (body as { socials?: unknown }).socials;
  if (typeof socials !== "object" || socials === null) {
    return err(422, "Некорректный запрос");
  }
  const input = socials as Record<string, unknown>;

  // Валидируем и собираем патч. Пустая строка → отвязка (NULL). Неизвестные ключи игнорим.
  const patch: SocialPatch = {};
  for (const platform of PLATFORMS) {
    if (!(platform in input)) continue;
    const raw = input[platform];
    const handle = typeof raw === "string" ? raw.trim() : "";
    if (handle === "") {
      patch[platform] = null;
      continue;
    }
    if (handle.length > MAX_HANDLE) {
      return err(422, `«${platform}»: не длиннее ${MAX_HANDLE} символов`);
    }
    if (!HANDLE_RULES[platform].test(handle)) {
      return err(422, `«${platform}»: неверный формат (${HANDLE_HINT[platform]})`);
    }
    patch[platform] = handle;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, socials: {} });
  }

  await db
    .update(profiles)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(profiles.id, userId));

  await revalidateProfileByUserId(userId);

  return NextResponse.json({ ok: true, socials: patch });
}
