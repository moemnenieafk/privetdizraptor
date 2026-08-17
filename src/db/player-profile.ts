// Ридер/райтер профиля игрока (серверная точка истины). Owner-role (Drizzle мимо RLS) —
// вызывается только из server-action после getMe. Спека: docs/decisions/player-profile-persistence.md.
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { eftGameId } from "./eft";
import { playerProfiles } from "./schema-player-profile";
import type { PlayerProfileSnapshot } from "@/types/eft-player";

/** Снапшот профиля пользователя для EFT. null — профиль не сохранён. */
export async function getPlayerProfileSnapshot(userId: string): Promise<PlayerProfileSnapshot | null> {
  const gameId = await eftGameId();
  const [row] = await db
    .select({ snapshot: playerProfiles.snapshot })
    .from(playerProfiles)
    .where(and(eq(playerProfiles.userId, userId), eq(playerProfiles.gameId, gameId)))
    .limit(1);
  return row?.snapshot ?? null;
}

/** Upsert снапшота (один на user+game). Денорм level/experience — из вью, иначе из идентичности. */
export async function upsertPlayerProfileSnapshot(
  userId: string,
  snapshot: PlayerProfileSnapshot,
): Promise<void> {
  const gameId = await eftGameId();
  // Денорм-колонки для индексации — из рич-вью (идентичность Слой B больше не хранит, см. sync-lib).
  const level = snapshot.view?.level ?? null;
  const experience = snapshot.view?.experience ?? null;

  await db
    .insert(playerProfiles)
    .values({ userId, gameId, snapshot, level, experience, source: snapshot.source })
    .onConflictDoUpdate({
      target: [playerProfiles.userId, playerProfiles.gameId],
      set: { snapshot, level, experience, source: snapshot.source, updatedAt: new Date() },
    });
}
