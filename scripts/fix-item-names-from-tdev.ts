// Фикс RU-имён предметов EFT из СТАТИК-ДАМПА json.tarkov.dev (§4.12 — разовый засев
// зеркала, НЕ рантайм-зависимость). Чинит мангл новых 1.1.0-предметов: у них в нашем
// зеркале английское имя + shortName = «первые 2 слова» (источник items_database.json
// был экспортнут, когда tarkov.dev ещё не отдавал RU-локаль).
//
// ☑ БЕЗОПАСНО ЗАПУСКАТЬ В ЛЮБОЙ МОМЕНТ: два гейта — (1) дамп должен отдавать РЕЗОЛВНУТЫЕ
//   имена (не ключи «<id> Name»: backend tarkov.dev периодически лежит → тогда аборт),
//   (2) должно быть достаточно кириллицы (иначе это не RU-дамп → аборт). Пока tarkov.dev
//   не оживёт — скрипт просто откажет, ничего не тронув.
//
// Патчит ТОЛЬКО предметы, где у НАС имя без кириллицы (EN/мангл), а у tarkov.dev — RU.
// Уже-русские имена и предметы без RU у tarkov.dev не трогает.
//
// Запуск: npm run db:fix-names   (или: npx tsx scripts/fix-item-names-from-tdev.ts)
// Язык:   TDEV_LANG=ru (дефолт). gameMode фиксирован regular.
import { config } from "dotenv";
config({ path: ".env.local" });

const LANG = process.env.TDEV_LANG || "ru";
const URL = `https://json.tarkov.dev/regular/items?lang=${LANG}`;
const cyr = (s: string | null | undefined) => /[а-яё]/i.test(s || "");

async function main() {
  console.log(`Источник: ${URL}`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`json.tarkov.dev HTTP ${res.status}`);
  const j: any = await res.json();
  const rawItems = j.data?.items ?? j.items;
  const list: any[] = Array.isArray(rawItems) ? rawItems : Object.values(rawItems || {});
  const withName = list.filter((x) => x.name && !/ Name$/.test(String(x.name)));
  const withCyr = list.filter((x) => cyr(x.name));
  console.log(`дамп: ${list.length} предметов | с реальным именем ${withName.length} | с кириллицей ${withCyr.length}`);

  // ── ГЕЙТЫ безопасности ──
  if (withName.length < list.length * 0.5) {
    console.error("❌ дамп отдаёт КЛЮЧИ («<id> Name») — backend tarkov.dev лежит. Ничего не патчу.");
    process.exit(2);
  }
  if (withCyr.length < 200) {
    console.error(`❌ мало кириллицы (${withCyr.length}) — это не RU-дамп (проверь TDEV_LANG=${LANG}). Ничего не патчу.`);
    process.exit(2);
  }

  const byId = new Map<string, any>(list.map((x) => [String(x.id), x]));
  const { db } = await import("../src/db/index.ts");
  const { items } = await import("../src/db/schema.ts");
  const { eq, and } = await import("drizzle-orm");
  const { eftGameId } = await import("../src/db/eft.ts");
  const gameId = await eftGameId();

  const ours = await db
    .select({ ig: items.inGameId, name: items.name, short: items.shortName })
    .from(items)
    .where(eq(items.gameId, gameId));

  let fixed = 0;
  for (const o of ours) {
    if (cyr(o.name)) continue; // у нас уже RU — не трогаем
    const t = byId.get(o.ig);
    if (!t || !cyr(t.name)) continue; // у tarkov.dev нет RU для этого id
    await db
      .update(items)
      .set({ name: t.name, shortName: t.shortName ?? o.short })
      .where(and(eq(items.gameId, gameId), eq(items.inGameId, o.ig)));
    console.log(`  ${o.ig}  «${o.name}» → «${t.name}» (${JSON.stringify(t.shortName)})`);
    fixed++;
  }
  console.log(`\n✅ обновлено RU-имён: ${fixed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
