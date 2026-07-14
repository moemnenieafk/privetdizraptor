// GET /api/comlink/sherpas — биржа шерпов. Только авторизованным (в выдаче Discord).
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { getSherpas } from "@/db/sherpa";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const data = await getSherpas();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
