---
status: ✅ сделано
affects: styles
date: 2026-06-26
done: 2026-06-29
---

# Собрать раздробленный CSS

**Статус:** ✅ сделано (2026-06-29) — через сверку docs↔code
**Затрагивает:** [[fsd-lite-normalize]] · [[snapshot-2026-06]]

## Контекст
CSS разбросан: `src/styles/icons.css` + `src/data/globals.css`. Глобальный CSS внутри `data/` — нелогичное место (data — для данных, не стилей).

## Вопросы / за-против
- Перенести `globals.css` в `src/styles/` (или `src/app/`)? Где Next ожидает глобальные стили в App Router.
- Объединять `icons.css` в `globals.css` или держать раздельно по назначению?
- Не затронет ли импорт `globals.css` в `layout.tsx`?

## Вывод
Премиса заметки устарела. CSS не «раздроблён»: в коде **три** файла, и `globals.css` **уже** лежит в `app/` (канон App Router). Сверено по импортам:

- `src/app/globals.css` — ✅ боевой, его грузит `layout.tsx`; весь `@theme` + `@import "../styles/icons.css"`; стоит правильный `source("../")`.
- `src/styles/icons.css` — ✅ боевой, реестр icon-mask классов (~315 строк), подключён из `app/globals.css`. Держим **раздельно по назначению** — не место в globals.
- `src/data/globals.css` — ☠️ мёртвый дубль, не импортится нигде. Старая версия с опасным `@import "tailwindcss"` **без** `source("../")` — тот самый триггер freeze-готчи.

**Решение:** не «переносить/объединять», а **удалить `src/data/globals.css`**. Три вопроса заметки отпадают: переносить нечего (globals уже в app/), icons.css уже подключён, `layout.tsx` грузит app-версию — удаление data/ его не задевает.

## Исполнено (2026-06-29)
Через сверку docs↔code (анализ, не `/execute-decision`). Факты сверх заметки:
- 🗑️ Удалён мёртвый `src/data/globals.css` (ни одного `import`; git: `D`). `app/globals.css` и `icons.css` не тронуты.
- 📝 Снят deviation «CSS раздроблён» в [[snapshot-2026-06]].
- ⏭️ **Сознательно не переносил** уникальный блок-потолок жирности (`--font-weight-bold: 500` и пр.) из мёртвого файла: `font-bold/semibold/extrabold` в `.tsx` не используются (0 совпадений) — блок ничего не держит. Вернуть запрет faux-bold на уровне токенов = 4 строки в `app/globals.css`, git-история их хранит.
