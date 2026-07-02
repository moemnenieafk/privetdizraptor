// Серверный хелпер «текущий пользователь» (слой 4): сессия Supabase + строка profiles.
// Аналог getAdmin (src/lib/auth/admin.ts), но без проверки роли — для кабинета/гарда.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, questProgress, barterProgress, achievementProgress } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export interface Me {
  id: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string; // 'user' | 'admin'
  usernameChangedAt: string | null; // ISO; для кулдауна смены логина в UI
  createdAt: string | null; // ISO; «участник с»
  socials: { twitch: string | null; youtube: string | null; discord: string | null; steam: string | null };
}

export type SocialPlatform = "twitch" | "youtube" | "discord" | "steam";

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
      createdAt: profiles.createdAt,
      twitch: profiles.twitch,
      youtube: profiles.youtube,
      discord: profiles.discord,
      steam: profiles.steam,
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
    createdAt: p?.createdAt ? p.createdAt.toISOString() : null,
    socials: {
      twitch: p?.twitch ?? null,
      youtube: p?.youtube ?? null,
      discord: p?.discord ?? null,
      steam: p?.steam ?? null,
    },
  };
}

export interface AccountStats {
  questsCompleted: number;
  bartersConfirmed: number;
  achievementsCompleted: number;
}

/** Реальная стата кабинета: выполнено квестов / подтверждено бартеров / достижений (по всем играм юзера). */
export async function getAccountStats(userId: string): Promise<AccountStats> {
  try {
    const [q] = await db
      .select({ n: sql<number>`coalesce(sum(jsonb_array_length(${questProgress.completedQuests})), 0)::int` })
      .from(questProgress)
      .where(eq(questProgress.userId, userId));
    const [b] = await db
      .select({ n: sql<number>`coalesce(sum(jsonb_array_length(${barterProgress.confirmedBarterIds})), 0)::int` })
      .from(barterProgress)
      .where(eq(barterProgress.userId, userId));
    const [a] = await db
      .select({ n: sql<number>`coalesce(sum(jsonb_array_length(${achievementProgress.completedIds})), 0)::int` })
      .from(achievementProgress)
      .where(eq(achievementProgress.userId, userId));
    return {
      questsCompleted: q?.n ?? 0,
      bartersConfirmed: b?.n ?? 0,
      achievementsCompleted: a?.n ?? 0,
    };
  } catch (e) {
    console.error("[getAccountStats]", e);
    return { questsCompleted: 0, bartersConfirmed: 0, achievementsCompleted: 0 };
  }
}
