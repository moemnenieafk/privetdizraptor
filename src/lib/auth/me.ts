// Серверный хелпер «текущий пользователь» (слой 4): сессия Supabase + строка profiles.
// Аналог getAdmin (src/lib/auth/admin.ts), но без проверки роли — для кабинета/гарда.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export interface Me {
  id: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string; // 'user' | 'admin'
  usernameChangedAt: string | null; // ISO; для кулдауна смены логина в UI
}

/** Текущий пользователь (сессия + profiles). null — не залогинен. */
export async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [p] = await db
    .select({
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      role: profiles.role,
      usernameChangedAt: profiles.usernameChangedAt,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return {
    id: user.id,
    email: user.email ?? null,
    username: p?.username ?? null,
    avatarUrl: p?.avatarUrl ?? null,
    role: p?.role ?? "user",
    usernameChangedAt: p?.usernameChangedAt ? p.usernameChangedAt.toISOString() : null,
  };
}
