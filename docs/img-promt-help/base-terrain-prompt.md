# База-терреин — промт image-to-image (Gemini Pro)

Слой 1 карты (растр, режется в тайлы z0–z6). Рестайл собранного арта в чистую игровую подложку
с рельефом/глубиной, БЕЗ векторизации и БЕЗ объектов (объекты — отдельный слой).

## Модель и настройки
- **`gemini-3-pro-image`** (у Pro есть style-reference слот — держит серию регионов).
- Grounding **OFF** (иначе тянет фото-референсы). Thinking у Pro включён.
- Вход 1 = исходный регион (геометрия, которую СОХРАНИТЬ). Вход 2 = утверждённый первый регион = STYLE ANCHOR.

## Промт (1722 симв.)
```
Restyle the attached top-down map region into a clean flat game-map BASE layer. This is image-to-image: keep the exact layout — every road, path, building footprint, wall, water edge, rail line and terrain boundary stays in the same place, shape and size. Do not add, remove, move or invent anything; do not draw vehicles, props or labels (those live on a separate layer). Restyle only the surface.

VIEW: orthographic, straight down, no perspective, no tilt.

SURFACES: paint each ground material as its own flat colour zone with a clean edge — asphalt roads as dark-grey ribbons, dirt and gravel as warm browns, grass as muted olive, concrete pads as light grey, water as dark blue-grey. One material per zone, no photo texture, no noise.

ELEVATION & DEPTH (must NOT look flat): add soft shaded relief lit by a single consistent light from the top-left. Raised ground, banks, ridges and rooftops catch a lighter top-left highlight; slopes, ditches, tunnels, bridge undersides and enclosed courtyards fall into soft shadow. Darken the edge of every level change with a thin ambient-occlusion line so height reads at a glance — while each surface stays a flat map tone.

PALETTE: muted post-industrial tones — charcoal asphalt, olive grass, warm tan dirt, grey concrete, rust accents, dark blue-grey water.

EDGES: keep the region seamless — surfaces run to all four borders and line up with neighbouring tiles. Match the second attached image as the STYLE ANCHOR for palette, contrast and relief strength.

OUTPUT: high-resolution raster, top-down, no lettering, borders, drop shadows or gradients on flat zones (relief shading only), no invented objects. Reads as a clean printed game-map base ready to tile.
```

## Укороченная версия (≤1500, если агент режет)
```
Restyle the attached top-down map region into a clean flat game-map BASE layer (image-to-image): keep the EXACT layout — roads, paths, building footprints, walls, water edges, rail lines, terrain boundaries stay in place, shape and size. Add/move/invent nothing; no vehicles, props or labels (separate layer).

Orthographic, straight down, no perspective.

SURFACES: each ground material a flat colour zone with clean edges — asphalt dark grey, dirt/gravel warm brown, grass muted olive, concrete light grey, water dark blue-grey. No photo texture or noise.

ELEVATION (must not look flat): soft shaded relief, one light from top-left. Raised ground/banks/ridges/roofs get a top-left highlight; slopes, ditches, tunnels, bridge undersides, enclosed yards fall to soft shadow; thin ambient-occlusion line on every height edge — surfaces stay flat map tones.

PALETTE: muted post-industrial — charcoal, olive, tan, grey, rust, blue-grey water.

EDGES: seamless, run to all borders, line up with neighbour tiles; match the 2nd image as STYLE ANCHOR.

Output: high-res raster, top-down, no lettering/borders/drop-shadows, flat zones (relief only), no invented objects.
```

## 16K-конвейер (важно)
Вывод модели ~1–4K < 16K → работаем **регионами**:
1. Режем 16K на перекрывающиеся регионы (~4K, паттерн `map-stitch`).
2. Первый регион — крутим до эталона, он становится **анкером** (вход 2 для всех следующих).
3. Остальные регионы — рестайл с анкером, тег «seamless, line up with neighbour tiles».
4. Сшиваем в 16K → тайлы z0–z6.
Альтернатива для быстрого тона: рестайл даунскейла всей карты как подложка-тон под чёткие объекты.

## Опция: карта высот/глубины (для будущего света/3D)
Отдельным прогоном тем же входом:
`…instead output a GRAYSCALE HEIGHT MAP of the same region: white = highest ground/rooftops, black = lowest/water, smooth gradients following elevation only, no colour, no objects, no texture.`
Растр высот кладётся как множитель тени под базой — усиливает глубину, ничего не перерисовывая.

## Порядок объектов над базой
Готовая база → поверх ставятся компоненты из библиотеки (дедуп) → слой разметки (лут/выходы/имена).
