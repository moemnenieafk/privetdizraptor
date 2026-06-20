# CTA Design Sync — Notes

## Project
- **Claude Design project:** Tactical Adaptation Centre - Design System by V4DYA
- **Project ID:** `2f0ac1a5-7724-4645-988c-68745661df2c`
- **URL:** https://claude.ai/design/p/2f0ac1a5-7724-4645-988c-68745661df2c
- **Shape:** tokens-only (no component bundle)
- **Synced:** 2026-06-18 (re-sync: added trader colors, kappa, lightkeeper tokens)

## Why tokens-only

CTA is a Next.js application, not a publishable design system package. Components depend on `next/link`, `next/image`, `next/navigation` which can't be esbuild-bundled outside the Next.js runtime. Full component sync would require Next.js stubs and significant work for limited gain.

## What was uploaded
- `styles.css` — NIGHTFALL tokens as standard `:root` CSS custom properties + @font-face
- `_ds_bundle.css` — Component utility classes (tactical-card-base, tactical-menu-item, icon-mask, etc.)
- `_ds_bundle.js` — Empty IIFE (tokens-only DS, no React components)
- `fonts/BlenderPro-Book.woff2` — Book weight (body)
- `fonts/BlenderPro-Medium.woff2` — Medium weight (headings, stats)
- `README.md` — Conventions for the design agent

## Re-sync procedure

On CSS token or pattern changes:
1. Update `ds-bundle/styles.css` or `ds-bundle/_ds_bundle.css` manually (or re-run this sync)
2. Copy updated font files if changed
3. Re-run the upload sequence with the same planId approach

No `package-build.mjs` / `resync.mjs` scripts needed — this is a hand-maintained tokens-only bundle.

## Re-sync risks

- **Token drift:** If `globals.css` gains new tokens, `ds-bundle/styles.css` needs manual update
- **Font changes:** If BlenderPro files move from `public/fonts/`, update the upload localPath
- **No anchor:** `_ds_sync.json` was intentionally omitted — full re-upload every time (cheap for 8 files)
- **No component previews:** The design agent has token/pattern knowledge but cannot render CTA-specific React components

## Known warns
- `[RENDER_SKIPPED]` — expected, no previews authored (tokens-only)
