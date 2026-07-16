// Миграция под трекинг офферов торговцев: колонки category/scope в item_changes
// (существующие строки → 'stat') + таблица trader_offer_state. Идемпотентно.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DDL: string[] = [
  `alter table item_changes add column if not exists category text not null default 'stat'`,
  `alter table item_changes add column if not exists scope text`,
  `create table if not exists trader_offer_state (
     game_id uuid not null references games(id) on delete cascade,
     trader_id text not null,
     tpl text not null,
     fingerprint text not null,
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists trader_offer_state_key_idx
     on trader_offer_state (game_id, trader_id, tpl)`,
  `alter table trader_offer_state enable row level security`,
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
    const check = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables
          where table_schema = 'public' and table_name = 'trader_offer_state'`,
    );
    const cols = await db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'item_changes'
            and column_name in ('category', 'scope')
          order by column_name`,
    );
    return NextResponse.json({
      ok: true,
      applied: applied.length,
      traderTable: [...check].map((r) => r.table_name),
      itemChangesCols: [...cols].map((r) => r.column_name),
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-trader-changes]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, appliedUpTo: applied.length, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
