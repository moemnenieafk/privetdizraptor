// Выход: чистим сессию Supabase и редиректим на /login.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/site";

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // origin из SITE_URL (канон), а не из request.url: за прокси внутренний
  // origin = localhost:3000 → выход уводил в тупик.
  // 303 — браузер сменит POST на GET при редиректе.
  return NextResponse.redirect(absoluteUrl("/login"), { status: 303 });
}
