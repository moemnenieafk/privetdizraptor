// PUT /api/account/notifications — настройки рассылок профиля (3 булевых флага).
// Тело: { notifications: { account?, offers?, news? } }. Пользователь — ТОЛЬКО из сессии.
// Пишем Drizzle owner-ролью (мимо RLS) — безопасность держит сессия (см. [[supabase-jwt-fix]]).
// Один атомарный апдейт → без частичного сохранения. Присылаются только изменённые флаги.
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type NotifyKey = "account" | "offers" | "news";
type NotifyColumn = "notifyAccount" | "notifyOffers" | "notifyNews";
const KEYS: readonly NotifyKey[] = ["account", "offers", "news"];
const COLUMN: Record<NotifyKey, NotifyColumn> = {
  account: "notifyAccount",
  offers: "notifyOffers",
  news: "notifyNews",
};

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

  if (!(await rateLimit(`account-notify:u:${userId}`, 20, 300))) {
    return err(429, "Слишком много запросов, попробуйте позже");
  }

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "Некорректный запрос");
  }

  const notifications = (body as { notifications?: unknown }).notifications;
  if (typeof notifications !== "object" || notifications === null) {
    return err(422, "Некорректный запрос");
  }
  const input = notifications as Record<string, unknown>;

  // Собираем патч только из присланных булевых флагов. Неизвестные ключи игнорим.
  const patch: Partial<Record<NotifyColumn, boolean>> = {};
  for (const key of KEYS) {
    if (!(key in input)) continue;
    const raw = input[key];
    if (typeof raw !== "boolean") return err(422, `«${key}»: ожидается boolean`);
    patch[COLUMN[key]] = raw;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, notifications: {} });
  }

  await db
    .update(profiles)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(profiles.id, userId));

  return NextResponse.json({ ok: true, notifications: patch });
}
