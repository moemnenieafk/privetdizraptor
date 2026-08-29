// Миграция соц-слоя сборок перков: season_builds + season_build_reactions + RLS.
// До неё реакции/обсуждение сборок падают (таблиц нет). Локально то же делает
// `npm run db:migrate-all`. Запуск: Actions → «migrate-season-builds». Защита CRON_SECRET.
// Идемпотентно.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { SEASON_BUILDS_DDL } from "@/db/season-builds-ddl";

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
    for (const stmt of SEASON_BUILDS_DDL) {
      await db.execute(sql.raw(stmt));
      applied += 1;
    }

    const check = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.season_builds`,
    );

    return NextResponse.json({
      ok: true,
      statements: SEASON_BUILDS_DDL.length,
      builds: [...check][0]?.n ?? 0,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-season-builds]", e);
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
