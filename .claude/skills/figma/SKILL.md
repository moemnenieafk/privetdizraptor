---
description: Transform Figma auto-generated code (inline styles, HEX colors, absolute px) into a proper CTA component with NIGHTFALL tokens and Tailwind v4 canonical classes. Use whenever the user pastes Figma code or describes a design from Figma.
allowed-tools: Write Read Glob
---

# Figma → CTA Component Transform

## Step 1 — Understand Design Intent

Before writing code, identify from the Figma input:
- What type of component is this? (atom → `ui/`, interactive → `feature/`, shell → `layout/`)
- What is the data shape? (static, props-driven, from Zustand?)
- Where does it live in FSD-lite?

## Step 2 — Map Figma Values to NIGHTFALL

### Colors (HEX → Token)

| Figma HEX | NIGHTFALL token | Tailwind utility |
|---|---|---|
| `#0D0D0F` | `--color-base` | `bg-(--color-base)` |
| `#161618` | `--color-card-menu` | `bg-card-menu` |
| `#222225` | `--color-lines-hover` | `border-lines-hover` |
| `#F2F2F2` | `--color-text-primary` | `text-text-primary` |
| `#9CA3AF` | `--color-text-secondary` | `text-text-secondary` |
| `#52525B` | `--color-text-muted` | `text-text-muted` |
| `#E68E25` | `--color-tactical-amber` | `text-tactical-amber` |
| `#00CDAB` | `--color-accent-frago` | `text-accent-frago` |
| `#689963` | `--color-nvg-green` | `text-nvg-green` |
| `#C24339` | `--color-danger` | `text-danger` |
| `#7E2C25` | `--color-danger-dim` | `bg-danger-dim` |
| dynamic accent | `--primary` | `bg-(--primary)` / `text-(--primary)` |

If HEX doesn't match any token — use the closest token. Never use raw HEX in output.

### Font (Figma fontFamily → CTA class)

| Figma | Tailwind |
|---|---|
| Blender Pro Book / Regular | `font-blender-book` |
| Blender Pro Medium + uppercase | `font-blender-medium uppercase tracking-widest` |
| Any monospace / numbers / prices | `font-mono text-xs` |

### Layout (Figma absolute → Tailwind flex/grid)

| Figma | Tailwind |
|---|---|
| `display: flex; alignItems: center` | `flex items-center` |
| `display: flex; justifyContent: space-between` | `flex items-center justify-between` |
| `gap: N` | `gap-N/4` (if divisible by 4) |
| `padding: N` | `p-N/4` |
| `display: grid; gridTemplateColumns: repeat(N, ...)` | `grid grid-cols-N` |

### Sizes (px → canonical scale, base unit = 4px)

If px ÷ 4 = whole number → use scale class: `h-15` not `h-[60px]`.
Non-divisible (3px, 1px, 79px) → keep arbitrary.

### Border radius

| Figma | Tailwind |
|---|---|
| `borderRadius: 1` or `2` | `rounded-xs` |
| `borderRadius: 4` | `rounded` |
| `borderRadius: 8` | `rounded-lg` |
| `borderRadius: 9999` (pill) | `rounded-full` |

## Step 3 — Write the Component

- Remove all `style={{}}` inline styles — replace with Tailwind classes
- Remove all raw HEX values
- Tailwind class order: **Position → Size → Typography → Colors → Breakpoints**
- TypeScript: no `any`, explicit prop interfaces
- Loading state: `animate-pulse` skeleton if data is async
- Use `'use client'` only if the component needs hooks or event handlers

## Step 4 — Output Format

```
### src/components/[layer]/[ComponentName].tsx
[full component code]
```

If multiple files needed (hook, store slice, helper) — output all of them.
