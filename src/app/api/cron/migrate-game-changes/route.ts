// Миграция таблиц CDC «что реально изменилось»: item_change_state + item_changes.
// db:push с телефона недоступен — накатываем роутом (паттерн migrate-comlink).
// Защита CRON_SECRET, идемпотентно (IF NOT EXISTS). RLS без policy — прямого
// PostgREST-доступа нет, читает сервер через Drizzle (мимо RLS).
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DDL: string[] = [
  `create table if not exists item_change_state (
     game_id uuid not null references games(id) on delete cascade,
     in_game_id text not null,
     name text not null,
     short_name text,
     fingerprint jsonb not null,
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists item_change_state_game_ingame_idx
     on item_change_state (game_id, in_game_id)`,
  `create table if not exists item_changes (
     id uuid primary key default gen_random_uuid(),
     game_id uuid not null references games(id) on delete cascade,
     in_game_id text not null,
     name text not null,
     short_name text,
     kind text not null,
     field text,
     old_value text,
     new_value text,
     detected_at timestamptz not null default now()
   )`,
  `create index if not exists item_changes_detected_idx on item_changes (detected_at)`,
  `create index if not exists item_changes_game_idx on item_changes (game_id)`,
  `alter table item_change_state enable row level security`,
  `alter table item_changes enable row level security`,
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
          where table_schema = 'public'
            and table_name in ('item_change_state', 'item_changes')
          order by table_name`,
    );
    return NextResponse.json({
      ok: true,
      statements: DDL.length,
      applied: applied.length,
      tables: [...check].map((r) => r.table_name),
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-game-changes]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, appliedUpTo: applied.length, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
