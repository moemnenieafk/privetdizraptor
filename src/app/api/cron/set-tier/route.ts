// Ручная выдача тира подписки без SQL Editor (телефон/отпуск). Паттерн set-role:
// GET за CRON_SECRET, дёргается из GitHub Actions (workflow «set-tier»). Матч
// пользователя по profiles.username (регистр не важен).
//
// Пишет и подписку, и леджер (billing_events type='grant') через setUserTier —
// единая точка выдачи тира. Валидация тира — по таблице tiers (тиры динамические),
// с деградацией на дефолтные слаги, если таблица пуста (fail-safe).
//
// Временный инструмент: когда вебхук платёжки заработает, тир будет писаться им;
// этот роут остаётся для бета-тестеров/ручной компенсации.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getTiersFromDb, setUserTier } from "@/db/billing";
import { revalidateProfileByUsername } from "@/lib/revalidate-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Дефолтные слаги на случай пустой/недоступной таблицы tiers (fail-safe). */
const DEFAULT_TIER_SLUGS = ["free", "operative", "veteran"] as const;

/** Разрешённые слаги тиров: из БД, иначе дефолтные. */
async function allowedTierSlugs(): Promise<string[]> {
  const rows = await getTiersFromDb();
  const fromDb = rows.map((r) => r.slug);
  return fromDb.length > 0 ? fromDb : [...DEFAULT_TIER_SLUGS];
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const username = (params.get("username") ?? "").trim();
  const tier = (params.get("tier") ?? "").trim();
  const monthsRaw = (params.get("months") ?? "0").trim();
  const source = (params.get("source") ?? "manual").trim().slice(0, 40) || "manual";

  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const allowed = await allowedTierSlugs();
  if (!allowed.includes(tier)) {
    return NextResponse.json(
      { error: `tier must be one of: ${allowed.join(", ")}` },
      { status: 400 },
    );
  }

  const months = Number.parseInt(monthsRaw, 10);
  if (!Number.isFinite(months) || months < 0 || months > 120) {
    return NextResponse.json({ error: "months must be 0..120 (0 = бессрочно)" }, { status: 400 });
  }

  try {
    // Резолвим пользователя по логину (регистр не важен).
    const [user] = await db
      .select({ id: profiles.id, username: profiles.username })
      .from(profiles)
      .where(sql`lower(${profiles.username}) = lower(${username})`)
      .limit(1);

    if (!user) {
      return NextResponse.json({ ok: false, reason: "user not found", username }, { status: 404 });
    }

    // upsert subscriptions + запись billing_events (type='grant') — атомарно в примитиве.
    await setUserTier({ userId: user.id, tier, months, source });

    revalidateProfileByUsername(user.username);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username },
      subscription: { tier, months, source },
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/set-tier]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
