// Cron: полный свип детекта аномалий companion-цен (плюс инлайн-детект при сабмите).
// Защита — CRON_SECRET (Bearer). См. [[companion-anomaly-detection]].
import { NextResponse } from "next/server";
import { detectCompanionAnomalies } from "@/db/companion-anomalies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const regular = await detectCompanionAnomalies("regular");
    const pve = await detectCompanionAnomalies("pve");
    return NextResponse.json({ ok: true, flagged: { regular, pve }, at: new Date().toISOString() });
  } catch (e) {
    console.error("[cron/detect-anomalies]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
