// Подтверждение email-ссылок из письма. Поддерживает ОБА формата:
//  - token_hash + type (кастомный token_hash-шаблон) → verifyOtp;
//  - code (дефолтный {{ .ConfirmationURL }} в PKCE-проекте) → exchangeCodeForSession.
// Дефолтные шаблоны редактировать нельзя без custom SMTP, поэтому держим оба пути.
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
