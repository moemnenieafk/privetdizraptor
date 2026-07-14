// Миграция медиа-библиотеки (E10, фаза 4): создаёт каталог media_assets + RLS.
// Сами файлы лежат в уже существующем публичном бакете cta-media (префикс content/).
//
// Запуск: Actions → «migrate-media». Защита CRON_SECRET. Идемпотентно.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { MEDIA_DDL } from "@/db/media-ddl";

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
    for (const stmt of MEDIA_DDL) {
      await db.execute(sql.raw(stmt));
      applied += 1;
    }

    const check = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.media_assets`,
    );
    const total = [...check][0]?.n ?? 0;

    return NextResponse.json({
      ok: true,
      statements: MEDIA_DDL.length,
      total,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-media]", e);
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
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
