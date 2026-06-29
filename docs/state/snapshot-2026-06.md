---
type: state
date: 2026-06
branch: feat/maps-frame-sprint
version: v0.2.0
---

# Срез проекта — июнь 2026

CTA — портал-агрегатор для хардкорных extraction-шутеров. Сейчас один гейм — **Escape from Tarkov (EFT)**; архитектура и БД заложены мультигейминговыми (`games` + catch-all `[game]`).

## Стек (фактический)
- **Next.js 16.2.7** (App Router, RSC по умолчанию) — ✅ синхронно с CLAUDE.md (2026-06-28)
- **React 19.2.7** + `babel-plugin-react-compiler` (компилятор включён)
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Zustand 5** — 9 сторов
- **TypeScript 5** strict (`any` запрещён правилами)
- **Drizzle ORM** + Postgres + **Supabase** (auth/storage/db), 18 таблиц, EAV+JSONB
- **Leaflet** — карты; **ReactFlow + dagre** — граф квестов
- **Apollo/graphql** — только в `cron/sync-prices` (единственная точка контакта с api.tarkov.dev)

## Что готово ✅
Каталог предметов (карточка с ценами/бартерами/крафтами, loot-rate, сравнение, избранное, виртуализация) · Quest Map (граф ReactFlow+dagre, кросс-линки Item↔Barter↔Quest) · Бартеры + калькулятор · Прогресс-хаб (achievements, hideout-калькуляторы, loadouts, prestige) · Gamesetting (боссы/торговцы/персонажи) · Карты v1 (Leaflet-фрейм, 4 типа маркеров) · Аккаунт/Auth (Supabase) + admin-CMS · Лендинг · Поиск · Видео · Codex · Styleguide.

## В работе 🟡
- **Карты** — интерактив только v1; `quest_zone` ждёт крон-синка зон; часть локаций без SVG → `SectionPlaceholder`
- **Мультигейминг** — каркас есть, контент только EFT; прочие игры → `PlaceholderPage`

## Заглушки ⛔
- `SectionPlaceholder`/`PlaceholderPage` в 7 местах
- ~~Пустые route-папки: `eft/ammo`, `eft/crafts`, 11× `eft/maps/{customs…woods}`~~ ✅ снесены 2026-06-28 ([[dead-routes-cleanup]])
- `AccountCenter` — захардкоженные даты активности и соц-привязки

## Отклонения от правил
**FSD-lite:** `PlaceholderPage.tsx` и `useIntersectionObserver.ts` в корне `components/` · дубликат хука (`hooks/` + `components/`) · page-компоненты колоцированы в `app/` · ~~CSS раздроблён (`icons.css` + `data/globals.css`)~~ ✅ снят мёртвый дубль 2026-06-29 ([[css-consolidation]]).

NIGHTFALL-счётчики ниже — **автоматические**: их пересчитывает `scripts/sync-style-debt.mjs` (pre-commit хук) из `src/`. Руками не править — перезапишутся. Эталоны: `font-mono`→`font-blender-medium`, `rounded-[Npx]`→`rounded-xs`, сырой HEX→токены.

<!-- debt:auto -->
**NIGHTFALL** (авто): any — 0 шт / 0 файлов · font-mono — 0 файлов · сырой HEX в произвольных значениях — 0 шт / 0 файлов · произвольный rounded в px — 2 шт · v3-утечки (gradient-направление, var() в bg) — ✅ нет.
<!-- /debt:auto -->

## Техдолг
- 🔴 **Supabase JWT ES256** — asymmetric user-токены не валидируются Storage/PostgREST → `auth.uid()=NULL` → RLS режет аватар. Фикс: переключить JWT Keys в Supabase Dashboard.
- ~~CLAUDE.md устарел по версии (Next 14 → 16)~~ ✅ закрыто 2026-06-28 ([[claude-md-version]])
- Живые цены flea — единственная рантайм-зависимость от tarkov.dev (только в кроне; на страницах вызовов быть не должно — правило BACKEND AUTONOMY)
- Захардкоженные данные AccountCenter · стиль-долг · дубликат хука
- `db:push --force` — опасная необратимая операция, владелец схемы = одна сессия

## Точки входа (для ассистента)
Правила — `CLAUDE.md` · бэкенд/БД — скилл `cta-backend` + `src/db/schema.ts` · токены — скилл `nightfall` · индекс файлов — скилл `project-index`.
