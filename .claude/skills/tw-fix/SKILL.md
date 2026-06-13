---
description: Find and fix Tailwind v4 non-canonical syntax violations across the project or in a specific file. Use when IDE flags warnings or before committing component code.
allowed-tools: Grep Read Edit
---

# Tailwind v4 Canonical Fixer

## Step 1 — Find Violations

Run these Grep patterns to locate all violations:

```
pattern: z-\[\d+\]         → z-[100], z-[50], etc.
pattern: stroke-\[\d+\]    → stroke-[3]
pattern: rounded-\[\d+px\] → rounded-[2px], rounded-[1px]
pattern: h-\[\d+px\]       → h-[60px], h-[36px]
pattern: w-\[\d+px\]       → w-[220px], w-[76px]
pattern: pt-\[\d+px\]      → pt-[28px]
pattern: bg-\[var\(         → bg-[var(--token)]
pattern: bg-gradient-to-    → bg-gradient-to-b/r/l/t
```

## Step 2 — Apply Canonical Mapping

### Z-index
Any `z-[N]` → `z-N` (always canonical in Tailwind v4)

### Stroke
`stroke-[3]` → `stroke-3`

### Rounded
`rounded-[1px]` → `rounded-xs`
`rounded-[2px]` → `rounded-xs`
Non-standard radii → keep arbitrary

### Pixel values (divisible by 4 rule)
Scale unit = 4px. `N/4` = Tailwind scale value.

| px | canonical |
|---|---|
| 4 | 1 |
| 8 | 2 |
| 10 | 2.5 |
| 12 | 3 |
| 16 | 4 |
| 18 | 4.5 |
| 20 | 5 |
| 24 | 6 |
| 28 | 7 |
| 32 | 8 |
| 36 | 9 |
| 40 | 10 |
| 48 | 12 |
| 56 | 14 |
| 60 | 15 |
| 64 | 16 |
| 72 | 18 |
| 76 | 19 |
| 80 | 20 |
| 96 | 24 |
| 100 | 25 |
| 112 | 28 |
| 120 | 30 |
| 160 | 40 |
| 176 | 44 |
| 220 | 55 |
| 348 | 87 |
| 400 | 100 |
| 700 | 175 |

Non-divisible (79px, 66px, 3px, 1px) → leave as arbitrary.

### CSS Variables
`bg-[var(--token)]` → `bg-(--token)`
`text-[var(--token)]` → `text-(--token)`
`border-[var(--token)]` → `border-(--token)`

### Gradients
`bg-gradient-to-b` → `bg-linear-to-b`
`bg-gradient-to-r` → `bg-linear-to-r`
`bg-gradient-to-l` → `bg-linear-to-l`
`bg-gradient-to-t` → `bg-linear-to-t`

## Step 3 — Verify

After edits, re-run the Grep patterns to confirm 0 matches remain in the modified files.
