// App-level rate-limit на нашей БД (Vercel+Supabase, без внешнего Upstash).
// Fixed-window счётчик в таблице rate_limits (атомарный upsert). Используется
// публичными auth-роутами (login/register) — слой поверх лимитов GoTrue.
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Возвращает true = РАЗРЕШЕНО, false = лимит превышен.
 * Fail-open при сбое БД: баг/недоступность лимитера НЕ должны запирать вход/регистрацию
 * (GoTrue лимитит дополнительно на своей стороне).
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const rows = (await db.execute(sql`
      insert into rate_limits (key, count, window_start)
      values (${key}, 1, now())
      on conflict (key) do update set
        count = case
          when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}::int)
          then 1 else rate_limits.count + 1 end,
        window_start = case
          when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}::int)
          then now() else rate_limits.window_start end
      returning count
    `)) as unknown as Array<{ count: number }>;

    // Опортунистическая чистка протухших ключей — держим таблицу маленькой.
    if (Math.random() < 0.02) {
      await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
    }

    const count = Number(rows[0]?.count ?? 1);
    return count <= max;
  } catch {
    return true; // fail-open
  }
}

/**
 * IP клиента из доверенного источника. На Vercel `x-real-ip` ставит САМА платформа
 * (клиент не подделает). Фолбэк — ПОСЛЕДНИЙ (правый) сегмент x-forwarded-for: его
 * дописывает прокси, тогда как левый сегмент клиент может подделать и крутить
 * фейковые IP, обходя rate-limit. Поэтому НЕ берём split(',')[0].
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    return parts[parts.length - 1]?.trim() || "unknown";
  }
  return "unknown";
}
