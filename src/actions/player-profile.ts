"use server";

// Server-actions профиля игрока (Слой B). Запись/чтение снапшота через owner-role после getMe.
// Аноним (getMe==null) → {ok:false}/null: клиент падает на localStorage (§ спека, аноним = локально).
import { getMe } from "@/lib/auth/me";
import { getPlayerProfileSnapshot, upsertPlayerProfileSnapshot } from "@/db/player-profile";
import type { PlayerProfileSnapshot } from "@/types/eft-player";

/** Сохранить снапшот текущего пользователя. ok:false — не залогинен (сохраняем локально на клиенте). */
export async function savePlayerProfileAction(
  snapshot: PlayerProfileSnapshot,
): Promise<{ ok: boolean }> {
  const me = await getMe();
  if (!me) return { ok: false };
  await upsertPlayerProfileSnapshot(me.id, snapshot);
  return { ok: true };
}

/** Снапшот текущего пользователя (или null — аноним/нет профиля). */
export async function loadPlayerProfileAction(): Promise<PlayerProfileSnapshot | null> {
  const me = await getMe();
  if (!me) return null;
  return getPlayerProfileSnapshot(me.id);
}
