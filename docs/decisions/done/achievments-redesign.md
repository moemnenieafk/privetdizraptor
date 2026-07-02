---
status: ✅ Фазы 1-2 сделаны
affects: achievements
date: 2026-07-02
done: 2026-07-02
---
# Эпик: Раздел «Достижения» — редизайн + SMART-детали + трекинг

**Статус:** ✅ ОБЕ ФАЗЫ ОДОБРЕНЫ V4DYA 2026-07-02. Фаза 1 (редизайн+SMART) — `b004a58`; Фаза 2 (трекинг игрока) — `039f078`, миграция применена → [[#Исполнено — Фаза 2 (2026-07-02)]]. Отложенное вынесено в отдельную задачу → [[player-tracking-tab]] (единая вкладка «Трекинг»).
**Затрагивает:** `eft/progress/achievements/*` · `db/landing.ts` · `db/schema.ts` (Фаза 1a + 2) · крон `api/cron/sync-prices` · новый `features/achievements/*` · новый `lib/achievement-hints.ts` + `data/achievement-hints.ts` · Фаза 2: `store/useAchievementStore.ts` + `api/eft/achievement-progress` + `providers/ProgressSync.tsx` + `account/*`

## Цель
Раздел Достижений EFT сейчас сломан ([[#Почему сломано]]). Переделать в качественное детализированное отображение на паттернах `EftItemTile`. Каждое достижение открывается в **детальную страницу** с описанием, официальной редкостью/фракцией и **SMART-подсказкой «как получить»** — кросс-линки на боссов (кого убить и где искать), карты, торговцев, квесты. Правильный мобильный вывод. Позже (Фаза 2) — закрепить достижения за телеметрией игрока (ручной трекинг), показывать в Аккаунт Центре, привязка к игре.

## Что показала разведка (2026-07-02)

### Почему сломано
- **Битый путь иконок.** `AchievementsClient.tsx` грузит `/images/achievements/${id}.webp`, а файлы лежат в `/images/achievements/eft/${id}.webp` → все иконки 404. **Главный баг.**
- **Выдуманная редкость.** Код лепит 4 тира из процентов произвольными порогами (`getRarity`), хотя в игре тиров 3.
- Иконок локально **111**, достижений в API **110** — свести (1 сирота/лишняя).

### Данные tarkov.dev богаче, чем наше зеркало
Живая интроспекция типа `Achievement` (2026-07-02). Зеркалим только первые 5 из 11:

| поле | зеркалим? | что даёт |
|---|---|---|
| `id`, `name`, `description`, `hidden`, `playersCompletedPercent` | ✅ да | текущее |
| `rarity` / `normalizedRarity` | ❌ нет | **офиц. редкость**: common 27 / rare 23 / legendary 60 |
| `side` / `normalizedSide` | ❌ нет | **фракция**: pmc 51 / scavs 1 / all 58 |
| `adjustedPlayersCompletedPercent` | ❌ нет | скорректированная метрика редкости |
| `imageLink` | ❌ нет | офиц. арт (у нас уже есть локальные webp — не нужен) |

Всего 110 достижений, 31 скрытое, диапазон выполнения 0.01%…48.9%.
⚠️ `side` = PMC/Scav/All, **не** USEC/BEAR. Профиль игрока USEC/BEAR — оба это PMC; фракцию не дробить.

### SMART-подсказка — реальность
Структурных «как получить» в API **нет**, описания короткие (~46 симв.). НО из текста извлекается многое:
- **Boss-килл** (сильный кейс, ~15 шт.): «Впервые убить **Санитара**/**Штурмана**/**Тагиллу**/**Партизана**/**Решалу**…» — имена 1:1 совпадают с `src/data/bosses.ts` (21 босс: портрет, HP, угроза, локация). → авто-линк на карточку босса + «где искать» + линк на карту.
- **Карта**: «на локации **Завод**/**Лес**» → линк на карту.
- **Торговец / цепочка**: «задания **Прапора**», «цепочка заданий **Лыжника**» → линк на торговца/квесты; событийные («Масленица 2024», «Загадочное в Таркове») — часто нет в наших данных → **ручной оверрайд**.
→ Отсюда решение «Гибрид»: авто-матч по именам + файл ручных оверрайдов.

### Переиспользуемые куски (пути абсолютные)
- **Плитка/сетка:** `src/components/features/items/EftItemTile/{EftItemTile,Media,Name,Header}.tsx`; тинт редкости `src/lib/tarkov-colors.ts`; сетка `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4`.
- **Детальная страница (эталон — выбранный формат):** `src/app/eft/items/item/[slug]/{page.tsx,ItemDetailLayout.tsx}` — двухколоночный layout, hero + модульные секции.
- **Кросс-линки:** Next `<Link>`; `/eft/questmap?quest=<id>`; `/eft/maps/{slug}?quest=<id>`; `/eft/items/item/{normalizedName}`; хелперы `src/lib/quest-map-link.ts`, `src/lib/map-quests.ts`.
- **Данные для подсказок:** `src/data/bosses.ts` (боссы), таблицы `maps`/`traders` в БД, квесты — tarkov.dev/`src/data/story-quests/*`.
- **Трекинг (Фаза 2, эталон):** `src/store/useQuestStore.ts` (`toggleQuest`), таблица `quest_progress` (`src/db/schema.ts`), `src/app/api/eft/progress/route.ts`, `src/components/providers/ProgressSync.tsx`, `src/lib/cta-api.ts`, Аккаунт Центр `src/app/account/{AccountCenter.tsx,page.tsx}` (`getAccountStats`).
- **Источник данных сейчас:** `src/db/landing.ts` → `syncEftLandingData()` (QUERY + upsert) и `getEftAchievements()` + `AchievementDTO`; крон `src/app/api/cron/sync-prices/route.ts` (vercel.json `0 5 * * *`).

## Развилки — решено V4DYA (2026-07-02)
| Развилка | Решение |
|---|---|
| Объём | **Фазами, фронт вперёд.** Опасные миграции трекинга — только Фаза 2. |
| Детальный вид | **Отдельная страница** `/eft/progress/achievements/[id]` (шарится ссылкой, богаче), НЕ drawer. |
| SMART-подсказка | **Гибрид:** авто-матч (boss/map/trader по имени) + файл ручных оверрайдов для событийных/хитрых. |
| Редкость | **3 официальных тира + фракция** из API; `% игроков` остаётся отдельной статой. Требует аддитивной миграции (Фаза 1a). |

**Механика трекинга (Фаза 2):** публичного API «ачивки игрока» в Tarkov нет → только **ручной тоггл**, как в трекере квестов. Иного пути нет.

---

## Фазы

### Фаза 1a — обогащение зеркала (backend, аддитивная миграция) ⚠️ подтверждение db:push
Цель: чтобы UI мог читать офиц. редкость/фракцию из НАШЕЙ БД (по BACKEND AUTONOMY фетч на запрос запрещён).
1. `src/db/schema.ts` — в таблицу `achievements` добавить колонки: `rarity`, `normalizedRarity`, `side`, `normalizedSide` (text, nullable), `adjustedPlayersCompletedPercent` (real, nullable). Аддитивно, без потери данных.
2. `src/db/landing.ts` — расширить `QUERY` (`achievements{ … rarity normalizedRarity side normalizedSide adjustedPlayersCompletedPercent }`), маппинг в insert + `onConflictDoUpdate set`, и `AchievementDTO` + `getEftAchievements()`.
3. Применить: `npm run db:push` → **сразу** `npm run db:sql` (реаппли RLS). Прогнать крон/синк, чтобы новые колонки наполнились.
4. Гард: **db:push — необратимо**, запуск только после ручного «ок» от V4DYA.

### Фаза 1b — фронт-редизайн (без опасных миграций)
1. **Фикс иконок** — путь `/images/achievements/eft/${id}.webp` (+ хелпер по аналогии с `item-icon.ts`, задел под R2/Supabase).
2. **Сетка/плитки** на паттерне `EftItemTile` — иконка-медаль как герой, тинт по офиц. редкости, значок фракции, `% игроков`, бейдж «скрытое» (блюр для hidden). Сетка `1/2/3/4`.
3. **Редкость** — 3 тира из `normalizedRarity` (common/rare/legendary) + токены цветов; убрать `getRarity` по процентам.
4. **Фильтры/сорт** в `AchievementsClient` — по редкости, фракции, hidden/visible, поиск; сорт по редкости/%.
5. **Детальная страница** `src/app/eft/progress/achievements/[id]/page.tsx` (RSC) + client-layout по эталону item-detail: hero (иконка, имя, редкость, фракция, %, hidden) + описание + блок **«Как получить»**.
6. **SMART-подсказка (гибрид):** `src/lib/achievement-hints.ts` — авто-резолвер (скан name/description → матч на `bosses.ts` nameRu / maps / traders); `src/data/achievement-hints.ts` — ручные оверрайды `Record<id, { boss?, map?, trader?, quest?, tip? }>`. Рендер: чипы/карточки кросс-линков (босс → карточка+карта, карта, торговец, квест).
7. **Мобилка** по скиллу `cta-mobile` (карточки 1-в-ряд <640px; детальная страница адаптив).
8. `reader` на одно достижение — `getEftAchievement(id)` в `db/landing.ts`.
9. Приёмка: `tsc` чисто; иконки грузятся; редкость/фракция офиц.; деталь открывается и показывает ≥1 рабочий кросс-линк на boss-килл достижении; мобилка.

### Фаза 2 — трекинг игрока (backend + стор + синк + Аккаунт Центр) ⚠️ db:push
1. `src/db/schema.ts` — таблица `achievement_progress` (PK `user_id`+`game_id`, `tracked_ids jsonb`, `completed_ids jsonb`, `updated_at`). RLS owner-only (`supabase/*.sql`).
2. `src/store/useAchievementStore.ts` — persist, `toggleTracked` / `toggleCompleted` / `loadProgress` (зеркало `useQuestStore`).
3. `src/app/api/eft/achievement-progress/route.ts` — GET/PUT, userId из сессии, upsert (зеркало `progress/route.ts`).
4. `src/components/providers/ProgressSync.tsx` + `src/lib/cta-api.ts` — гидрация/дебаунс-сейв.
5. Аккаунт Центр — вкладка/виджет «Достижения» (выполнено X/110, распределение по редкости); `getAccountStats`.
6. UI на плитке/детали — тоггл «выполнено»/«отслеживаю».
7. Применить: `db:push` → `db:sql` (после ручного «ок»).

## Границы
- **В scope:** раздел `eft/progress/achievements` (список + детальная страница + подсказки + мобилка); Фаза 1a обогащение `achievements`; Фаза 2 трекинг.
- **НЕ трогаем:** `EftItemTile` и items (только читаем паттерн, не правим); `bosses.ts`/`maps`/`traders`/квесты (только читаем для линков); трекинг квестов/бартеров; чужие крон-синки (только добавляем поля в achievements-часть); фракцию НЕ дробим на USEC/BEAR (side = PMC/Scav/All).
- **Автономность (§4.11):** UI читает только нашу БД; никаких рантайм `api.tarkov.dev`. Новые поля — через зеркало + крон.

## Критерий готовности (детерминированный)
- **Фаза 1a:** `tsc` чисто; после синка в `achievements` заполнены `rarity/side/…`.
- **Фаза 1b:** `tsc`/build ок; страница `/eft/progress/achievements` рендерит иконки (0 × 404); редкость = офиц. 3 тира; деталь `/[id]` открывается; на boss-килл достижении есть кликабельный линк на босса+карту; мобилка не ломается.
- **Фаза 2:** `tsc` ок; тоггл сохраняется в БД (per user/game) и переживает релогин; Аккаунт Центр показывает счётчик.

## Гарды
- **Масштаб:** большой эпик, 3 фазы. Каждая — отдельный PR/приёмка.
- **Ручное подтверждение:** `db:push` в Фазе 1a (аддитив, низкий риск) и Фазе 2 (новая таблица). Необратимо → одна строка «ок» перед запуском. Порядок всегда `db:push` → `db:sql`.

---

## Исполнено (2026-07-02) — Фаза 1a + 1b
Через цепь docs→code (скиллы `execute-decision` + `cta-backend` + `nightfall`). `tsc --noEmit` чисто.

**Фаза 1a — обогащение зеркала (backend):**
- `src/db/schema.ts` — в `achievements` добавлены колонки `rarity`, `normalized_rarity`, `side`, `normalized_side` (text), `adjusted_players_completed_percent` (real).
- `src/db/landing.ts` — расширены `QUERY`, `RawAchievement`, insert + `onConflictDoUpdate`, `AchievementDTO`; вынесен `toAchievementDTO`; добавлен reader `getEftAchievement(id)`.
- Применено: `db:push` (аддитив, БЕЗ потери данных) → `db:sql` (RLS восстановлен на всех таблицах) → `db:sync-landing`. **Наполнено 110 достижений**: rarity {common 27, rare 23, legendary 60}, side {pmc 51, all 58, scavs 1}.

**Фаза 1b — фронт-редизайн:**
- `src/lib/achievement-icon.ts` — **фикс битых иконок** (`/images/achievements/eft/<id>.webp`, был путь без `/eft/` → 404) + фолбэк.
- `src/lib/achievement-visuals.ts` + `globals.css` — тип `AchievementView` (client-safe) + `rarityMeta`/`sideLabel`/`RARITY_RANK`. **Цвета редкости выверены V4DYA по градации Таркова** (токены в `@theme`, маппинг — в visuals.ts):
  - легендарное `--color-rarity-legendary` #BDA550 (Каппа); обычное — серый text-secondary.
  - редкое: **подложка плитки** = тёмный `--color-rarity-rare` #4C2A55 /30; **бейдж/текст** = светлый `--color-rarity-rare-badge` #A069AF (читаемость).
  - **бейдж редкости** = пилюля: подложка /10 + обводка /50 + текст цвета редкости. Подложка плитки = цвет /30; рамка легендарного /70.
  - все бейджи `text-type-micro`; пара «фракция + %» = `text-text-primary/70`.
- Медиаконтейнер иконки — БЕЗ фона/рамки/тени (правка V4DYA по Figma): иконка `object-contain` «плавает» на подложке плитки. В гриде, таблице и на детальной.
- `src/lib/achievement-hints.ts` + `src/data/achievement-hints.ts` — **SMART-подсказка (гибрид)**: авто-резолвер (стем-матчинг имён боссов/карт/торговцев) + файл ручных оверрайдов. Проверено на живых данных: **38/110 авто-связей** (boss 26, trader 9, map 6); падежи ловятся (Тагиллу→tagilla, Санитара→sanitar, «на локации Завод»→factory, Лыжнику→skier).
- `AchievementsClient.tsx` — переписан: грид+таблица, офиц. редкость + фракция, фильтры (редкость/фракция/видимость/сорт/поиск), плитки-ссылки на деталь, блюр скрытых + **«зажать глазик» (hold-to-reveal)** раскрывает контент карточки, пока держишь (pointer-события + pointer-capture, не триггерит переход по ссылке). Убран нерабочий `getRarity`-по-процентам.
- `src/app/eft/progress/achievements/[id]/{page.tsx,AchievementDetail.tsx}` — **детальная страница** (RSC): hero (иконка+редкость+фракция+%+hidden) + описание + блок «Как получить» с кросс-линками (босс→карточка+портрет→`/eft/gamesetting/bosses/<slug>`, карта→`/eft/maps/<nn>`, торговец→`/eft/quests/<nn>`).
- Мобилка вшита (грид 1-в-ряд <640px, hero стекается, фильтры flex-wrap) по канону `cta-mobile`.

**Приёмка V4DYA — ✅ ПРИНЯТО 2026-07-02** (`npm run dev`):
- [x] `/eft/progress/achievements` — иконки грузятся (0 × 404), 3 тира редкости + фракция, фильтры/сорт/поиск, грид+таблица
- [x] клик по плитке → деталь `/[id]`; на boss-килл достижении — кликабельная карточка босса
- [x] скрытые — блюр + «зажать глазик» (hold-to-reveal) раскрывает контент карточки
- [x] мобилка не ломается
- [x] бейджи редкости (пилюли подложка/10 + обводка/50): легендарное #BDA550, редкое #A069AF, обычное серое

**Доработки по приёмке (V4DYA, 2026-07-02):** легендарное → #BDA550 (Каппа); рарный бейдж → светлый #A069AF (тёмный #4C2A55 только подложка плитки); медиаконтейнер иконки без фона (иконка плавает); все бейджи `text-type-micro`; «фракция + %» = `text-primary/70`; обводка бейджей фракции `text-primary/25`; глазик/«Скрытое» = `text-primary/50`; статы «Выполнили/С поправкой» = `text-primary/50`; hold-to-reveal на карточке.

**Открытый мелкий вопрос:** лейбл scavs — «Дикие» (сейчас) vs «Дикий».

## Исполнено — Фаза 2 (2026-07-02)
Ручной трекинг достижений (публичного API «ачивки игрока» в EFT нет). Зеркало трекера квестов. `tsc` чист; миграция применена (`db:push`→`db:sql`, RLS восстановлен).

- **БД:** таблица `achievement_progress` (PK user+game, `completed_ids`/`tracked_ids` jsonb) + `supabase/achievement-progress-rls.sql` (owner-only).
- **Стор:** `src/store/useAchievementStore.ts` (`completed`+`tracked`, persist `cta-achievement-progress`).
- **API:** `src/app/api/eft/achievement-progress/route.ts` (GET/PUT из сессии) + `getCtaAchievementProgress`/`saveCtaAchievementProgress` в `cta-api.ts`.
- **Синк:** `src/components/providers/AchievementSync.tsx` (гидрация на логине + дебаунс-сейв), смонтирован в `app/layout.tsx`.
- **UI:** `src/components/features/achievements/AchievementTrackToggle.tsx` — compact «выполнено» ✓ в шапке плитки, full «выполнено+отслеживаю» на детали. Фильтр «скрыть выполненные», счётчик выполненных. mounted-гард от hydration-mismatch. Цвет выполненного = `--color-success`.
- **Аккаунт Центр:** стата «Достижений: N» (`getAccountStats` + `achievement_progress`); сброс прогресса чистит таблицу + ключ localStorage.
- **Доработка фильтров (V4DYA):** панель фильтров переведена на стиль раздела «Предметы» — плоский бар + кастомные `FilterDropdown` (портирован из `CategoryControlBar`), прозрачные тогглы/переключатель вида.

**Не сделано (осознанно, на потом):** отдельная вкладка «Достижения» в Аккаунт Центре с разбивкой по редкости; кураторка ручных hint-оверрайдов сверх авто-38/110.

---
*Процесс: [[engineering-loop]]*
