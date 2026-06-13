---
description: Scaffold a new CTA component following FSD-lite architecture and NIGHTFALL design system. Use when creating new UI atoms, feature components, or layout parts.
arguments:
  - name: component-name
  - name: type
allowed-tools: Write Read Glob
---

# New Component Scaffold

## Directory by Type

| Type | Path | Rules |
|---|---|---|
| `ui` | `src/components/ui/$0.tsx` | Dumb atom. No `'use client'`, no Zustand, no side effects. Props only. |
| `feature` | `src/components/features/$0.tsx` | `'use client'` required. Zustand allowed. Complex logic lives here. |
| `layout` | `src/components/layout/$0.tsx` | Shell/nav/modals. `'use client'` if animation or state. |

## Server vs Client

Default = Server Component (no directive).
Add `'use client'` only when the component uses:
- `useState`, `useEffect`, `useRef`, `useCallback`
- Browser APIs (window, document)
- Zustand store
- Event handlers (onClick, onChange on interactive elements)
- Animation state

## Template: UI Atom (Server)

```tsx
import type { FC } from 'react';

interface $0Props {
  // props here
}

export const $0: FC<$0Props> = ({ /* props */ }) => {
  return (
    <div className="/* Position Size Typography Colors Breakpoints */">
      {/* content */}
    </div>
  );
};
```

## Template: Feature Component (Client)

```tsx
'use client';

import { useState } from 'react';
// import useStore from '@/store/yourStore';

interface $0Props {
  // props here
}

export function $0({ /* props */ }: $0Props) {
  return (
    <div className="/* Position Size Typography Colors Breakpoints */">
      {/* content */}
    </div>
  );
}
```

## NIGHTFALL Styling Checklist

- [ ] No raw HEX — only design tokens
- [ ] `bg-(--color-base)` syntax, not `bg-[var(--token)]`
- [ ] Headers: `font-blender-medium uppercase tracking-widest`
- [ ] Body: `font-blender-book`
- [ ] Numbers/prices: `font-mono text-xs`
- [ ] Gradients: `bg-linear-to-*` not `bg-gradient-to-*`
- [ ] Rounded corners: `rounded-xs` not `rounded-[2px]`
- [ ] px values divisible by 4 → canonical scale class
- [ ] Tailwind class order: Position → Size → Typography → Colors → Breakpoints
- [ ] Loading state: `animate-pulse` skeleton, never spinner

## TypeScript Checklist

- [ ] No `any` — discriminated unions or specific types
- [ ] Sort comparators typed as `string | number`
- [ ] Props interface explicit, no implicit types
- [ ] Server Actions in `src/actions/`, not inside components
