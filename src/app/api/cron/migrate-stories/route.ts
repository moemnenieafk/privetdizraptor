// Миграция сюжетных гайдов (E10, фаза 5): создаёт story_guides + RLS и засевает
// 10 существующих историй из src/data/story-walkthroughs. Сид идемпотентен —
// повторный прогон не затирает правки редактора.
//
// Запуск: Actions → «migrate-stories». Защита CRON_SECRET.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { STORY_DDL } from "@/db/story-ddl";
import { seedStoriesFromStatic } from "@/db/stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let applied = 0;

  try {
    for (const stmt of STORY_DDL) {
      await db.execute(sql.raw(stmt));
      applied += 1;
    }

    const seed = await seedStoriesFromStatic();

    const check = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.story_guides`,
    );

    return NextResponse.json({
      ok: true,
      statements: STORY_DDL.length,
      seeded: seed.inserted,
      alreadyThere: seed.skipped,
      total: [...check][0]?.n ?? 0,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-stories]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      {
        ok: false,
        failedAtStatement: applied,
        error: err.message ?? String(e),
        dbError: err.cause?.message ?? null,
      },
      { status: 500 },
    );
  }
}
