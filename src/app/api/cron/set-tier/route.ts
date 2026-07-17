// Ручная выдача тира подписки без SQL Editor (телефон/отпуск) — до подключения
// биллинга. Паттерн set-role: GET за CRON_SECRET, дёргается из GitHub Actions
// (workflow «set-tier»). Матч пользователя по profiles.username (регистр не важен).
//
// Временный инструмент: когда появится вебхук платёжки, тир будет писаться им;
// этот роут остаётся для бета-тестеров/ручной компенсации.
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, subscriptions } from "@/db/schema";
import { isTierId } from "@/data/subscription-tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  if (!isTierId(tier)) {
    return NextResponse.json(
      { error: "tier must be one of: free, operative, veteran" },
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

    // months>0 → срок от текущего момента; 0 → бессрочно (null).
    const validUntil =
      months > 0 ? sql`now() + make_interval(months => ${months})` : sql`null`;

    const [row] = await db
      .insert(subscriptions)
      .values({ userId: user.id, tier, source, validUntil })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { tier, source, validUntil, updatedAt: sql`now()` },
      })
      .returning({
        userId: subscriptions.userId,
        tier: subscriptions.tier,
        validUntil: subscriptions.validUntil,
        source: subscriptions.source,
      });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username },
      subscription: row,
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
