// Выход: чистим сессию Supabase и редиректим на /login.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 — браузер сменит POST на GET при редиректе.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
