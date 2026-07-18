// Миграция статуса «Стример»: добавляет profiles.streamer (публичный бейдж +
// твич-рамка на /u/[username]). Additive + идемпотентно (add column if not exists).
// Запуск: Actions → «migrate-streamer». Защита CRON_SECRET.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DDL = `alter table public.profiles
  add column if not exists streamer boolean not null default false;`;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await db.execute(sql.raw(DDL));
    const check = await db.execute<{ column_name: string }>(sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'streamer'
    `);
    return NextResponse.json({
      ok: true,
      column: [...check][0]?.column_name ?? null,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[cron/migrate-streamer]", e);
    const err = e as { message?: string; cause?: { message?: string } };
    return NextResponse.json(
      { ok: false, error: err.message ?? String(e), dbError: err.cause?.message ?? null },
      { status: 500 },
    );
  }
}
