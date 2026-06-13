<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CTA Project — Agent Context

**Project:** Centre Tactical Adaptation — Hardcore Extraction Shooter Portal (EFT hub).
**Stack:** Next.js 16 (App Router) · Tailwind CSS v4 · Zustand · TypeScript strict · Apollo GraphQL.
**Data source:** tarkov.dev public GraphQL API.

## Architecture (FSD-lite)
- `src/components/ui/` — dumb atoms, Server Components, props only
- `src/components/features/` — smart, `'use client'`, Zustand allowed
- `src/components/layout/` — Header, Footer, modals
- `src/store/` — Zustand stores only
- `src/hooks/` — custom hooks (`use` prefix, `'use client'` directive)
- `src/actions/` — Next.js Server Actions
- `src/app/eft/` — all EFT game routes

## Non-negotiable Rules
- `any` is FORBIDDEN — use discriminated unions or `string | number`
- No raw HEX — only NIGHTFALL design tokens via `bg-(--color-token)` syntax
- No `bg-gradient-to-*` — use `bg-linear-to-*` (Tailwind v4)
- No arbitrary px if canonical scale exists: `h-15` not `h-[60px]`
- Tailwind class order: Position → Size → Typography → Colors → Breakpoints
- Loading states: `animate-pulse` skeletons, never spinners
- Heavy libs (Leaflet, Canvas): `next/dynamic` with `ssr: false`

## Current Priority (Phase 2)
Items database, item detail pages, trader modules, barter/craft.
Phase 3 (Maps, Quest Tracker) is paused.

## Key Files to Read First
- `CLAUDE.md` — roles, execution rules, design token quick-ref
- `DESIGN_SYSTEM.md` — full NIGHTFALL spec
- `PROJECT_STRUCTURE.md` — routing and file paths
