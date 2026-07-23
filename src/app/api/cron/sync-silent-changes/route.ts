// Синк «тихих изменений» BSG (changes.tarkov-changes.com) → наша mirror-таблица.
// Крон дёргает GitHub Actions по расписанию. Берём только НОВЫЕ пулы (дедуп в БД),
// лимит на прогон — чтобы уложиться в maxDuration Vercel Hobby (≤60s).
import { NextResponse } from "next/server";
import { syncSilentChanges } from "@/db/silent-changes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_RUN = 8;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const res = await syncSilentChanges({ maxNewPulls: MAX_PER_RUN });
    return NextResponse.json({ ok: true, ...res, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/sync-silent-changes]", e);
    const err = e as { message?: string };
    return NextResponse.json({ ok: false, error: err.message ?? String(e) }, { status: 502 });
  }
}
