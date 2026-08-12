// Чтение и запись ПОЛЬЗОВАТЕЛЬСКИХ маркеров карт (Wizard/CMS). Ф4 единой системы маркеров
// (docs/decisions/unified-markers.md): источник переключён с editorial_markers на
// markers(source='user'); ВЫХОДНОЙ shape сохранён (EditorialMarkerRow) + контракт API
// (NewEditorialMarker) → route и рендер НЕ меняются (мерж-рендерер Б). editorial_markers
// заморожена (снапшот для отката, дропнем в Ф5). Reader публичный (RLS read-all), CRUD — API после
// canEditContent. Resilience: ошибка/нет таблицы → reader отдаёт [], билд не падает.
import { and, asc, eq } from "drizzle-orm";
import { db } from "./index";
import type { EditorialMarkerRow, NewEditorialMarker } from "./schema-editorial";
import { markers, type MarkerRow, type NewMarker } from "./schema-markers";
import { eftGameId } from "./eft";

/** markers(user) → форма EditorialMarkerRow (контракт карточки/рендера не меняется). */
function toEditorialRow(m: MarkerRow): EditorialMarkerRow {
  return {
    id: m.id,
    gameId: m.gameId,
    mapId: m.mapId,
    floor: m.floor,
    x: m.x ?? 0,
    y: m.y,
    z: m.z ?? 0,
    type: m.type,
    category: m.category,
    faction: m.faction,
    title: m.title ?? "",
    description: m.description,
    screenshots: m.screenshots ?? [],
    linkKind: m.linkKind,
    linkId: m.linkId,
    linkStep: m.linkStep,
    polygon: (m.polygon as { x: number; z: number }[] | null) ?? null,
    sourceMarkerId: m.sourceMarkerId,
    hidden: m.hidden,
    authorId: m.authorId,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    // Лут-пул: несколько предметов на один спот. Хранится в meta.lootItems (jsonb) таблицы markers.
    lootItems: Array.isArray((m.meta as { lootItems?: unknown } | null)?.lootItems)
      ? ((m.meta as { lootItems: unknown[] }).lootItems.filter((x): x is string => typeof x === "string"))
      : null,
  };
}

/** NewEditorialMarker (контракт API) → строка markers(source='user'), без id (id — отдельно). */
function toUserMarker(row: NewEditorialMarker): NewMarker {
  return {
    gameId: row.gameId,
    mapId: row.mapId,
    source: "user",
    type: row.type ?? "poi",
    floor: row.floor ?? null,
    x: row.x,
    y: row.y ?? null,
    z: row.z,
    polygon: row.polygon ?? null,
    category: row.category ?? null,
    faction: row.faction ?? null,
    title: row.title,
    description: row.description ?? null,
    screenshots: row.screenshots ?? [],
    linkKind: row.linkKind ?? "none",
    linkId: row.linkId ?? null,
    linkStep: row.linkStep ?? null,
    sourceMarkerId: row.sourceMarkerId ?? null,
    hidden: row.hidden ?? false,
    authorId: row.authorId ?? null,
    // Лут-пул → meta.lootItems (jsonb). Пусто → null, чтобы не плодить {} в meta.
    meta: row.lootItems?.length ? { lootItems: row.lootItems } : null,
  };
}

/** Все пользовательские маркеры карты (по mapId) — для рендера слоя. Ошибка/нет таблицы → []. */
export async function getEditorialMarkers(mapId: string): Promise<EditorialMarkerRow[]> {
  try {
    const rows = await db
      .select()
      .from(markers)
      .where(and(eq(markers.mapId, mapId), eq(markers.source, "user")))
      .orderBy(asc(markers.createdAt));
    return rows.map(toEditorialRow);
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
    const rows = await db
      .select()
      .from(markers)
      .where(
        and(
          eq(markers.gameId, gameId),
          eq(markers.source, "user"),
          eq(markers.linkKind, kind),
          eq(markers.linkId, linkId),
        ),
      );
    return rows.map(toEditorialRow);
  } catch (e) {
    console.error("[getEditorialMarkersByLink]", e);
    return [];
  }
}

/** Апсерт маркера (создание/правка) — вызывает только API после getCmsUser. Возвращает строку. */
export async function upsertEditorialMarker(row: NewEditorialMarker): Promise<EditorialMarkerRow> {
  const m = toUserMarker(row);
  if (row.id) {
    const [updated] = await db
      .update(markers)
      .set({ ...m, updatedAt: new Date() })
      .where(and(eq(markers.id, row.id), eq(markers.source, "user")))
      .returning();
    if (updated) return toEditorialRow(updated);
  }
  const [inserted] = await db
    .insert(markers)
    .values(row.id ? { ...m, id: row.id } : m)
    .returning();
  return toEditorialRow(inserted);
}

/** Удаление маркера по id (в скоупе игры + source='user'). Возвращает число удалённых. */
export async function deleteEditorialMarker(id: string): Promise<number> {
  const gameId = await eftGameId();
  const res = await db
    .delete(markers)
    .where(and(eq(markers.id, id), eq(markers.source, "user"), eq(markers.gameId, gameId)));
  return res.count;
}
