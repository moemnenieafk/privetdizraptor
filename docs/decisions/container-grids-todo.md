---
status: 🟡 в работе — ручная простановка сеток контейнеров
affects: item-detail, capacity-grid, container-grid-overrides, SlotGrid
date: 2026-07-22
---

# Контейнеры-хранилища без сетки — ручная простановка

Обзор предметов, у которых нет данных о сетке вместимости в наших источниках (свежий
патч EFT — SPT/tarkov.dev отстают). Правятся вручную в `src/data/container-grid-overrides.json`
(поле `grids`: `width`×`height`; несколько секций = несколько объектов; `allowedCats` —
опц. что вмещает). Заполненные я забираю: `node scripts/dump-container-grids-spt.mjs` →
`tsx scripts/etl-items.ts` → БД → блок «Вместимость» (`SlotGrid`) загорается.

**Распаковываемые дроп-кейсы (Arena/Twitch/лутбоксы редкости) убраны** — у них нет
сетки-хранилища (открываются на верстаке). Всего осталось: **27**.

Связано: [[autonomy-prices-research]] (SPT-путь), скилл `game-asset-extraction`.

## Точно контейнеры — 20

| Название | EN | Футпринт | Сетка | id |
|---|---|---|---|---|
| Банка под болты | Nut can | 1x1 | ✅ 3x3 | `693bfb50d5c25889e701d444` |
| Боевой ранец 5.11 Tactical "RUSH 100" (Черный) | 5.11 Tactical RUSH 100 backpack (Black) | 6x7 | — | `67458730df3c1da90b0b052b` |
| Грузовая рама Mystery Ranch "NICE Frame Load Sling" с защитным кейсом | Mystery Ranch NICE Frame Load Sling | 5x6 | ✅ 5x7 | `68947ad3e4bf255d1b0ca75c` |
| Защищенный контейнер "Гамма" | Secure container Gamma | 3x3 | ✅ 3x3 | `68f8e04eae031982b00e7aaf` |
| Защищенный контейнер "Гамма" (Loui Peeton) | Secure container Gamma (Loui Peeton) | 3x3 | ✅ 3x3 | `68f117b8121d878a2303eee0` |
| Защищенный контейнер "Каппа" (Осквернённый) | Secure container Kappa (Desecrated) | 3x3 | ✅ 3x4 | `676008db84e242067d0dc4c9` |
| Кейс для бронеплит | Ballistic plate case | 4x2 | ✅ 8x12 | `67600929bd0a0549d70993f6` |
| Кейс для ключей | Key case | 3x2 | ✅ 11x7 | `67d3ed3271c17ff82e0a5b0b` |
| Кейс для редких жетонов "Twitch" | Twitch rare dogtag case | 1x1 | ✅ 5x5 | `6937ecc3dbdccab44605fcf0` |
| Копилка SheefGG | SheefGG piggy bank | 2x2 | ✅ 4x4 | `69f9d319c906cd16da03b374` |
| Непростой бумажник Loui Peeton | Loui Peeton deluxe wallet | 1x1 | ✅ 3x2 | `6937eccbfd921faceb0dfecd` |
| Поясная сумка (Loui Peeton) | Fanny pack (Loui Peeton) | 2x2 | ✅ 3x2 | `68d55968ca9935b3f10607a9` |
| Рюкзак LBT-1476A 3Day Pack (MultiCam Alpine) | LBT-1476A 3Day Pack (MultiCam Alpine) | 4x5 | ✅ 5x5 | `67458794e21e5d724e066976` |
| Рюкзак Mystery Ranch "2 Day Assault Pack" (Черный) | Mystery Ranch 2 Day Assault Pack (Black) | 5x6 | ✅ 5x6 | `68947ab5a733b1602007e2fe` |
| Рюкзак Mystery Ranch "Terraframe" (Новогодний) | Mystery Ranch Terraframe backpack (Christmas Edition) | 5x6 | — | `674da9cf0cb4bcde7103c07b` |
| Рюкзак Mystery Ranch "Terraframe" (Олива) | Mystery Ranch Terraframe backpack (Olive Drab) | 5x6 | — | `674da107c512807d1a0e7436` |
| Рюкзак Tasmanian Tiger "Modular Pack 45 Plus" (MultiCam Black) | Tasmanian Tiger Modular Pack 45 Plus (MultiCam Black) | 5x8 | ✅ 5x8 | `68947a8ce4bf255d1b0ca759` |
| Термосумка для напитков "Hot Rod" | Hot Rod beverage cooler bag | 2x2 | ✅ 7x7 | `6937ecd37713b904480013ac` |
| Тубус для плакатов | Poster tube | 1x3 | ✅ 8x10 | `697883474afb9f7de10380ba` |
| Ящик с инструментами "Discord ver." | Toolbox (Discord Version) | 2x2 | ✅ 6x6 | `688b2dba67bf6fa26c07e918` |

## Свежие (properties пустые) — 7

| Название | EN | Футпринт | Сетка | id |
|---|---|---|---|---|
| Бронированный кейс | Armored case | 4x4 | — | `68dfc07da7cfeed3e60204e7` |
| Бронированный кейс | Armored case | 4x4 | — | `68fa8e253666e2fd5b00a626` |
| Ключ от кейса | Case key | 1x1 | — | `67449b6c89d5e1ddc603f504` |
| Открытый кейс | Opened case | 2x2 | — | `674078c4a9c9adf0450d59f9` |
| Письмо из почтового ящика | Letter from the mailbox | 1x1 | — | `68d2fc914aae290cf704e373` |
| Плакат с необычной разгрузкой | Unusual leather rig poster | 2x2 | — | `67f924b1b07831a6ef0ce317` |
| Ящик "Echo Belli" | Echo Belli crate | 3x2 | — | `69d39aacf1954acdb3083285` |
