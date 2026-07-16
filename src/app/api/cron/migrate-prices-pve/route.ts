// Одноразовая миграция: добавляет PvE-колонки в таблицу `prices` через Drizzle.
// Нужна потому, что db:push и Supabase SQL Editor недоступны с телефона.
//
// Защита — CRON_SECRET (fail-closed). Выполняет ТОЛЬКО статический DDL ниже —
// произвольный SQL из запроса не принимается. Идемпотентно (ADD COLUMN IF NOT EXISTS):
// гоняется сколько угодно раз. После успеха можно дёргать /api/cron/sync-prices.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRICES_PVE_DDL: string[] = [
  `ALTER TABLE prices ADD COLUMN IF NOT EXISTS avg24h_price_pve integer`,
  `ALTER TABLE prices ADD COLUMN IF NOT EXISTS low24h_price_pve integer`,
  `ALTER TABLE prices ADD COLUMN IF NOT EXISTS sell_for_pve jsonb`,
  `ALTER TABLE prices ADD COLUMN IF NOT EXISTS buy_for_pve jsonb`,
];

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const applied: number[] = [];
  try {
    for (let i = 0; i < PRICES_PVE_DDL.length; i++) {
      await db.execute(sql.raw(PRICES_PVE_DDL[i]));
      applied.push(i);
    }

    // Контроль: реально ли колонки появились.
    const check = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'prices'
            and column_name like '%_pve'
          order by column_name`,
    );
    const columns = [...check].map((r) => r.column_name);

    return NextResponse.json({
      ok: true,
      statements: PRICES_PVE_DDL.length,
      columns,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-prices-pve]", e);
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
