// Серверный guard CMS: пускает только залогиненного пользователя с role='admin'.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string | undefined;
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
