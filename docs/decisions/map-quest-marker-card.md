---
type: decision
status: done
created: 2026-08-26
game: eft
---
# Карты: клик по квест-маркеру → карточка Визарда с Quest Node

**Статус:** ✅ реализовано (ветка `feat/map-quest-marker-card`, 3 коммита: `19ecb38f` + `4a18fe2e` + `49a0b3a5`). Грилл проведён до автопилота, все развилки закрыты V4DYA. Билд webpack зелёный, tsc 0. Ждёт live-verify V4DYA + пуш.

## Контекст (проблема)
Синканные из tarkov.dev маркеры зон заданий (`quest_zone`) по клику **не открывали ничего**: клик-хендлер сверял `m.type === 'quest'`, а синканные несут тип `quest_zone` и не пробрасывали `questId` в клиент. Статик-карты по клику уводили на отдельную вкладку `/eft/quests/task/[id]` — вырывало из контекста карты.

## Решение (грилл → канон)
Клик по ЛЮБОМУ квест-маркеру (синканный `quest_zone`, editorial `linkKind='quest'`, статик `questId`) → **read-only карточка Визарда типа «Квест»** поверх карты (переиспользован `EditorialMarkerCard`, show-режим). Шапка = `label` маркера; ниже — **`QuestRow`** привязанного квеста (тот же ряд, что в drawer «Поиск на локации»). Клик по `QuestRow` → панель **«Подробности задания»** (`QuestDetail variant="drawer"`) через общий канал стора — без новых вкладок. Нерезолвнутый квест → мягкая строка «Задание недоступно».

## Как сделано (файлы)
- **Сервер:** `src/app/eft/maps/[slug]/page.tsx` — при сборке `MapViewMarker` для `quest_zone` кладёт `questId = linkedQuestId` (сам `getEftMapData` отдаёт `MapMarkerRow[]`, `MapViewMarker` собирается в page).
- **`QuestRow`** вынесен в общий `src/components/features/maps/QuestRow.tsx` (переиспуск drawer'ом поиска и карточкой). API: `{ q: MapQuestLite, query?, active?, onSelect: (id)=>void }`.
- **`EditorialMarkerCard`**: новый проп `onOpenQuest?(questId)`; в show-режиме статичный ряд `linkedQuest` заменён кликабельным `QuestRow`; фолбэк «Задание недоступно» при `linkKind==='quest'` без данных.
- **Общий канал детали:** `useMapUiStore.openQuestDetail(questId)` + `selectedQuestId` (уже были). Мобильный `MapQuestDetailSheet` (`lg:hidden`) уже слушал; добавлен десктопный `MapQuestDetailDesktop` (`hidden lg:flex`, смонтирован в `MapFrame`, смещение `searchOpen ? left-87 : left-0`). `MapSearchDrawer` переведён на общий канал, локальный master-detail убран.
- **`MapViewerClient`**: клик-хендлер расширен на `(quest || quest_zone) && questId` → карточка через механизм-близнец `infoMarker` (поповер над меткой, закрытие Esc/клик-мимо); синтез `EditorialMarkerView`, резолв `LinkedQuestInfo` из пропа `quests` (протянут `MapFrame → MapViewerLoader → MapViewerClient`); `onOpenQuest → openQuestDetail`, карточка гасится при открытии детали.

## Не входит / не тронуто
- Deep-link `?quest=` (перелёт/подсветка зоны в `MapFrame`) — не тронут.
- Схема БД, кроны синка — не тронуты (фича = «просто UI» поверх зеркала, §4.11).
- Пообъектные координаты целей (пины отдельных объективов) — в зеркале нет x/z у `TaskObjective`, гранулярность на уровне квеста (как в существующем `MapQuestDetailSheet`).

## Долг / открытое
- **Live-verify V4DYA:** визуальная сверка на живой карте с квест-зонами (напр. `/eft/maps/streets`, `/eft/maps/customs`) — автопилот браузер не гонял.
- Доля синканных `quest_zone` с резолвимым `linkedQuestId` — проверить живьём; фолбэк «Задание недоступно» держит нерезолв.
- 3 предсуществующих eslint-замечания в `MapViewerClient.tsx` (cycleToLayer-before-declared + React-Compiler memo) — НЕ от этой задачи, не трогались.

## Автопилот
Собрано навыком `/autopilot` (полный автомат, 2026-08-26). Требования/спека/таски — `.autopilot/map-quest-marker-card/`.
