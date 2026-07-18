// Миграция слоя комментариев: entity_comments + entity_comment_votes + RLS.
// Сносит пустой build_comments (был с жёстким FK) и заводит полиморфный слой.
//
// Запуск: Actions → «migrate-entity-comments». Защита CRON_SECRET. Идемпотентно.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { COMMENTS_DDL } from "@/db/comments-ddl";

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
    for (const stmt of COMMENTS_DDL) {
      await db.execute(sql.raw(stmt));
      applied += 1;
    }

    const check = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.entity_comments`,
    );

    return NextResponse.json({
      ok: true,
      statements: COMMENTS_DDL.length,
      comments: [...check][0]?.n ?? 0,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-entity-comments]", e);
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
