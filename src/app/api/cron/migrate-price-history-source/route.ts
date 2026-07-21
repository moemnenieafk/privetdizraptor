// Миграция: колонка `source` в `price_history` — откуда взяты сутки.
// own — наш снимок, tarkovdev — залито бэкфилом. Без пометки ряд смешанной природы
// через месяц становится необъяснимым.
//
// Защита — CRON_SECRET (fail-closed). Только статический DDL. Идемпотентно.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DDL: string[] = [
  `ALTER TABLE price_history ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'own'`,
];

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const applied: number[] = [];
  try {
    for (let i = 0; i < DDL.length; i++) {
      await db.execute(sql.raw(DDL[i]));
      applied.push(i);
    }

    const stats = await db.execute<{ source: string; rows: number }>(
      sql`select source, count(*)::int as rows from price_history group by source order by source`,
    );

    return NextResponse.json({
      ok: true,
      statements: DDL.length,
      bySource: [...stats],
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-price-history-source]", e);
    const err = e as { message?: string; cause?: { message?: string; code?: string } };
    return NextResponse.json(
      {
        ok: false,
        failedAtStatement: applied.length,
        error: err.message ?? String(e),
        dbError: err.cause?.message ?? null,
        dbCode: err.cause?.code ?? null,
      },
      { status: 500 },
    );
  }
}
