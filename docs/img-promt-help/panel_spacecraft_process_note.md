# Панель «Процесс создания космического аппарата»

Формат **2950 × 2770 мм**, белый фон, чёрная графика. Павильон «Космос», ВДНХ.

---

## 1. Принцип

Схему целиком генерировать нельзя: стрелки, выноски, кириллица и связи всегда разваливаются.

Генерируются **листы пиктограмм** по 8 объектов → трассируются в Illustrator → «взрыв», оси, связи, нумерация и подписи собираются вектором в Figma.

- **F0** — разнесённая (взрыв) схема самого аппарата, 8 частей
- **F1–F6** — стадии процесса, по 8 пиктограмм
- Всего сгенерировано 56 объектов, на панель отбирается 38

## 2. Раскладка, мм

| Зона | X | Y | Ш | В |
|---|---|---|---|---|
| Поля | 160 / 160 / 160 / 200 (л/п/в/н) | | | |
| Живое поле | 160 | 160 | 2630 | 2410 |
| Заголовок (Enormous Bold) | 160 | 160 | 1200 | 460 |
| Лид (Pofo Bold) | 1490 | 160 | 900 | 300 |
| Поле графики | 160 | 740 | 2630 | 1830 |
| Взрыв-схема F0 | 2150 | 740 | 640 | 1830 |
| Блок стадий F1–F6 | 160 | 740 | 1900 | 1830 |

**Сетка стадий:** 3 колонки × 2 ряда, ячейка 620 × 880, гаттер 20 гор. / 70 верт.

**Внутри ячейки:**
- номер + название стадии (Enormous Medium 46/54) — 120 мм
- 5 пиктограмм: ряды 3 + 2, бокс 190 × 190, гаттер 25 / 30
- подпись под каждой (Pofo Bold 26/32, до 2 строк) — 70 мм
- остаток 170 мм — короткий абзац стадии

**F0:** 8 частей по высоте 1830 → бокс части 180 мм, зазор 55, пунктирная ось 4 мм по центру колонки.

**Кегли** (обзор 1,5–2,5 м): заголовок 145/150 · подзаголовок стадии 46/54 · тело 34/42 · подпись 26/32. Ниже 24 не опускаться.

## 3. Промты

> [!warning] Промты ниже написаны в идиоме Stable Diffusion
> Хвост `No text, letters, Cyrillic, numbers…` — это негативный перечень, а у Gemini **поля `negativePrompt` нет**: всё перечисленное уходит в основной промт словами и вводит объекты в контекст. Google просит обратного — описывать желаемое утвердительно. Листы F1–F4 на этих промтах уже сняты и приняты, поэтому переписывать их задним числом смысла нет; **F5, F6 и F0 генерировать по канону** — свод правил: [[PROMPT-RULES-nano-banana]] (см. §1 «описывать, а не запрещать» и §13 антипаттерны).

Инвариантные блоки во всех семи промтах повторены **дословно** — это и есть механизм единого стиля. Не переписывать «для разнообразия».

Аспект: **F0 — 9:16**, F1–F6 — 16:9, панель целиком — 1:1.

**Транспорт — ProxyAPI, не Google напрямую.** Ключ `PROXYAPI_KEY` (он же `GEMINI_API_KEY` в `.env.local` CTA) — это ключ ProxyAPI; прямой `generativelanguage.googleapis.com` его не принимает («API key not valid»), а из РФ ещё и режет по гео. База — `https://api.proxyapi.ru/google/v1beta`, заголовок `Authorization: Bearer`. Воркер `gemini-proxy.cta-quest.workers.dev` — тот же ProxyAPI под капотом, отдельного баланса у него нет.

**Модель — `gemini-3-pro-image` (Nano Banana Pro), `imageSize: 2K`. Flash не годится принципиально:** он отдаёт только 1024 px и не держит заданный вес штриха — утолщает крупные контуры, а мелкую деталь всё равно рисует волоском. На панели 3450 мм такая линия не читается. Проверено, четыре прогона выброшены.

Через API лимит в 1500 символов (поле Figma «Make an image») не действует — промт можно писать полностью.

---

### F0 — Взрыв-схема аппарата · 1421 симв.

```
Flat black-ink pictogram sheet: pure white #FFFFFF ground, drawings pure black #000000, no grey, no gradient, no shadow, no texture.
Style: printed technical-catalogue pictogram, solid black silhouettes plus hairline outlines, one stroke weight over the whole sheet, about 12 px at 2700 px on the long side, same on the smallest part and the largest. Closed clean contours.
Projection orthographic. Hardware oblique, 30 degrees from front, 30 from above. Figures strictly frontal, flat black silhouettes.
Layout: one satellite as an exploded stack on a single vertical axis, parts separated top to bottom by equal white gaps, centred, never touching. Nothing in the corners.
Objects top to bottom: parabolic high-gain dish antenna; folded solar array wing pair; star tracker sensor block; instrument bay box with radiator panels; battery and avionics tray; two spherical propellant tanks; propulsion module with main nozzle and four thrusters; open outline of the thermal blanket shell.
No text, letters, Cyrillic, numbers, captions, labels, callouts, leader lines, arrows, connectors, frames, borders, grid, dimension lines, logos, watermark, colour, grey fill, hatching, stipple, sketch lines, vanishing point, ground plane, cast shadow, reflection, 3D render, photorealism, screen interface. This is a pictogram sheet, not a diagram: objects are drawn separately, the schema is assembled later. Nothing not named in Objects may appear.
```

### F1 — КБ и проектирование · 1394 симв.

```
Flat black-ink pictogram sheet: pure white #FFFFFF ground, drawings pure black #000000, no grey, no gradient, no shadow, no texture.
Style: printed technical-catalogue pictogram, solid black silhouettes plus hairline outlines, one stroke weight over the whole sheet, about 12 px at 2700 px on the long side, same on the smallest part and the largest. Closed clean contours.
Projection orthographic. Hardware oblique, 30 degrees from front, 30 from above. Figures strictly frontal, flat black silhouettes.
Layout: 8 objects, 2 rows of 4, each isolated in its own cell with white margin, none touching. All drawn to the same cell height whatever their real size. Nothing in the corners.
Objects: drafting board with T-square; workstation, screen showing a plain wireframe satellite outline; rolled drawing stack; scale model of a satellite on a stand; wind tunnel test section; row of computer server racks; compasses and scale ruler; seated engineer at a desk.
No text, letters, Cyrillic, numbers, captions, labels, callouts, leader lines, arrows, connectors, frames, borders, grid, dimension lines, logos, watermark, colour, grey fill, hatching, stipple, sketch lines, vanishing point, ground plane, cast shadow, reflection, 3D render, photorealism, screen interface. This is a pictogram sheet, not a diagram: objects are drawn separately, the schema is assembled later. Nothing not named in Objects may appear.
```

### F2 — Производство · 1402 симв.

```
Flat black-ink pictogram sheet: pure white #FFFFFF ground, drawings pure black #000000, no grey, no gradient, no shadow, no texture.
Style: printed technical-catalogue pictogram, solid black silhouettes plus hairline outlines, one stroke weight over the whole sheet, about 12 px at 2700 px on the long side, same on the smallest part and the largest. Closed clean contours.
Projection orthographic. Hardware oblique, 30 degrees from front, 30 from above. Figures strictly frontal, flat black silhouettes.
Layout: 8 objects, 2 rows of 4, each isolated in its own cell with white margin, none touching. All drawn to the same cell height whatever their real size. Nothing in the corners.
Objects: CNC milling machine; industrial robot welding arm; 3D printer with a printed bracket; filament winding machine on a cylindrical mandrel; press brake bending a sheet; spherical tank in a welding cradle; flat solar panel with a cell grid; anodising bath with a rack of parts.
No text, letters, Cyrillic, numbers, captions, labels, callouts, leader lines, arrows, connectors, frames, borders, grid, dimension lines, logos, watermark, colour, grey fill, hatching, stipple, sketch lines, vanishing point, ground plane, cast shadow, reflection, 3D render, photorealism, screen interface. This is a pictogram sheet, not a diagram: objects are drawn separately, the schema is assembled later. Nothing not named in Objects may appear.
```

### F3 — Сборка и чистовая комната · 1421 симв.

```
Flat black-ink pictogram sheet: pure white #FFFFFF ground, drawings pure black #000000, no grey, no gradient, no shadow, no texture.
Style: printed technical-catalogue pictogram, solid black silhouettes plus hairline outlines, one stroke weight over the whole sheet, about 12 px at 2700 px on the long side, same on the smallest part and the largest. Closed clean contours.
Projection orthographic. Hardware oblique, 30 degrees from front, 30 from above. Figures strictly frontal, flat black silhouettes.
Layout: 8 objects, 2 rows of 4, each isolated in its own cell with white margin, none touching. All drawn to the same cell height whatever their real size. Nothing in the corners.
Objects: cleanroom airlock with double doors; two technicians in hooded coveralls; gantry crane lifting a cylindrical module; assembly cradle holding a satellite body; coiled cable harness; torque wrench; instrument bay with plug-in electronics boxes; solar wing deployment rig on horizontal supports.
No text, letters, Cyrillic, numbers, captions, labels, callouts, leader lines, arrows, connectors, frames, borders, grid, dimension lines, logos, watermark, colour, grey fill, hatching, stipple, sketch lines, vanishing point, ground plane, cast shadow, reflection, 3D render, photorealism, screen interface. This is a pictogram sheet, not a diagram: objects are drawn separately, the schema is assembled later. Nothing not named in Objects may appear.
```

### F4 — Испытания · 1411 симв.

```
Flat black-ink pictogram sheet: pure white #FFFFFF ground, drawings pure black #000000, no grey, no gradient, no shadow, no texture.
Style: printed technical-catalogue pictogram, solid black silhouettes plus hairline outlines, one stroke weight over the whole sheet, about 12 px at 2700 px on the long side, same on the smallest part and the largest. Closed clean contours.
Projection orthographic. Hardware oblique, 30 degrees from front, 30 from above. Figures strictly frontal, flat black silhouettes.
Layout: 8 objects, 2 rows of 4, each isolated in its own cell with white margin, none touching. All drawn to the same cell height whatever their real size. Nothing in the corners.
Objects: vibration shaker table with a satellite bolted on; horizontal thermal vacuum chamber with a hinged door; anechoic wall of pyramidal absorbers; centrifuge arm with a capsule; solar simulator lamp array; acoustic test horn; balancing turntable; helium leak test rig with a gas bottle.
No text, letters, Cyrillic, numbers, captions, labels, callouts, leader lines, arrows, connectors, frames, borders, grid, dimension lines, logos, watermark, colour, grey fill, hatching, stipple, sketch lines, vanishing point, ground plane, cast shadow, reflection, 3D render, photorealism, screen interface. This is a pictogram sheet, not a diagram: objects are drawn separately, the schema is assembled later. Nothing not named in Objects may appear.
```

### F5 — Транспортировка и старт · 1419 симв.

```
Flat black-ink pictogram sheet: pure white #FFFFFF ground, drawings pure black #000000, no grey, no gradient, no shadow, no texture.
Style: printed technical-catalogue pictogram, solid black silhouettes plus hairline outlines, one stroke weight over the whole sheet, about 12 px at 2700 px on the long side, same on the smallest part and the largest. Closed clean contours.
Projection orthographic. Hardware oblique, 30 degrees from front, 30 from above. Figures strictly frontal, flat black silhouettes.
Layout: 8 objects, 2 rows of 4, each isolated in its own cell with white margin, none touching. All drawn to the same cell height whatever their real size. Nothing in the corners.
Objects: rail transporter car carrying a rocket stage; road transporter truck with a container; assembly hall with tall doors; erector arm at 45 degrees; launch pad with four service towers; rocket standing on the pad; fuelling tanker with a mast; rocket lifting off with a flat black exhaust plume.
No text, letters, Cyrillic, numbers, captions, labels, callouts, leader lines, arrows, connectors, frames, borders, grid, dimension lines, logos, watermark, colour, grey fill, hatching, stipple, sketch lines, vanishing point, ground plane, cast shadow, reflection, 3D render, photorealism, screen interface. This is a pictogram sheet, not a diagram: objects are drawn separately, the schema is assembled later. Nothing not named in Objects may appear.
```

### F6 — Орбита и эксплуатация · 1431 симв.

```
Flat black-ink pictogram sheet: pure white #FFFFFF ground, drawings pure black #000000, no grey, no gradient, no shadow, no texture.
Style: printed technical-catalogue pictogram, solid black silhouettes plus hairline outlines, one stroke weight over the whole sheet, about 12 px at 2700 px on the long side, same on the smallest part and the largest. Closed clean contours.
Projection orthographic. Hardware oblique, 30 degrees from front, 30 from above. Figures strictly frontal, flat black silhouettes.
Layout: 8 objects, 2 rows of 4, each isolated in its own cell with white margin, none touching. All drawn to the same cell height whatever their real size. Nothing in the corners.
Objects: first stage separating, two cylinders apart; fairing halves split open; satellite with solar arrays deployed; parabolic ground station dish on a mount; mission control hall, console rows, blank front screen; relay antenna tower; orbital docking pair of modules; reentry capsule with a flat heat shield.
No text, letters, Cyrillic, numbers, captions, labels, callouts, leader lines, arrows, connectors, frames, borders, grid, dimension lines, logos, watermark, colour, grey fill, hatching, stipple, sketch lines, vanishing point, ground plane, cast shadow, reflection, 3D render, photorealism, screen interface. This is a pictogram sheet, not a diagram: objects are drawn separately, the schema is assembled later. Nothing not named in Objects may appear.
```

## 4. Порядок прогонов

1. **F1 первым** — на нём принимается стиль (толщина штриха, степень залитости). Пока F1 не устраивает, остальные не запускать: правки вносить репликами («сохрани композицию, сделай силуэты плотнее»), не регенерацией.
2. Принятый F1 прикладывать как style anchor к F2–F6 строкой:
   `Match the attached sheet for stroke weight and silhouette density. Style only.`
   ⚠️ **Анкор сжимать до ≤100 КБ** (1024 px по длинной стороне, JPEG q78). Картинка на входе тяжелее ~1,5 МБ — и ProxyAPI отвечает `402 Insufficient balance`, ВРЁТ про баланс: он резервирует под запрос по верхней оценке. Тот же промт с лёгким анкором проходит на том же балансе. Разрешение анкора роли не играет — модель считывает с него только толщину штриха и плотность силуэта.
3. **F0 последним**: деталей больше, нужен уже устоявшийся штрих.

## 4а. Черновик панели целиком — отдельный режим

§1 запрещает генерить схему целиком **для боевой панели** — связи и кириллица разваливаются. Но для «показать, как будет выглядеть» это рабочий приём, если соблюсти два условия:

- **не просить у модели текст вообще.** Заголовки, лид и подписи — плашки-заглушки (`plain rounded outlines standing in for text`). Стоит назвать группы словами прямо в промте («design office», «manufacturing») — модель напечатает эти названия на макете;
- **явно запретить рамки** — `no frame around the sheet, no boxes around groups, no separating rules`. Под давлением на «bold» модель утолщает не пиктограммы, а рамки и плашки.

Промт — `prompts/FULL.txt`, аспект 1:1 (панель 2950×2770 почти квадрат). Вес штриха задавать формулой из рабочих промтов: `one stroke weight over the whole sheet, about 10 px at 2048 px on the side, exactly the same weight on the smallest detail and on the largest object`. Плюс `Objects are drawn simply, few lines each` — иначе на 38 объектов в одном кадре деталь съедает толщину.

Стиль черновика (принят V4DYA 02.09.2026 по рефу) — не плотные силуэты основной серии, а **тонко-жирная рисованная линия**: doodle-контур фломастером, без заливок, искры-звёздочки, человечки-палочки.

## 4б. Состояние на 02.09.2026

Результаты — вне валта: `C:\Users\vadim\YandexDisk\!!! Pattern Digital 2025\ВДНХ - Космонавтика и Авиация\Infographics\`, скрипт прогона `gen.py`, промты в `prompts/`, выдача в `out/`.

- **Эталон стиля принят:** `out/F1_125858_04.jpg` (сжатая копия для анкора — `anchor_F1.jpg`)
- **Листы:** F1 — 4 варианта ✅ · F2 — 5 ✅ · F3 — 3 ✅ · F4 — 1 ⚠️ · F5, F6, F0 — не сгенерированы ❌
- **Черновик панели целиком:** `out/FULL_152047_01.jpg` — раскладка по §2 (3×2 + F0 колонкой справа), принят

## 5. Сборка

- **Illustrator:** Image Trace → Black and White Logo, Threshold 128, Paths 100%, Corners 75%, Noise 0 → Expand → разрезать по объектам, каждый в свой compound path.
- **Figma:** ось взрыва — пунктир 2 px; связи и стрелки — вектор; нумерация выносок — ALS Enormous Medium; заголовки стадий — ALS Enormous Bold; тело — ALS Pofo Bold.
- **Акцент #4212b5** только на векторном слое (ось, активная связь, номера). Растр остаётся чистым чёрным — панель остаётся годной и под инверсию для чёрной серии.
- Фон — белый прямоугольник `00_bg_white` отдельным тогглируемым слоем (та же конвенция, что `00_bg_black`), чтобы декаль под 3ds Max ушла с альфой.
- Истинный масштаб между объектами задаётся в Figma, не в промте.
- **Проверка перед экспортом:** минимальный элемент любой пиктограммы ≥ 3,5 мм. Тоньше — Object → Path → Offset Path +1,5 мм на выделенных компаундах, не перегенерация.
- Экспорт панели — PDF/SVG, растра на панели нет, разрешение не лимитирует.

## 6. Смета генерации

⚠️ **Ставка — ~100 ₽ за изображение** (`gemini-3-pro-image` 2K через ProxyAPI, ≈ $1,15). Замерено 02.09.2026 по двум дельтам баланса: 1324 → 898 ₽ за 4 изображения, затем 898 → 0 ₽ за 9. Прежняя ставка $0,12 в этой заметке была взята от Flash и занижала смету **на порядок** — не возвращать.

| Сценарий | Прогонов | ₽ |
|---|---|---|
| Оптимистичный (стиль встал с 3–4 попытки) | 40 | **4 000** |
| Расчётный: F1 ×12, F2–F6 ×6, F0 ×10 | 52 | **5 200** |
| С резервом +25 % | 65 | **6 500** |
| Худший (стиль не встаёт, всё по 2 круга) | 100 | **10 000** |

**Закладывать 6 500 ₽.** Экономить переходом на Flash нельзя — см. §3, он не держит штрих.

Баланс проверять в кабинете proxyapi.ru: эндпоинт `/proxyapi/balance` рабочим ключом не читается («not allowed to access this endpoint»), а `402` в ответе на генерацию про реальный остаток ничего не говорит — сперва исключить тяжёлый анкор (§4.2).
