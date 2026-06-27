---
type: index
---

# CTA — Карта проекта

Мыслительная среда проекта **Centre Tactical Adaptation** (ЦТА) — портал-агрегатор для extraction-шутеров.
Здесь раскладываю проект по пунктам: что есть, что решить, куда дальше. Код живёт в `../src`, правки — через Claude Code.

> Открой **Graph View** (Ctrl+G), чтобы видеть связи между решениями и фичами.

## 📍 Текущее состояние
- [[snapshot-2026-06]] — полный срез проекта (стек, что готово, долги). Обновлять при крупных вехах.

## 🧭 Решения — пройтись по за/против
Каждая заметка: контекст → варианты → за/против → вывод.

> **Статус-борд** — авто из фронтматтера заметок (Dataview). Единственный источник правды по статусам; ниже — навигация по темам.

```dataview
TABLE WITHOUT ID file.link AS "Решение", status AS "Статус", affects AS "Зона", date AS "Заведено"
FROM "decisions"
SORT status ASC, date ASC
```

**Гигиена кода**
- [[dead-routes-cleanup]] — снести пустые route-папки (ammo, crafts, 11×maps) и `graphify-out`
- [[fsd-lite-normalize]] — вынести `PlaceholderPage` + хук из корня `components/`, слить дубликат хука
- [[css-consolidation]] — собрать раздробленный CSS, убрать `globals.css` из `data/`

**Стиль-долг (NIGHTFALL)**
- [[style-debt]] — `any`×8, `font-mono`×7, сырой HEX, `rounded-[Npx]`×6 → `/tw-fix` + `/refactor`

**Блокеры**
- [[supabase-jwt-fix]] — критичный: ES256 ломает загрузку аватара (RLS режет `auth.uid()`)
- [[claude-md-version]] — CLAUDE.md заявляет Next 14, по факту Next 16

**Развитие**
- [[maps-v2-scope]] — карты: больше типов маркеров, зоны квестов, локации без подложки
- [[multigaming-second-game]] — когда и как добавить вторую игру
- [[account-real-data]] — убрать захардкоженные даты/соц-привязки из AccountCenter

## 🎯 Видение
- [[roadmap]] — горизонт и приоритеты: что разрабатываю/улучшаю дальше

## 🗂 Шаблоны
- [[decision]] — шаблон решения (за/против)
- [[feature]] — шаблон фичи
