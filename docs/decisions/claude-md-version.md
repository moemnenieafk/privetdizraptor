---
status: ✅ сделано
affects: CLAUDE.md
date: 2026-06-26
done: 2026-06-28
---

# CLAUDE.md: Next 14 → Next 16

**Статус:** ✅ сделано (2026-06-28) — применено через цепочку docs→code
**Затрагивает:** [[snapshot-2026-06]]

## Контекст
В `CLAUDE.md` стек заявлен как Next.js 14, фактически проект на **16.2.7** + React 19 + react-compiler. App Router тот же, но указание версии вводит в заблуждение, и устаревшие правила могут подсказать неверные паттерны.

## Вывод
Поправить блок стека в `CLAUDE.md`: Next 14 → **Next 16 (App Router, React 19, react-compiler enabled)**. Заодно дописать реальный стек, которого нет в файле: Zustand 5, Drizzle + Supabase, и правило **BACKEND AUTONOMY** (рантайм-вызовы api.tarkov.dev запрещены, только крон).

## Исполнено (2026-06-28)
Применено в `CLAUDE.md §3 TECH STACK`. При исполнении сверено с реальным кодом — часть пункта устарела:
- ✅ `Next.js 14` → `Next.js 16 (App Router, React 19 + react-compiler)`.
- ✅ `Zustand` → `Zustand 5`.
- ✅ Добавлена строка **Backend:** Drizzle ORM + Postgres/Supabase.
- ⏭️ **BACKEND AUTONOMY** дописывать не пришлось — правило уже было добавлено ранее (§4.11). Урок цепочки: исполнитель сверяет решение с актуальным кодом, а не применяет слепо.
