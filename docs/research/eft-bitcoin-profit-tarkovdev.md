# EFT Bitcoin Farm — Profit Facts Sheet (для калькулятора)

> Собрано 2026-08-22 из первичных источников: официальный EFT Wiki (Fandom), tarkov.dev (исходники калькулятора на GitHub), `json.tarkov.dev`-дамп, и кросс-сверено с community-гайдами. Питает живой калькулятор — константы точные, спорное помечено в «Confidence».

⚠️ **Главная поправка к вводным:** базовая константа времени в актуальном патче (1.1.0 / Season 1, 2026) — **300000 секунд**, а не 145000. 145000 — значение старых патчей. Коэффициент на GPU — **0.041225** (это НЕ `(GPUs-1)/49`; см. Formulas). tarkov.dev в коде читает длительность из API-крафта, а `300000` — дефолт-фолбэк.

---

## 1. Уровни модуля Bitcoin Farm — слоты под GPU

| Уровень | Слотов GPU (совокупно) | Источник |
|---|---|---|
| L1 | **10** | tarkov.dev `cardSlots = {1:10, 2:25, 3:50}`; wiki |
| L2 | **25** | там же |
| L3 | **50** | там же |

**Гоча из JSON-дампа:** в `json.tarkov.dev/regular/hideout` станция `bitcoin-farm` (`id 5d494a445b56502f18c98a10`, `areaType 20`) кодирует слоты через `levels[].bonuses[]` с `type:"AdditionalSlots"`, и значения **инкрементальные, не совокупные**: L1 `value:10`, L2 `value:15`, L3 `value:25`. Совокупно = 10 / 25 / 50. `slotItems:["57347ca924597744596b4e71"]` — id видеокарты. Читая зеркало, суммируй по уровням.

---

## 2. Формула времени производства

Один **Physical Bitcoin = 0.2 BTC** (внутриигровой предмет). Время на один предмет:

```
t_seconds_per_coin(GPUs) = BASE / (1 + (GPUs - 1) * 0.041225)
```

- `BASE = 300000` сек (патч 1.1.0). Исторически было 145000 — отсюда путаница во вводных.
- Коэффициент `0.041225` на каждую карту сверх первой. (`0.041225 ≈ 1/24.25`, а НЕ `1/49`. Вариант с делителем 49 в интернете — устаревший/иной вывод, актуальному коду tarkov.dev не соответствует.)
- `coins_per_day = 86400 / t_seconds_per_coin`
- Один предмет = 0.2 BTC, поэтому «BTC/день» = `coins_per_day * 0.2`, но продаётся и считается прибыль **по предмету (0.2 BTC coin)**, не по 1.0 BTC.

**Точный код tarkov.dev** (`src/pages/bitcoin-farm-calculator/data.js`):
```js
const calculateMSToProduceBTC = (numCards, duration = 300000) => {
    return (duration / (1 + (numCards - 1) * 0.041225)) * 1000;
};
export const MaxNumGraphicsCards = 50;
export const MinNumGraphicsCards = 1;
```
> `duration` здесь в секундах, `*1000` → миллисекунды. Отдельного `productionBoostPercent`/множителя в формуле НЕТ — весь буст зашит в коэффициент 0.041225. `duration` в проде берётся из длительности крафта Bitcoin Farm через API; 300000 — фолбэк-дефолт.

### Worked examples (BASE = 300000, патч 1.1.0)

| GPUs | Время/предмет (сек) | Время/предмет | Предметов (0.2 BTC)/день |
|---|---|---|---|
| 1 | 300 000 | 83.33 ч | 0.288 |
| 10 | 218 814 | 60.78 ч | 0.395 |
| 25 | 150 799 | 41.89 ч | 0.573 |
| 50 | 99 337 | 27.59 ч | 0.870 |

Совпадает 1:1 с таблицей timesaver.gg (1 GPU=83ч20м, 50 GPU≈27ч35м, ~0.87/день).

<details><summary>Для справки — та же формула при устаревшем BASE = 145000</summary>

| GPUs | сек/предмет | ч/предмет | предметов/день |
|---|---|---|---|
| 1 | 145 000 | 40.28 | 0.596 |
| 10 | 105 760 | 29.38 | 0.817 |
| 25 | 72 886 | 20.25 | 1.185 |
| 50 | 48 013 | 13.34 | 1.800 |
</details>

**Стопы производства:** нет GPU / выключено питание / накопилось 3 несобранных Bitcoin (5 при Elite Hideout Management).

---

## 3. Расход топлива

- **Топливо жжёт генератор (Generator), а не сама ферма.** Ферма требует лишь чтобы питание было включено. Расход топлива общий на всё убежище, не «за биткоин».
- Базовый расход: **1 единица топлива ≈ 12 мин 38 сек** питания (без модулей).
- Модификаторы длительности:
  - **Solar Power** (солнечная станция, L1): ×2 длительность.
  - **Hideout Management (Elite)**: дополнительно продлевает (см. §4).

**Ёмкости баков (полный бак, базовое питание, без модулей):**

| Бак | Item id | База | + Solar (×2) | + Solar + Elite HM |
|---|---|---|---|---|
| Expeditionary fuel tank | `5d1b371186f774253763a656` | ~12 ч 38 м (**45 473 000 мс**) | ~25 ч 16 м | ~67 ч 22 м |
| Metal fuel tank | `5d1b36a186f7742523398433` | ~33 ч 32 м (…21 ч?)* | ~42 ч (?) | ~112 ч |

> \* tarkov.dev-код фиксирует **Metal = 75 789 000 мс ≈ 21 ч 03 м** базового питания. Wiki-снапшот приводил «33 ч 32 м» для Metal и «12 ч 38 м» для Expeditionary — расхождение по Metal см. в «Confidence». Для расчёта бери **код tarkov.dev как канон**: Expeditionary 45 473 000 мс, Metal 75 789 000 мс.

**Стоимость топлива в день (метод tarkov.dev, `useFuelPricePerDay`):**
```
fuelPricePerDay = (cheaperFuelTank.buyFor.priceRUB / durationMs) * 1000 * 60 * 60 * 24
```
где `durationMs` = базовая длительность выбранного (более дешёвого за единицу питания) бака, применённая с бонусами:
```
durationMs = basePowerDurationMs
durationMs = durationMs / (1 - skillFuelDecreasedConsumptionRate)   // Hideout Management, см. §4
if (solarActive) durationMs = durationMs * 2
```
**Топливо/биткоин** = `fuelPricePerDay / coins_per_day` (руб. на один предмет 0.2 BTC).

---

## 4. Навыки

**Hideout Management** — влияет на **расход топлива**, а не на скорость майнинга.
- **−0.5% расхода за уровень**, кап суммарно **−25%** (в коде: `skillFuelDecreasedConsumptionRate`, `durationMs /= (1 - rate)`, rate ≤ 0.25).
- **Elite Hideout Management** дополнительно: буфер несобранных биткоинов **3 → 5** (меньше простоев фермы), и заметно продлевает питание (см. таблицу баков; для Metal+Solar+Elite до ~112 ч).
- **На скорость производства биткоина Hideout Management НЕ влияет** — скорость только от числа GPU.

Прочих навыков, влияющих на ферму, нет. (Solar Power — это модуль убежища, не навык.)

---

## 5. Продажа Physical Bitcoin

- **Только Терапевту (Therapist). На барахолке продажа ЗАПРЕЩЕНА** (flea-banned) — покупка/продажа Physical Bitcoin на flea недоступна.
- **Один предмет = 0.2 BTC.**
- **Цена Терапевта ДИНАМИЧЕСКАЯ**: привязана к реальному курсу Bitcoin, обновляется ежедневно в **полночь GMT+4**. Диапазон в 2026 наблюдался ~200k…800k+ ₽; актуально на август 2026 ≈ **437 000–440 000 ₽** за предмет (tarkovadvisor: ₽437 365; timesaver: ~440 000 сверено 2026-08-07).
- **basePrice предмета** в справочнике ≈ **100 000 ₽** (историческое значение справочника; НЕ путать с продажной ценой Терапевта — для расчёта прибыли использовать реальную `sellFor` Терапевта).
- В tarkov.dev цена берётся `getMaxSellFor(bitcoinItem)` = максимум по `sellFor[].priceRUB` (де-факто Терапевт, т.к. flea нет).

```js
export const getMaxSellFor = (item) => {
  let max;
  for (const sf of item.sellFor) if (max===undefined || max.priceRUB < sf.priceRUB) max = sf;
  return { ...max };
};
```

---

## 6. Стоимость GPU и окупаемость

- **Graphics card** — id `57347ca924597744596b4e71`.
- Цена (август 2026): барахолка ~**289 000–425 000 ₽**; бартер Mechanic LL3 ~**236 000 ₽**/карта.
- tarkov.dev берёт **дешевейшую `buyFor.priceRUB`** карты × число карт = `graphicsCardsCost`.
- Окупаемость (ROI / payback), точный метод tarkov.dev:
```
totalCosts     = graphicsCardsCost + buildCosts        // buildCosts = стоимость постройки модуля (опц.)
btcProfitPerDay = btcPerDay * btcSellPrice - fuelPricePerDay
profitableDay   = ceil(totalCosts / btcProfitPerDay)   // дней до окупаемости
```
где `btcPerDay` = число предметов (0.2 BTC)/день из §2, `btcSellPrice` = `getMaxSellFor` из §5.

---

## 7. Как tarkov.dev показывает профитность

Страница `tarkov.dev/bitcoin-farm-calculator` (компоненты `index.jsx` + `profit-info.jsx`):
- Ввод: число видеокарт (пресеты обычно 1 / 10 / 25 / 50), тумблеры «учитывать топливо» и «учитывать стоимость постройки», «дней до вайпа».
- Метрики:
  - **Profit per day** = `btcPerDay * btcSellPrice − fuelPricePerDay`.
  - **Profit per GPU** (руб/день на карту) — прибыль/день ÷ число карт (падает с ростом карт из-за diminishing returns).
  - **Days to ROI (payback)** = `ceil(totalCosts / btcProfitPerDay)`.
  - **Remaining profit after wipe** = `(daysLeft − profitableDay) * btcProfitPerDay` (если `daysLeft > profitableDay`).
- Числовая иллюстрация (timesaver, при ~440k Терапевт): ~127k ₽/день @1 GPU; ~174k @10 (≈17.4k/карту); ~252k @25 (≈10.1k/карту); ~383k @50 (≈7.7k/карту).

---

## 8. Поля в `json.tarkov.dev` (для проводки в наше зеркало)

**Станция** (`/{mode}/hideout`, дамп кеширован по id):
- Bitcoin Farm: `id 5d494a445b56502f18c98a10`, `normalizedName "bitcoin-farm"`, `areaType 20`, `name "hideout_area_20_name"` (реальное имя — мержить из `hideout` translations, endpoint `translations:true`).
- ⚠️ **Форма дампа отличается от GraphQL-схемы:** `data` — это **объект, ключ = id станции**, а не массив `hideoutStations[]`. Итерируй `Object.values(data)`.
- Слоты GPU: `levels[].bonuses[]`, где `type:"AdditionalSlots"`, `value:` инкремент слотов (10/15/25 → сумма 10/25/50), `slotItems:["57347ca924597744596b4e71"]` (GPU). `passive:true`, `production:false`.
- `levels[].constructionTime` (сек): L1 122400, L2 180000, L3 381600.

**⚠️ Крафта «Physical Bitcoin» в JSON-дампе НЕТ.** Проверено: `/{mode}/crafts` (214 рецептов) не содержит ни станции bitcoin, ни награды с id биткоина; `levels[].crafts` у станции = `null`. Bitcoin Farm — **пассивная продукция** (station bonus `AdditionalSlots`), не обычный `craft`. ⇒ длительность производства в наше зеркало из API не приходит как craft.duration — **формулу §2 с константой 300000 и коэф. 0.041225 надо зашивать в код калькулятора** (или в конфиг), а не читать из crafts-таблицы.

**Предметы** (`/{mode}/items`):
- Physical Bitcoin: `id 59faff1d86f7746c51718c9c`, `normalizedName "physical-bitcoin"`. Читать `sellFor[]` (Терапевт), `basePrice`. Flea в `sellFor`/`buyFor` не будет (flea-banned).
- Graphics card: `id 57347ca924597744596b4e71`. Читать `buyFor[]` (дешевейшая — flea/Mechanic-бартер).
- Fuel: Expeditionary `5d1b371186f774253763a656`, Metal `5d1b36a186f7742523398433` — `buyFor` для стоимости топлива.
> Гоча дампа: `/{mode}/items` при прямом curl отдавал усечённый объект (10 ключей) — вероятно троттлинг/пагинация Cloudflare. В проде цены тянет наш крон-синк в Supabase, UI читает зеркало (§4.11), id выше стабильны.

---

## Formulas (сводка для реализации)

```
// Слоты
gpuSlots(level) = {1:10, 2:25, 3:50}[level]

// Скорость (BASE = 300000 сек, патч 1.1.0)
secPerCoin(g)   = 300000 / (1 + (g - 1) * 0.041225)
coinsPerDay(g)  = 86400 / secPerCoin(g)          // предметов 0.2 BTC в сутки
btcPerDay(g)    = coinsPerDay(g) * 0.2           // если нужно в «полных» BTC

// Топливо (durationMs — базовая длит. дешёвого бака; Expeditionary 45_473_000, Metal 75_789_000)
hmRate          = min(0.005 * hmLevel, 0.25)     // Hideout Management, кап 25%
effDurationMs   = durationMs / (1 - hmRate) * (solar ? 2 : 1)
fuelPricePerDay = fuelBuyRUB / effDurationMs * 1000 * 60 * 60 * 24
fuelPerCoin     = fuelPricePerDay / coinsPerDay(g)

// Экономика
btcSellPrice    = max(bitcoinItem.sellFor[].priceRUB)   // Терапевт (flea запрещён)
profitPerDay(g) = coinsPerDay(g) * btcSellPrice - fuelPricePerDay
profitPerGPU(g) = profitPerDay(g) / g
totalCosts(g)   = g * gpuBuyRUB + buildCosts
paybackDays(g)  = ceil(totalCosts(g) / profitPerDay(g))
```

---

## Confidence / open questions

- ✅ **Высокая уверенность:** формула `BASE / (1 + (g-1)*0.041225)`, коэффициент 0.041225, слоты 10/25/50, flea-бан Physical Bitcoin, Hideout Management = только топливо −0.5%/ур. кап 25%, Elite буфер 3→5, скорость от GPU (не от навыка), ROI-метод tarkov.dev, item/station id, инкрементальный `AdditionalSlots` в дампе, отсутствие bitcoin-крафта в `/crafts`. Всё сверено ≥2 источника (код tarkov.dev + wiki/гайд + JSON-дамп).
- ⚠️ **BASE = 300000 vs 145000:** актуальный патч 1.1.0 = **300000** (сверено: код tarkov.dev дефолт 300000 + таблица timesaver 1:1). 145000 — старые патчи. Если BSG менял длительность крафта — реальное значение приходит из API-крафта, но крафт **в JSON-дампе отсутствует** (см. §8) → зашить 300000 в конфиг и проверять при вайпах.
- ⚠️ **Длительность Metal fuel tank:** код tarkov.dev = 75 789 000 мс (≈21 ч базы), wiki-снапшот приводил «33 ч 32 м». Расхождение не разрешено на 100% (возможно wiki считает с каким-то модулем или устарел). Для калькулятора взят код tarkov.dev как канон; при точной сверке — перепроверить на живой wiki-странице Metal fuel tank (была недоступна: HTTP 402/403 у fandom при фетче).
- ⚠️ **basePrice Physical Bitcoin (~100000):** справочное, не продажное. Реальная прибыль — по `sellFor` Терапевта (динамика, ~437–440k на авг-2026). Курс меняется ежедневно (полночь GMT+4) — калькулятор должен брать живую цену из зеркала, не хардкодить.
- ⚠️ **Цены GPU/топлива** волатильны (барахолка) — только из живого зеркала.
- 📝 **Fandom/tarkov.dev-HTML недоступны прямым фетчем** (402/403) — числа wiki взяты из поисковых сниппетов и cross-guide; первичка по формулам — исходники tarkov.dev на GitHub (raw) + `json.tarkov.dev` (оба доступны).

---

## Источники

- tarkov.dev калькулятор (исходники): `github.com/the-hideout/tarkov-dev` → `src/pages/bitcoin-farm-calculator/{data.js,index.jsx,profit-info.jsx}` (raw через `raw.githubusercontent.com/the-hideout/tarkov-dev/main/...`) — формула, константы 300000 / 0.041225, слоты, топливо, ROI.
- `https://tarkov.dev/bitcoin-farm-calculator` — живой калькулятор (HTML недоступен фетчу, разобран по исходникам).
- `https://json.tarkov.dev/regular/hideout`, `/regular/crafts`, `/endpoints` — станция bitcoin-farm, bonuses/AdditionalSlots, отсутствие крафта.
- EFT Wiki (Fandom): `Bitcoin_farm`, `Physical_Bitcoin`, `Metal_fuel_tank`, `Expeditionary_fuel_tank`, `Hideout` — слоты, топливо, навык, flea-бан (через поисковые сниппеты; прямой фетч 402/403).
- timesaver.gg: `blog/tarkov-bitcoin-farm-guide` (1.1.0, 2026) — таблица времени/дохода, слоты, цены GPU/Терапевт, сверка формулы.
- tarkovadvisor.com: `item/physical-bitcoin` — Therapist ₽437 365, 0.2 BTC.
- tarkovguide.net `bitcoin-farm-calculator`, gate.com guide — кросс-сверка формулы/констант.
