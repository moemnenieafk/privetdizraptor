// OAuth-callback (Discord/Twitch): провайдер возвращает code → меняем на сессию.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/safe-next";
import { absoluteUrl } from "@/lib/site";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  // Провайдер мог вернуться с ошибкой ВМЕСТО кода (redirect_uri mismatch,
  // invalid_client, отказ пользователя) — тогда code отсутствует.
  const providerError = searchParams.get("error_description") || searchParams.get("error");

  // Абсолютный origin берём из SITE_URL (канон), а НЕ из request.url:
  // за обратным прокси (Cloudflare→Coolify) внутренний origin = http://localhost:3000,
  // и редирект уводил пользователя в тупик вместо cta.quest.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(absoluteUrl(next));
    // Обмен кода на сессию упал (частая причина — протухший client secret
    // провайдера в конфиге GoTrue). Логируем реальную причину в серверный вывод.
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  } else {
    console.error("[auth/callback] provider returned no code:", providerError ?? "(none)");
  }

  return NextResponse.redirect(absoluteUrl("/login?error=oauth"));
}
