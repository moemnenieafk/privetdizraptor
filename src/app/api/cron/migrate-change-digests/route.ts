// Миграция таблицы редакторских разборов срезов изменений (change_digests).
// db:push с телефона нет — накатываем роутом (паттерн migrate-comlink). Идемпотентно.
// RLS: публичное чтение только published; пишет серверный admin-роут (Drizzle мимо RLS).
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DDL: string[] = [
  `create table if not exists change_digests (
     game_id uuid not null references games(id) on delete cascade,
     date text not null,
     note_ru text not null default '',
     published boolean not null default false,
     author_id uuid,
     updated_at timestamptz not null default now()
   )`,
  `create unique index if not exists change_digests_game_date_idx on change_digests (game_id, date)`,
  `alter table change_digests enable row level security`,
  `drop policy if exists change_digests_read on change_digests`,
  `create policy change_digests_read on change_digests for select using (published = true)`,
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
          where table_schema = 'public' and table_name = 'change_digests'`,
    );
    return NextResponse.json({
      ok: true,
      statements: DDL.length,
      applied: applied.length,
      tables: [...check].map((r) => r.table_name),
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-change-digests]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, appliedUpTo: applied.length, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
