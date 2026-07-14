// Миграция Кодекса в БД (E10, фаза 3): создаёт codex_articles + RLS и СРАЗУ засевает
// 8 существующих статей из src/data/codex. Сид идемпотентен (on conflict do nothing) —
// повторный прогон не затирает правки редактора.
//
// Запуск: Actions → «migrate-codex». Защита CRON_SECRET.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { CODEX_DDL } from "@/db/codex-ddl";
import { seedCodexFromStatic } from "@/db/codex";

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
    for (const stmt of CODEX_DDL) {
      await db.execute(sql.raw(stmt));
      applied += 1;
    }

    const seed = await seedCodexFromStatic();

    const check = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.codex_articles`,
    );
    const total = [...check][0]?.n ?? 0;

    return NextResponse.json({
      ok: true,
      statements: CODEX_DDL.length,
      seeded: seed.inserted,
      alreadyThere: seed.skipped,
      total,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-codex]", e);
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
