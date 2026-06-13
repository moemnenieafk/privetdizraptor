---
description: Code quality refactor for CTA project — TypeScript strict mode, DRY hook extraction, performance patterns. Use before committing or when reviewing existing code for issues.
allowed-tools: Grep Read Edit Write Glob
---

# CTA Refactor Checklist

## TypeScript Strict

- `any` is FORBIDDEN everywhere. Replace with:
  - Specific type: `string`, `number`, `boolean`
  - Union: `string | number`
  - Discriminated union for complex shapes
  - `unknown` + type guard if source is truly unknown
  - GraphQL response types from the schema

- Sort comparators must be typed:
  ```tsx
  // ❌
  const aValue: any = ...
  // ✅
  const aValue: string | number = ...
  ```

- Props interfaces: always explicit, never implicit.
- `eslint-disable-next-line @typescript-eslint/no-explicit-any` only for legitimate union types from external APIs (e.g., tarkov.dev GraphQL `properties` field).

## DRY — Hook Extraction

When 2+ components share identical state logic (useState + useEffect + useRef blocks), extract to a hook in `src/hooks/`.

### Modal animation pattern
3+ modals with open/close animation → use `useModalAnimation(isOpen, onClose)` from `src/hooks/useModalAnimation.ts`.

Exception: if a modal has conditional `useClickOutside` (e.g., `isVisible && !isOtherModalOpen`), keep its logic inline — don't force into the shared hook.

### Naming
- `use` prefix always
- Located in `src/hooks/`
- `'use client'` directive at top of hook file

## Performance

- Long lists (>50 items) → virtualize (react-window or similar)
- Heavy client libs → `next/dynamic` with `ssr: false`
- Stable components receiving same props → `React.memo`
- Avoid inline object/array creation in JSX props

## Import Hygiene

- Remove unused imports immediately (TS6133 errors)
- No default + named re-exports unless required
- Group: React → Third-party → Internal (`@/...`) → Relative

## Deprecated APIs

- `frameBorder="0"` on iframe → `style={{ border: 'none' }}`
- `className` for styling, never `style` for layout (exception: `animationDelay`)

## Server vs Client Split

Move these OUT of components into helpers or Zustand:
- Quest tree calculations
- Barter math
- Derived state from multiple sources

Keep components as thin renderers.
