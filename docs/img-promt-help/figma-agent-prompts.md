# Промты для Figma-ИИ-агента (объекты)

Два универсальных промта: (1) НАРИСОВАТЬ флэт-вектор объекта с нуля, (2) ВЕКТОРИЗОВАТЬ растр.
Стиль — та же ДНК, что в `CTA-MAP-OBJECTS-vector-prompts.md` (топ-даун, ≤3 тона, константная
обводка, LOD 1/40, палитра Завода), но фон **прозрачный** (нативный вектор в Figma).

---

## 1. Нарисовать объект (флэт-вектор, ~1300 симв.)
Слот `{SUBJECT}` бери из `customs-objects-subjects.md`. Запас на подстановку ~180 симв.

```
Draw a flat top-down vector game-map asset: {SUBJECT}.

VIEW: orthographic bird's-eye, camera straight down, only horizontal surfaces visible. Solid flat colour shapes with hard edges. No perspective, isometric, tilt or gradient.

SHADING: each material at most 3 flat tones — base, one shadow, one highlight — every tone a solid area with a hard boundary. No soft shadow, gloss, bloom, noise or photo texture.

LINEWORK: dark outline of constant weight around the outer silhouette and each major part; weight never tapers.

STRUCTURE: render repeated features — tread plates, corrugation, planking, tyre lugs, grilles, ribs, seams, bolts — as clean parallel shapes at even spacing.

PALETTE: muted post-industrial Tarkov tones — rusty orange, olive/khaki green, steel blue-grey, warm tan, dark charcoal, brown wood. One colour per material.

FRAME: one object, centred, even ~5% margin on all sides, empty corners, transparent background. The object meets the background only at its outline and casts no shadow onto it.

DETAIL: keep every part at least 1/40 of the width; merge anything smaller into the flat colour around it. No lettering, borders, drop shadows, ground, floor or props — only the object itself.

Reads as a printed vector map icon: flat inks, hard edges, clean paper.
```

**Как заполнять `{SUBJECT}`:** гипер-конкретно, простым языком, БЕЗ игровых имён. Не `military
truck`, а `a six-wheeled cargo truck with an open flatbed, spare wheel behind the cab, twin
exhaust stacks, canvas tilt`. Именно детализация держит силуэт.

---

## 2. Векторизовать растр (трассировка)
⚠️ Флаги vtracer НЕЛЬЗЯ скормить встроенной векторизации Figma — у агента свой трейсер, слабее.
Для трассировки эталонного качества: гони **сам vtracer** → SVG → импорт (см. `vtracer-settings.md`).
Этот промт — на случай, когда остаёшься в Figma.

```
Vectorize the attached raster into clean flat vector paths. If you can run vtracer, use these settings: mode spline, hierarchical stacked, filterSpeckle 4, colorPrecision 8, layerDifference 16, cornerThreshold 60, spliceThreshold 45, pathPrecision 8, colorMode color.

Otherwise trace it as solid flat-fill shapes — one closed path per colour region, hard edges, NO strokes. Merge specks smaller than ~1/40 of width into the surrounding fill. Keep the dark outline as its own single shape. The background becomes one shape and is deleted, leaving a transparent canvas. Snap near-straight edges to lines but preserve the curved car body. Name each layer by its fill colour. Output clean SVG with no gradients, filters, masks or embedded raster.
```

**Важно:** чистый вектор выходит только из ПЛОСКОГО входа. Сырой игровой кроп → каша (сотни
путей). Плоский вход даёт Gemini-флэт. Цепочка эталона: **Gemini-флэт → vtracer → чистый вектор.**
