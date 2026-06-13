---
description: NIGHTFALL design system reference — full token registry, typography rules, and Tailwind v4 canonical patterns. Use when writing or reviewing any component styling.
allowed-tools: Read
---

# NIGHTFALL Design System

## Design Token Registry (`src/app/globals.css @theme`)

All tokens auto-generate Tailwind utilities. NEVER use raw HEX equivalents.

| Token | Tailwind utility | HEX |
|---|---|---|
| `--color-base` | `bg-(--color-base)` | `#0D0D0F` |
| `--color-card-menu` | `bg-card-menu` | `#161618` |
| `--color-lines-hover` | `border-lines-hover` | `#222225` |
| `--color-text-primary` | `text-text-primary` | `#F2F2F2` |
| `--color-text-secondary` | `text-text-secondary` | `#9CA3AF` |
| `--color-text-muted` | `text-text-muted` | `#52525B` |
| `--color-tactical-amber` | `text-tactical-amber` | `#E68E25` |
| `--color-accent-frago` | `text-accent-frago` | `#00CDAB` |
| `--color-nvg-green` | `text-nvg-green` | `#689963` |
| `--color-online` | `text-online` | `#6B9963` |
| `--color-danger` | `text-danger` | `#C24339` |
| `--color-danger-dim` | `bg-danger-dim` | `#7E2C25` |
| `--color-mode-pvp` | `text-mode-pvp` | `#9A8866` |
| `--color-mode-pve` | `text-mode-pve` | `#0095E2` |
| `--color-edition-tue` | `text-edition-tue` | `#51C6DB` |
| `--color-edition-eod` | `text-edition-eod` | `#CB8A00` |
| `--color-edition-pfe` | `text-edition-pfe` | `#9A8866` |
| `--color-edition-lb`  | `text-edition-lb`  | `#9CA3AF` |
| `--color-edition-std` | `text-edition-std` | `#52525B` |
| `--primary` (dynamic) | `bg-(--primary)` | theme-dependent |

## Typography Rules

| Element | Classes |
|---|---|
| Body text | `font-blender-book` |
| Headers | `font-blender-medium uppercase tracking-widest` |
| Numbers, prices | `font-mono text-xs` |
| Secondary text | `text-text-secondary` |
| Muted / disabled | `text-text-muted` |

## Tailwind v4 Canonical Syntax

Always generate canonical, never arbitrary equivalents:

| Wrong | Correct |
|---|---|
| `bg-[var(--token)]` | `bg-(--token)` |
| `bg-gradient-to-b` | `bg-linear-to-b` |
| `rounded-[2px]` | `rounded-xs` |
| `stroke-[3]` | `stroke-3` |
| `h-[60px]` | `h-15` |
| `z-[100]` | `z-100` |

**Scale rule:** if px value is divisible by 4 → canonical class exists. `N/4` = Tailwind scale unit.
Examples: 60→h-15, 36→h-9, 220→w-55, 76→w-19, 64→w-16, 18→w-4.5, 20→h-5, 56→w-14.
Non-divisible (79px, 66px, 3px) → keep arbitrary.

## CSS Variable Syntax

```tsx
// ✅ Correct
<div className="bg-(--color-card-menu) border-lines-hover text-text-primary">

// ❌ Wrong
<div className="bg-[var(--color-card-menu)] bg-[#161618]">
```

## Gradient Syntax

```tsx
// ✅ Correct
<div className="bg-linear-to-r from-lines-hover to-transparent">

// ❌ Wrong  
<div className="bg-gradient-to-r from-lines-hover to-transparent">
```
