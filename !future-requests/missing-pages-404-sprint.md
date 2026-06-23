# СПРИНТ: закрыть все 404 и реализовать недостающие страницы EFT

> **Переносимый спринт-план** (копия одобренного плана). Если в текущем чате кончились лимиты —
> открой новый чат Клода, прочитай этот файл и продолжай с нужной фазы. Отмечай прогресс ✅.
> Источник-план: `~/.claude/plans/smooth-zooming-zephyr.md`.
>
> **Статус фаз:** Phase 0 ✅ · Phase 1A (сюжетка) ✅ · Phase 1B (трейдеры) ✅ · Phase 2 (price-slot/craft/bitcoin/needed/prestige + **loot-tier 2.6 ✅**) ✅ · Phase 3 (боссы) ✅ · Phase 4 (карты) ⬜ блокер-данных.
>
> ## Журнал (день 3)
> - **loot-tier (2.6) — ГОТОВО (build green, ○ Static).** Кодировка `LootRateClient.tsx` восстановлена: файл был равномерным double-encoding мохибейком (UTF-8→прочитан как cp1251→пересохранён в UTF-8). Развернул `text.encode('cp1251').decode('utf-8')`; единственный неразворачиваемый символ — заглавная «И» (байт `0x98` не определён в cp1251, 3×: ПОИСК/Изображение/Итог) — пропатчен через ASCII-плейсхолдер. Записан UTF-8 без BOM, верифицирован байт-ассертами (16/16 меток, ноль мохибейка/control-символов).
> - **Тир-режим** свёрнут в `/eft/items/loot-rate` (toggle «Тиры» → бейдж S/A/B/C/D + пилюли-фильтр поверх готовых фильтров/сорта; тир по `vps`). Тир-логика вынесена в `src/lib/loot-tier.util.ts` (Tier/пороги 40k/20k/10k/5k/0/цвета/`tierOf`); `PriceSlotClient` отрефакторен на неё — дубликат устранён.
> - **Полноэкранный квест-таск — ГОТОВО (build green, ƒ; runtime 200/404 проверены).** Тело `QuestDrawer` вынесено в общий `src/components/features/quests/QuestDetail/` (проп `variant: 'drawer'|'page'` — контейнер/размеры/нав-экшен; всё состояние+стор+auto-complete внутри, `dedupedObjectives` через `useMemo`). `QuestDrawer` теперь тонкая обёртка (slide-анимация+панель+close). Новый RSC-роут `/eft/quests/task/[id]` (`.find` в `EFT_QUESTS`, `notFound`, back-ссылка «Квесты»). Deep-link: в дровере иконка «развернуть» → страница; на странице «Карта» → `/eft/questmap?quest=<id>`.
> - **HP боссов — ГОТОВО для всех 15 (build green, SSG; runtime проверен).** Тянул авторитетные значения по зонам из tarkov.dev GraphQL (`bosses { health }`) разово для авторинга статики. Хелпер `bossHp(head,chest,stomach,arm,leg)` заменил `STANDARD_HP`. Добавил HP 10 боссам (kaban/kollontai/partisan/zryachiy/bigpipe/birdeye/knight/sektant/thewedge/shadowoftagilla) **+ исправил 5 существующих** — они были PMC-плейсхолдерами (killa 440→890, tagilla 510→1220, shturman 440→812, gluhar 540→1010, sanitar 440→1270). Лор не тронут (diff-классификация + targeted-скрипт).
> - **Кодекс-лор (сюжетный батч 4+2) — ГОТОВО (build green; runtime 6/6 = 200).** Тип `src/types/codex.ts` + self-contained `CodexArticle` (шапка-глиф, лид, вертикальный таймлайн, секции, related, плашка достоверности). Ветвление `gamesetting/[slug]` (статья → шаблон, иначе заглушка). 4 статьи `src/data/codex/{lore,timeline,factions,corporations}.ts` — контент через research-воркфлоу `codex-lore-research` (8 агентов: research→адверсариальный фактчек), сгенерён в TS скриптом из JSON (текст байт-точный, спекуляции помечены, без внешних ссылок). 2 индекс-лендинга `characters`/`materials`.
> - **Кодекс-лор добивка — ГОТОВО (build green; runtime 200).** Ещё 2 статьи через `codex-lore-research-2`: `locations.ts` «Локации» (8 секций, 11 карт) + `theories.ts` «Теории и загадки» (7 секций, формат «Канон/Подтверждено/Спекуляции» с явными пометками). Реестр `index.ts` пересобран на 6 статей. Осталось кодекса: audiotapes/docs-notes (нужны данные предметов).
> - **Backend `hideout_upgrades` — mirror ГОТОВ (db:push+db:sql+sync выполнены, RLS on).** Таблица `hideout_upgrades` (PK игра+станция+уровень; JSONB item/station/trader/skill requirements + constructionTime) в `schema.ts`; `supabase/hideout-upgrades-rls.sql`; `src/db/hideout.ts` `syncEftHideout()` (upsert-only); `scripts/sync-hideout.ts` + `db:sync-hideout`. **26 станций → 68 строк** засинхрено из tarkov.dev, форма JSONB и RLS проверены.
> - **needed-убежище агрегатор — ГОТОВО (build green ○ Static; runtime 200).** `getHideoutNeeds()` в `src/db/hideout.ts` (RSC-чтение зеркала, join имён из `items`, валюта ₽/€/$ исключена). Таб-переключатель `NeededTabs` (Квесты | Убежище) на `/eft/progress/needed`; `HideoutNeededClient` — шопинг-лист (поиск/сорт, разворот → станция+уровень+кол-во). **Квесты=256, Убежище=116** позиций. Завершает Phase 2.4 (без трекинга «построено» — нет hideout-стора, это будущий шаг).
>
> ## Журнал (день 2, автономно — pushed на main)
> - **Phase 1B** — `QuestTraderList` (реюз `QuestNode`+`QuestDrawer`), `computeStatusMap`→`src/lib/quest-status.ts`; `/eft/quests/<трейдер>`. Карта квестов цела.
> - **Phase 2.2** — `craft-profit` (чипы станций, ₽/час, разворот вход/выход).
> - **Phase 2.1** — `price-slot` (топ-500 ₽/слот, тиры S–D, налог+модификаторы убежища реактивно, вердикт торговец/барахолка).
> - **Phase 2.4** — `needed` (агрегатор предметов активных квестов; часть убежища — позже, нужна `hideout_upgrades`).
> - **Phase 2.3** — `bitcoin-profit` (формула 145000/(1+(GPU−1)*0.041225), окупаемость, цены из зеркала).
> - **Phase 2.5** — `prestige` (требования/награды/сброс-перенос; пороги патч-зависимы).
> - Коммиты: 4df487e, 68b5d57, 9eeda3d, a676de4.
 - **Кодекс — Торговцы** (03e74cd) — `/eft/gamesetting/traders` индекс + детали (11, досье+кросс-ссылка на квесты). `src/data/traders.ts`.
> - ⬜ Осталось:
>   - craft-profit гейты (надстройка на `hideout_upgrades`); needed-убежище трекинг «построено» (нужен hideout-стор); Phase 4 карты → `map_assets`/`map_markers`+изображения; кодекс: audiotapes/docs-notes → данные предметов.
>
> ## Журнал выполнения (автономная сессия)
> **✅ Phase 0 — заглушки (build green):** `src/components/ui/SectionPlaceholder.tsx`, `src/lib/section-nav.ts`,
> маршруты `eft/maps/[slug]`, `eft/quests/[slug]`, `eft/gamesetting/[slug]`, `eft/videos/[category]`,
> `eft/progress/loadouts/[action]`, `eft/progress/hideout/[metric]`, `eft/progress/{needed,prestige}`,
> `eft/items/price-slot`, `[game]/[[...rest]]` (реюз `PlaceholderPage`+`GAMES_DATA`). Все ~60 404 закрыты.
> Удалены мёртвые `src/components/page.tsx` и `src/components/features/page.tsx` (последний тянул tarkov.dev).
>
> **✅ Phase 1A — сюжетные квесты (build green):** `src/types/story-quest.ts`, компонент
> `src/components/features/quests/StoryQuestGuide/`, данные всех 10 глав `src/data/story-quests/*` (из
> `docs/.../Руководство_Сюжетных_Квестов_Tarkov_2.md`), ветвление в `eft/quests/[slug]/page.tsx`
> (глава→гайд / трейдер·события→заглушка). Хаб `lore-quests` уже ссылается на гайды. Hero — заглушки.
> Видео встроены где сопоставление надёжно.
>
> **✅ Phase 3 — боссы (build green, SSG):** `src/types/boss.ts`, `src/data/bosses.ts` (15 боссов: лор +
> «почему стал таким» по всем; HP по 7 зонам у всех 15 — источник tarkov.dev, день 3),
> `eft/gamesetting/bosses/page.tsx` (индекс) + `bosses/[slug]/page.tsx` + `components/features/bosses/BossDetail.tsx`.
>
> **⬜ Осталось (требует тебя / рантайма / данных):**
> - Phase 1B — трейдерские списки на `QuestNode` (нужен вынос статус-логики из `QuestMapClient`; риск без рантайм-проверки).
> - Phase 2 — калькуляторы price-slot/craft/bitcoin (данные в зеркале, но математику надо проверить на живой БД; price-slot трогает общий `barter-calc`).
> - Phase 2.4/2.5 — «Нужные предметы» (нужна таблица `hideout_upgrades`), «Престиж» (навыки/статик-данные).
> - Phase 3 — кодекс: торговцы + остальной лор; HP оставшихся боссов из крона.
> - Phase 4 — карты (блокер: нет `map_markers`/изображений; нужны mirror-таблицы + хостинг).
> - Примечание: параллельной бэкенд-сессии НЕТ — schema.ts/db:push/крон ведёт эта же (фронт) сессия.

---

## Context (зачем)

Дерево меню `src/data/headerConfig.ts` описывает ~**60 путей без `page.tsx`** — все падают в глобальный `not-found.tsx`. Это не краши, а **тупики**: живой пункт меню → стена без навигации.

Граф `graphify-out/` показал: 60 страниц схлопываются в ~11 файлов (паттерн `items/[...category]` + god-узлы-реюзы), квест/прогресс-подсистемы почти готовы в коде.

**Решения (зафиксированы):**
1. Стратегия: **сначала убить ВСЕ 404 умной заглушкой** → потом реальные фичи.
2. Приоритет реала: **1) Квесты → 2) Прогресс-инструменты → 3) Кодекс → 4) Карты**.
3. Другие игры: **одна общая заглушка-лендинг**.
4. Архитектура: **динамические маршруты** (мирроринг items-catch-all).

---

## ⚠ ОГРАНИЧЕНИЕ: АВТОНОМНЫЙ БЭКЕНД
EFT-данные **полностью зеркалятся в Supabase**. **Запрещены рантайм-вызовы `api.tarkov.dev`** (страницы/компоненты/actions). Источники: Drizzle `getEftCatalog()`+`getEftPriceMapFromDb()`, HTTP `cta-api.ts`, иконки `itemIconUrl()`, таблицы `barters/crafts/achievements/maps/traders`. Нужен датасет, которого нет → mirror-таблица + синк (работа **бэкенд-сессии**, `schema.ts`+`db:push` ведёт только она). Единственная точка контакта с tarkov.dev — крон `/api/cron/sync-prices`. `/tarkov-api` — НЕ для фронта.

---

## Карта 404
| Группа | Кол-во | Закрытие |
|---|---|---|
| Карты | 14 | `maps/[slug]` |
| Квесты (трейдеры 11 + сюжетные 10 + события 1) | 22 | `quests/[slug]` |
| Кодекс/лор | 12 | `gamesetting/[slug]` |
| Видео | 4 | `videos/[category]` |
| Прогресс (needed, loadouts/{my,find,add}, hideout/{craft-profit,bitcoin-profit}, prestige) | 6 | статика + `[action]`/`[metric]` |
| Цена за слот | 1 | статика-оверрайд (catch-all сейчас рендерит пустой каталог) |
| Другие игры | 7+ | `[game]/[[...rest]]` |

`/eft/quests/events` и `/eft/progress/needed` — **мёртвые карточки на хабе** `src/app/eft/page.tsx`.

---

# PHASE 0 — Убить ВСЕ 404 (умная заглушка) · данных не требует ⏳

### `src/components/ui/SectionPlaceholder.tsx` (новый, server-friendly, без client-state)
Шапка раздела (иконка+заголовок+описание+табы) + панель «Раздел в разработке» (стиль `not-found.tsx`), хлеб-крошки работают сами (`breadcrumbNames` уже полон). Props: `title, description?, iconUrl?/iconClass?, tabs?[], activeHref?`. Токены NIGHTFALL.

### Маршруты-заглушки (тонкие RSC: `findNodeByPath` → табы → `<SectionPlaceholder/>`)
| Файл | Ловит |
|---|---|
| `eft/maps/[slug]/page.tsx` | 14 карт |
| `eft/quests/[slug]/page.tsx` | 22 квеста |
| `eft/gamesetting/[slug]/page.tsx` | 12 кодекс |
| `eft/videos/[category]/page.tsx` | 4 видео |
| `eft/progress/loadouts/[action]/page.tsx` | my/find/add |
| `eft/progress/hideout/[metric]/page.tsx` | craft-profit/bitcoin-profit |
| `eft/progress/needed/page.tsx` · `eft/progress/prestige/page.tsx` · `eft/items/price-slot/page.tsx` | статика |
| `[game]/[[...rest]]/page.tsx` | др. игры → реюз `PlaceholderPage` (гард: не eft и есть в HEADER_DICTIONARY) |

**Итог: 1 компонент + 10 маршрутов = все ~60 тупиков закрыты.**

---

# PHASE 1 — Квесты (реал) · список `QuestNode` + детальная страница ⬜
`QuestNode` (карточка) реюз ~85%, `QuestDrawer`→`QuestDetail` (деталь) ~100%. Источник — `EFT_QUESTS` (`src/data/quests/index.ts`).

`[slug]` ВЕТВИТСЯ: **трейдер** (prapor…) → список `QuestNode`; **сюжетная глава** (tour, ticket…) → **walkthrough-гайд**; **events** → события.

- Вынести `computeStatusMap`/`computeFilteredIds` (из `QuestMapClient`) → `src/lib/quest-status.ts` (список+карта).
- Вынести тело `QuestDrawer` → `src/components/features/quests/QuestDetail/index.tsx` (drawer на карте + полноэкранный `quests/task/[taskId]/page.tsx`).
- Деталь квеста: цели+чекбоксы (`ObjectiveRow`/`getObjIcon`), hero (`getQuestHeroImg`), `QuestItemTracker`, видео-гайд, награды, toggle complete/pin.
- Хабы: `side-quests` → списки трейдеров; `lore-quests` → карточки 10 глав → гайды.
- Автономия: иконки предметов через `itemIconUrl`, НЕ baked `assets.tarkov.dev`.

### Сюжетные квесты — walkthrough-гайды (отдельный шаблон)
**Контент ГОТОВ:** `docs/new-pages/Руководство_Сюжетных_Квестов_Tarkov_2.md` (полный разбор 10 глав: Тур, Небеса в огне, Билет[3 концовки], Случайный свидетель, Батя, Синий Огонь, Они уже здесь, Неизвестные, Лабиринт, Борей — с таблицами FIR, выборами, наградами). Видео — `docs/new-pages/Сюжетные-квесты-доп-инфа.md`. Hero — **заглушки** `/images/story-quests/placeholder.webp`.
- Перенести в `src/data/story-quests/*` по схеме `StoryQuestChapter` (slug · titleRu/En · chapterNumber · heroImage · summary · activation · prerequisites · steps[]{title,location,instructions,items[]{name,count,fir},mapHint,**mapLink**,warnings,videoGuidePremium?} · **branches[]** для Билета · rewards · achievement · videoGuides[] · sources[]). Тип `src/types/story-quest.ts`, компонент `StoryQuestGuide`.
- **Видео↔главы:** tour→`5HTLMMw2yn8` · heaven-on-fire→`cSSXGs1p1VY` · ticket→`R3qZa0B8gWk`(+`Ar0Mug7Wd64`/`A2S2YKVgGYI`) · witness→`lf_PCnb-T5A` · batya→`JpEeY6IBRZA` · blue-fire→`y1QgiNaLE4E` · already-here→`3pGpUgCeaUQ` · unknowns→`NgL9BOaAFqs` · boreas→`stgF5bO7rs4` · labyrinth→уточнить.
- YouTube-embed можно; wiki-ссылки в продукт НЕ выводим (агрегатор).

---

# PHASE 2 — Прогресс-инструменты (реал) ⬜
Все читают **только зеркало**. Готовность: 2.1/2.2/2.3 — ✅ данные есть; 2.4/2.5 — нужны mirror-данные.

### 2.1 Цена за слот — `/eft/items/price-slot`
Спек `docs/architecture/03 …Цена за слот.md` (налог барахолки, арбитраж торговец/барахолка, модификаторы убежища, цвета подложки). Метрика = ЧистаяПрибыль/(W×H). Тиры S≥40к·A20–40к·B10–20к·D<10к. 2 режима (verdict-card моб / ранж-список десктоп). Реюз `tarkov-colors`,`formatters`,`item-indicators.util`,`barter-calc`(+модификаторы в `calcFleaFee`),`getEftPriceMapFromDb`. Новое `src/lib/price-slot.util.ts`, `VerdictCard`/`PriceSlotRow`/`HideoutConfigPanel`. Mirror-гэпов нет.

### 2.2 Прибыль крафта — `/eft/progress/hideout/craft-profit`
**Icon-driven**, группировка по станциям (иконки `public/icons/eft/04-progression/hideout-modules/*` — все 25). Метрика **₽/час** (дефолт-сорт). Чипы станций (иконка+имя+счётчик), таблица по станции (иконка в заголовке), разворот строки = вход/выход/налог, флаг «запускаемо сейчас» (`usePlayerStore` уровень + наличие). «Worth it» 🟢>20к/🟡5–20к/⚪<5к/❌убыток/🔒гейт. Реюз `BartersClient`(виртуал-таблица; `TraderAvatar`→станц.иконка), `barter-calc`, `formatters`. Новое `src/lib/craft-calc.ts`, `StationChips`, `CraftProfitClient.tsx`. Mirror-гэпы: топливо, навык «Управление убежищем», крафты-за-квестом.

### 2.3 Прибыль Bitcoin — `/eft/progress/hideout/bitcoin-profit`
Цена BTC/GPU из `prices`. Формула добычи — **уточнить коэффициенты**. Слайдер GPU + карточки метрик (BTC/сутки, время/коин, окупаемость GPU, прибыль/сутки, ±10%). Новое `src/lib/bitcoin-calc.ts`, `BitcoinProfitClient.tsx`.

### 2.4 Нужные предметы — `/eft/progress/needed`
Агрегатор «осталось собрать» (квесты + убежище), группировка по предмету. Квесты — `getActiveItemRequirements()` (готово). Убежище — **нужна mirror `hideout_upgrades`**. Реюз `QuestItemTracker`,`ItemTrackerClient`,`EftItemTile`. Новое `NeededItemsClient.tsx`. До таблицы — только квестовая часть.

### 2.5 Престиж — `/eft/progress/prestige`
Табы по уровням: требования → награды → сбрасывается/переносится. Реюз `usePlayerStore`,`AchievementsClient`. Новое статич. `prestige-requirements.json`/`prestige-rewards.json`, `PrestigeClient.tsx`. Нужны навыки игрока (из `/api/profile-ocr` или расширить стор). Делать последним.

### 2.6 Рейтинг предметов (loot-tier) — ✅ ГОТОВО (build green)
Toggle «Тиры» в `/eft/items/loot-rate`: тир-бейдж S/A/B/C/D + пилюли-фильтр поверх готовых фильтров/сорта (НЕ отдельный раздел). Тир по `vps` (₽/слот). Тир-логика — общий `src/lib/loot-tier.util.ts` (реюз в price-slot). Шкала 5-уровневая S/A/B/C/D (пороги 40k/20k/10k/5k/0). OCR/Jarvis — премиум-роадмап.

---

# PHASE 3 — Кодекс/лор (реал) · `gamesetting/[slug]` ⬜
12 страниц. **Боссы и торговцы — первыми** (ассеты есть: 15 портретов `public/images/bosses/eft/`, 12 `traders/eft/`).

### Страница босса (`/eft/gamesetting/bosses/[slug]`) — HP по зонам + лор
HP по 7 частям тела (Голова/Грудь/Живот/Л+П рука/Л+П нога — раздуты vs PMC 35/85), боевой лут, спавн-карты+шанс, **достоверный лор + «почему стал таким»**.
- Данные → mirror `bosses`: `{ normalizedName, nameRu/En, portrait, health[]{bodyPart,maxHp,armorClass?}, totalHp, armor, weapon, followers[], spawnMaps[]{map,chance}, lore, motivation, confidence, sourceRefs }`. HP/спавн — синк tarkov.dev (крон); **лор — наш research-контент (готов по 15)**.
- Реюз: `EftItemTile`-бейджи, `ProgressBar` (HP-бары), `SectionPanel`, токены угрозы.
- Лор: богатый — Killa, Tagilla, Glukhar, Sanitar, Kaban, Kollontai, Partisan, The Wedge; скудный (короче+пометка) — Shturman, Zryachiy, Big Pipe, Birdeye, Knight, Cultist Priest, Shadow of Tagilla.

Остальной кодекс (lore/timeline/factions/corporations/locations/materials/theories) — текст/арт нет → **запрос бэкенду** на mirror/CMS, фронт рендерит шаблон по `[slug]`.

---

# PHASE 4 — Карты (реал) · `maps/[slug]` ⚑ ТРАФИК-ДРАЙВЕР ⬜
Эталон реализации — **tarkov.dev (open-source)**: Leaflet + `L.CRS.Simple`, image-overlay/тайлы, grouped-layer-control, мульти-этаж, мульти-терм поиск, permalink, localStorage. У MapGenie берём quicksearch + sidebar-фильтры со счётчиками + «отметить найденным».

### Боли → фиксы (дифференциаторы)
1. Перегруз маркерами → кластеризация + умные дефолты (Выходы+Спавны ON, остальное OFF).
2. «Какой выход с моего спавна/фракции?» → **фильтр спавн→выход** (клик спавна подсвечивает валидные выходы) + фильтр фракции.
3. Перекрытие подписей → иконки-маркеры + zoom-адаптив.
4. Платные/особые выходы → бейджи 🟢бесплатно/🟡$/⚡флаер/⏱таймер/🔴фракция + тултип.
5. Моб/2-й монитор · 6. Интерактивная легенда · 7. Квест-слой · 8. Рендер только видимых + «обновлено Xч».

### Тех-стек
Leaflet через `next/dynamic ssr:false`. Реюз `QuestMapViewport` (tween/transform как референс), `getEftMaps()`, `TacticalCartography`. Маркеры — новый `MapMarker`. «Найдено»+пины — localStorage. Файлы: `eft/maps/[slug]/page.tsx`(RSC) + `MapViewerClient`+`MapMarker`/`MapLayerPanel`/`FloorSwitcher`/`MapLegend`/`MapSearch`.

### ⚑ БЛОКЕР ДАННЫХ (бэкенд)
`maps`-таблица = только метаданные. Нужны: `map_assets` (image/bounds/transform), `map_floors` (этажи/height-extents), `map_markers` (тип/position{x,y,z}/faction/requirement/linked_item_id/linked_quest_id/categories), хостинг изображений (R2/Storage). Фронт строит shell+UI против контракта.

### Связка квест↔карта + премиум-видео
Шаги walkthrough → `mapLink` (deep-link `?focus=<markerId>`) на маркер цели (слой «КВЕСТЫ», `map_markers.linked_quest_id`). Двунаправленно. Премиум: видео-гайд на каждую цель (за подпиской).

### Фазировка
v1 image-overlay + Выходы/Спавны (+спавн→выход) · v2 Лут/Ключи/Боссы/Опасности+кластеры+квест-слой+поиск+мульти-этаж · v3 кастом-пины/share/live-позиция/сквад.

---

## Премиум-роадмап (за подпиской, позже)
- Loot-tier: OCR (YOLO) → оценка инвентаря → AI «Jarvis» (RAG).
- Карты/квесты: премиум-видео-гайды на каждую цель.
- Карты v3: live-позиция, сквад-синк.
Все за слоем auth/подписки (бэкенд).

## Backend-координация (mirror-таблицы — бэкенд-сессия; фронт НЕ трогает schema.ts)
- `hideout_upgrades` (Нужные предметы + уровни станций).
- Крафты: `fuel`, `taskUnlock` + навык «Управление убежищем» (net-прибыль/гейты в 2.2).
- Навыки игрока + `prestige_requirements`/`prestige_rewards`.
- `bosses` (HP по зонам + спавн из крона; лор — наш контент), `traders`, далее `lore`/`factions`/`locations`/… .
- **Карты:** `map_assets`, `map_floors`, `map_markers` + хостинг изображений.
- (опц.) `quests` mirror вместо статич. `EFT_QUESTS`.

## Реюз (reuse-first)
- Маршрут: `eft/items/[...category]/page.tsx` (`findNodeByPath`).
- Данные (зеркало): `getEftCatalog`, `getEftPriceMapFromDb`, `cta-api.ts`, `itemIconUrl`.
- `PlaceholderPage` (др.игры); `HubNav` (образец шапки); `headerConfig` (+`breadcrumbNames`); `pageContent`.
- Квесты: `QuestNode`, `QuestDrawer`→`QuestDetail`, `QuestItemTracker`, `computeStatusMap`/`computeFilteredIds`.
- Таблицы: `BartersClient`, `barter-calc`, `formatters`, `tarkov-colors`, `item-indicators.util`.
- Сторы: `useQuestStore`, `usePlayerStore`, `useItemsStore`, `useFavoritesStore`, `useBreadcrumbStore`.

## Verification
1. `npm run dev` → 1–2 пути каждой группы: раздел открывается с шапкой/крошками/табами, не глобальный 404.
2. Хаб `/eft`: «События» и «Нужные предметы» — не тупик.
3. `/eft/items/price-slot` — заглушка, не пустой каталог.
4. `/frago`,`/gzw` → `PlaceholderPage`; мусор → глобальный 404.
5. `npm run build` + `npx tsc --noEmit` чисто (запрет `any`).
6. Аудит автономии: `api.tarkov.dev` нет в `src/app`+`src/components` (кроме крона).
