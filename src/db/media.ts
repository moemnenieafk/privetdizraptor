// Медиа-библиотека: чтение и запись каталога (E10, фаза 4).
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema-media";

export interface MediaItem {
  id: string;
  url: string;
  path: string;
  alt: string;
  mime: string;
  bytes: number;
  createdAt: string;
}

/** НЕ БРОСАЕТ: до миграции таблицы нет — библиотека просто пустая, CMS живёт. */
export async function listMedia(limit = 60): Promise<MediaItem[]> {
  try {
    const rows = await db
      .select()
      .from(mediaAssets)
      .orderBy(desc(mediaAssets.createdAt))
      .limit(Math.min(limit, 200));

    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      path: r.path,
      alt: r.alt,
      mime: r.mime,
      bytes: r.bytes,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (e) {
    console.warn("[media] каталог недоступен:", e instanceof Error ? e.message : e);
    return [];
  }
}

export async function addMedia(input: {
  path: string;
  url: string;
  mime: string;
  bytes: number;
  alt: string;
  uploadedBy: string;
}): Promise<MediaItem> {
  const [row] = await db.insert(mediaAssets).values(input).returning();
  return {
    id: row.id,
    url: row.url,
    path: row.path,
    alt: row.alt,
    mime: row.mime,
    bytes: row.bytes,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Возвращает путь+url удалённого объекта — его нужно снести из бакета (R2 или legacy Supabase). */
export async function removeMedia(id: string): Promise<{ path: string; url: string } | null> {
  const [row] = await db
    .delete(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .returning({ path: mediaAssets.path, url: mediaAssets.url });
  return row ?? null;
}
