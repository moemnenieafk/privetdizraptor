# CTA NIGHTFALL — Design Agent Conventions

## Typography

Two fonts ship, both **BlenderPro**. Use them exclusively — no system fonts, no generic sans:

| Family | CSS var | Use for |
|---|---|---|
| `"BlenderPro-Book"` | `var(--font-blender-book)` | Body copy, descriptions, labels |
| `"BlenderPro-Medium"` | `var(--font-blender-medium)` | Headings, badges, stats, numbers |

All headings (`h1`–`h4`) are uppercase by default. Numbers, prices, and stats: BlenderPro-Medium at small size (`font-size: 0.75rem`). **Never use monospace or system fonts.**

## Color System

All colors are CSS custom properties. Use them — never raw hex.

**Surfaces:**
- `var(--color-base)` — `#141416` — main page background
- `var(--color-darkbase)` — `#0D0D0E` — deeper background, sidebars
- `var(--color-card-menu)` — `#242426` — card/panel fill
- `var(--color-lines-hover)` — `#313135` — borders, dividers

**Text:**
- `var(--color-text-primary)` — `#F2F2F2` — main readable text
- `var(--color-text-secondary)` — `#9696A1` — secondary labels
- `var(--color-text-muted)` — `#54545C` — hints, inactive items

**Dynamic accent (changes with game theme):**
- `var(--primary)` — active color, hover fills, CTAs. EFT default: `#E68E25` (amber)
- `var(--shadow-neon)` — matching neon glow for this theme

**Game themes:** wrap a section in `.theme-eft`, `.theme-frago`, `.theme-gzw` etc. to shift `--primary` and `--shadow-neon` automatically.

**Semantic:**
- `var(--color-nvg-green)` / `var(--color-success)` — success, crafts, positive
- `var(--color-danger)` — destructive / failure states
- `var(--color-tactical-amber)` — warnings, economy
- `var(--color-online)` — online indicator
- `var(--color-kappa)` — `#BDA550` — Kappa container badge
- `var(--color-lightkeeper)` — `#2ED399` — Lightkeeper trader accent

**EFT Trader accents** (use for trader-specific UI elements):
- `var(--trader-prapor)`, `var(--trader-therapist)`, `var(--trader-fence)`, `var(--trader-skier)`, `var(--trader-peacekeeper)`, `var(--trader-mechanic)`, `var(--trader-ragman)`, `var(--trader-jaeger)`, `var(--trader-ref)`, `var(--trader-lightkeeper)`, `var(--trader-btr-driver)`

## Styling Idiom

This is a CSS custom property system with Tailwind v4 utility classes. Style with:

1. **Tokens first** — `color: var(--color-text-secondary)`, `background: var(--color-card-menu)`
2. **Tailwind utilities** — spacing, flex, grid (e.g. `gap-7`, `px-4`, `flex items-center`)
3. **Component classes** — `tactical-card-base`, `tactical-menu-item`, `icon-mask`, `icon-bg`

Never invent new colors. Never use raw hex. If a needed value isn't in the token list, use the closest token.

## Component Classes

| Class | Purpose |
|---|---|
| `.tactical-card-base` | Standard dark card with neon hover lift |
| `.tactical-menu-item` | Nav item — `--primary` fill on hover |
| `.tactical-gradient-border` | Gradient accent border (position parent relative) |
| `.tactical-tooltip` | Tooltip overlay pattern |
| `.icon-mask` | SVG icon recolorable via `color`/`currentColor` |
| `.icon-bg` | Raster icon, no recolor |
| `.hub-heading` | Responsive section heading (18–24px clamp) |
| `.hub-description` | Responsive sub-heading text (12–16px clamp) |
| `.animate-on-scroll` + `.is-visible` | Scroll-triggered fade-in-up |

## Minimal Build Example

```html
<div style="background: var(--color-base); color: var(--color-text-primary); font-family: var(--font-blender-book); padding: 2rem;">
  <h2 style="font-family: var(--font-blender-medium); text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary);">
    ТАКТИЧЕСКИЙ БЛОК
  </h2>
  <div class="tactical-card-base" style="padding: 1rem; margin-top: 1rem;">
    <p style="color: var(--color-text-secondary); font-size: 0.875rem;">
      Контентная зона карточки
    </p>
  </div>
</div>
```

## Where the Truth Lives

- Token definitions: `styles.css` (`:root {}` block)
- Component patterns: `_ds_bundle.css`
- Fonts: `fonts/BlenderPro-Book.woff2`, `fonts/BlenderPro-Medium.woff2`
