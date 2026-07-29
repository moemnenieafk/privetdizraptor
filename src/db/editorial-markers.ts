// Чтение и запись editorial_markers (ручные маркеры карт от админа/модератора).
// Reader — публичный (RLS read-all), CRUD — только через API после проверки canEditContent.
// Resilience: таблицы ещё нет (не накатана) → reader отдаёт [], билд не падает (паттерн codex).
// Решения/схема: docs/decisions/editorial-markers-tool.md.
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import { editorialMarkers, type EditorialMarkerRow, type NewEditorialMarker } from "./schema-editorial";
import { eftGameId } from "./eft";

/** Все редакторские маркеры карты (по mapId) — для рендера слоя. Ошибка/нет таблицы → []. */
export async function getEditorialMarkers(mapId: string): Promise<EditorialMarkerRow[]> {
  try {
    return await db
      .select()
      .from(editorialMarkers)
      .where(eq(editorialMarkers.mapId, mapId))
      .orderBy(asc(editorialMarkers.createdAt));
  } catch (e) {
    console.error("[getEditorialMarkers]", e);
    return [];
  }
}

/** Маркеры, привязанные к квесту/истории (link_id) — для чипа СЮЖЕТ (фаза B) и quest-слоя. */
export async function getEditorialMarkersByLink(
  kind: "story" | "quest",
  linkId: string,
): Promise<EditorialMarkerRow[]> {
  try {
    const gameId = await eftGameId();
    return await db
      .select()
      .from(editorialMarkers)
      .where(
        and(
          eq(editorialMarkers.gameId, gameId),
          eq(editorialMarkers.linkKind, kind),
          eq(editorialMarkers.linkId, linkId),
        ),
      );
  } catch (e) {
    console.error("[getEditorialMarkersByLink]", e);
    return [];
  }
}

/** Апсерт маркера (создание/правка) — вызывает только API после getCmsUser. Возвращает строку. */
export async function upsertEditorialMarker(row: NewEditorialMarker): Promise<EditorialMarkerRow> {
  if (row.id) {
    const [updated] = await db
      .update(editorialMarkers)
      .set({ ...row, updatedAt: new Date() })
      .where(eq(editorialMarkers.id, row.id))
      .returning();
    if (updated) return updated;
  }
  const [inserted] = await db.insert(editorialMarkers).values(row).returning();
  return inserted;
}

/** Удаление маркера по id (в скоупе игры). Возвращает число удалённых. */
export async function deleteEditorialMarker(id: string): Promise<number> {
  const gameId = await eftGameId();
  const res = await db
    .delete(editorialMarkers)
    .where(and(eq(editorialMarkers.id, id), eq(editorialMarkers.gameId, gameId)));
  return res.count;
}
