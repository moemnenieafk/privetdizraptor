// Обновление сессии Supabase на каждом запросе (refresh токена в cookie).
// Вызывается из корневого middleware.ts. Слой 4.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Пока ключи Supabase не заданы — middleware ничего не делает,
  // сайт работает как раньше (без авторизации).
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ВАЖНО: getUser() обязателен — он триггерит обновление просроченного токена.
  // Между createServerClient и getUser не вставлять никакой логики.
  await supabase.auth.getUser();

  return response;
}
