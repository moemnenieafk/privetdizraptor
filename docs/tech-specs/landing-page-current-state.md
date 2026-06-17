# CTA Лендинг — Текущее состояние разработки

> Дата: 2026-06-17 · Ветка: main
> Используй этот документ как точку входа при продолжении работы над лендингом.

---

## Статус блоков

| # | Блок | Файл | Статус |
|---|------|------|--------|
| 1 | Terminal Boot Hero | `HomeClient.tsx` + `TerminalBoot.tsx` | ✅ Готово |
| 2 | Active Context Bar | `ActiveContextBar.tsx` + `TraderCountdown.tsx` | ✅ Готово |
| 3 | Supply Database Grid | `SupplyGrid.tsx` | ✅ Готово |
| 4 | Tactical Cartography | `TacticalCartography.tsx` + `TacticalCartographyClient.tsx` | ✅ Готово |
| 5 | Comms Network Hub (fullkamen) | `CommsHub.tsx` | ✅ Готово |
| 6 | Diagnostics Footer | `Footer.tsx` | ✅ Готово |

---

## Реализованная архитектура

```
src/app/layout.tsx
  └── ConditionalLayout ("use client")
        ├── Header
        ├── StreamStatus
        ├── <main> → page.tsx
        │     ├── ActiveContextBar   ← Server Component
        │     │     └── TraderCountdown  ← "use client", countdown
        │     └── HomeClient         ← "use client"
        │           ├── TerminalBoot     ← boot animation, ~860ms
        │           ├── [Hero Section]   ← статичный JSX
        │           ├── supplySection    ← React.ReactNode prop
        │           │     └── SupplyGrid ← Server Component
        │           ├── [Carousel]       ← GAMES_DATA
        │           └── [Videos]         ← LiteYouTube, fetchLatestYouTubeVideos
        └── Footer ("use client")   ← DiagnosticsFooter
```

### Ключевой паттерн: Server → Client передача
`SupplyGrid` (Server Component) нельзя импортировать внутри `HomeClient` (Client Component).
Решение: `page.tsx` рендерит `<SupplyGrid>` и передаёт как `React.ReactNode` prop:
```tsx
// page.tsx
<HomeClient supplySection={<SupplyGrid items={supplyItems} />} />
```

---

## Файлы лендинга

| Файл | Тип | Назначение |
|------|-----|------------|
| `src/app/page.tsx` | Server Component (async) | Корень, `Promise.all` fetch, сборка |
| `src/actions/tarkov-context.ts` | Server Action | Статус сервера + тикер + таймеры, `revalidate: 60` |
| `src/actions/tarkov-supply.ts` | Server Action | 12 волатильных предметов + buyback, `revalidate: 120` |
| `src/types/supply.ts` | TypeScript | Тип `SupplyItem` |
| `src/components/features/home/TerminalBoot.tsx` | Client | Boot-анимация 4 строки × 160ms |
| `src/components/features/home/HomeClient.tsx` | Client | Hero + carousel + videos, получает `supplySection` prop |
| `src/components/features/home/ActiveContextBar.tsx` | Server | Sticky бар: сервер · тикер · таймер |
| `src/components/features/home/TraderCountdown.tsx` | Client | Live обратный отсчёт, пульс при <60s |
| `src/components/features/home/SupplyGrid.tsx` | Server | Грид 12 карточек gap-px |
| `src/components/layout/Footer.tsx` | Client | DiagnosticsFooter: nav + ping + about |

---

## Блок 4 — Tactical Cartography (реализовано)

**Файлы:**
- `src/actions/tarkov-cartography.ts` — Server Action, `revalidate: 300`, fetchs Kappa tasks + maps
- `src/components/features/home/TacticalCartography.tsx` — Server Component-обёртка
- `src/components/features/home/TacticalCartographyClient.tsx` — Client, hover → подсветка локации

**Архитектура:** тот же Server→Client prop паттерн. TacticalCartography передаётся в HomeClient как `tacticalSection?: React.ReactNode`.

**Что реализовано:** Split-screen: left=8 Kappa-квестов (по experience DESC), right=контекст локации при hover (все квесты на той же карте + wiki ссылка). Bottom CTA → `/eft/questmap`.

## Блок 4 — (оригинальный план)

**Концепция из дизайн-документа (`cta-mainpage-landing-trend2026-deep-research.md` §5.4):**
Сплит-скрин между активными квестами и интерактивной картой. При hover на квест — подсветка POI на карте.

**Архитектурное решение (заготовка):**
- `src/components/features/home/TacticalMap.tsx` — Server Component, данные из tarkov.dev
- Передаётся в `HomeClient` как `React.ReactNode` prop (тот же паттерн что SupplyGrid)
- Листлет (`leaflet`) → `next/dynamic` с `ssr: false`

**GraphQL для этого блока** (`/tarkov-api` для точных полей):
```graphql
query {
  maps { name normalizedName wiki }
  tasks(limit: 10) {
    name
    map { name }
    objectives { description }
    experience
  }
}
```

**Важно:** Перед реализацией вызвать `/tarkov-api` — карты и квесты имеют специфичную схему с inline-fragments.

---

## Блок 5 — Comms Network Hub (fullkamen)

**Концепция из дизайн-документа (§5.5):**
Стилизован под перехват радиопередачи. Заголовок: `[ УСТАНОВЛЕНО СОЕДИНЕНИЕ // ЧАСТОТА: ФИЛОСОФИЯ КАМЕНИЗМА ]`

**Что уже есть:**
- В `HomeClient.tsx` есть видео-секция `СМОТРИ ВИДЕО` с `LiteYouTube` — это прообраз.
- `fetchLatestYouTubeVideos()` уже работает.

**Что нужно:**
- Апгрейд текущей видео-секции до `CommsHub` с военной радио-эстетикой
- Twitch live-статус (fetch `https://api.twitch.tv/helix/streams?user_login=fullkamen`)
- Социальные кнопки: Telegram `https://t.me/fullkamen`, Discord, Boosty
- Компонент: `src/components/features/home/CommsHub.tsx` (Client, нужен useEffect для Twitch)

---

## Дизайн-правила (напоминалка)

- `transition-none` везде — мгновенный hover, без анимации
- `border-radius: 0` — острые углы только
- Разделители: `border-lines-hover` (#313135), не тени
- Заголовки: `font-blender-medium uppercase tracking-widest`
- Числа/таймеры: `font-blender-medium text-xs tabular-nums`
- Скелетоны: `animate-pulse`, никаких спиннеров
- Accent: `var(--primary)` → `bg-(--primary)` / `text-(--primary)`

---

## Ссылки на спецификации

- Итерационный план (v1 Brutalism): `@gemini-deep-research/tech-specs/landing-page-sprints.md`
- **User Friendly Roadmap (v2 Clarity): `@gemini-deep-research/tech-specs/landing-userfriendly-2.0.md`** ← АКТИВНЫЙ ПЛАН
- Дизайн-исследование: `@gemini-deep-research/дизайн система/cta-mainpage-landing-trend2026-deep-research.md`
- Скилл лендинга: `.claude/skills/cta-landing/SKILL.md`
- Дизайн-система: `/nightfall`
- API Tarkov: `/tarkov-api`
