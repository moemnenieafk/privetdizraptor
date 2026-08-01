---
status: 🔬 research — feasibility шага 1 спеки [[heatmap-loot-ev-dataset]]; код НЕ писан, дампы НЕ качались
affects: eft-maps, loot, data-ingest, supabase, heatmap
date: 2026-08-01
---

# SPT loot-таблицы как источник EV-датасета heatmap — ресёрч (шаг 1, БЛОКЕР)

**Цель:** снять риск #1 спеки [[heatmap-loot-ev-dataset]] — проверить по ПЕРВОИСТОЧНИКАМ SPT,
правда ли эмулятор отдаёт loot по локациям с **координатой + шансом + пулом предметов на точку**,
пригодно ли это для нашего `EV(точка) = Σ P(предмет) × цена`, и ложится ли SPT-координата на наш
рендер без второго пересчёта. Здесь — факты со ссылками; вердикт и форма зеркала — в конце.

Связано: [[heatmap-loot-ev-dataset]] (спека, шаг 1) · [[heatmap-research]] · [[eft-data-autonomy-research]] ·
playbook `/game-data-ingest` · CLAUDE.md §4.11 (автономность), §5 (db:push).

**Метод/оговорка:** веб-UI их GitLab `dev.sp-tarkov.com` редиректит не-браузерные запросы на
`github.com/sp-tarkov` (антискрейп), сырые JSON-файлы базы напрямую вытянуть не удалось. Поэтому
структуры взяты из (а) **исходных TS-моделей** зеркала `github.com/sp-tarkov/server` (raw), (б)
**DeepWiki** по `sp-tarkov/server-csharp` (генерится из реального кода C#-переписи), (в) кода модов,
которые эти JSON читают/пишут. Где форму подтверждают ≥2 независимых источника — помечено; где нет —
в разделе «не проверено».

---

## TL;DR (вердикты, доказанные ниже)

- **ПРИГОДЕН.** SPT несёт ровно тройку, которой нам не хватает: **позиция `Position{x,y,z}` +
  шанс точки `probability` + пул предметов с весами `itemDistribution[].relativeProbability`** — всё
  в ОДНОЙ записи спавн-точки. Для loose-лута — на каждую точку; для контейнеров — позиция+шанс
  контейнера в `base.json`, а распределение содержимого — в общей `staticLoot.json` по типу контейнера.
- **КООРДИНАТЫ = ТА ЖЕ система, что tarkov.dev.** SPT `Position` — это сырой Unity
  `localPlayer.Transform.position` (x,y,z) из клиента EFT; tarkov.dev-позиции спавнов/лута — из тех же
  BSG-файлов. Наш рендер уже кладёт tarkov.dev-точки как `[z, x]` через кастомный CRS
  (`ll = (p) => [p.z, p.x]`) → **SPT-точки лягут тем же `ll()` без второго трансформа.** (Возможен
  сдвиг origin по конкретной карте — выверить на 1–2 точках, как делали для tarkov.dev.)
- **ITEM ID тривиален.** `IItem._tpl` в SPT = BSG template id = 24-hex Mongo `_id` = id предмета в
  tarkov.dev = наш `linkedItemId`. Join цен по id — прямой, маппинг-таблица не нужна.
- **Лицензия — НЮАНС.** Код SPT-сервера под **NCSA** (либеральная, как MIT), но JSON базы —
  это распакованные **данные BSG** (© Battlestate Games); NCSA их не «отмывает». Это те же
  игровые факты, что мы уже зеркалим из tarkov.dev/файлов игры (§4.11), риск — тот же, не новый.
- **Свежесть отстаёт от live-вайпа.** Актуальный SPT 4.0 прибит к EFT **0.16.9.0.40087** (релиз
  02.10.2025); патчи EFT после этого — только в след. версии SPT. → EV это «≈ на патч SPT», как и
  предупреждает спека (риск 6). Тот же лаг у tarkov.dev (наш `container-grids-todo.md:10`).

---

# ЧАСТЬ A. ГДЕ ЖИВУТ loot-таблицы (Q1)

## Раскладка базы
Per-map данные лежат по пути **`project/assets/database/locations/{locationId}/`**, базовый файл карты —
`base.json` (подтверждено DeepWiki `4.3-location-data`). Ключи карт (из `ILocations.ts`, verbatim):
`bigmap` (Customs), `factory4_day`, `factory4_night`, `interchange`, `laboratory`, `lighthouse`,
`rezervbase` (Reserve), `shoreline`, `tarkovstreets` (Streets), `woods`, `sandbox` / `sandbox_high`
(Ground Zero), + служебные `develop/hideout/privatearea/suburbs/terminal/town`.

## Что прицеплено к каждой карте
Тип `ILocation` (`models/eft/common/ILocation.ts`, **verbatim из исходника**) — это карта-агрегат
всех loot-подсистем локации:

```ts
export interface ILocation {
    /** Map meta-data */
    base: ILocationBase;
    /** Loose loot postions and item weights */
    looseLoot: ILooseLoot;
    /** Static loot item weights */
    staticLoot: Record<string, IStaticLootDetails>;
    /** Static container postions and item weights */
    staticContainers: IStaticContainerDetails;
    staticAmmo: Record<string, IStaticAmmoDetails[]>;
    /** All possible static containers on map + their assign groupings */
    statics: IStaticContainer;
    /** All possible map extracts */
    allExtracts: IExit[];
}
```

Отсюда прямо видно разделение (ответ на «отдельная ли подсистема»):
- **loose** — `looseLoot: ILooseLoot` (позиции + веса на точку, per-map файл `looseLoot.json`).
- **контейнеры** — двухчастно: **где и с каким шансом** контейнер стоит (`staticContainers`/`statics`
  + массив `Loot` в `base.json`), а **что внутри** — общий `staticLoot: Record<tpl, IStaticLootDetails>`
  (распределение по ТИПУ контейнера, файл `db/loot/staticLoot.json`; ключ Record = tpl контейнера).
- **staticLoot.json — общий на все карты** (`tables.loot.staticLoot`), не per-map; per-map — только
  ГДЕ стоят контейнеры. (Путь `db/loot/staticLoot.json` и «список каждого контейнера + под-список
  предметов с probability» подтверждён поиском по их коду и модом AllTheLoot.)

---

# ЧАСТЬ B. ФОРМАТ LOOSE-лута (Q2) — есть ли координата+шанс+пул

**Да, всё три — в одной записи.** Тип `ILooseLoot` (**verbatim из `ILooseLoot.ts`**):

```ts
export interface ILooseLoot {
    spawnpointCount: ISpawnpointCount;        // { mean: number; std: number }
    spawnpointsForced: ISpawnpointsForced[];  // гарантированные точки (квест/сюжет)
    spawnpoints: ISpawnpoint[];               // обычные вероятностные точки
}

export interface ISpawnpoint {
    locationId: string;
    probability: number;                      // ← ШАНС, что точка активна (0..1)
    template: ISpawnpointTemplate;
    itemDistribution: ItemDistribution[];     // ← ПУЛ кандидатов + веса
}

export interface ISpawnpointTemplate {
    Id: string;
    IsContainer: boolean;
    useGravity: boolean;
    randomRotation: boolean;
    Position: Ixyz;                           // ← КООРДИНАТА {x,y,z}
    Rotation: Ixyz;
    IsAlwaysSpawn: boolean;
    IsGroupPosition: boolean;
    GroupPositions: IGroupPostion[];
    Root: string;                             // _id корневого item в Items[]
    Items: IItem[];                           // предметы-кандидаты этой точки
}

export interface ItemDistribution {
    composedKey: IComposedKey;                // { key: string } → ссылается на item в Items[]
    relativeProbability: number;              // ← ВЕС предмета в пуле точки
}
```

Как это читается доменно (подтверждено DeepWiki-описанием алгоритма генерации loose-лута):
- **шанс точки** = `spawnpoint.probability` (сервер катит `GetChance100(spawnPoint.Probability)`);
- **координата** = `template.Position` (при спавне `item.Position = spawnPoint.Position`);
- **пул точки** = `template.Items[]` (сами предметы, с `_tpl`), а **веса** — параллельный массив
  `itemDistribution[]`, где `composedKey` мапится на конкретный item, `relativeProbability` = его вес.
  То есть на одной loose-точке может быть НЕСКОЛЬКО альтернатив-предметов с относительными весами —
  ровно то, что нужно для `Σ P(предмет)×цена`.
- `spawnpointsForced` — точки со 100%-спавном (сюжет/квест), формой = `{locationId, probability,
  template}` (без `itemDistribution` — предмет фиксирован в `template.Items`).

**Форму подтверждают независимо:** (а) verbatim TS-модель выше; (б) DeepWiki C#-сервера
(`SpawnPoint.Probability`, «Position: 3D coordinates», «weighted list `SpawnPoint.Template.Items`»);
(в) сообщество/моды описывают ту же запись `spawnpoints[].{probability, template{Position, Root,
Items[{_id,_tpl,upd}]}, itemDistribution[{composedKey, relativeProbability}]}`.

---

# ЧАСТЬ C. ФОРМАТ СТАТИЧЕСКИХ КОНТЕЙНЕРОВ (Q3)

Контейнер (ящик/сейф/куртка/труп) — **отдельная подсистема** от loose, задаётся двухчастно:

1. **Позиция + шанс появления самого контейнера** — в `base.json` карты. `ILocationBase.Loot:
   ISpawnpointTemplate[]` (**verbatim**) — контейнеры описаны тем же `ISpawnpointTemplate` (с
   `Position`, `IsContainer:true`, `Root`, `Items`). Плюс `ILocation.staticContainers:
   IStaticContainerDetails` / `statics: IStaticContainer` — «все возможные контейнеры + их
   группировки и min/max спавна». Категории шанса (из DeepWiki C#): **Static Forced** (100%,
   `staticForced`), **Guaranteed**, **Randomisable** (вероятностные) — т.е. у контейнера есть свой
   спавн-шанс, а часть контейнеров форсится.
2. **Что внутри контейнера** — общий `staticLoot: Record<string, IStaticLootDetails>` (ключ = tpl
   ТИПА контейнера, файл `db/loot/staticLoot.json`). По описанию алгоритма (DeepWiki) и коду AllTheLoot,
   `IStaticLootDetails` содержит:
   - **`itemcountDistribution`** — распределение КОЛИЧЕСТВА предметов (сколько штук положить), пары
     `{count, relativeProbability}`;
   - **`itemDistribution`** — распределение КАКИЕ предметы, пары `{tpl, relativeProbability}`
     (`tpl` = template id предмета).
   Сервер: катит число по `itemcountDistribution` → тянет предметы из `itemDistribution` по весам →
   применяет фильтры/лимиты. Аналогично `staticAmmo: Record<caliber, IStaticAmmoDetails[]>` для
   патронов (`{tpl, relativeProbability}` — форма `staticAmmo` подтверждена кодом AllTheLoot:
   `staticAmmo[cal].push({ tpl: data.Id, relativeProbability })`).

**Важное отличие от loose для нашего EV:** у контейнера распределение — по ТИПУ (не «этот сейф на
Складе», а «сейфы вообще»). Значит EV конкретной точки-контейнера = EV его типа (одинаков для всех
экземпляров этого типа на карте). Это ок для heatmap («где стоят сейфы» × «EV сейфа»), но per-instance
уникальности пула у контейнеров нет — в отличие от loose, где пул привязан к самой точке.

---

# ЧАСТЬ D. MARKED-ROOM И СХРОНЫ (Q4)

Отдельного «marked-room»-типа в схеме **нет** — это НЕ первоклассная сущность SPT. Моделируется через
уже описанные примитивы:
- **Закопанные схроны / стэши** — это те же **статические контейнеры** (у них свой tpl-тип «buried
  stash»/«ground cache» и запись в `statics`/`base.json Loot` с `Position` и своим `staticLoot`-пулом).
  Покрытие — как у любого контейнера (позиция+шанс+пул-по-типу).
- **Marked-room лут** — в live EFT это loose-лут в комнате под marked-ключ, ВЗВЕШЕННЫЙ на особый пул
  (дорогие кейсы/ключи). В SPT это отдельные `spawnpoints` в той зоне с высоким `relativeProbability`
  на редкие предметы. Т.е. на уровне данных — обычные loose-точки; «marked» = семантика зоны, а не
  поле. **Условный шанс «только с ключом» в самих loot-таблицах НЕ выражен** — SPT-генерация не
  требует ключа, чтобы лут появился (ключ — гейт доступа игрока, не гейт спавна).

**Вывод для нас:** координата+шанс+пул для marked/схронов ЕСТЬ (как loose/контейнер соответственно),
но «условность от ключа/квеста» (спека, решение 2 / риск 3) в SPT-данных **не размечена** — её
пришлось бы навешивать нам editorial-слоем (привязка зоны к ключу у нас уже есть: `lock`→`key`,
`reverse-key-doors`). `spawnpointsForced` покрывает квестовo-форсированные точки, но не «marked».

---

# ЧАСТЬ E. КООРДИНАТЫ (Q5) — критично для рендера

**SPT `Position` = сырые Unity world-координаты клиента EFT.** Прямое доказательство: мод
`Tarkov_CustomSpawnPointMaker` (пишет spawn-point JSON по нажатию игрока) берёт позицию так:
```csharp
var position = localPlayer.Transform.position;
customSpawnPoint.Add("Position", new JArray(position.x, position.y, position.z));
```
— то есть `Position{x,y,z}` записывается 1:1 из `Transform.position`, БЕЗ трансформа. Это тот же
BSG-мировой простор, из которого tarkov.dev берёт `Map.spawns`/`lootLoose` позиции (их данные —
из тех же game-файлов).

**На нашей стороне** (`MapViewerClient.tsx`): маркеры кладутся в СЫРЫХ игровых координатах
`ll = (p) => [p.z, p.x]` (`:69`), а совмещение с артом делает кастомный CRS (`makeCRS`: `L.CRS.Simple`
+ `L.Transformation` + поворот `coordinateRotation` в проекции, `:50-64`). Все наши tarkov.dev-точки
(loose/контейнеры/замки/выходы) уже ложатся этим `ll()` 1:1.

**Итог:** SPT-точку подаём тем же `ll({x, z})` — **второго трансформа SPT→BSG не нужно, это одно
пространство.** Единственное, что выверить эмпирически (как выверяли tarkov.dev): нет ли по конкретной
карте расхождения origin/оси Y (этажи). Ось `y` (высота) в `ll()` игнорируется — она пойдёт в
floor-фильтр (`applyFloor`), а не в план. Порядок именно `[z, x]` (не `[x, z]`) — как у tarkov.dev,
т.к. это BSG-конвенция; для SPT ожидаемо тот же, но **сверить на 1–2 известных точках обязательно.**

---

# ЧАСТЬ F. ITEM ID (Q6)

**`_tpl` == BSG template id == tarkov.dev id == наш `linkedItemId`.** Цепочка:
- `IItem` (**verbatim**): `{ _id: string; _tpl: string; parentId?; slotId?; location?; upd? }`.
  `_tpl` — ссылка на шаблон предмета.
- BSG использует 24-символьные hex Mongo ObjectId как id всех сущностей; tarkov.dev показывает
  ровно этот 24-hex id предмета (подтверждено: item id на tarkov.dev = BSG template id = Mongo `_id`).
- У нас editorial-конвенция уже зафиксирована: `linkedItemId` = «id мира из tarkov.dev», а в
  визарде маркеров есть флаг `isItemId` = 24-hex (`HANDOFF-step-marker-wizard.md:137`).

→ **Join цен тривиален:** `priceIndex.get(spawn._tpl)` — тот же индекс, которым страница карты уже
резолвит `keyPrice`/`itemBg` по `linkedItemId` (`heatmap-research.md` §4). Маппинг-таблица SPT→наш id
НЕ нужна. (Гоча из памяти: `normalizedName` из json.tarkov.dev бывает плейсхолдером — но мы джойним
по `_tpl`/id, не по имени, так что не задевает.)

---

# ЧАСТЬ G. ВЕРСИЯ / СВЕЖЕСТЬ (Q7)

- **Актуальный SPT 4.0 прибит к EFT `0.16.9.0.40087`** (релиз 02.10.2025, до softcore-вайпа PvE).
  Патчи EFT после — только в SPT 4.1; каждая версия SPT требует патчер-даунгрейд клиента до своей
  версии EFT (источник: `wiki/FAQs_40.md`).
- **Обновляется по-релизно, не непрерывно.** Значит loot-таблицы = снимок на версию EFT данного
  релиза SPT; за live-вайпом лагают (риск 6 спеки подтверждён). Тот же характер лага, что у tarkov.dev
  (`container-grids-todo.md:10`: «SPT/tarkov.dev отстают за патчем EFT»).
- **Где брать:** офиц. GitLab `dev.sp-tarkov.com/spt/server` (база в `project/assets/database/`,
  зеркало исходников `github.com/sp-tarkov/server`); релизы — с их сайта/хаба (Forge). Для нас — это
  **статический дамп на версию** (по `/game-data-ingest`), крон-обновление не требуется (данные
  меняются раз в релиз SPT, а не ежедневно) — в отличие от цен.

---

# ЧАСТЬ H. ЛЕГАЛЬНОСТЬ / ЛИЦЕНЗИЯ (Q8) — риск честно

- **Код сервера SPT — NCSA Open Source License** (© SPT Team; verbatim из `server/LICENSE.md` — это
  Univ. of Illinois/NCSA, разрешает use/copy/modify/distribute). В тексте лицензии **нет оговорки**,
  выделяющей игровые ассеты/данные BSG.
- **НО JSON базы — это данные BSG.** Файлы `locations/*/looseLoot.json`, `staticLoot.json` и т.п. —
  распакованные/реверснутые данные Escape from Tarkov, права на которые у **Battlestate Games**. NCSA
  покрывает софт SPT, а не проприетарные данные игры (подтверждено обзорами лицензии SPT). То есть
  «лицензия SPT» НЕ делает эти данные свободными для редистрибуции.
- **Оценка риска для нас:** это **те же игровые ФАКТЫ**, что мы уже зеркалим (позиции из tarkov.dev,
  характеристики предметов из файлов игры — `eft-data-autonomy-research`, `/game-data-ingest`). Риск —
  ровно тот же класс, что весь наш инжест игровых данных по §4.11, а НЕ новый. Мы берём числа (шанс,
  вес, координата, tpl), не ассеты/код. Практика портала: факты игры зеркалим, ссылки наружу — на
  свои страницы. **Рекомендация:** относиться как к прочему game-data-ingest (внутреннее зеркало,
  атрибуция источника в доке синка), не как к «свободной» лицензии SPT; если появится юрист-строгий
  режим — это кандидат на пересмотр вместе со всем инжестом BSG-фактов.

---

# ЧАСТЬ I. ВЕРДИКТ (Q9)

## (а) Есть ли ВСЁ нужное (координата+шанс+пул на точку)
**Да, для loose — идеально:** `Position{x,y,z}` + `probability` + `itemDistribution[{item, relativeProbability}]`
в одной записи `ISpawnpoint`. Для контейнеров — позиция+шанс на точке (`base.json`), пул — по типу
(`staticLoot`), т.е. per-type, не per-instance (для heatmap достаточно).

## (б) Достаточность по sourceType
| sourceType | координата | шанс | пул+веса | вывод |
|---|---|---|---|---|
| **loose** | ✅ per-point `Position` | ✅ `probability` | ✅ per-point `itemDistribution` | **полностью** |
| **container** | ✅ `base.json Loot.Position` | ✅ спавн-категории (forced/guaranteed/random) | ✅ per-**type** `staticLoot` | **достаточно** (пул общий на тип) |
| **cache/схрон** | ✅ (как контейнер) | ✅ | ✅ per-type | **достаточно** (это подвид контейнера) |
| **marked-room** | ✅ (loose-точки зоны) | ✅ | ✅ | **частично**: спавн есть, «условие ключа» в данных НЕ размечено → навешивать editorial |

## (в) Нормализованная запись зеркала `loot_spawns` (предложение полей)
На каждую SPT-точку — одна строка:
```
loot_spawns {
  mapId: string            // наш slug карты (маппинг из SPT locationId: bigmap→customs и т.д.)
  gameId: 'eft'
  sourceType: 'loose' | 'container' | 'cache' | 'marked'   // marked — editorial-обогащение
  x: number                // = SPT Position.x  (сырой BSG, рендерим ll=[z,x])
  z: number                // = SPT Position.z
  y: number | null         // = SPT Position.y  → floor-фильтр, не план
  probability: number      // шанс точки/контейнера (loose: spawnpoint.probability)
  containerTpl: string | null   // для container/cache: tpl типа (ключ staticLoot)
  pool: Array<{ tpl: string; relativeProbability: number }>   // из itemDistribution (item _tpl + вес)
  // EV НЕ хранится — считается на рендере join'ом priceIndex (спека, решение 1)
  sourceVersion: string    // версия EFT/SPT дампа (напр. '0.16.9.0.40087') — для оговорки «≈»
}
```
Нормализация весов: `P(предмет) = relativeProbability / Σ relativeProbability` внутри пула точки
(веса относительные, не проценты — их надо нормировать самим). `EV(точка) = probability × Σ_i
[ P_i × цена(tpl_i) ]`, цена — live-барахолка на рендере (`priceIndex`, как `keyPrice`).

## (г) Главные подводные камни
1. **Веса относительные** (`relativeProbability`), НЕ вероятности — нормировать по сумме пула на точку.
2. **`Position.y` = высота/этаж**, не план — не совать в `ll()`, пустить в floor-фильтр (`applyFloor`).
3. **`locationId` SPT → наш slug** — маппинг (`bigmap`→`customs`, `rezervbase`→`reserve`,
   `tarkovstreets`→`streets`, `sandbox`→ground-zero…): маленькая ручная таблица.
4. **Контейнерный пул — per-type**, не per-instance: EV сейфа одинаков для всех сейфов карты
   (ожидаемо, но не «уникальный лут точки», как у loose).
5. **marked/схрон-условность (ключ/квест) в данных не размечена** — если нужна в UI, навешивать
   editorial (у нас есть `lock→key`); `spawnpointsForced` ≠ marked.
6. **Свежесть = снимок на версию SPT**, лаг за live-вайпом → EV подавать как «≈ на патч», не «точное»
   (риск 6 спеки; оговорка в UI фазы 2).
7. **Легальность = класс game-data-ingest** (данные BSG под их ©, NCSA их не покрывает) — зеркалить
   как прочие факты игры, с атрибуцией, не выдавать за «свободные».
8. **Origin-сверка обязательна** — координата ТА ЖЕ по природе, но выверить на 1–2 точках/карту, что
   `[z,x]` ложится (как выверяли tarkov.dev), прежде чем массово доверять.
9. **Объём** — loose на Стритах/Маяке = тысячи точек (heatmap-research §5): дамп большой, но это
   офлайн-инжест, не рантайм; в зеркале — те же тысячи строк на карту (ок для Supabase).

**Итог: SPT ПРИГОДЕН как источник EV-датасета.** Он закрывает именно тот пробел, ради которого писалась
спека (шанс + пул на точку, которых нет в tarkov.dev), в совместимой системе координат и с
join-совместимыми id. План спеки (шаги 2–5: дамп → нормализация в `loot_spawns` → mirror → синк)
можно вести без пересборки. Оговорки — свежесть (≈), marked-условность (editorial), лицензия
(класс game-data-ingest).

---

## Открытый список «НЕ проверено» (честность метода)
- **Сырые JSON-файлы базы напрямую не прочитаны** (их GitLab редиректит не-браузер, raw-файлы под
  auth). Форма выведена из verbatim TS-моделей `sp-tarkov/server` + DeepWiki(C#) + кода модов. Реальный
  дамп на конкретной карте (`bigmap/looseLoot.json`) глазами НЕ смотрелся — сверить при шаге 2.
- **Точные camelCase-спеллинги полей `IStaticLootDetails`/`IStaticContainerDetails`** (`itemDistribution`
  vs `ItemDistribution`, `itemcountDistribution`) — по нескольким источникам сходятся, но verbatim-файл
  static-loot модели (не в `common/` и не в `common/tables/`, лежит в отдельном файле) не открыт. Форма
  `{tpl, relativeProbability}` / `{count, relativeProbability}` подтверждена кодом AllTheLoot и DeepWiki,
  но точный регистр ключей — сверить в дампе.
- **Origin/ось конкретной карты SPT vs наш арт** — НЕ выверено эмпирически (нельзя качать дампы в
  ресёрче). Гипотеза «одно пространство, тот же `[z,x]`» доказана по природе данных (оба = BSG Unity),
  но численную сверку на 1–2 точках делать на шаге 2.
- **Совпадает ли набор loose-точек SPT с числом маркеров tarkov.dev** у нас (наши `loot_loose` из
  tarkov.dev vs SPT `spawnpoints`) — не сверялось; это РАЗНЫЕ наборы точек (спека это и закладывает:
  heat — отдельный SPT-набор, не переиспользует наши маркеры).
- **Точная привязка marked-room зон к ключам в SPT** — не подтверждена (вывод: в loot-данных не
  размечена; live-семантика «ключ гейтит доступ, не спавн»).

## Источники
**Первоисточники SPT (verbatim исходники / зеркало):**
- `github.com/sp-tarkov/server` — `project/src/models/eft/common/ILocation.ts` (агрегат per-map:
  `base/looseLoot/staticLoot/staticContainers/staticAmmo/statics`), `ILooseLoot.ts` (`ISpawnpoint`,
  `probability`, `template.Position/Root/Items`, `itemDistribution{composedKey, relativeProbability}`),
  `ILocationBase.ts` (`Loot: ISpawnpointTemplate[]`, `GlobalContainerChanceModifier`), `IItem.ts`
  (`_id/_tpl`), `models/spt/server/ILocations.ts` (ключи карт), `LICENSE.md` (NCSA).
- `dev.sp-tarkov.com/spt/server` — офиц. GitLab, база `project/assets/database/locations/{map}/base.json`
  + `db/loot/staticLoot.json` (пути; веб-UI редиректит не-браузер → напрямую не вытянут).
- DeepWiki `sp-tarkov/server-csharp` — `5.3-loot-generation` (алгоритм: `spawnPoint.Probability`,
  `item.Position = spawnPoint.Position`, `ItemDistribution`/`ItemCountDistribution`, категории
  контейнеров forced/guaranteed/random), `4.3-location-data` (путь `locations/{id}/base.json`, список карт).
- `wiki/FAQs_40.md` (sp-tarkov) — SPT 4.0 = EFT `0.16.9.0.40087`, релиз 02.10.2025, патчер-даунгрейд.

**Первоисточники-adjacent (моды, читающие эти JSON):**
- `nektonick/Tarkov_CustomSpawnPointMaker` `Plugin.cs` — `Position = localPlayer.Transform.position`
  (x,y,z) → доказательство «SPT Position = сырой Unity world coord».
- `lBlackMambal/SPT-Mods-AllTheLoot` `mod.ts` — `tables.loot.staticLoot`, `staticAmmo[cal].push({tpl,
  relativeProbability})` (форма static-пула).
- Item id: BSG template id = 24-hex Mongo ObjectId = tarkov.dev item id (несколько источников).

**Наш код/доки (внутренние):**
- `MapViewerClient.tsx` — CRS (`:50-64`), `ll=(p)=>[p.z,p.x]` (`:69`), floor (`applyFloor`).
- `docs/decisions/heatmap-loot-ev-dataset.md` (спека, шаг 1) · `heatmap-research.md` (priceIndex/join,
  объёмы) · `eft-data-autonomy-research.md` (инжест фактов игры) · `container-grids-todo.md:10`
  (лаг SPT/tarkov.dev за патчем) · `HANDOFF-step-marker-wizard.md:137` (`isItemId`=24-hex).

---
*Процесс: [[engineering-loop]] · снимает риск #1 [[heatmap-loot-ev-dataset]] · след. шаг — шаг 2 спеки
(дамп по `/game-data-ingest` + origin-сверка на 1–2 картах).*
