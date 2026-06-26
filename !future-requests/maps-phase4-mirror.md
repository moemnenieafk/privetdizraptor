# Phase 4 — Интерактивные карты EFT: дизайн mirror-слоя

> Статус: **ПРОЕКТ** (design-only). НИКАКОЙ `db:push` в этом заходе. Схему/план согласуем с Вадимом ДО наката.
> Синтез разведотчётов A1–A4 (см. «Источники разведки» в конце).
> Дата: 2026-06-23.

---

## 1. РЕЗЮМЕ

### Физибилити: **GO** (с одним лицензионным гейтом)

Гипотеза из брифа подтверждена всеми четырьмя разведотчётами: блокер «нет данных/хостинга» снимается тем же self-mirror паттерном, что и 5044 иконки + prices/barters/crafts. Технических блокеров нет.

**Разделяем два класса артефактов (разный режим):**
- **Геометрия маркеров** (координаты выходов/спавнов/лута/замков/переключателей/опасностей/боссов) — берётся из GraphQL `Map`, лицензионно чистая (MIT/MIT-0, факты-координаты, как prices/barters). **GO без оговорок.**
- **Картинки-подложки карт** (SVG) — авторские произведения (Shebuka/Jindouz/re3mr) под спорной лицензией (A2: CC BY-NC-SA 4.0 NonCommercial; A4: репо tarkovdata вообще без LICENSE-файла, 404). **Это единственный реальный гейт — решение за Вадимом.**

### 3–5 главных решений (рекомендации)

1. **Геометрию маркеров зеркалим в Postgres** новой таблицей `map_markers` (+ `map_assets` для рендер-конфига, опц. `map_floors`). Объём тривиален: **~17.8k строк regular** (vs существующие mirror-таблицы того же порядка). Доминирует loot (77%) — в MVP loose-loot прячем за галочкой → ~11.2k строк.
2. **Формат картинок — SVG-вектор** (11 файлов, **~1.7–2 MB на ВСЕ карты**, многоэтажность бесплатно через `<g>`-группы). НЕ растровые тайлы (сотни файлов/карта), НЕ JPG+3D (78 MB) — для MVP избыточно.
3. **Хостинг картинок — рекомендуется Cloudflare R2** (нулевой egress навсегда; карты = traffic-driver, узкое место — bandwidth, не storage). Допустимая альтернатива для MVP — `cta-media` (~2 MB, копейки storage, но Supabase Free даёт лишь 10 GB egress/мес). Решение за Вадимом.
4. **Рендер — Leaflet + `L.CRS.Simple`** через `next/dynamic({ssr:false})` (правило 6). Эталон — tarkov-dev (MIT, логику можно портировать). НЕ тянем самописный `QuestMapViewport` — берём из него только паттерны (`tween`, zoom-to-cursor) на случай отказа от Leaflet.
5. **Рендер-конфиг проекции (`transform`/`bounds`/`coordinateRotation`/`heightRange`) НЕ в GraphQL** — это рукописный конфиг tarkov-dev (`src/data/maps.json`). Заводим у себя: либо jsonb-колонки в `map_assets`, либо статика `src/data/eft-map-config.ts` (11 записей — это параметры НАШЕГО рендера, не игровые данные).

### Оценка объёма работ

- **Данные/бэкенд:** ~средне. 1 новая таблица-семья (3 таблицы) + 1 синк-функция + 1 RLS-файл + 1 sync-скрипт + 1 upload-скрипт + 1 URL-хелпер. Паттерн полностью отработан (barters/crafts/icons).
- **Фронт:** ~высокая часть. Leaflet-интеграция с нуля (новая зависимость), кастомная проекция (transform + поворот), мульти-этаж (height-ranges), слои-фильтры, поиск. Самое сложное — привязка world-coords к SVG и многоэтажность.
- **Новая зависимость:** `leaflet` + `@types/leaflet` (единственный новый рантайм-пакет, согласовать).

---

## 2. MIRROR-СХЕМА (Drizzle, эскиз)

> Опирается на реальные поля из A1 (GraphQL `Map`) и форму конфига из A2 (`maps.json`).
> PK-паттерн как у существующих таблиц. gameId-скоуп через FK→`games` (cascade). RLS read-only.
> Геометрия в jsonb — это lowest-friction first cut (зеркалит источник 1:1, как barters/crafts слоты).

### 2.1 `map_assets` — per-map рендер-конфиг + ключ изображения

Расширяет существующую `maps` (НЕ заменяет — `maps` остаётся parent-метаданными). FK на `maps.id`.

```ts
export const mapAssets = pgTable("map_assets", {
  mapId:              text("map_id").primaryKey()
                        .references(() => maps.id, { onDelete: "cascade" }),
  gameId:             uuid("game_id").notNull()
                        .references(() => games.id, { onDelete: "cascade" }),
  normalizedName:     text("normalized_name").notNull(),   // slug = ключ в maps.json

  // ── ключ изображения в Storage/R2 (как itemIconUrl) ──
  imageKey:           text("image_key"),        // "maps/eft/{normalizedName}.svg"
  imageFormat:        text("image_format"),      // "svg" | "png-tiles" | "jpg"
  projection:         text("projection"),        // "interactive" | "static" | "3D"

  // ── параметры проекции (из maps.json, НЕ из GraphQL) ──
  transform:          jsonb("transform").$type<[number, number, number, number]>(),
                        // [scaleX, offsetX, scaleZ/scaleY, offsetZ/offsetY]
  coordinateRotation: integer("coordinate_rotation"),      // 0/90/180/270
  bounds:             jsonb("bounds").$type<[[number, number], [number, number]]>(),
                        // [[y1,x1],[y2,x2]] углы холста L.CRS.Simple
  heightRange:        jsonb("height_range").$type<[number, number]>(),  // [min,max] game-Y дефолт-этажа
  minZoom:            integer("min_zoom"),
  maxZoom:            integer("max_zoom"),
  tileSize:           integer("tile_size"),                // если растровые тайлы
  svgLayer:           text("svg_layer"),                   // id <g>-группы = дефолтный этаж

  // ── атрибуция (load-bearing, A4) ──
  author:             text("author"),                      // "Shebuka" | "Jindouz" | "re3mr"
  authorLink:         text("author_link"),

  // ── метаданные карты (миграция из расширенного Map) ──
  raidDuration:       integer("raid_duration"),            // минуты
  players:            text("players"),                     // "8-12"
  minPlayerLevel:     integer("min_player_level"),
  maxPlayerLevel:     integer("max_player_level"),

  syncedAt:           timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});
```

> Альтернатива: эти поля можно влить прямо в `maps` (jsonb `render_config` + скаляры). Рекомендация — **отдельная `map_assets`**: держит «тяжёлый» рендер-конфиг отдельно от лёгкой `maps`, которую читает лендинг-виджет, и не ломает существующий `getEftMaps()`.

### 2.2 `map_floors` (опц.) — per-floor слои/высоты для мульти-этажа

Из `maps.json` `layers[]`. Можно начать с jsonb-массива в `map_assets.layers` и вынести в таблицу позже. Эскиз нормализованной формы:

```ts
export const mapFloors = pgTable("map_floors", {
  mapId:        text("map_id").notNull()
                  .references(() => maps.id, { onDelete: "cascade" }),
  floorKey:     text("floor_key").notNull(),     // svgLayer id, напр. "Ground_Level"
  gameId:       uuid("game_id").notNull()
                  .references(() => games.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),          // "Ground_Level" / "Underground"
  show:         boolean("show").default(true).notNull(),  // дефолт-видимость
  heightMin:    integer("height_min"),           // extents[].height[0] (game-Y)
  heightMax:    integer("height_max"),           // extents[].height[1]
  orderIdx:     integer("order_idx").default(0).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.mapId, t.floorKey] }),
}));
```

> **Рекомендация для v1:** НЕ заводить `map_floors` сразу — хранить `layers[]` как jsonb на `map_assets`. Нормализовать в v2, когда мульти-этаж попадёт в скоуп.

### 2.3 `map_markers` — геометрия всех маркеров (ядро)

Discriminated union по `type`. Координаты в jsonb (raw Unity world coords). PK — composite `(mapId, id)` (id из GraphQL для extract/transit/lock/switch; для spawn/loot/hazard, где id нет — генерим стабильный hash от position+type при синке).

```ts
export const mapMarkers = pgTable("map_markers", {
  mapId:        text("map_id").notNull()
                  .references(() => maps.id, { onDelete: "cascade" }),
  id:           text("id").notNull(),            // GraphQL id ИЛИ synth-hash
  gameId:       uuid("game_id").notNull()
                  .references(() => games.id, { onDelete: "cascade" }),

  type:         text("type").notNull(),
                  // "extract" | "spawn" | "transit" | "hazard"
                  // | "loot_container" | "loot_loose" | "lock" | "switch"
                  // | "boss" | "stationary_weapon" | "btr_stop" | "artillery"

  // ── позиция: x,z = ground-plane, y = высота (мульти-этаж) ──
  position:     jsonb("position").$type<{ x: number; y: number; z: number }>(),
  outline:      jsonb("outline").$type<{ x: number; y: number; z: number }[]>(),  // полигон зоны
  top:          real("top"),                     // вертикальный Y-экстент зоны
  bottom:       real("bottom"),

  label:        text("label"),                   // name / zoneName
  faction:      text("faction"),                 // extract: "all"|"pmc"|"scav"
  sides:        jsonb("sides").$type<string[]>(),         // spawn: ["pmc"]|["scav"]|["all"]
  categories:   jsonb("categories").$type<string[]>(),    // spawn: ["bot"]|["player"]|["boss"]|["sniper"]

  // ── связи (опц., для квест-слоя / тултипов) ──
  linkedItemId: text("linked_item_id"),          // lock.key.id / lootContainer.id / transferItem
  linkedQuestId: text("linked_quest_id"),        // зарезервировано под квест-слой (v2)

  // ── тип-специфичная нагрузка (зеркало 1:1) ──
  meta:         jsonb("meta").$type<Record<string, unknown>>(),
                  // extract: { switches:[{id,name}], transferItem:{id,name,count} }
                  // transit: { description, conditions, destinationMap:normalizedName }
                  // hazard:  { hazardType }
                  // lock:    { lockType, needsPower, keyName }
                  // switch:  { switchType, activatedBy:{id,name}, activates:[{operation,target}] }
                  // boss:    { spawnChance, spawnTime, spawnTrigger, portrait, spawnLocations:[{spawnKey,name,chance}], escorts:[...] }

  syncedAt:     timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.mapId, t.id] }),
  byMapType: index("map_markers_map_type_idx").on(t.mapId, t.type),
}));
```

**Inferred-типы** (экспортнуть рядом со schema.ts:411–416):
```ts
export type MapAssetRow = typeof mapAssets.$inferSelect;
export type NewMapAssetRow = typeof mapAssets.$inferInsert;
export type MapMarkerRow = typeof mapMarkers.$inferSelect;
export type NewMapMarkerRow = typeof mapMarkers.$inferInsert;
// + MapFloorRow если заведём
```

### 2.4 RLS — `supabase/maps-geometry-rls.sql` (новый)

Образец `supabase/landing-rls.sql` (3 строки на таблицу). Подхватится `db:sql` по алфавиту.

```sql
-- map_assets
alter table public.map_assets enable row level security;
create policy "map_assets_read_all" on public.map_assets for select using (true);

-- map_markers
alter table public.map_markers enable row level security;
create policy "map_markers_read_all" on public.map_markers for select using (true);

-- map_floors (если заведём)
alter table public.map_floors enable row level security;
create policy "map_floors_read_all" on public.map_floors for select using (true);
```

### 2.5 Боссы — важная оговорка (A1)

`BossSpawnLocation` = `{spawnKey, name, chance}` — **именованная зона со шансом, БЕЗ координат**. Маркер босса на холсте ставится кросс-референсом `spawnKey` → `spawns[].zoneName`. То есть боссы в v2: либо отдельный список «возможные боссы» в панели (без пина), либо пин по zone-центроиду спавнов с тем же `zoneName`. **Открытый вопрос рендера, не данных.**

---

## 3. СИНК

### 3.1 Форма функции — новый `src/db/maps.ts` → `syncEftMapsGeometry()`

Образец — `src/db/barters-crafts.ts` целиком (НЕ расширяем `landing.ts` — там лёгкий метаданный синк, геометрия его раздует). Источник запроса — sample-query из A1 (раздел b), проверен против живой схемы 2026-06-23.

Ключевые моменты запроса (A1, caveat):
- `maps(lang: ru)` **не принимает id-аргумент** → тянем ВСЕ карты, фильтруем клиентски. Один запрос = вся геометрия всех карт (payload большой ~522 KB, но один раз за крон — ок).
- `lang: ru` для отображаемых строк; геометрия language-independent.
- Поля геометрии брать из A1 / скилла `/tarkov-api` — НЕ угадывать.

```ts
// src/db/maps.ts (эскиз)
const ENDPOINT = "https://api.tarkov.dev/graphql";

interface RawMapPosition { x: number; y: number; z: number; }
interface RawMapSpawn { zoneName: string; sides: string[]; categories: string[]; position: RawMapPosition; }
// ... типизированные Raw* для extracts/transits/hazards/locks/switches/loot/bosses (без any)

export async function syncEftMapsGeometry(): Promise<{
  assets: number; markers: number; pruned: number; skipped: boolean;
}> {
  const gameId = await getEftGameId();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY /* sample из A1 */ }),
    cache: "no-store",
  });
  const { data } = await res.json();

  // 1. upsert map_assets (метаданные карты; transform/bounds/rotation — см. п.3.3)
  // 2. flatten все категории маркеров → NewMapMarkerRow[]
  //    (для spawn/loot/hazard без id → synth-hash от type+position)
  // 3. chunked onConflictDoUpdate с sql`excluded.*`
  // 4. pruneStale(mapMarkers, mapMarkers.id, mapMarkers.gameId, gameId, keepIds, "maps-geometry")
  //    + pruneStale(mapAssets, ...)
}
```

### 3.2 Прюн — переиспользуем `pruneStale` (landing.ts:23–41)

Сигнатура:
```ts
async function pruneStale(
  table: PgTable, idCol: PgColumn, gameCol: PgColumn,
  gameId: string, keep: string[], label: string,
): Promise<{ deleted: number; skipped: boolean }>
```
Гарды: `keep.length===0`→no-op; `keep < had*0.5`→skip+warn (защита от обрезанного ответа). `private` в landing.ts → **экспортнуть** оттуда (предпочтительно) ИЛИ скопировать inline (как barters-crafts.ts 178–208).

> ⚠️ Нюанс для `map_markers`: PK composite `(mapId,id)`, а `pruneStale` бьёт по одной id-колонке + gameId. Прюнить **по mapId-скоупу** (per-map keep-set), а не глобально — иначе межкарточные id-коллизии. Возможно нужен мини-вариант `pruneStaleScoped(table, idCol, scopeCol, scopeVal, keep, label)`. **Открытый вопрос имплементации.**

### 3.3 transform/bounds/rotation — НЕ из GraphQL (A1+A2)

GraphQL `Map` НЕ содержит `transform/bounds/coordinateRotation/heightRange/svgLayer/layers`. Источник — `maps.json` (the-hideout/tarkov-dev). Варианты заполнения `map_assets`:
- **(рекоменд.)** Завести статику `src/data/eft-map-config.ts` (11 записей, перенос полей проекции из `maps.json` вручную — это параметры НАШЕГО рендера) и при синке мёржить её в `map_assets` по `normalizedName`.
- Либо синк-скрипт читает локально склонированный `maps.json` один раз.

### 3.4 Точные шаги по рецепту A3

1. `schema.ts` — +`mapAssets`, +`mapMarkers` (+`mapFloors` опц.) ~стр.259; +inferred-типы ~стр.412.
2. `supabase/maps-geometry-rls.sql` — новый (п.2.4).
3. `npm run db:push` ЗАТЕМ СРАЗУ `npm run db:sql` — ⚠️ **НЕ в этом заходе**. push сносит RLS/FK/триггеры, db:sql восстанавливает идемпотентно. Только с подтверждения Вадима при нём на связи.
4. `src/db/maps.ts` — `syncEftMapsGeometry()` (образец barters-crafts.ts).
5. `scripts/sync-maps-geometry.ts` + npm `db:sync-maps-geometry` (образец `scripts/sync-landing.ts`).
6. `scripts/upload-map-assets.ts` + npm `db:upload-maps` (см. раздел 4).
7. `src/lib/map-image.ts` — `mapImageUrl()` (образец `item-icon.ts`).
8. `src/app/api/cron/sync-prices/route.ts` — best-effort блок (образец landing-блока стр.37–52): `try { geoRes = await syncEftMapsGeometry(); } catch(e){ console.error(...) }`, подмешать `...geoRes` в ответ. Best-effort: сбой геометрии не роняет прайс-синк.
9. `src/db/landing.ts` — добавить читалку `getEftMapGeometry(slug)` (RSC, try/catch→fallback).
10. `src/app/eft/maps/[slug]/page.tsx` — заменить `SectionPlaceholder` на RSC→Leaflet-loader.

---

## 4. ЗАЛИВКА ИЗОБРАЖЕНИЙ

### 4.1 Откуда берём (A2)

- **SVG-подложки:** репо `the-hideout/tarkov-dev-svg-maps`, CDN `https://assets.tarkov.dev/maps/svg/{Name}.svg`. **11 файлов, ~1.7 MB всего** (Streets 320 KB, Shoreline 322 KB — крупнейшие; Factory 29 KB — мелкий). Этажи = `<g>`-группы внутри файла.
- Растровые тайлы (`assets.tarkov.dev/maps/{key}_{ver}/main/{z}/{x}/{y}.png`, tileSize 256) — опц. оптимизация, НЕ для MVP.

### 4.2 Скрипт — `scripts/upload-map-assets.ts` (образец `scripts/upload-icons.ts`)

1:1 паттерн: `bucket.list` пачками по 1000 (резюм), worker-pool concurrency 20, `bucket.upload(upsert:true)`, `SUPABASE_SERVICE_ROLE_KEY`. Сначала скачать 11 SVG в `public/images/maps/eft/`, потом залить.

**Бакет/ключи:**
- **cta-media** (MVP-вариант): ключ `maps/eft/{normalizedName}.svg` (мульти-этаж внутри SVG → один файл/карта; если когда-то порежем на растровые этажи — `maps/eft/{normalizedName}/{floor}.webp`).
- **R2** (рекоменд., A4): тот же ключ, отдельный провайдер, S3-совместимый API (тот же `@aws-sdk/s3`-стиль). Причина — **нулевой egress** (карты = traffic-driver; Supabase Free даёт 10 GB egress/мес — выгорит на ~5k просмотров 2 MB-карты).

### 4.3 URL-хелпер — `src/lib/map-image.ts` (образец `item-icon.ts:6–10`)

```ts
export function mapImageUrl(normalizedName: string): string {
  // cta-media вариант:
  return `${SUPABASE_URL}/storage/v1/object/public/cta-media/maps/eft/${normalizedName}.svg`;
  // R2 вариант: `${R2_PUBLIC_BASE}/maps/eft/${normalizedName}.svg`
}
```

### 4.4 Легальность + атрибуция (A2/A4) — КРИТИЧНО

Разный режим у данных и картинок:

| Артефакт | Лицензия | Вердикт |
|---|---|---|
| **Геометрия маркеров** (GraphQL) | MIT / MIT-0 (tarkov-api, tarkov-dev) | ✅ **GO** — факты-координаты, как prices/barters |
| **Рендер-логика** (CRS/transform/слои) | MIT (tarkov-dev) | ✅ **GO** — портируем, сохраняем MIT-нотис |
| **SVG-картинки карт** | A2: CC BY-NC-SA 4.0 (NonCommercial+ShareAlike) · A4: репо tarkovdata без LICENSE (404) + EULA BSG | ⚠️ **ГЕЙТ** — см. ниже |

**⚠️ ПРОТИВОРЕЧИЕ A2 vs A4 по картинкам** (явно отмечаю):
- **A2:** SVG строго под CC BY-NC-SA 4.0 → **NO-GO для прямого зеркалирования**, если CTA не строго некоммерческий (реклама/донаты/будущая монетизация ломают NonCommercial). ShareAlike делает наши адаптации вирусными.
- **A4:** риск **низкий-средний и управляемый** — десятки community-сайтов делают это годами без претензий BSG; де-факто толерантность высокая. Формального LICENSE в SVG-репо нет (404).

**Рекомендация синтезатора:** разница в строгости двух репозиториев (`tarkov-dev-svg-maps` с CC BY-NC-SA vs `tarkovdata` без LICENSE) — оба отчёта смотрели на разные источники одних карт. Безопасный план:
1. **MVP-данные (маркеры) — стартуем сразу** (чисто MIT).
2. **Картинки — три опции, решает Вадим:**
   - **(A) Чистый путь:** не использовать их SVG; маркеры поверх собственной/минимальной подложки. Дороже по арту, юридически безупречно.
   - **(B) Зеркалить SVG как некоммерческий проект** + обязательная атрибуция на каждой карте. Шатко при будущей монетизации.
   - **(C) Спросить разрешения** (Discussion в их репо) — самый чистый, если хотим именно их арт.
3. **Атрибуция (обязательна при B/C, желательна всегда):** на странице каждой карты — «Map by {author}» из `author`/`authorLink` (Shebuka/Jindouz/re3mr), «Map data via tarkov.dev (MIT)», дисклеймер «не аффилировано с Battlestate Games; EFT © BSG» в футере раздела.
4. **Правило 9 (внешние wiki-ссылки):** атрибуция на GitHub-репо автора / CC — это требование лицензии, НЕ wiki-датабаза → допустимо как `rel="nofollow"` подпись. Точную формулировку утверждает Вадим.

---

## 5. ФРОНТ-КОНТРАКТ (эскиз, end-to-end)

```
src/app/eft/maps/[slug]/page.tsx          (RSC)
  └─ getEftMapGeometry(slug)              читает map_assets + map_markers (+ map_floors)
  └─ <MapViewerLoader markers asset />     dynamic(ssr:false) обёртка
       └─ MapViewerClient                  Leaflet + L.CRS.Simple (next/dynamic ssr:false, правило 6)
            ├─ basemap: L.svgOverlay(mapImageUrl(slug), bounds)
            ├─ проекция: transform + applyRotation(coordinateRotation) [портир. из tarkov-dev MIT]
            ├─ MapMarker        L.marker / L.polygon(outline) по type, стили NIGHTFALL
            ├─ MapLayerPanel    тоглы слоёв (Выходы/Спавны/Лут/Ключи/Опасности/Боссы)
            ├─ FloorSwitcher    фильтр по heightRange/map_floors (Ctrl+колесо как эталон)
            ├─ MapLegend        легенда типов маркеров
            └─ MapSearch        поиск по label/выходам/ключам
```

**Файлы (A3, раздел e):**
- Создать: `src/components/features/maps/MapViewerLoader.tsx` (образец `QuestMapLoader.tsx` — dynamic ssr:false), `MapViewerClient.tsx` (новый Leaflet-клиент; стили панелей по `TacticalCartographyClient.tsx`).
- Изменить: `src/app/eft/maps/[slug]/page.tsx` (убрать `SectionPlaceholder`), опц. `src/app/eft/maps/page.tsx` (список карт перевести с `HEADER_DICTIONARY` на `getEftMaps()` — устранить расхождение статики и БД).

**Что переиспользуем (A3):**
- ✅ `dynamic(ssr:false)` шаблон из `QuestMapLoader.tsx`/`QuestMapDynamic.tsx` — копировать 1:1, поменять импорт.
- ✅ `TacticalCartographyClient.tsx` — референс NIGHTFALL-стилей панели слоёв (border-lines-hover, font-blender-medium, animate-pulse скелетоны вместо спиннеров — правило 8).
- ✅ `mapImageUrl()` по `item-icon.ts`.
- ⚠️ `QuestMapViewport` — **НЕ тянем целиком** (самописный DOM-transform, для гео-карты Leaflet лучше из коробки: мульти-этаж, image-overlay, кластеры). Берём только ПАТТЕРНЫ на запасной случай: `tween()` (стр.104–128), `clamp`, zoom-to-cursor (стр.337–342), `screenToCanvas`. **По умолчанию — Leaflet.**

**Координатная трансформация (A1/A2):** маркеры в raw Unity world coords. 2D-плоскость = `(x, z)`; `y` = высота (мульти-этаж). Render-time: `(x,z)` → image-space через `transform [scaleX,offsetX,scaleZ,offsetZ]` + `coordinateRotation` (cos/sin матрица). `top/bottom` + `heightRange` → фильтр этажей.

---

## 6. ФАЗИРОВКА

### v1 — image-overlay + базовый интерактив
**UI:** SVG-подложка (1 карта → все 11), слои **Выходы** + **Спавны**, связь спавн→выход (подсветка). Без мульти-этажа (только дефолтный `svgLayer`).
**Из mirror нужно:** `map_assets` (imageKey, transform, bounds, coordinateRotation, minZoom/maxZoom) + `map_markers` где `type IN (extract, spawn)`. Картинки залиты.

### v2 — полные слои + квест-слой + поиск + мульти-этаж
**UI:** слои **Лут/Ключи(lock)/Переключатели/Опасности/Боссы**, кластеризация лута, фильтр-панель, поиск (label/выходы/ключи), **мульти-этаж** (FloorSwitcher по heightRange), квест-слой (linkedQuestId).
**Из mirror нужно:** все `type` в `map_markers` (+ loose-loot за галочкой), `map_floors`/`layers`, `meta` (switch-цепочки, boss spawnLocations, lock.keyName), `linkedItemId`/`linkedQuestId`.

### v3 — кастом-пины / share
**UI:** пользовательские пины (заметки), share-ссылка состояния (слои+этаж+вьюпорт), опц. растровые тайлы / 3D-виды.
**Из mirror нужно:** новых mirror-данных НЕ требует (только клиентский стейт + URL-стейт); опц. тайлы → доп. заливка.

---

## 7. РИСКИ + ОТКРЫТЫЕ ВОПРОСЫ ДЛЯ ВЛАДЕЛЬЦА

### Риски
1. **Картинки карт ≠ MIT-данные.** Авторские произведения + EULA BSG + противоречие A2 (CC BY-NC-SA NonCommercial) vs A4 (де-факто толерантность). Митигация: атрибуция, нет монетизации именно карт, дисклеймер, либо собственный арт. **Низкий-средний, управляемый.**
2. **Отсутствие LICENSE в SVG-репо** `tarkovdata` (404) — формального гранта нет.
3. **Дрейф схемы tarkov.dev** (`lootLoose`/`transits`/`artillery`/`btrStops` могут меняться) — синк толерантен (pruneStale + best-effort).
4. **Боссы без координат** (`BossSpawnLocation` = zone+chance, не latlng) — пин через кросс-референс `spawnKey`→`spawns.zoneName`. Открытый вопрос рендера.
5. **Прюн composite-PK** `map_markers` — `pruneStale` бьёт по одной id-колонке; нужен per-map-скоуп вариант (иначе межкарточные коллизии id).
6. **Egress на Supabase Free** — единственный чисто-технический риск; снимается R2.
7. **Мульти-этаж/проекция** — самая сложная часть фронта (height-ranges, привязка world-coords к SVG, поворот). Данные есть, риск инженерный.

### Открытые вопросы (решить ДО db:push)
1. **🔴 КРИТИЧНО — db:push.** Этот заход только ПРОЕКТИРУЕТ. Реальное создание таблиц требует `npm run db:push` (--force, сносит RLS/FK/триггеры) → СРАЗУ `npm run db:sql` (восстанавливает RLS идемпотентно). **Выполняем ТОЛЬКО с подтверждения Вадима и при нём же на связи.**
2. **Лицензия картинок:** опция (A) свой арт / (B) зеркалить как некоммерческий + атрибуция / (C) спросить разрешения? Влияет на весь v1-арт.
3. **Хостинг картинок:** R2 (рекоменд., нулевой egress) или cta-media (ок для MVP)?
4. **Формат картинок:** SVG-вектор (рекоменд., ~2 MB, мульти-этаж) — подтвердить, что НЕ нужен JPG+3D (78 MB) на старте.
5. **loose-loot в MVP:** включаем 6.6k строк (37% объёма) или прячем за галочкой / откладываем в v2? (рекоменд. — за галочкой/v2).
6. **Regular only или regular+PVE?** (PVE ×2 строк; рекоменд. — regular на старте).
7. **Формат атрибуции авторов** на странице (как выводим `author`/`authorLink` без нарушения правила 9) + согласие на дисклеймер BSG в футере.
8. **Новая зависимость:** `npm i leaflet @types/leaflet` — единственный новый рантайм-пакет. Согласовать.

---

## Источники разведки

Документ синтезирован из четырёх разведотчётов (детали и проверка — в них):
- **A1** — схема tarkov.dev GraphQL `Map` (live-интроспекция 2026-06-23): полный список полей геометрии, sample-запрос, координатная система, где живёт рендер-метадата (`maps.json`).
- **A2** — рендер the-hideout/tarkov-dev (MIT), форма `maps.json`, пайплайн изображений (11 SVG ~1.7 MB), лицензионный вердикт по SVG (CC BY-NC-SA 4.0, NonCommercial).
- **A3** — наш код: текущая схема `maps` (schema.ts:253), что тянет `landing.ts`, переиспользуемые куски (`pruneStale`, `QuestMapLoader`, `item-icon.ts`, `upload-icons.ts`), пошаговый рецепт + список файлов.
- **A4** — объём (~17.8k строк regular, loot 77%), хостинг (R2 vs cta-media, egress), лицензия (данные MIT-0 чисто; картинки авторские + EULA), атрибуция (Shebuka/Jindouz/re3mr).

Сырые артефакты A4: `…/scratchpad/maps.json` (522 KB, regular, 16 карт), `…/scratchpad/maptype.json` (интроспекция типа `Map`).

> Все детали полей/таблиц/файлов взяты из A1–A4. Где отчёты противоречат (лицензия картинок A2 vs A4) — отмечено явно. Где пробел (боссы без координат, прюн composite-PK, transform не в GraphQL) — выписано как открытый вопрос, не выдумано.
