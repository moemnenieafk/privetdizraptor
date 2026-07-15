---
type: state
date: 2026-07
branch: main
version: pre-release (pkg 4.4.0)
---

# Срез проекта — июль 2026

CTA — портал-агрегатор для хардкорных extraction-шутеров. Активный гейм один — **Escape from Tarkov (EFT)**; архитектура и БД мультигейминговые (`games` + catch-all `[game]`). Продукт в фазе **релиз-гигиены перед запуском бесплатным ядром** ([[release-readiness-2026-07]]).

**Масштаб:** 77 страниц · 45 API-роутов (10 cron-синков) · 20 Zustand-сторов · 2071 файл в репо.

## Стек (фактический)
- **Next.js 16.2.7** (App Router, RSC по умолчанию)
- **React 19.2.7** + `babel-plugin-react-compiler`
- **Tailwind CSS v4** (`@tailwindcss/postcss`) · дизайн-система **Nightfall**
- **Zustand 5** — 20 сторов
- **TypeScript 5** strict (`any` запрещён правилами; авто-счётчики Nightfall держат долг на 0)
- **Drizzle ORM** + Postgres + **Supabase** (auth/storage/db)
- **Leaflet** — карты · **ReactFlow + dagre** — граф квестов · **TanStack Virtual** — виртуализация · **embla** — карусели
- **Google Gemini 2.5 Flash** — OCR профиля игрока (`api/profile-ocr`)
- **api.tarkov.dev** — только в cron (`sync-prices`, `sync-weapons`), на страницах рантайм-вызовов нет (правило BACKEND AUTONOMY)

## Что готово ✅
- **Каталог предметов** — карточка (цены/бартеры/крафты), loot-rate, price-slot, сравнение (hard-scoped), избранное, виртуализация.
- **Квесты** — граф Quest Map (ReactFlow+dagre), страницы тасков, side/lore/events, кросс-линки Item↔Barter↔Quest, story-walkthroughs (13 сюжеток).
- **Прогресс-хаб** — achievements, hideout (модули + bitcoin/craft-profit калькуляторы), **loadouts** (см. ниже), prestige («Путь к Престижу», геймификация), **seasons/perks-builder**, needed-items (stash overlay), tracker.
- **Loadouts / Оружейник** — build store (undo), стат-движок, community catalog (`b/[code]`), «мои билды», **Gunsmith solver** (`find/gunsmith/[objectiveId]`), интеграция плейлиста Gunsmith @fullkamen.
- **Gamesetting** — боссы (векторный манекен, damage-виз, BossItemLoadout), торговцы, персонажи, материалы.
- **Loot-containers** — реальные лут-таблицы (sp-tarkov/server).
- **Карты v1** — Leaflet-фрейм, типы маркеров, quest-zones, player-position tracking (File System Access API).
- **Comlink** 🆕 — community/UGC-хаб: blog, discussions, find-partner, masterclasses, sherpa-exchange, reports, candidates, game-updates.
- **Профиль игрока** 🆕 — локальный (`usePlayerStore`, до 5 профилей ЧВК) + облачный (`api/eft/player-profile`, таблица `playerProfiles`) + **OCR** со скриншота (Gemini): nickname, level, prestige, edition, faction, mode.
- **Геймификация** — XP/streak/badges/trader-tier ранги (пока **заточено под бартер-калькулятор**: XP = профит сделок).
- **Телеметрия** — `PlayerTelemetry` (header) + `TelemetryDetailsClient` + player-tracking.
- **Аккаунт/Auth** — Supabase (service-role роуты + Drizzle, не client-RLS) + **admin-CMS** (items, media, articles, codex, stories).
- **Прочее** — лендинг, глобальный поиск (`search-engine`), видео (архив @fullkamen, RSS-fallback, плейлисты), **Codex** + `slang.ts`, styleguide.

## В работе 🟡 (блокеры релиза)
- **SEO-минимум** — `sitemap.ts`/`robots.ts`/метаданные/OG (сейчас стайлгайдовские) + `error.tsx` (500) + `noindex` на styleguide.
- **Футер** — реальные URL вместо `#` ([[cta-footer-redesign]]).
- **Юр-текст** — privacy/terms (черновики без силы).
- **RLS-аудит Comlink** (UGC!) + `/security-review` ([[pre-mvp-release-audit]] Проход 2).
- **Карты** — интерактив v1; часть локаций без SVG → `SectionPlaceholder`.
- **Мультигейминг** — каркас есть, контент только EFT.

## Заглушки / долг ⛔
- `SectionPlaceholder`/`PlaceholderPage` в местах без контента.
- Nightfall-долг: авто-счётчики (`sync-style-debt.mjs`, pre-commit) — any/font-mono/HEX держатся на 0.
- Оплата подписки — рельс не выбран (Boosty ~20% отклонён; [[monetization-subscriptions]], [[deep-research-payment-rails]]).

## Подписка (финализировано)
`free` **Боец** (0₽) · `operative` **Оперативник** (199₽) · `veteran` **Ветеран** (449₽). Тир — серверная истина (`subscriptions`), не persist. Гейт-инфраструктура: `subscription.server.ts`, `useSubscriptionStore`, `<Paywall>`.

## Ключевые точки профиля/поведения (для «Ульты» — [[adaptive-hub-ulta]])
- `usePlayerStore.PlayerProfile` — nickname/level/prestige/faction/edition/mode/traderLevels. **Нет `hoursPlayed`.**
- `types/profile-ocr.ProfileOcrResult` — тот же набор без часов. OCR-скрин профиля EFT показывает часы/рейды/выживаемость → есть что дораспознавать.
- Телеметрия (`PlayerTelemetry`) — источник поведенческих сигналов.
- Геймификация — есть каркас XP/ранг/бейджей, но barter-scoped; для глобальной роли нужен отдельный слой.

## Точки входа (для ассистента)
Правила — `CLAUDE.md`/`AGENTS.md` · бэкенд/БД — скилл `cta-backend` + `src/db/schema.ts` · токены — скилл `nightfall` · индекс файлов — скилл `project-index` · решения — `docs/_index.md`.
