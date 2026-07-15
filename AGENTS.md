<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CTA Project — Agent Context

**Project:** Centre Tactical Adaptation — Hardcore Extraction Shooter Portal (EFT hub + multi-game).  
**Version:** 4.3.0  
**Stack:** Next.js 16 (App Router, RSC + react-compiler) · Tailwind CSS v4 · Zustand · TypeScript strict.  
**Data source:** our Supabase mirror. UI reads ONLY our backend (`getEftCatalog`/`getEftPriceMapFromDb`/`cta-api`); tarkov.dev is synced by a server cron, never at request time (see CLAUDE.md rule 11 — BACKEND AUTONOMY).

## Architecture (FSD-lite)
- `src/components/ui/` — dumb atoms, Server Components, props only
- `src/components/features/` — smart, `'use client'`, Zustand allowed
- `src/components/layout/` — Header, Footer, modals
- `src/store/` — Zustand stores only (`usePlayerStore`)
- `src/hooks/` — custom hooks (`use` prefix, `'use client'` directive)
- `src/actions/` — Next.js Server Actions
- `src/data/` — static dictionaries, headerConfig, pageContent, slang
- `src/lib/` — formatters, search-engine, tarkov-colors, eft-catalog, cta-api, item-icon
- `src/app/eft/` — all EFT game routes

## Key Components (v4.1.0)
- `CategoryControlBar` — items filter bar (search, sort, armor class, barter, advanced filters)
- `EftItemTile/` — composable tile (Root/Header/Media/Name/Pricing + tooltips)
- `ItemsCategoryClient` — items catalog client (cards-only via `EftItemTile` + sort; table view removed)
- `useCategoryFilters` — hook for filter state (localStorage persistence)
- `CategoryTabs` — subcategory tab navigation

## Non-negotiable Rules
- `any` is FORBIDDEN — use discriminated unions or `string | number`
- No raw HEX — only NIGHTFALL design tokens via `bg-(--color-token)` syntax (NOT `[var(--token)]`)
- No `bg-gradient-to-*` — use `bg-linear-to-*` (Tailwind v4)
- No arbitrary px if canonical scale exists: `h-15` not `h-[60px]`
- No `font-mono` — use `font-blender-medium text-xs` for numbers/prices/stats
- Tailwind class order: Position → Size → Typography → Colors → Breakpoints
- Loading states: `animate-pulse` skeletons, never spinners
- Heavy libs (Leaflet, Canvas): `next/dynamic` with `ssr: false`
- Sticky panels: sticky wrapper must contain ALL related content (control bar + expanded panel together)
