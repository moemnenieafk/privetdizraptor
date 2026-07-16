// Миграция таблицы снимка квестов (quest_state). Идемпотентно.
// category='quest' в item_changes отдельной колонки не требует.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DDL: string[] = [
  `create table if not exists quest_state (
     game_id uuid not null references games(id) on delete cascade,
     quest_id text not null,
     name text not null,
     fingerprint text not null,
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists quest_state_key_idx on quest_state (game_id, quest_id)`,
  `alter table quest_state enable row level security`,
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
          where table_schema = 'public' and table_name = 'quest_state'`,
    );
    return NextResponse.json({ ok: true, applied: applied.length, tables: [...check].map((r) => r.table_name), at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/migrate-quest-changes]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json({ ok: false, appliedUpTo: applied.length, error: err.message ?? String(e), dbError: err.cause?.message ?? null }, { status: 500 });
  }
}
