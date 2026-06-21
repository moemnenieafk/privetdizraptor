// Карточка редактирования предмета в CMS.
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, itemCategories, itemProperties } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { EditItemForm } from "./EditItemForm";

export default async function AdminItemEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const gameId = await eftGameId();

  const [row] = await db
    .select({
      id: items.inGameId,
      name: items.name,
      shortName: items.shortName,
      description: items.description,
      basePrice: items.basePrice,
      categoryId: items.categoryId,
      properties: itemProperties.properties,
    })
    .from(items)
    .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
    .where(and(eq(items.gameId, gameId), eq(items.inGameId, id)))
    .limit(1);

  if (!row) notFound();

  const categories = await db
    .select({ id: itemCategories.id, slug: itemCategories.inGameId })
    .from(itemCategories)
    .where(eq(itemCategories.gameId, gameId))
    .orderBy(asc(itemCategories.inGameId));

  return <EditItemForm item={row} categories={categories} />;
}
