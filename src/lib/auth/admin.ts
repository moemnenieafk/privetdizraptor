// Серверные guard'ы CMS.
//   getAdmin()   — только role='admin' (каталог, роли, системное).
//   getCmsUser() — admin ИЛИ editor (контент-зона /admin и правка материалов).
// Канон прав — @/lib/auth/roles.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { canAccessCms, canEditContent, canManageCatalog, type Role } from "@/lib/auth/roles";

export interface AdminUser {
  id: string;
  email: string | undefined;
}

export interface CmsUser extends AdminUser {
  role: Role;
  /** Может править контент (статьи, кодекс, истории). */
  canEditContent: boolean;
  /** Может править каталог предметов и выдавать роли. */
  canManageCatalog: boolean;
}

/** Пользователь CMS-зоны: admin или editor. null — доступа нет. */
export async function getCmsUser(): Promise<CmsUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  const role = (p?.role ?? "user") as Role;
  if (!canAccessCms(role)) return null;

  return {
    id: user.id,
    email: user.email,
    role,
    canEditContent: canEditContent(role),
    canManageCatalog: canManageCatalog(role),
  };
}

// null — не админ (или не залогинен). Иначе — данные админа.
export async function getAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [p] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (p?.role !== "admin") return null;
  return { id: user.id, email: user.email };
}
