---
status: 🔵 обдумываю
affects: account, tracking, items
date: 2026-07-03
---
# Трекинг: Нужные предметы

## Цель
Секция «Нужные предметы» во вкладке «Трекинг» ([[player-tracking-tab]]): сводка предметов, которые игроку СЕЙЧАС нужны — для активных квестов (needed/found, FIR) и апгрейдов убежища — с прогрессом сбора и кросс-линками на карточки предметов. Часть платного контура трекинга (PRO).

## Контекст
- Квестовые требования УЖЕ вычисляются: `useQuestStore` → `getActiveItemRequirements(tasks, completedQuests, itemProgress)` → `{item, needed, found, foundInRaid}` (bridge для `/eft/progress/tracker` — проверить, что за страница и что переиспользовать).
- Убежище: `useHideoutStore` (station→level) + таблица `hideout_upgrades` (itemRequirements) — можно вычислить «что нужно на следующий уровень станций».
- Иконки: `icon-eft-prog-items-needed`, `icon-eft-prog-items-tracker`. Иконки предметов: `itemIconUrl()`.
- Инкремент найденного: `incrementItem/decrementItem` в useQuestStore (для квестовых), у убежища счётчиков нет.

## Развилки
- Объединять квестовые + hideout в один список или две подсекции?
- Компакт-строки или плитки? (для «нужных» логичнее строки с прогрессом X/Y, плитки — у избранного)
- Синк найденного для hideout-предметов — нужен ли вообще (нет стора количества)?

## Гарды
- Квестовая часть — чистая агрегация. Hideout-счётчики — возможен новый стор (localStorage, без БД). PRO-гейт — общий (см. хаб).

---
*Хаб: [[player-tracking-tab]] · Процесс: [[engineering-loop]]*
