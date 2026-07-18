// Выдача/снятие публичного статуса «Стример» без SQL Editor. Паттерн set-role:
// GET за CRON_SECRET, дёргается из GitHub Actions (workflow «set-streamer»).
// Модератор подтверждает, что Twitch реально принадлежит человеку, и включает флаг.
//
// Включить можно только если у пользователя задан Twitch (статус = «подтверждённый
// твич-аккаунт»). Снять — всегда.
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { revalidateProfileByUsername } from "@/lib/revalidate-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const username = (params.get("username") ?? "").trim();
  const value = (params.get("value") ?? "on").trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }
  if (value !== "on" && value !== "off") {
    return NextResponse.json({ error: "value must be on | off" }, { status: 400 });
  }
  const enable = value === "on";

  try {
    const [user] = await db
      .select({ id: profiles.id, username: profiles.username, twitch: profiles.twitch })
      .from(profiles)
      .where(sql`lower(${profiles.username}) = lower(${username})`)
      .limit(1);

    if (!user) {
      return NextResponse.json({ ok: false, reason: "user not found", username }, { status: 404 });
    }
    if (enable && !user.twitch) {
      return NextResponse.json(
        { ok: false, reason: "у пользователя не задан Twitch — статус стримера требует подтверждённого твича", username },
        { status: 409 },
      );
    }

    await db
      .update(profiles)
      .set({ streamer: enable, updatedAt: sql`now()` })
      .where(eq(profiles.id, user.id));

    revalidateProfileByUsername(user.username);

    return NextResponse.json({
      ok: true,
      user: { username: user.username, twitch: user.twitch },
      streamer: enable,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/set-streamer]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
