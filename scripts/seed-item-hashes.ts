// CLI: наполнить `item_icon_hashes` perceptual-хэшами (dHash) иконок предметов EFT.
// Источник — ТОЛЬКО наше зеркало: каталог `items` (размеры сетки) + `prices`
// (normalizedName) + R2-иконки (itemIconUrl). Внешние игровые API (api.tarkov.dev /
// json.tarkov.dev) на запрос ЗАПРЕЩЕНЫ (§4.11/§4.12) — здесь их нет.
// Запуск: npx tsx scripts/seed-item-hashes.ts
import { config } from "dotenv";
config({ path: ".env.local" });

const CONCURRENCY = 8;

// slug из name: латиница/цифры → дефисы, схлопнуть повторы, обрезать по краям.
function slugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

async function main(): Promise<void> {
  // Импорты ПОСЛЕ config() — db-модуль читает DATABASE_URL лениво при первом запросе,
  // а itemIconUrl — NEXT_PUBLIC_ICON_BASE_URL.
  const { eq, and, isNotNull, sql } = await import("drizzle-orm");
  const { db } = await import("../src/db/index.ts");
  const { games, items } = await import("../src/db/schema.ts");
  const { itemIconHashes } = await import("../src/db/schema/vision.ts");
  const { getEftPriceIndex } = await import("../src/db/prices.ts");
  const { itemIconUrl } = await import("../src/lib/item-icon.ts");
  const { dhash } = await import("../src/lib/vision/phash.ts");

  const [eftGame] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.code, "eft"))
    .limit(1);
  if (!eftGame) throw new Error("игра 'eft' не найдена — прогоните npm run db:etl");
  const gameId = eftGame.id;

  // Только предметы с известной сеткой (gridW×gridH нужны для матча по размеру при скане).
  const rows = await db
    .select({
      inGameId: items.inGameId,
      name: items.name,
      gridWidth: items.gridWidth,
      gridHeight: items.gridHeight,
    })
    .from(items)
    .where(
      and(
        eq(items.gameId, gameId),
        isNotNull(items.gridWidth),
        isNotNull(items.gridHeight),
      ),
    );

  // normalizedName из прайс-зеркала (паттерн barter-quest.ts). Фолбэк — slug из name.
  const priceIndex = await getEftPriceIndex();
  console.log(`выбрано предметов: ${rows.length}`);

  // Строка на upsert. Собираем в буфер и пишем чанками — bulk-upsert (паттерн etl/prices)
  // вместо тысяч одиночных insert'ов, которые роняют транзакционный пулер (порт 6543).
  type HashRow = {
    itemId: string;
    name: string;
    normalizedName: string;
    gridW: number;
    gridH: number;
    dhash: string;
    iconUrl: string;
  };

  const results: HashRow[] = [];
  let skipped = 0;

  // Сеть — узкое место (тысячи R2-иконок + sharp): её параллелим. Запись — bulk после.
  const queue = [...rows];
  const worker = async (): Promise<void> => {
    for (;;) {
      const item = queue.pop();
      if (!item) return;
      // where гарантирует not-null, но drizzle-тип — number | null; сузим явно.
      if (item.gridWidth == null || item.gridHeight == null) continue;

      const normalizedName =
        priceIndex.get(item.inGameId)?.normalizedName || slugFromName(item.name);
      const iconUrl = itemIconUrl(item.inGameId);

      let image: Response;
      try {
        image = await fetch(iconUrl);
      } catch (e) {
        console.warn(`skip ${normalizedName}: fetch-error ${String(e)}`);
        skipped += 1;
        continue;
      }
      if (!image.ok) {
        console.warn(`skip ${normalizedName}: ${image.status}`);
        skipped += 1;
        continue;
      }

      const arr = await image.arrayBuffer();
      if (arr.byteLength === 0) {
        console.warn(`skip ${normalizedName}: empty`);
        skipped += 1;
        continue;
      }

      const hash = await dhash(Buffer.from(arr));

      results.push({
        itemId: item.inGameId,
        name: item.name,
        normalizedName,
        gridW: item.gridWidth,
        gridH: item.gridHeight,
        dhash: hash,
        iconUrl,
      });
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const hashed = results.length;
  const CHUNK = 500;
  for (let i = 0; i < results.length; i += CHUNK) {
    await db
      .insert(itemIconHashes)
      .values(results.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: itemIconHashes.itemId,
        set: {
          name: sql`excluded.name`,
          normalizedName: sql`excluded.normalized_name`,
          gridW: sql`excluded.grid_w`,
          gridH: sql`excluded.grid_h`,
          dhash: sql`excluded.dhash`,
          iconUrl: sql`excluded.icon_url`,
          updatedAt: sql`now()`,
        },
      });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itemIconHashes);

  console.log(`захэшено: ${hashed}, пропущено: ${skipped}`);
  console.log(`строк в item_icon_hashes: ${count}`);
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
