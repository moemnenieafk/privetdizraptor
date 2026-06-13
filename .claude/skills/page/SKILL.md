---
description: Create a new Next.js App Router page for CTA project — generates page.tsx (Server Component), optional Client Component, and wires up the correct directory structure. Use when adding a new route under /eft/ or top-level.
arguments:
  - name: route
  - name: title
allowed-tools: Write Read Glob
---

# New Page Scaffold

## Directory Convention

All EFT game content lives under `src/app/eft/`. Top-level portal pages at `src/app/`.

```
src/app/eft/[route]/
  page.tsx           ← Server Component (always)
  [Route]Client.tsx  ← Client Component (only if needed)
```

## When to Split into Client Component

Create a `[Route]Client.tsx` when the page needs:
- `useState`, `useEffect`, `useRef`
- Zustand store access
- Interactive filters, modals, or tabs
- Animations that require DOM access

If the page is purely static or fetches server-side data only → keep everything in `page.tsx`.

## Template: Static Page (Server Only)

```tsx
// src/app/eft/$0/page.tsx
import type { Metadata } from 'next';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export const metadata: Metadata = {
  title: '$1 | CTA — Centre Tactical Adaptation',
  description: '',
};

export default function $1Page() {
  return (
    <main className="flex min-h-screen flex-col bg-(--color-base)">
      {/* content */}
    </main>
  );
}
```

## Template: Page with Client Component

```tsx
// src/app/eft/$0/page.tsx
import type { Metadata } from 'next';
import { $1Client } from './$1Client';

export const metadata: Metadata = {
  title: '$1 | CTA — Centre Tactical Adaptation',
  description: '',
};

export default function $1Page() {
  return <$1Client />;
}
```

```tsx
// src/app/eft/$0/$1Client.tsx
'use client';

export function $1Client() {
  return (
    <main className="flex min-h-screen flex-col bg-(--color-base)">
      {/* content */}
    </main>
  );
}
```

## Template: Page with Data Fetching (GraphQL)

```tsx
// src/app/eft/$0/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '$1 | CTA',
  description: '',
};

async function getData() {
  // fetch from tarkov.dev GraphQL or internal API
}

export default async function $1Page() {
  const data = await getData();
  
  return (
    <main className="flex min-h-screen flex-col bg-(--color-base) px-4 py-6 md:px-8">
      {/* content */}
    </main>
  );
}
```

## Layout Patterns

- Full-bleed page: `min-h-screen bg-(--color-base)`
- Content container: `max-w-[1100px] mx-auto px-4 md:px-8`
- Section header: `font-blender-medium uppercase tracking-widest text-text-primary`
- Loading skeleton: `animate-pulse bg-lines-hover rounded-xs`

## Checklist

- [ ] `metadata` export with title + description
- [ ] `'use client'` only in the Client Component, never in `page.tsx`
- [ ] Background: `bg-(--color-base)` not raw HEX
- [ ] Data fetching async in Server Component
- [ ] Empty state component if list can be empty
- [ ] Page added to navigation config if it needs a menu entry
