// Одноразовая миграция: создаёт таблицу `price_history` — суточные снимки цен
// барахолки. Нужна потому, что `prices` хранит только текущее состояние, а спотовая
// цена скачет в разы за сутки, и любой расчёт поверх неё шумит.
//
// Защита — CRON_SECRET (fail-closed). Выполняет ТОЛЬКО статический DDL ниже.
// Идемпотентно (IF NOT EXISTS): гоняется сколько угодно раз.
//
// Порядок выката — docs/decisions/done/db-schema-column-deploy-order.md:
// эта миграция → деплой кода, который таблицу читает → /api/cron/snapshot-prices.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRICE_HISTORY_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS price_history (
     game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
     in_game_id text NOT NULL,
     day date NOT NULL,
     avg_price integer,
     low_price integer,
     synced_at timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT price_history_pkey PRIMARY KEY (game_id, in_game_id, day)
   )`,
  `CREATE INDEX IF NOT EXISTS price_history_day_idx ON price_history (day)`,
];

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const applied: number[] = [];
  try {
    for (let i = 0; i < PRICE_HISTORY_DDL.length; i++) {
      await db.execute(sql.raw(PRICE_HISTORY_DDL[i]));
      applied.push(i);
    }

    const rows = await db.execute<{ rows: number; days: number }>(
      sql`select count(*)::int as rows, count(distinct day)::int as days from price_history`,
    );
    const stats = [...rows][0] ?? { rows: 0, days: 0 };

    return NextResponse.json({
      ok: true,
      statements: PRICE_HISTORY_DDL.length,
      rows: stats.rows,
      days: stats.days,
      hint: stats.rows === 0 ? "таблица пуста — прогони snapshot-prices" : null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-price-history]", e);
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
