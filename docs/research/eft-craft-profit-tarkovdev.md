---
type: research
topic: EFT hideout craft-profit — как считает tarkov.dev + формулы скиллов Crafting / Hideout Management
date: 2026-08-21
method: Первоисточники — исходный код the-hideout/tarkov-dev (GitHub, ветка main, читан через gh api), JSON-дамп json.tarkov.dev, EFT Wiki (fandom) и вторичные вики-агрегаторы. Каждое число сверено с кодом или несколькими источниками; расхождения помечены явно.
---

# Как tarkov.dev считает профит крафтов и как моделировать скиллы

> Внимание по §4.12: `api.tarkov.dev/graphql` НЕ трогаем. Ниже — только **логика расчёта** (которую мы считаем сами) и **имена полей** JSON-дампа (`json.tarkov.dev`, за нашим кроном). Живой API не нужен.

Ключевые файлы-первоисточники в `the-hideout/tarkov-dev` (ветка `main`):
- `src/components/crafts-table/index.jsx` — сборка строки крафта, профит, профит/час, сортировка/фильтры.
- `src/modules/flea-market-fee.mjs` — формула комиссии барахолки.
- `src/modules/best-price.js` — подбор оптимальной цены выставления (минимум комиссии).
- `src/modules/format-cost-items.js` — цена ВХОДНЫХ предметов (флиа-buy / трейдер / бартер / крафт), топливо, Hideout Management на «0.66».
- `src/pages/crafts/index.jsx` — контролы страницы `/hideout-profit/`.
- `src/features/crafts/do-fetch-crafts.mjs` — чтение `${gameMode}/crafts` (тот же дамп, что и наш).

---

## 1. Расчёт профита на `/hideout-profit/`

### 1.1 Цена ВХОДНЫХ предметов (`totalCost`)
Считается в `format-cost-items.js` → `getCheapestPrice()`. Для каждого `requiredItem` берётся **минимальная из доступных цен закупки**:

- **Кэш-закупка** (`getCheapestCashPrice`): среди `item.buyFor`, у которых `priceRUB > 0` — берётся **самое дешёвое** предложение (флиа-market или трейдер). Флиа учитывается, только если игрок доступен по уровню (`playerLevel >= minLevelForFlea`) либо включён `Ignore settings`. Трейдер учитывается, если открыт нужный уровень лояльности. Если купить негде — фолбэк на «продать трейдеру» (`cash-sell`) как оценка стоимости.
- **Бартер** (`getCheapestBarter`) — если включён тумблер «Use barters for item sources» (`useBarterIngredients`). Рекурсивно оценивает стоимость входов бартера.
- **Крафт** (`getCheapestCraft`) — если включён «Use crafts for item sources» (`useCraftIngredients`). Рекурсивно.
- Итог `getCheapestPrice` = минимум из cash / barter / craft по `pricePerUnit`.

`item.foundInRaid === true` у входа → цена входа считается **0** (`getCheapestCashPrice` возвращает `pricePerUnit: 0` для FIR-предметов; бартеры/крафты для FIR-входов пропускаются). То есть FIR-квестовые входы обнуляют стоимость.

**Инструменты не входят в стоимость.** В `crafts-table` перед суммированием фильтр `costItem.isTool === false`; инструмент — это `requiredItem.attributes` с `{name:"tool", value:true}` (в JSON: `attributes.tool`). `totalCost = Σ (pricePerUnit × count)` по НЕ-инструментам.

Формула стоимости входа (verbatim):
```js
costItemsWithoutTools.forEach(costItem => totalCost += costItem.pricePerUnit * costItem.count);
```

### 1.2 Цена ВЫХОДНОГО (reward) предмета — «лучшее из трейдера и барахолки»
Только `rewardItems[0]` (первый продукт крафта).

1. **Лучший трейдер** (`bestSellTo`): максимум `priceRUB` из `craftRewardItem.sellFor`, **исключая** `flea-market` и (если нет Jaeger) `jaeger`.
2. **Барахолка**: если предмет не `noFlea` и доступен по флиа (`availableOnFlea`):
   - `fleaPriceToUse` = `avg24hPrice` (если тумблер «Average prices») либо `lastLowPrice`; фолбэк на `lastLowPrice`, если 0.
   - Через `bestPrice()` подбирается **оптимальная цена выставления**, минимизирующая «цена − комиссия» (шаг −1000 ₽ вниз от текущей, пока чистый профит растёт). Возвращает `bestPrice` и `bestPriceFee`.
   - Сравнение: если `fleaPriceToUse − fleaFeeSingle > bestSellTo.priceRUB` → продаём на флиа (`sellValue = fleaPriceToUse`), иначе комиссия обнуляется и остаётся трейдер.

**Итог:** `sellValue` = **max(лучший трейдер-sell, цена-флиа-минус-комиссия)**. То есть сравнивается ЧИСТАЯ выручка (после вычета комиссии на стороне флиа), и выбирается больший канал.

Reward всегда считается `isFIR: true` (крафт-выход found-in-raid).

### 1.3 Комиссия барахолки — точная формула (`flea-market-fee.mjs`)
Verbatim:
```js
export default function fleaMarketFee(basePrice, sellPrice, options = {}) {
    const count = options.count ?? 1;
    const intelligenceCenter = options.intelligenceCenter ?? 3;   // из настроек, дефолт 3
    const hideoutManagement = options.hideoutManagement ?? 0;     // из настроек, дефолт 0
    const Ti = options.Ti ?? 0.03;
    const Tr = options.Tr ?? 0.03;
    let V0 = basePrice;    // базовая цена предмета (item.basePrice)
    let VR = sellPrice;    // цена выставления
    let P0 = Math.log10(V0 / VR);
    let PR = Math.log10(VR / V0);
    let Q  = count;
    let IC = 1;

    if (VR < V0) { P0 = Math.pow(P0, 1.08); }
    if (VR >= V0){ PR = Math.pow(PR, 1.08); }

    if (intelligenceCenter >= 3) {
        IC = 1 - (0.01 * hideoutManagement + 1) * 0.3;
    }
    return Math.ceil(V0 * Ti * Math.pow(4, P0) * Q + VR * Tr * Math.pow(4, PR) * Q) * IC;
}
```

Ключевые факты:
- **Коэффициенты Ti = Tr = 0.03** (текущий дефолт в коде). Закомментированные старые значения `0.05 / 0.1` — историческое, НЕ актуальное.
- База степени = **4**; показатели `P0 = log10(V0/VR)`, `PR = log10(VR/V0)`.
- **Показатель 1.08** — «утяжеление» степени применяется к тому логарифму, знак которого положительный (`P0` при заниженной цене `VR<V0`, `PR` при завышенной `VR>=V0`). Это заменило старый эксплойт-фактор (раньше `Po = Po*4^(Po^1.08)`); текущая версия в коде именно `Math.pow(P0, 1.08)`.
- **Q** — количество лотов (для крафта `rewardItems[0].count`).
- **Скидка Разведцентра (Intelligence Center) 3-го ур.:** `IC = 1 − (0.01·HM + 1)·0.3`. При Intel≥3 и HM=0 это `1 − 0.3 = 0.7` (−30%). Каждый уровень Hideout Management добавляет +0.3% к скидке (при HM=50 → `1 − 1.5·0.3 = 0.55`, т.е. −45%). Ниже Intel 3 — `IC=1` (без скидки).

> Осторожно: в коде **дефолт `intelligenceCenter=3`** — то есть tarkov.dev по умолчанию считает профит С уже применённой −30% скидкой на комиссию. Если хотим «сырой» профит без Разведцентра — считать `IC=1`.

Комиссия на профит (в `crafts-table`) берётся **на весь тираж**: `fleaFeeTotal = fleaMarketFee(basePrice, fleaPriceToUse, {count: rewardItems[0].count})`.

### 1.4 Итоговый профит и профит/час
Verbatim:
```js
tradeData.profit = tradeData.reward.sellValue * craftRow.rewardItems[0].count - totalCost - fleaFeeTotal;
tradeData.profitPerHour = Math.floor(tradeData.profit / (craftDuration / 3600));
```
- `profit = sellValue × count − totalCost − fleaFeeTotal`. Комиссия вычитается ТОЛЬКО когда продажа идёт через флиа (иначе `fleaFeeTotal=0`).
- `profitPerHour = profit / (craftDuration / 3600)`, где `craftDuration` — длительность **после** скидки скилла Crafting (см. §2).
- Отдельная колонка `fleaThroughput = floor(sellValue × count / (craftDuration/3600))` — «валовый оборот флиа в час» (без вычета стоимости/комиссии).

### 1.5 ТОПЛИВО в профите — важный нюанс
Топливо (Expeditionary fuel tank `5d1b371186f774253763a656`, Metal fuel tank `5d1b36a186f7742523398433`) — это **обычный `requiredItem`** конкретных крафтов (у крафтов Генератора/некоторых станций). Оно входит в `totalCost` как любой другой вход.

Тумблер **«Empty fuel»** (`freeFuel`): если включён, стоимость топливного бака берётся как `sellForTradersBest.priceRUB × 0.1` (≈ цена «почти пустого» бака, 10% от продажи трейдеру), а не полная закупка. Логика:
```js
if (freeFuel && fuelIds.includes(requiredItem.item.id)) {
    bestPrice = requiredItem.item.sellForTradersBest;
    calculationPrice = requiredItem.item.sellForTradersBest.priceRUB * 0.1;
}
```
**Вывод:** tarkov.dev НЕ добавляет отдельную «стоимость работы станции в час». Топливо учитывается лишь там, где оно прописано входом рецепта. Общий расход генератора на все параллельные крафты они не размазывают.

### 1.6 Hideout Management и «0.66»-входы
В `format-cost-items.js` для входов с дробным `count === 0.66` (спец-случай некоторых рецептов) применяется скидка Hideout Management:
```js
count: requiredItem.count === 0.66
    ? (requiredItem.count - (requiredItem.count * (hideoutManagementSkillLevel * 0.5)) / 100).toFixed(2)
    : requiredItem.count
```
То есть −0.5%×уровень к количеству такого входа. Это единственное место, где HM влияет на профит крафта у tarkov.dev (снижение расхода топлива/ресурса), а не на время.

### 1.7 Контролы страницы `/hideout-profit/` (`src/pages/crafts/index.jsx`)
- **Станция** (`selectedStation`): дефолт `"top"` (лучший крафт на каждой станции, максимум 2 на станцию, Bitcoin Farm исключён), спец-значение `"banned"` (только флиа-запрещённые предметы), либо конкретная станция по `normalizedName`.
- **`Ignore settings`** (`showAll`) — показать все крафты, игнорируя уровни станций/квест-локи/уровень флиа.
- **`Average prices`** (`averagePrices`) — использовать `avg24hPrice` вместо `lastLowPrice`.
- **`Empty fuel`** (`freeFuel`) — см. §1.5.
- **Use barters / Use crafts for item sources** — рекурсивный источник входов.
- **Item filter** / поиск по имени (`nameFilter`, `itemFilter`).
- **Колонки:** Reward · Cost (список входов) · Duration/Finishes · **Cost ₽** · **Flea throughput/h** (только если флиа открыта) · **Estimated profit** · **Estimated profit/h**. Дефолтная сортировка — по `profit` убыв.
- Разбивка профита в тултипе (`profitParts`): «Sell price» (+), «Cost» (−), «Flea Market fee» (−).

### 1.8 FIR / умножение на count
- Reward помечен `isFIR: true` — крафт-выход всегда «в рейде найден», можно листить на флиа.
- Все денежные величины умножаются на `rewardItems[0].count`: `sellValue × count`, комиссия с `Q=count`.

---

## 2. Скилл Crafting («Ручное производство») — влияние на ВРЕМЯ

**Формула tarkov.dev (verbatim, `crafts-table/index.jsx`):**
```js
const craftDuration = Math.floor(
    craftRow.duration - (craftRow.duration * (skills.crafting * 0.75)) / 100
);
```
То есть **−0.75% времени за уровень скилла**. При максимуме навыка 50 → **−37.5%** длительности. (`skills.crafting` = уровень из настроек, дефолт 0.)

Соответствие вики (EFT Wiki / TarkovForge):
- «Reduces item crafting time by −0.75% per level, до −37.5% на Elite» — сходится 1:1 с кодом.
- Также по вики скилл сокращает **все циклические производства (кроме Bitcoin Farm)** на те же −0.75%/ур. tarkov.dev применяет `craftDuration` ко ВСЕМ крафтам таблицы одинаково (Bitcoin Farm вообще исключён из таблицы профита отдельным фильтром).

**Elite (уровень 51):** разблокирует **одновременный крафт 2 разных предметов в одной зоне** (Workbench, Lavatory, Nutrition Unit, Medical Station, Intelligence Center; плюс Scav Case). Это НЕ доп-скидка времени — это удвоение пропускной способности станции. tarkov.dev это в расчёте профита-на-крафт **не моделирует** (считает один слот).

> Расхождение источников: часть агрегаторов пишет «−37.5% at Elite Level», подразумевая, что 37.5% достигается на 51-м уровне. Математически по формуле `0.75%×level` 37.5% достигается на **level 50**; уровень 51 (Elite) даёт формально 38.25%, но канон — «максимум навыка = уровень 50, множитель ×0.75%», а 51 = порог Elite-перка. Мы следуем КОДУ: `level × 0.75%` без спец-обработки Elite для времени.

**К каким крафтам применяется:** ко всем производственным станциям (Workbench, Lavatory, Nutrition Unit, Medical Station, Intelligence Center, Booze Generator и т.п.). Bitcoin Farm — исключение (не крафт в смысле таблицы). Скилл Crafting — единственный, что режет ВРЕМЯ.

---

## 3. Скилл Hideout Management («Управление убежищем») — НЕ влияет на время крафта

**Главный вывод (подтверждён кодом и вики):** Hideout Management **НЕ ускоряет крафты и не сокращает их длительность.** В `crafts-table` длительность зависит ТОЛЬКО от `skills.crafting`. Единственное касание профита от HM — снижение количества дробных «0.66»-входов (§1.6) и скидка на флиа-комиссию через Разведцентр (§1.3).

Эффекты HM по вики (EFT Wiki / eft-ammo / TarkovForge), для полноты модели убежища (не для времени крафта):
- **+1% ко всем бонусам модулей за уровень** → до **+50%** на 50-м уровне.
- **−0.5% расхода топлива / водо- и воздухо-фильтров за уровень** → до **−25%** на 50-м.
- **Elite (уровень 50):** по агрегаторам — сверх максимума: усиленные бонусы модулей, доп. слоты топлива/фильтров и поднятый потолок сбора Bitcoin Farm. Точные числа Elite между источниками расходятся (напр. «+2 слота», «cap 3→5 монет») — помечаю как **неуверенное**, при необходимости сверить прямо на Fandom `Hideout_Management` (страница закрыта для нашего фетчера — читать вручную/в браузере). Для калькулятора профита это НЕ нужно.

**Как стакаются Crafting и Hideout Management:** они действуют на РАЗНЫЕ величины и не пересекаются на времени. Crafting × время (мультипликативно на длительность), HM × количество спец-входов и × скидку комиссии. Никакого «сложения процентов на время» — HM времени не касается. Внутри флиа-комиссии HM входит мультипликативно в множитель Разведцентра `IC = 1 − (0.01·HM + 1)·0.3`.

---

## 4. Требования конкретного крафта (схема данных)

Из `do-fetch-crafts.mjs` и живого JSON `json.tarkov.dev/{gameMode}/crafts` — поля крафта:
- `id`
- `station` (id станции; нормализуется в normalizedName через hideout-дамп)
- `level` — требуемый уровень станции (единственное «требование» по умолчанию)
- `duration` — секунды (базовые, до скилла Crafting)
- `requiredItems[]`: `{ item: <id>, count, attributes: { tool?: true, ... } }`
- `requiredQuestItems[]` — квест-предметы-входы (обычно пусто)
- `productItem` (в старом формате `rewardItems[0]`): `{ item: <id>, count, attributes }`
- `gameEditions[]` — привязка к изданию игры (напр. эксклюзив издания)
- `taskUnlock` — id квеста, открывающего рецепт (может отсутствовать/null)

**Вывод:** у крафта НЕТ собственного требования по скиллу или FIR на сам рецепт. Требования = **уровень станции** (`level`), опционально **квест-анлок** (`taskUnlock`) и, редко, **издание игры** (`gameEditions`) / квест-предметы (`requiredQuestItems`). «Found in Raid» относится к отдельным ВХОДАМ (флаг на item), а не к рецепту; крафт-выход всегда FIR. tarkov.dev в фильтрах учитывает `level > station-level` (скрыть недоступное) и `taskUnlock` (если включён TarkovTracker).

---

## 5. Актуальность данных / текущий вайп (2026)

- Сезон 1 / патч линейки 1.1.0 (2026) — «денежная мета» сместилась (Moonshine, Bitcoin, крафты вокруг Kord и т.п. по агрегаторам timesaver/timmytracker). Конкретные топ-крафты меняются с ценами барахолки, но **логика расчёта та же**.
- Числа, зависящие от цен (`lastLowPrice`, `avg24hPrice`, `sellFor`, `buyFor`), — волатильны; формула стабильна.
- **Наш подход (чтение из зеркала `json.tarkov.dev` за кроном) — верный и совпадает с самим tarkov.dev:** их сайт тоже читает `${gameMode}/crafts` JSON (`do-fetch-crafts.mjs`), а не считает на лету из игры. Мы просто повторяем их клиентскую математику над теми же данными. GraphQL не нужен (§4.12).
- Единственные «живые» величины, которых может не быть в статике мгновенно — история/последняя цена флиа; они и у tarkov.dev идут из того же дампа/`prices`.

---

## Как учесть в коде (рекомендации для нашего калькулятора)

Пусть на входе крафт из зеркала: `duration`, `requiredItems[]`, `productItem{item,count}`, `level`, `station`, `taskUnlock`. Настройки игрока: `craftingSkill` (0..50), `hideoutManagement` (0..50), `intelCenterLevel`.

1. **Длительность со скиллом Crafting:**
   `effDuration = floor(duration − duration × (craftingSkill × 0.75) / 100)`.
   (Bitcoin Farm из таблицы профита исключаем, как tarkov.dev.)

2. **Стоимость входов:** для каждого `requiredItem` (кроме `attributes.tool === true`) взять минимум из {cheapest cash-buy (флиа/трейдер), опц. barter, опц. craft}; FIR-вход → 0.
   `totalCost = Σ pricePerUnit × count`. Для дробных `count === 0.66` применить HM: `count × (1 − hideoutManagement × 0.5 / 100)`.
   Тумблер «пустое топливо»: для двух fuel-id считать `sellForTradersBest × 0.1`.

3. **Выручка:** `sellValue = max(bestTraderSell, fleaPrice − fleaFee(1 лот))`, где `bestTraderSell` — макс `sellFor.priceRUB` кроме flea (и кроме jaeger без Jaeger). Комиссию считать только если победила флиа.

4. **Комиссия флиа** — портировать `fleaMarketFee` 1:1:
   ```
   P0 = log10(V0/VR); PR = log10(VR/V0)         // V0 = basePrice, VR = sellPrice
   if VR <  V0: P0 = P0^1.08
   if VR >= V0: PR = PR^1.08
   IC = intelCenter>=3 ? 1 - (0.01*HM + 1)*0.3 : 1
   fee = ceil( V0*0.03*4^P0*Q + VR*0.03*4^PR*Q ) * IC     // Ti=Tr=0.03, Q=count
   ```
   Дать пользователю тумблер «учитывать Разведцентр 3 ур.» (иначе IC=1) — tarkov.dev по умолчанию ставит intelCenter=3.
   Опционально: подбор оптимальной цены выставления (`bestPrice`) — шаг −1000₽ вниз, пока `цена−fee` растёт.

5. **Профит и профит/час:**
   `profit = sellValue × count − totalCost − feeTotal(Q=count)`
   `profitPerHour = floor(profit / (effDuration / 3600))`.
   Доп. метрика `fleaThroughput = floor(sellValue × count / (effDuration/3600))`.

6. **Hideout Management НЕ трогает время.** Не складывать его с Crafting на длительности. HM только: (а) дробные «0.66»-входы, (б) множитель скидки флиа-комиссии внутри IC.

7. **Требования крафта** = `level` станции + опц. `taskUnlock` + опц. `gameEditions`/`requiredQuestItems`. Собственного skill/FIR-требования на рецепт нет.

---

## Sources
- tarkov.dev craft-table logic (профит, профит/час, выбор канала продажи, фильтры): https://github.com/the-hideout/tarkov-dev/blob/main/src/components/crafts-table/index.jsx
- Формула комиссии барахолки (Ti/Tr=0.03, 4^log10, 1.08, IC-скидка): https://github.com/the-hideout/tarkov-dev/blob/main/src/modules/flea-market-fee.mjs
- Подбор оптимальной цены выставления: https://github.com/the-hideout/tarkov-dev/blob/main/src/modules/best-price.js
- Цена входов, топливо (freeFuel ×0.1), HM на «0.66», FIR-обнуление: https://github.com/the-hideout/tarkov-dev/blob/main/src/modules/format-cost-items.js
- Контролы страницы /hideout-profit/: https://github.com/the-hideout/tarkov-dev/blob/main/src/pages/crafts/index.jsx
- Схема crafts (чтение ${gameMode}/crafts JSON): https://github.com/the-hideout/tarkov-dev/blob/main/src/features/crafts/do-fetch-crafts.mjs
- Живой JSON-дамп (поля крафта): https://json.tarkov.dev/regular/crafts
- Баг-репорт по порядку аргументов комиссии (контекст формулы): https://github.com/the-hideout/tarkov-dev/issues/105
- Crafting skill (−0.75%/ур, −37.5% Elite, Elite = 2 предмета в зоне): https://escapefromtarkov.fandom.com/wiki/Crafting · https://tarkovforge.com/skills/crafting
- Hideout Management (не влияет на время; +1%/ур бонусы, −0.5%/ур расход, Elite): https://escapefromtarkov.fandom.com/wiki/Hideout_Management · https://www.eft-ammo.com/wiki/tarkov-hideout-management
- Флиа-комиссия (общая формула VO·Ti·4^log10 + VR·Tr·4^log10): https://escapefromtarkov.fandom.com/wiki/Trading
- Текущая мета крафтов (сезон 1, 2026): https://timesaver.gg/blog/tarkov-best-hideout-crafts-profit · https://www.timmytracker.com/guide/best-crafts
