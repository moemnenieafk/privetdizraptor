// Мгновенная инвалидация публичной страницы /u/[username] после изменений, которые
// на ней видны (галочка, тир→доступы, статус стримера, анкета). Без этого страница
// обновлялась бы только по ISR-таймеру (revalidate=120). Вызывается из route handlers.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

/** Инвалидировать /u/{username}. username берём как есть (канонический из profiles). */
export function revalidateProfileByUsername(username: string | null | undefined): void {
  if (username) revalidatePath(`/u/${username}`);
}

/** То же, но когда под рукой только userId — резолвим логин из profiles. */
export async function revalidateProfileByUserId(userId: string): Promise<void> {
  const [row] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  revalidateProfileByUsername(row?.username);
}
