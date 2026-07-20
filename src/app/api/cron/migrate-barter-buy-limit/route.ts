// Одноразовая миграция: добавляет колонку `buy_limit` в таблицу `barters`.
// Нужна потому, что db:push и Supabase SQL Editor недоступны с телефона.
//
// Защита — CRON_SECRET (fail-closed). Выполняет ТОЛЬКО статический DDL ниже —
// произвольный SQL из запроса не принимается. Идемпотентно (ADD COLUMN IF NOT EXISTS):
// гоняется сколько угодно раз.
//
// Порядок: эта миграция → деплой кода → /api/cron/sync-prices (заполнит колонку,
// синк бартеров идёт тем же кроном). До синка колонка пустая, и курс арена-валют
// считается по заниженной ёмкости ступеней — см. docs/EFT_CURRENCY_MODEL.md
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BARTER_BUY_LIMIT_DDL: string[] = [
  `ALTER TABLE barters ADD COLUMN IF NOT EXISTS buy_limit integer`,
];

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const applied: number[] = [];
  try {
    for (let i = 0; i < BARTER_BUY_LIMIT_DDL.length; i++) {
      await db.execute(sql.raw(BARTER_BUY_LIMIT_DDL[i]));
      applied.push(i);
    }

    // Контроль: реально ли колонка появилась и сколько строк уже заполнено.
    const check = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'barters'
            and column_name = 'buy_limit'`,
    );
    const columns = [...check].map((r) => r.column_name);

    const filled = await db.execute<{ total: number; with_limit: number }>(
      sql`select count(*)::int as total,
                 count(buy_limit)::int as with_limit
          from barters`,
    );
    const stats = [...filled][0] ?? { total: 0, with_limit: 0 };

    return NextResponse.json({
      ok: true,
      statements: BARTER_BUY_LIMIT_DDL.length,
      columns,
      barters: stats.total,
      withBuyLimit: stats.with_limit,
      hint: stats.with_limit === 0 ? "колонка пуста — прогони sync-prices" : null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-barter-buy-limit]", e);
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
