---
status: 🔵 обдумываю
affects: architecture
date: 2026-06-26
---

# Нормализовать FSD-lite

**Статус:** 🔵 обдумываю
**Затрагивает:** [[snapshot-2026-06]]

## Контекст
Отклонения от FSD-lite:
- `components/PlaceholderPage.tsx` и `components/useIntersectionObserver.ts` — в корне `components/`, минуя `ui/features/layout`.
- Дубликат хука `useIntersectionObserver` (есть и в `hooks/`, и в `components/`).
- Часть page-компонентов (`*Client.tsx`, `AccountCenter`, `QuestMapClient`) колоцированы в `app/` route-папках.

## Вопросы для за/против
- `PlaceholderPage` → `components/ui/` (это атом) или `components/features/`?
- Хук-дубликат: оставить канон в `hooks/`, удалить из `components/` — что-то сломается в импортах?
- Колоцированные `*Client` в `app/` — переносить в `features/` (строго по FSD) или оставить (прагматично для Next)? Стоит ли свеч?

## За / Против
| | За | Против |
|---|---|---|
| Строгий перенос всего | Чистая архитектура, предсказуемость | Риск задеть импорты, время |
| Точечно (хук + Placeholder) | Быстро, низкий риск | Колокация в app/ остаётся |

## Вывод
*(заполнить)*
