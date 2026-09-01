// Список пользователей для админки (/admin/users). Read-only join:
//   auth.users (email, created_at) ⋈ profiles (username, role, avatar) ⋈ subscriptions (tier, срок).
// Owner-коннект (Drizzle) читает схему `auth`. Пишем через существующий /api/admin/subscriptions.
import { sql } from "drizzle-orm";
import { db } from "@/db";

export interface AdminUserRow {
  id: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string; // 'user' | 'editor' | 'moderator' | 'admin'
  tier: string; // 'free' | slug
  validUntil: string | null; // ISO | null (бессрочно)
  createdAt: string | null; // ISO
}

interface Raw {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  tier: string | null;
  valid_until: string | Date | null;
  created_at: string | Date | null;
}

const iso = (v: string | Date | null): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString();

/** Все игроки, новые сверху. Подписки/роли резолвятся с дефолтами (free / user). */
export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const res = await db.execute(sql`
    select u.id::text          as id,
           u.email             as email,
           u.created_at        as created_at,
           p.username          as username,
           p.avatar_url        as avatar_url,
           p.role              as role,
           s.tier              as tier,
           s.valid_until       as valid_until
    from auth.users u
    left join public.profiles p       on p.id = u.id
    left join public.subscriptions s  on s.user_id = u.id
    order by u.created_at desc nulls last
  `);
  const rows = (res as unknown as { rows?: Raw[] }).rows ?? (res as unknown as Raw[]);
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    username: r.username,
    avatarUrl: r.avatar_url,
    role: r.role ?? "user",
    tier: r.tier ?? "free",
    validUntil: iso(r.valid_until),
    createdAt: iso(r.created_at),
  }));
}
