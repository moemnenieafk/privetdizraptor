---
status: ✅ сделано
done: 2026-07-03
affects: account, tracking, items
date: 2026-07-03
---
# Трекинг: Нужные предметы

## Цель
Домен «Предметы» во вкладке «Трекинг» ([[player-tracking-tab]]): дайджест того, что игроку сейчас нужно собирать — квестовые предметы (X/Y, FIR, ±) + предметы на следующие уровни станций убежища. Гибрид: топ-список с инкрементом тут, полный список — `/eft/progress/needed`.

## Развилки — ЗАКРЫТЫ V4DYA (2026-07-03, Q&A)
| Развилка | Решение |
|---|---|
| Объём v1 | **Квестовые + убежище** (две подсекции) |
| Глубина | **Дайджест + ссылки**: сводка-цифры + **топ-N ближайших к завершению** квестовых предметов со строками X/Y и **±** прямо во вкладке; «Весь список» → `/eft/progress/needed` |
| Суб-табы / PRO | см. [[tracking-side-quests]] (общие решения) |

## Контекст (факты разведки 2026-07-03)
- **Полная страница УЖЕ существует**: `/eft/progress/needed` — табы Квесты (`NeededItemsClient`) + Убежище (`HideoutNeededClient`). НЕ дублируем — дайджест.
- Квестовые: `useQuestStore.getActiveItemRequirements(tasks, completed, itemProgress)` → `{item, needed, found, foundInRaid}`; инкремент `setItemCount/incrementItem/decrementItem` (синк в облако уже есть).
- Убежище: `getHideoutNeeds()` (`src/db/hideout.ts`, таблица `hideout_upgrades` + items) → агрегат по itemId с sources; фильтр по построенным уровням — клиентский (`useHideoutStore.levels`).
- ⚠️ objectives всех 520 квестов в бандл не тащим: server-side готовим **плоский список квестовых требований** `{questId, questName, objectiveId, itemId, name, short, icon, count, fir}` (только TaskObjectiveItem) — клиент фильтрует по `completedQuests` и считает.

## План
1. `src/lib/tracking-digest.ts` — добавить `questItemRequirements` (плоские требования из `EFT_QUESTS`); hideout — `getHideoutNeeds()` в `account/page.tsx`.
2. Новый `src/app/account/TrackingItemsDigest.tsx`:
   - сводка: квестовые (всего/собрано/осталось) + убежище (осталось предметов/юнитов с учётом `useHideoutStore.levels`);
   - **топ-N (5-6) квестовых предметов, ближайших к завершению**: иконка (`itemIconUrl`), имя, прогресс-бар X/Y, FIR-бейдж, кнопки ± (`useQuestStore`);
   - подсекция убежища: топ-строки «предмет × кол-во» (без ±, счётчиков у убежища нет);
   - CTA «Весь список» → `/eft/progress/needed`. mounted-гард, мобилка.
3. `tsc` → приёмка → коммит (общий с [[tracking-side-quests]]).

## Критерий готовности
- [x] `tsc` чисто; ± во вкладке двигает `itemProgress` (и наоборот — синк со страницей tracker/needed)
- [x] Убежище учитывает построенные уровни из `useHideoutStore`
- [x] Цифры сходятся с `/eft/progress/needed`

## Гарды
- Сторы/БД/API не трогаем — чистая агрегация. Коммит по «ок».

---

## Исполнено (2026-07-03) — на приёмке
`tsc` чисто, БД/сторы не тронуты. `tracking-digest.ts` отдаёт плоские `itemRequirements` (TaskObjectiveItem), `account/page.tsx` дозагружает `getHideoutNeeds()`. Новый `src/app/account/TrackingItemsDigest.tsx`: сводка (предметов собрано/всего + осталось шт.) + CTA «Весь список» → `/eft/progress/needed`; топ-6 квестовых предметов ближайших к завершению (иконка, FIR, бар, X/Y, **±** → `setItemCount`, маппинг предмет→objectives: + в первую незаполненную, − из последней ненулевой); убежище — остаток на непостроенные уровни с учётом `useHideoutStore.levels` (топ-строки × кол-во, без счётчиков).

### Доработка 1 по приёмке (2026-07-03)
- **Валюта/патроны = «стек за 1 шт.»** (флаг `stackAsOne` в digest, server-side: валюта по `CURRENCY_IDS`, патроны по `types:'ammo'` из зеркала prices): в счётчиках дайджеста не суммируются рубли/пачки (гигантские «4520023 шт.» ушли), ± бинарный (весь стек / ноль).
- Страница `/eft/progress/needed`: **ручной ввод количества** (input 0..needed, `setItemCount`) рядом с ± — для денег/патронов кликать нереально.
- Бейдж «FIR» → **«Найдено в рейде»** везде (needed ×2 + фильтр, tracker, дайджест).

---
*Хаб: [[player-tracking-tab]] · Процесс: [[engineering-loop]]*
