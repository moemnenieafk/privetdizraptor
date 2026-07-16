// Миграция таблицы снимка крафтов убежища (craft_state). Идемпотентно.
// category='craft' в item_changes отдельной колонки не требует (колонка текстовая).
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DDL: string[] = [
  `create table if not exists craft_state (
     game_id uuid not null references games(id) on delete cascade,
     recipe_id text not null,
     fingerprint text not null,
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists craft_state_key_idx on craft_state (game_id, recipe_id)`,
  `alter table craft_state enable row level security`,
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
          where table_schema = 'public' and table_name = 'craft_state'`,
    );
    return NextResponse.json({ ok: true, applied: applied.length, tables: [...check].map((r) => r.table_name), at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/migrate-craft-changes]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json({ ok: false, appliedUpTo: applied.length, error: err.message ?? String(e), dbError: err.cause?.message ?? null }, { status: 500 });
  }
}
