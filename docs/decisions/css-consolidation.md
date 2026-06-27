---
status: 🔵 обдумываю
affects: styles
date: 2026-06-26
---

# Собрать раздробленный CSS

**Статус:** 🔵 обдумываю
**Затрагивает:** [[fsd-lite-normalize]]

## Контекст
CSS разбросан: `src/styles/icons.css` + `src/data/globals.css`. Глобальный CSS внутри `data/` — нелогичное место (data — для данных, не стилей).

## Вопросы / за-против
- Перенести `globals.css` в `src/styles/` (или `src/app/`)? Где Next ожидает глобальные стили в App Router.
- Объединять `icons.css` в `globals.css` или держать раздельно по назначению?
- Не затронет ли импорт `globals.css` в `layout.tsx`?

## Вывод
*(заполнить)*
