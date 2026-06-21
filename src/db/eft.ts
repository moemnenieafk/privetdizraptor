// Серверные хелперы для EFT-данных (используются route handlers слоя 3).
import { eq } from "drizzle-orm";
import { db } from "./index";
import { games } from "./schema";

// gameId игры eft кэшируется на процесс — справочник games статичен.
let cache: string | null = null;
export async function eftGameId(): Promise<string> {
  if (cache) return cache;
  const [g] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.code, "eft"))
    .limit(1);
  if (!g) throw new Error("игра 'eft' не найдена — прогоните npm run db:etl");
  cache = g.id;
  return cache;
}

// Иконки лежат локально в public как {inGameId}.webp (R2 пока не используем).
export const itemImagePath = (inGameId: string): string =>
  `/images/items/eft/${inGameId}.webp`;
