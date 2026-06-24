// POST /api/auth/login — вход по e-mail ИЛИ имени пользователя + паролю.
// Username → e-mail резолвится на СЕРВЕРЕ (e-mail клиенту не отдаём, чтобы не
// светить адреса). Подпись signInWithPassword на серверном клиенте проставляет
// cookie-сессию в ответ. На любую ошибку — единый 401 (без энумерации логинов).
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, clientIp, hasRecentEvent, recordEvent, clearEvent } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const FAIL_WINDOW = 3600; // окно «недавней ошибки» для адаптивной капчи (1ч)

const tooMany = () =>
  NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const fail = () => NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
// Неудача по креденшелам: помечаем для адаптивной капчи и просим капчу на след. попытку.
const failCreds = () =>
  NextResponse.json({ error: "Неверный логин или пароль", captchaRequired: true }, { status: 401 });

// username → e-mail через profiles.id + admin.getUserById (service-role).
// auth.users клиенту/анону недоступен, поэтому резолвим серверно.
async function emailForUsername(username: string): Promise<string | null> {
  const [p] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${username})`)
    .limit(1);
  if (!p) return null;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return null;

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.getUserById(p.id);
  if (error) return null;
  return data.user?.email ?? null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const ip = clientIp(req);
  // Rate-limit по IP (поверх лимитов GoTrue): защита от брутфорса/стаффинга.
  if (!(await rateLimit(`login:ip:${ip}`, 20, 300))) return tooMany();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const identifier = isObject(body) && typeof body.identifier === "string" ? body.identifier.trim() : "";
  const password = isObject(body) && typeof body.password === "string" ? body.password : "";
  const captchaToken = isObject(body) && typeof body.captchaToken === "string" ? body.captchaToken : "";
  if (!identifier || !password) return fail();
  // Cap длины — отсекаем переразмерный ввод до БД/admin/signIn (анти-DoS-усилитель).
  if (identifier.length > 320 || password.length > 128) return fail();

  const failKey = `loginfail:ip:${ip}`;

  // Адаптивная капча: если с этого IP была недавняя ошибка входа — требуем Turnstile.
  if (await hasRecentEvent(failKey, FAIL_WINDOW)) {
    if (!(await verifyTurnstile(captchaToken, ip))) {
      return NextResponse.json(
        { error: "Подтвердите, что вы не робот", captchaRequired: true },
        { status: 400 },
      );
    }
  }

  let email: string | null = identifier;
  if (!EMAIL_RE.test(identifier)) {
    email = await emailForUsername(identifier);
    if (!email) {
      await recordEvent(failKey, FAIL_WINDOW);
      return failCreds();
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await recordEvent(failKey, FAIL_WINDOW);
    return failCreds();
  }

  await clearEvent(failKey); // успех → снять требование капчи с этого IP
  return NextResponse.json({ ok: true });
}
