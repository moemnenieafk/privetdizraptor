---
status: 🔵 спека — промоут HD-Завода в боевую карту (исполнение поэтапно, решение V4DYA 2026-08-13)
affects: maps, config, r2, cron, supabase
date: 2026-08-13
---
# Промоут: HD-Завод → боевая карта Завод (`factory`)

**Цель.** HD-карта Завода (16K тайлы + editorial-метки, сейчас превью `/eft/maps/factory-hd`)
становится БОЕВОЙ картой `/eft/maps/factory`. Старая интерактивная (Shebuka SVG) удаляется.

## ⚠️ Блокер прода — снять ПЕРВЫМ
Тайлы **21 849 файлов / 56 МБ** в `.gitignore` (мастер-арт тоже) → на Vercel из git их нет.
Промоут без R2 = карта Завод на живом сайте ПУСТАЯ (тайлы 404). 22k файлов в git класть нельзя.
R2 у нас есть (креды + `upload-maps-r2.ts` как образец).

## Порядок исполнения (каждый шаг — проверка перед следующим; ⛔ = НЕОБРАТИМО)

### Шаг 1 — R2-хостинг тайлов [снимает блокер, обратимо]
- Новый `scripts/upload-tiles-r2.ts` (образец `upload-maps-r2.ts`, S3Client готов): залить
  `public/maps/factory/tiles/**` на R2, ключ `maps/factory/tiles/{floor}/{z}/{y}/{x}.jpg`,
  immutable-кэш. ~22k объектов — батч-заливка с конкурентностью.
- `MapViewerClient.tsx:1520` — tileLayer URL `/maps/${tileBase}/tiles/…` → префикс из env
  (`NEXT_PUBLIC_MAP_BASE_URL`, тот же, что уже отдаёт иконки/SVG-карты из R2). Одна точка.
- Проверка: `curl` R2-URL тайла = 200; на превью тайлы грузятся с R2 (Network → r2.dev).
- Обратимо: env-переключение назад на `/public`.

### Шаг 2 — config промоут [обратимо в ветке]
- `eft-map-config.ts`: блок `factory` → перенести поля `factory-hd` (`staticMap:true`,
  `tileBase:"factory"`, `tileExt`, `tilePixelSize`, `editorial:true`, `bounds`, `minZoom/maxZoom`,
  `groundTile`, `tileVersion`). Убрать интерактивные поля старого factory (`svgFile:"Factory.svg"`,
  `transform`, `coordinateRotation`).
- Проверка: `/eft/maps/factory` рендерит тайлы+editorial локально; этажи, drawer'ы, визард.

### Шаг 3 — метки: 🔑 РАЗВИЛКА V4DYA ⛔ (SQL по БД)
Сейчас: боевой `factory` — **синканные** метки (`source='sync'`, крон-автообновление из
tarkov.dev, BSG map_id). HD-Завод — наши **editorial** метки (спроецированные + твоя выверка,
`source='user'`, `map_id='factory-hd'`). После промоута выбрать модель Завода:
- **(A) Полностью editorial (курируемый)** — рекоменд., т.к. HD-метки уже курируешь: editorial
  переносим на `map_id='factory'`; синканные factory скрываем/не рендерим; синк factory отключаем.
  ➕ полный контроль, твоя ручная выверка. ➖ метки не автообновляются из игры (поддержка вручную).
- **(B) Гибрид** — синканные (авто-свежесть) + editorial поверх (override/дополнение).
  ➕ автообновление. ➖ сложнее, ручная выверка конфликтует с автопозициями.
- Перенос (после выбора): SQL `update markers set map_id='factory' where map_id='factory-hd'` +
  строка `maps`. `dump:factory-hd` ПЕРЕД — бэкап.

### Шаг 4 — крон [следствие Шага 3]
- (A): пропустить `factory` в `syncEftMapsGeometry` (не синкать его метки) — иначе крон вернёт
  синканные. (B): оставить как есть.

### Шаг 5 — роутинг [обратимо]
- `/eft/maps/factory` → HD (определяется config'ом после Шага 2, доп. кода не надо).
- Редирект `/eft/maps/factory-hd` → `/eft/maps/factory` в `next.config.ts` (старые ссылки/скилл-
  референсы на превью-slug не 404-ят). Обновить slug в скриптах/сидах (`factory-hd`→`factory`).

### Шаг 6 — удаление старой ⛔
- Shebuka `Factory.svg`: R2 (`maps/eft/factory.svg`) + `public/images/maps/eft/Factory.svg`.
- Старые синканные метки factory (если (A)) — удалить или оставить скрытыми.
- Делать ТОЛЬКО после подтверждения, что HD работает на проде (Шаг 7).

### Шаг 7 — мерж main + деплой + верификация прода ⛔ (пуш main)
- Мерж `feat/factory-hd-tiles` → `main` → Vercel auto-deploy.
- Верификация на ЖИВОМ сайте: `/eft/maps/factory` открывается (тайлы с R2), метки, drawer'ы
  (поиск/ключи/квесты), этажи, визард под админом.
- Откат: revert merge + redeploy (тайлы на R2 остаются, безвредны).

## Риски / гарды
- **§5 необратимое** — подтверждение перед: мержем main, удалением старой карты, SQL-переносом меток.
- **Прод-крон на ОБЩЕЙ БД** до деплоя крутит старый код; строку `maps` защищает триггер
  `protect-custom-maps.sql`. Промоут на BSG-id `factory` уберёт фрагильность slug-id `factory-hd`.
- **R2 immutable-кэш**: при перенарезке тайлов бампать `tileVersion` (`?v=`).
- **Slug-переход**: старые `/factory-hd` → редирект (Шаг 5).

## Критерий готовности
- [ ] Тайлы на R2, карта грузит их (не `/public`) — локально + прод.
- [ ] `/eft/maps/factory` = HD (тайлы+editorial), рендер + drawer'ы + этажи + визард.
- [ ] Метки по выбранной модели (A/B); синк согласован.
- [ ] Старая карта удалена, редирект `factory-hd→factory`.
- [ ] Мерж в main, ЖИВОЙ сайт верифицирован.

## Журнал исполнения

**Шаг 1 ✅ (2026-08-13)** — R2-хостинг тайлов. `scripts/upload-tiles-r2.ts` (+ `npm run db:upload-tiles-r2`);
залито **21 848** тайлов в R2 (`cta-media`, ключ `maps/factory/tiles/{floor}/{z}/{y}/{x}.jpg`, immutable), 0 ошибок.
Вьюер `MapViewerClient.tsx:1520` — префикс `mapAssetBase` (`src/lib/map-image.ts`); curl тайлов всех 4 этажей на z=6 = 200.
⚠️ **Отклонение от спеки:** переменная **`NEXT_PUBLIC_MAP_TILE_BASE_URL`** (не общая `NEXT_PUBLIC_MAP_BASE_URL`), т.к.
SVG-подложки ещё НЕ на R2 (проверено — 404) → общий флип положил бы их в 404. Фолбэк на общую сохранён. Прод-env — Шаг 7.

**Шаг 2 ✅ (2026-08-13)** — config-промоут. Блок `factory` = поля `factory-hd` (тайлы/этажи/`editorial`/HD-bounds),
Shebuka-поля сняты. `factory-hd` блок пока жив (снимет Шаг 5). Побочно: дедуп `navMaps` в `page.tsx` ×2 (промоут в
`staticMap` дал бы дубль `factory` БД+конфиг в нав-дропдауне — тот же приём, что на индексе). Верифицировано в браузере:
`/eft/maps/factory` рендерит HD-тайлы, этаж-свитчер, drawer'ы, визард; typecheck 0; консоль без ошибок.

**Шаг 3 ✅ (2026-08-13) — модель (A) полностью editorial (выбор V4DYA «A го»).** Бэкап ПЕРВЫМ:
`npm run dump:factory-hd` → **446 меток** в `scripts/data/factory-hd-markers.snapshot.json` (container 161, loot 144,
spawn 82, quest_zone 42, extract 9, lock 5, transit 3). Перенос — `scripts/promote-factory-markers.ts` (dry-run по
умолчанию, `--apply`, `--rollback`; гварды). Открытия при исполнении: (1) синканные метки живут в `markers` под **BSG-id**
(`source='sync'`), editorial — под slug (`map_id='factory-hd'`); в `markers` для slug 'factory' было 0 sync → «прятать»
нечего, тайл-ветка их и так не читает. (2) «+ строка maps» из спеки = реально нужно: у `maps` не было slug-строки
`id='factory'` (синканный сидит под BSG-id) → скрипт создал её (FK-анкор editorial, параллельно `factory-hd`).
Итог: `maps 'factory'` создана, **446 user-меток `factory-hd`→`factory`**, sync не тронут. Верифицировано в браузере:
`/eft/maps/factory` = HD-тайлы + полный набор меток (выходы/боссы/квесты/ключи/лут). Откат: `--rollback` + `restore:factory-hd`.

**⚠️ Шаг 3.5 (критично, вне спеки) — защита строки maps от прод-крона.** Общая БД: `maps 'factory'`,
которую создал Шаг 3, попадала под `pruneStale(maps)` в `syncEftLandingData` (ЧАСОВОЙ крон `/api/cron/sync-prices`) —
удаление строки → FK `ON DELETE CASCADE` снёс бы все 446 меток ДО деплоя keep-фикса. Закрыто: триггер
`supabase/protect-custom-maps.sql` расширен на `('factory-hd','factory')` и **применён на БД** (`npm run db:sql`,
проверено: функция содержит 'factory', триггер enabled). Плюс код-фикс `landing.ts` `CUSTOM_MAP_IDS=['factory-hd','factory']`
(эффект после деплоя; триггер — немедленный DB-гард). Это и есть «гарда триггером», заложенная в разделе Риски.

**Шаг 5 ✅ (2026-08-13) — роутинг + чистка.** Редирект `/eft/maps/factory-hd→/eft/maps/factory` (`next.config.ts`,
активен после рестарта/деплоя). Конфиг-блок `factory-hd` удалён (поля уже в `factory`); `build-map-tiles.mjs`
`configSlug→'factory'`. Верифиц.: индекс `/eft/maps` — 14 карт, `factory-hd` нет, `factory` без дубля; typecheck 0.
Хвост Ш5 ✅: `dump/restore-markers-hd.ts` переключены `MAP_ID='factory'` (футган снят — dump теперь бэкапит боевой
`factory`, файл `scripts/data/factory-markers.snapshot.json` = 446, старый `factory-hd-markers.snapshot.json`
сохранён как историч. бэкап до промоута). Имена npm-скриптов (`dump:factory-hd`/`restore:factory-hd`) НЕ переименованы —
широко зареференсены в заметках/скриптах, менял бы кучу ссылок; таргет-slug внутри важнее имени-алиаса. Историч.
one-time скрипты (seed/calibrate/project) оставлены намеренно.

**Арт-апдейт (2026-08-13)** — V4DYA обновил визуал земли; ре-нарезка `tiles:factory` (21 844 тайла, 4 этажа) →
R2 re-upload (21 848, 0 ошибок, хеш-сверка ground-тайла local==R2 ✓) → `tileVersion 5→6`. Попутно фикс `build-map-tiles.mjs`
`bumpVersion`: ловил только ключ в кавычках (`"factory-hd":`), после промоута ключ без кавычек (`factory:`) → теперь оба.
Метки выровнены (мастер вернули к канону 16384² после промашки с Figma «Clip content»).

**Осталось:** Ш4 крон (пропуск factory в `syncEftMapsGeometry` — гигиена, в связке с Ш6),
Ш6 удаление ⛔ (Shebuka `Factory.svg` R2+public; синканные/строка factory-hd) — после прод-верифа,
Ш7 мерж main + деплой + прод-вериф ⛔ (пуш main + Vercel env `NEXT_PUBLIC_MAP_TILE_BASE_URL`).
Всё в рабочем дереве ветки `feat/factory-hd-tiles`, НЕ закоммичено.

*Статус: ничего не закоммичено (общее рабочее дерево); ветка `feat/factory-hd-tiles`. Бэкап-снапшот на диске (не в git).*

---
*Процесс: [[engineering-loop]] · родитель: [[factory-map-detail-test]] (эпик HD-Завод) · решение V4DYA
2026-08-13 «HD становится Заводом, старую удалить» → поэтапно с проверками.*
