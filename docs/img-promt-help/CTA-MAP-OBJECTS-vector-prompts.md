# CTA — векторизация вырезанных объектов карт (v2)

Один инвариант на весь набор. Между объектами меняется **только `{SUBJECT}`** и матовый фон.
Фиксированные блоки копируются байт-в-байт: переписанный «для разнообразия» блок уводит стиль.

## Модель и настройки

| Этап | Модель | Разрешение | Почему |
|---|---|---|---|
| Подбор анкера (8–12 прогонов) | `gemini-3.1-flash-image` | **512px** | анкера ещё нет, стиль-слот не нужен · $0.045 за прогон |
| Весь набор | **`gemini-3-pro-image`** | **4K, 1:1** | **только у Pro есть слот style-reference** · $0.24 за объект |

Ставить NB2 на батч нельзя: там нет роли style-reference, анкер уйдёт как обычный объектный
референс и набор расползётся по толщине обводки. Именно на этом ломаются серии.

Grounding **OFF** — иначе тянет фотореференсы в плоский бриф. Thinking у Pro всегда включён.
Батч на 40 объектов: ~$9.6 в стандарте, вдвое дешевле через Batch API (до 24ч).

---

## TYPE A — изолированный объект

Техника, лестницы, контейнеры, станки, мебельные кластеры. **Дефолт.**

```
Redraw the attached game-map object as a flat vector map asset. The output will be traced in Adobe Illustrator and assembled into a top-down game map, so it has to consist of solid flat colour areas with hard edges — that is the purpose of every rule below.

REFERENCES
The first attached image is the GEOMETRY SOURCE. Reproduce its silhouette, proportions, internal part layout and rotation exactly, matching them precisely even where they differ from the real object.
The second attached image is the STYLE ANCHOR for this entire set. Match its outline weight, fill flatness, number of shading steps, palette and contrast. Only the depicted object differs.

SUBJECT: {SUBJECT}

CAMERA: orthographic, straight down, camera axis perpendicular to the ground plane. Only horizontal surfaces are visible. Edges that are parallel in the geometry source stay parallel here.

STEP 1 — MASSES. Block the object out as flat solid shapes, one uniform colour per part, each bounded by a hard edge.
STEP 2 — SHADING. Give each material at most three flat tones: base, one shadow, one highlight. Each tone is its own solid area with a hard boundary.
STEP 3 — LINEWORK. Draw a dark outline of constant weight around the outer silhouette and around each major part. The weight is identical everywhere and does not taper.
STEP 4 — REPEATED STRUCTURE. Draw tread plates, corrugation, planking, tyre lugs, grilles, roof ribs and seams as clean repeated parallel shapes at even spacing.
STEP 5 — DETAIL BUDGET. Keep every part that is at least 1/40 of the image width. Anything smaller becomes part of the flat colour of the part containing it.

PALETTE: {PALETTE}. Every area is one of these colours exactly, assigned by material.

FRAME: one object, centred, oriented {ORIENTATION}, with an even margin of about 5 percent of the canvas on all four sides and empty corners.

BACKGROUND: a single flat {MATTE} field, one uniform colour from edge to edge. The object keeps its own colours, meets the background only at its outline, and casts nothing onto it.

The image reads as a printed vector illustration: flat inks, hard edges, clean paper. Everything the SUBJECT does not name is absent from it — bare background around the object, no ground, no floor, no props, no second copy. If the geometry source carries an arrow, a marker or a symbol on its surface, continue the material underneath instead; those are added later as separate vector layers.

No perspective, no isometric, no tilt. No gradient, no soft shadow, no gloss, no bloom, no noise, no photographic texture, no drop shadow, no border, no lettering.

4K output, 1:1 aspect ratio.
```

---

## TYPE B — комната / напольный тайл

Заменить `CAMERA` … `FRAME` на три блока ниже, всё остальное байт-в-байт:

```
CAMERA: orthographic, straight down, camera axis perpendicular to the floor. The tile's outer rectangle keeps the proportions of the geometry source, its edges run parallel to the canvas edges, and its corners are exactly 90 degrees.

INTERIOR: the floor is one flat base colour and the wall band is a second. Every object standing on the floor — furniture, crates, machinery, pallets, shelving — is its own flat shape with its own outline, sitting directly on the floor.

FRAME: the tile centred with an even margin of about 4 percent of the canvas on all four sides and empty corners.
```

В `STEP 5` для тайлов порог тот же 1/40, но мелкий мусор, пятна и трещины опускаются целиком —
не сводятся в крапины.

---

## Реестр слотов

| Слот | Чем заполнять | Дефолт |
|---|---|---|
| **`{SUBJECT}`** ⚠️ | Форма + материал + счёт частей, обычным языком, без названий из игры. Гипер-конкретно: не `military truck`, а `a six-wheeled cargo truck with an open flatbed, a spare wheel behind the cab, a round metal disc mounted on the roof rack, two exhaust stacks` | — (без него силуэт плывёт) |
| **`{MATTE}`** ⚠️ | `saturated magenta (#C000C0)` для всего с хаки, оливой, зеленью, жёлтым, охрой. `saturated green (#00C000)` — только для серо-бурых и красных объектов без единого зелёного пикселя | `saturated magenta (#C000C0)` |
| **`{PALETTE}`** ⚠️ | 12-цветный генеративный сабсет палитры карт CTA, хексами через запятую | Фолбэк с текущих кропов: `#1E1B18, #4E5A3A, #3B4530, #2E2E2E, #55575A, #7D8286, #A9704A, #6B4630, #C8B79A, #6E5A4A, #B5651D, #F28A2E` |
| `{ORIENTATION}` | `exactly as in the geometry source` или `with its long axis vertical` для нормализованной библиотеки | `exactly as in the geometry source` |
| **Анкер** ⚠️ | Утверждённый первый выход, вторым вложением | — (со 2-го объекта обязателен) |

**Почему не зелёный и не белый:** зелёный кей съедает оливу техники, белый — светло-бежевые
накладки на дереве, а в Illustrator ещё и провоцирует `Ignore White`. Маджента максимально
далека по тону от всей палитры Таркова.

---

## Порядок прогона

1. ~~**Кроп** вплотную к объекту~~ → **ОТМЕНЕНО 2026-09-02:** кроп — **квадрат 1:1, объект в центре, ~25 % воздуха с каждой стороны** (`docs/decisions/map-asset-pipeline-canon.md` §2). Модель сама вырезает объект и лучше читает высоту; впритык — перспективные искажения. В запрос — ≤1024 px JPEG. Поворот делать самому в
   Figma до отправки — просьба повернуть отрабатывается как перерисовка и ломает пропорции.
2. **Анкер:** NB2, 512px, самый простой объект набора (лестничный марш), 8–12 прогонов, крутить
   только `STEP 2` и `STEP 3`. Утвердить один — после этого инвариант закрыт на правки.
3. **Батч:** Pro, 4K, 1:1. Кроп первым вложением, анкер вторым, роли названы словами (в промте
   это уже есть). Очередь: лестницы и контейнеры → техника → станки → интерьеры последними.
4. **Правки — разговором, не перегенерацией.** «Оставь композицию, сделай обводку тоньше
   вдвое». Никаких seed и cfg в Gemini нет: воспроизводимость держат только анкер и
   байт-в-байт одинаковый текст.
5. **Контактный лист** в масштабе реального зума карты — расхождение видно только рядом.
   Дрейф чинить перегенерацией с анкером, не правкой текста.
6. Обрезать угол с меткой SynthID.

Пары «целый / разбитый», «открытый / закрытый» гнать подряд в одной сессии.

---

## Трассировка в Illustrator

Object → Image Trace → Expand.

| Параметр | Значение |
|---|---|
| Mode | Color |
| Palette | **Limited**, Colors = цветов палитры **+1** (фон) |
| Paths | 85–90 |
| Corners | 75 |
| Noise | 25–50 px (архитектура выше, техника ниже) |
| Method | Abutting |
| Create | Fills only |
| Snap Curves to Lines | ON для лестниц, комнат, ящиков · OFF для техники и колёс |
| Ignore White | OFF |

После Expand: клик по фону → `Select → Same → Fill Color` → Delete. При Limited-палитре фон
трассируется одной фигурой и уходит целиком, кей в Photoshop не нужен. Затем
`Object → Path → Simplify` (~95%) и переименование заливок в семантические токены.

---

## Сборка в Figma

Каждый объект — компонент с вариантом поворота, не запечённый угол. Слои `SHELL` и `MARK`
(стрелки, номера выходов, маркеры лута) — только Figma. Порог LOD 1/40 держать и на сборке:
что схлопнула модель, руками не дорисовывать.
