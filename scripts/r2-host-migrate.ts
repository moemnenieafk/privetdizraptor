// Разовая миграция зашитых в БД абсолютных URL ассетов со старого публичного адреса
// бакета R2 (`pub-<id>.r2.dev`) на кастомный домен `cdn.cta.quest`.
//
// Зачем: ТСПУ режет домен `r2.dev` по SNI — у RU-аудитории не грузилась НИ ОДНА картинка
// (bugs/done/2026-09-02-2137--assets-r2-blocked-in-russia.md). Все резолверы в коде строят
// URL из env, поэтому им хватило смены переменной. Но CMS-медиа (`media_assets.url`) и
// тела статей хранят АБСОЛЮТНЫЙ URL в данных — env на них не действует.
//
// Скан идёт по ВСЕМ текстовым/json-колонкам public-схемы, а не по заранее известному
// списку таблиц: список устареет на первой же новой фиче, а пропущенная колонка — это
// битая картинка в проде.
//
//   npx tsx scripts/r2-host-migrate.ts            # только показать, что найдено
//   npx tsx scripts/r2-host-migrate.ts --apply    # выполнить UPDATE
//
// ⚠️ Требует SSH-туннель к БД: `bash ~/cta-provision/dev.sh` (порт 5432 закрыт наружу, §4.13).
import { config } from "dotenv";
config({ path: ".env.local" });

const OLD_HOST = "pub-0969d515fb064d119680c2d311607c29.r2.dev";
const NEW_HOST = "cdn.cta.quest";

type Hit = { table_name: string; column_name: string; data_type: string; cnt: number };

async function main() {
  const apply = process.argv.includes("--apply");
  const postgres = (await import("postgres")).default;
  const url = process.env.DATABASE_URL_SESSION;
  if (!url) throw new Error("DATABASE_URL_SESSION не задан");

  const sql = postgres(url, { prepare: false, onnotice: () => {} });

  // query_to_xml — единственный способ посчитать по динамически собранному имени колонки
  // в обычном SELECT (без plpgsql-цикла и временных таблиц).
  const hits = (await sql.unsafe(`
    SELECT table_name, column_name, data_type, cnt FROM (
      SELECT c.table_name, c.column_name, c.data_type,
        (xpath('/row/cnt/text()', query_to_xml(
          format('select count(*) as cnt from %I.%I where %I::text like ''%%${OLD_HOST}%%''',
                 c.table_schema, c.table_name, c.column_name),
          false, true, '')))[1]::text::int AS cnt
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
       AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = 'public'
        AND c.data_type IN ('text', 'character varying', 'json', 'jsonb')
    ) s WHERE cnt > 0 ORDER BY cnt DESC
  `)) as unknown as Hit[];

  if (hits.length === 0) {
    console.log(`Ни одной строки с «${OLD_HOST}» не найдено — мигрировать нечего.`);
    await sql.end();
    return;
  }

  const total = hits.reduce((s, h) => s + h.cnt, 0);
  console.log(`Найдено ${total} строк в ${hits.length} колонках:\n`);
  for (const h of hits) {
    console.log(`  ${h.table_name}.${h.column_name} (${h.data_type}) — ${h.cnt}`);
  }

  if (!apply) {
    console.log(`\nЭто был сухой прогон. Для записи: npx tsx scripts/r2-host-migrate.ts --apply`);
    await sql.end();
    return;
  }

  console.log(`\nПрименяю замену «${OLD_HOST}» → «${NEW_HOST}»…`);
  for (const h of hits) {
    // json/jsonb приводим к тексту и обратно: replace по строке покрывает URL на любой
    // глубине вложенности, а структуру документа не трогает.
    const cast = h.data_type === "json" || h.data_type === "jsonb" ? `::text` : "";
    const back = h.data_type === "json" || h.data_type === "jsonb" ? `::${h.data_type}` : "";
    const res = await sql.unsafe(
      `UPDATE public."${h.table_name}"
          SET "${h.column_name}" = replace("${h.column_name}"${cast}, '${OLD_HOST}', '${NEW_HOST}')${back}
        WHERE "${h.column_name}"::text LIKE '%${OLD_HOST}%'`,
    );
    console.log(`  ✓ ${h.table_name}.${h.column_name} — ${res.count} строк`);
  }

  await sql.end();
  console.log("Готово.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
