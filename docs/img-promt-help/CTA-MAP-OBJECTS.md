# CTA MAP OBJECTS — векторизация через Gemini → Illustrator

Универсальный промт для превращения кропа объекта с карты в плоский растр,
который чисто трассируется в Illustrator в 7–12 цветов дизайн-системы.

Файл живой: правится на месте по мере роста набора. Не плодить версии.

---

## 1. Разделение обязанностей

| Этап | Кто | Что делает |
|---|---|---|
| Источник | tarkov.dev | кроп PNG — даёт **след и ориентацию**, больше ничего |
| Проход 1 | Gemini Pro | плоская посторизованная отрисовка, 8 разнесённых по светлоте зон |
| Проход 2 | Illustrator | Image Trace с библиотекой свотчей NIGHTFALL → точные токены |
| Проход 3 | Illustrator | Expand, чистка, назначение классов |

Ключевое: **Gemini не задаёт цвета.** Он задаёт светлоту зон. Хексы приходят
на трассировке. Просить у модели конкретные значения бесполезно — она их не
держит, а антиалиасинг всё равно размажет плоские заливки в сотни оттенков.

---

## 1б. Почему символ, а не объект

На Таможне 2328 окрашенных рукотворных объектов. Поштучно это 93 тысячи путей;
базовый `Customs.svg` держит 506 путей в 46 КБ gzip, отсюда оценка **8.3 МБ
gzip** — нежизнеспособно.

Решение — библиотека `<symbol>` в `<defs>` плюс `<use>` на каждый экземпляр.
Замерено на синтетике:

```
 500 инстансов: gzip   8 КБ   (17 байт на объект)
1000 инстансов: gzip  12 КБ   (13 байт на объект)
2328 инстансов: gzip  24 КБ   (11 байт на объект)
```

**11 байт на объект против 8.3 МБ.** Разница в 350 раз. Значит через Gemini
проходят не тысячи объектов, а двенадцать символов.

Отсюда два следствия, которые меняют работу:

**Объект генерируется в каноническом повороте, 0°.** Длинная ось горизонтально,
носом вправо. Разворот на карте делает `transform="rotate()"` на инстансе.
Кроп с карты нужен только чтобы снять угол и пропорцию — форму он не задаёт.

**Консистентность становится бесплатной.** Все контейнеры на всех картах — это
буквально один и тот же путь. Дрейфа между экземплярами не существует в
принципе, потому что экземпляр один.

```xml
<defs>
  <symbol id="obj-container" viewBox="0 0 24 10">…</symbol>
</defs>
<g id="Objects">
  <use href="#obj-container" x="412.6" y="288.1" transform="rotate(34 412.6 288.1)"/>
</g>
```

---

## 2. Промт

Attach two images. IMAGE 1 — approved anchor. IMAGE 2 — the map crop.
On the very first run there is no anchor: drop the IMAGE 1 line and generate
the anchor object alone.

```
Flat vector-style technical illustration for a tactical map, hard-edged and fully posterised, built from solid areas of colour with no gradients anywhere.

REFERENCE: IMAGE 1 is the style anchor for this entire set. Match its rendering, its number of tonal steps, its light direction, its edge treatment and its level of simplification exactly. Only the depicted object differs.

REFERENCE: IMAGE 2 defines the footprint and proportions of the subject. Match those proportions precisely. Ignore its rotation: draw the subject in canonical orientation with its long axis horizontal and its front to the right. IMAGE 2 is a geometry guide only — do not copy its rendering, its colours or its level of detail, and do not treat it as a style reference.

SUBJECT: {SUBJECT}

FORM: build the object from large primary volumes only — boxes, cylinders, wedges. Every surface is a flat plane or a simple curved shell. No fine detail, no small parts, no bolts, no rivets, no wear, no rust, no scratches, no panel lines. Any feature smaller than 1/12 of the object's longest side must be omitted rather than drawn.

SHADING: cel shading with exactly six discrete tonal steps and nothing between them. Every step is one perfectly uniform flat area of colour with a hard edge against its neighbours. The six steps are these exact desaturated cool greys, from darkest to lightest: #141416, #313135, #52525B, #747781, #9CA3AF, #C6C9D0. Assign upward-facing planes the lighter steps, vertical planes the middle steps, and undersides and cavities the darkest step. Curved surfaces are broken into two or three flat bands, never blended. This is a posterised illustration, not a render — banding is the goal, not a defect.

LIGHT: a single directional light from the upper left of the image at a fixed 45 degree azimuth. The light is fixed in image space and does not rotate with the object — however the object is turned, the upper-left surfaces stay lightest. No second light, no fill, no rim light, no coloured light, no reflections, no specular hotspots.

CAMERA: orthographic, looking down at 15 degrees off vertical, viewing direction fixed for the whole set. The subject is drawn in canonical orientation: long axis horizontal, front to the right. No perspective convergence, no lens distortion, no tilt of the horizon. The object sits centred with an even margin on all four sides and does not touch any edge.

PALETTE: the object body uses only the six greys listed in SHADING. If SUBJECT names a painted shipping container, its painted panels use exactly one of these four colours and no other: rust orange #BB6D46, blue #3280B2, green #3C8460, maroon #873A40 — the container's shading still comes from the six greys applied as flat overlays on that colour. One accent, warm orange #E68E25, is allowed only on parts that are genuinely marked or hazardous on the real object, and only on surfaces shaded with the three darkest steps #141416, #313135 or #52525B, never on the lighter three. A second accent, red #C24339, is allowed on hazard markings only. No greens and no blues anywhere except on a container panel. Total distinct colours in the image, background included, must not exceed nine.

EDGES: every boundary between two colours is a clean hard edge. No soft transitions, no feathering, no glow, no bloom, no blur, no depth of field, no noise, no grain, no film texture, no paper texture, no halftone, no dithering, no stippling, no cross-hatching, no brush strokes, no painterly edges. The image must look like flat vector shapes already, not like a photograph of them.

DEPTH: no cast shadow on the ground, no contact shadow, no ambient occlusion gradient, no reflection under the object. Depth is carried by the tonal steps alone.

RESTRAINT: render exactly what SUBJECT describes and nothing more. Exactly one object. No ground, no terrain, no vegetation, no debris, no crates, no barrels, no figures, no vehicles other than the subject, no ornament, no particles, no smoke, no sparks. Nothing that is not explicitly named in SUBJECT may appear in the frame.

BACKGROUND: one perfectly flat, evenly lit, solid {MATTE} field filling the entire frame, completely uniform in colour, with no gradient, no vignette, no texture, no grain, no pattern and no checkerboard. A plain matte colour field and nothing else. The object must not reflect or pick up any colour from the background and must cast no shadow onto it.

NEGATIVE: no text, no labels, no lettering, no numbers, no logos, no branding, no watermarks, no signatures, no UI, no captions, no measurement marks, no gauge markings. No frame, no border, no bezel, no plaque, no badge, no backing plate, no vignette. Nothing in the corners. No gradients of any kind. No photographic realism, no PBR shading, no metallic reflections, no glass refraction. No isometric grid, no blueprint lines, no technical drawing annotations, no exploded view. Do not copy any logos, text or markings from the reference images.
```

---

## 2б. Что грузить в IMAGE 1 и IMAGE 2

**IMAGE 1 — стилевой якорь. Обязателен всегда, начиная со второго объекта.**
Из текста без якоря не генерировать: текстовые инварианты держат примерно 60%
консистентности, остальное даёт только кондиционирование картинкой.

**IMAGE 2 — геометрический гид. В большинстве случаев не нужен.** Кроп с карты
при 3.86 px на метр даёт контейнер шириной 23 px. Это не геометрия, это пятно,
и оно течёт артефактами в генерацию. Реальный предмет модель знает лучше.
Прикладывать только там, где пропорции конкретного экземпляра не выводятся из
названия — кран на стройке, нестандартная бытовка.

Рабочий диапазон 2–4 референса, потолок 14. Здесь почти всегда один.

### Раунд 1: якоря ещё нет

Первый контейнер генерируется от нарисованного стилевого плана
`REF_STYLE_container.png` — плоская отрисовка контейнера точными токенами
палитры, свет сверху-слева, наклон 15°, зелёный мат. Он задаёт ровно то, что
дороже всего описывать словами: шесть плоских ступеней с конкретными
значениями и жёсткие края без антиалиасинга.

Смысл в том, что посторизацию проще нарисовать за пять минут, чем выпрашивать
у модели восемью итерациями.

На этом раунде блок REFERENCE заменяется целиком:

```
REFERENCE: IMAGE 1 is a flat vector style plate, not a photograph and not a subject reference. Match its rendering exactly: the same six flat tonal steps with the same values, the same hard edges with no soft transitions, the same light from the upper left, the same 15 degree downward viewing angle, the same flat matte background. Do NOT copy what it depicts — reproduce only how it is rendered.
```

Последняя фраза обязательна. Без неё якорь-контейнер начинает протекать в
предмет, и машина возвращается коробкой на колёсах.

### Раунд 2 и далее: якорем становится результат

Как только сгенерированный контейнер прошёл числовой критерий — 25–60 путей и
не больше 9 цветов после трассировки — **он становится IMAGE 1 навсегда**.
Нарисованный план уходит в архив, к нему больше не возвращаться. Блок
REFERENCE возвращается к штатной формулировке из раздела 2.

### Привязка ролей, когда референсов два

Синтаксиса слотов нет: `[REF_GEO]` в теле промта — просто текст, он ни к чему
не привязывается. Три способа, от худшего к лучшему:

1. Порядок загрузки — `the first attached image`. Ломается при перезаливке.
2. **Подпись, впечатанная в картинку.** Перед загрузкой положить полосу сверху
   с надписью `REF_STYLE` / `REF_GEO`. Тогда порядок перестаёт иметь значение.
3. Один референс на проход — сначала геометрия, потом стиль отдельной правкой.

При одном референсе всё это не нужно, порядок однозначен.

### Гигиена

Крой референс плотно по объекту: окружение из референса течёт в генерацию.
Один и тот же якорь держать прикреплённым на всех проходах одной задачи —
отцепишь, и материал поплывёт между проходами. Pro, не Flash: на Flash
референс не выживает. Уже сгенерировал на Flash — `⋯ → Redo with Pro`,
промт не переписывать.

---

## 3. Реестр слотов

| Слот | Что подставить | По умолчанию |
|---|---|---|
| `{SUBJECT}` | **заполнять обязательно** — объект формой и материалом, без марок и брендов | — |
| `{MATTE}` | **заполнять обязательно** — цвет подложки, максимально далёкий по тону от объекта | `pure saturated magenta (#C000C0)` |

`{SUBJECT}` — единственное, что меняется между объектами набора. Всё остальное
копируется побайтово. Переписал фиксированный блок «для разнообразия» —
объект вывалился из семейства, и это видно только на контактном листе, когда
уже сгенерировано двадцать штук.

`{MATTE}` по таблице: объект нейтрально-серый или тёмный → зелёный `#00C000`;
объект с оранжевым акцентом или хаки → маджента `#C000C0`; смешанный →
синий `#0040FF`. Никогда не брать подложку в тоне самого объекта, иначе на
кее объект потеряет края.

---

## 4. Почему шесть ступеней и 15 градусов

**Шесть ступеней.** Меньше пяти — объём не читается, цилиндр становится
прямоугольником. Больше семи — Image Trace начинает дробить соседние ступени
на лишние пути, и вместо 12 цветов приходит 40. Шесть плюс акцент плюс
подложка = восемь, что оставляет запас до твоего потолка в 12 под добавление
токенов уже в векторе.

**Наклон 15 градусов.** Чистый вид сверху убивает узнаваемость всего
цилиндрического: цистерна сверху — это круг, наливняк сверху — скруглённый
прямоугольник, отличить невозможно. Изометрия решает узнаваемость, но ломает
след — объект перестаёт совпадать со своим местом на карте.

15° — компромисс с числом: искажение следа составляет `cos(15°) = 0.966`, то
есть 3.4%. На карте, где единица равна метру, это 3 см на метровом объекте.
Незаметно при размещении, но достаточно, чтобы показать бок цилиндра и сделать
цистерну цистерной.

**Свет закреплён в пространстве кадра, а не объекта.** Это картографическая
конвенция: солнце всегда с северо-запада, независимо от того, как повёрнут
дом. Если привязать свет к объекту, набор развалится — повёрнутые объекты
будут выглядеть освещёнными с разных сторон.

---

## 4б. Палитра

Полная таблица и обоснование — `map-palette.css`, свотчи —
`NIGHTFALL-map-full.ase` (24 цвета, семь групп), превью —
`palette-full-preview.png`. Здесь только то, что нужно при генерации.

### Объект — двенадцать цветов

| Код | Токен | HEX | L\* | C | Назначение |
|---|---|---|---|---|---|
| V0 | `--object-v0` | `#141416` | 6.4 | 1 | низы, каверны, **контур объекта** |
| V1 | `--object-v1` | `#313135` | 20.5 | 3 | тень |
| V2 | `--object-v2` | `#52525B` | 35.2 | 6 | вертикальная грань в тени |
| V3 | `--object-v3` | `#747781` | 50.1 | 6 | вертикальная грань в свету |
| V4 | `--object-v4` | `#9CA3AF` | 66.8 | 7 | верхняя грань, полутон |
| V5 | `--object-v5` | `#C6C9D0` | 80.9 | 4 | верхняя грань, блик; белый борт |
| CNT-A | `--cnt-rust` | `#BB6D46` | 54.0 | 44 | контейнер ржаво-оранжевый |
| CNT-B | `--cnt-blue` | `#3280B2` | 51.1 | 34 | контейнер синий |
| CNT-C | `--cnt-green` | `#3C8460` | 49.9 | 34 | контейнер зелёный |
| CNT-D | `--cnt-maroon` | `#873A40` | 35.1 | 36 | контейнер бордовый |
| AMB | `--object-accent` | `#E68E25` | 66.8 | 70 | маркировка, лестницы, ЛЭП |
| DNG | `--object-hazard` | `#C24339` | 46.7 | 60 | аварийное, запретное |

Шаг лестницы объёма 14.1–16.7 по L\*, равномерный. Шесть из двенадцати
переиспользуют существующие токены NIGHTFALL, шесть новых.

### Три правила, вытекающие из чисел

**Акцент только на V0–V2.** `--primary` `#E68E25` имеет L\* 66.8 — ровно как
V4 `#9CA3AF`. Разница светлоты ноль: оранжевая маркировка на светлой грани
неразличима в оттенках серого и пропадает ниже 48 px. На V0–V2 контраст
32–60, на V3 остаётся 16.7 — граница допустимого.

**Контейнеры держат один L\*-диапазон, кроме бордового.** CNT-A/B/C сидят на
50–54 и различаются только тоном — так они читаются как один класс объектов.
CNT-D уведён на 35: при равной светлоте он спорил бы с DNG, ближайшая пара
после V1↔растительности это CNT-A↔DNG на ΔE 23.9. Различение добирается
формой: контейнер сплошной прямоугольник, опасная зона — заливка 40% с
пунктирным контуром.

**Контур V0 обязателен.** Заливки объектов и поверхностей карты лежат в одном
диапазоне светлоты и по заливке не разводятся: V2 против `--map-paving` даёт
ΔE 7.0, V3 против `--map-building` 6.8, V4 против `--map-floor` 7.8. Это не
дефект подбора — диапазон L\* от 6 до 82, делённый на 24 значения, оставляет
по три единицы на шаг, места нет. Разделяет обводка. Голым касанием заливок
соприкасаются только природные поверхности между собой, и там всё чисто.

### Поверхности — двенадцать

Сопоставлены с набором классов Shebuka. Сохранены его смысловые семьи по тону
и порядок светлот внутри каждой; перевёрнута полярность — его карты светлые с
тёмными зданиями, NIGHTFALL тёмный, поэтому здания стали светлее подложки
(55.9 против 24.2). Хрома срезана примерно вдвое: у него `gravel` C 33.5,
`stairs` C 87.2, в тёмной системе это перебивает контейнеры и амбер.

| Семья | Классы | Токены |
|---|---|---|
| Холодная природа | trees, land, water | `--map-vegetation` `#0D2E16`, `--map-terrain` `#1D3F3D`, `--map-water` `#004A78` |
| Тёплое сыпучее | wood, gravel, rock | `--map-wood` `#6E472D`, `--map-gravel` `#876A4D`, `--map-rock` `#A18E75` |
| Построенное | locked, paving, building, floor | `--map-locked` `#3C3F4E`, `--map-paving` `#61636D`, `--map-building` `#848595`, `--map-floor` `#B5B5BE` |
| Линейное | rail, fence | `--map-rail` `#99554D`, `--map-fence` `#C0D0C3` |

Проверено по 30 реально соприкасающимся парам: минимальный ΔE76 = 14.2,
медианный 36.0. `tarmac`, `road_tarmac` и `cement` у Shebuka схлопнуты в один
`--map-paving`: первые два отличались на 3.6 по L\*, это шум, а не различение.
`stairs` и `powerline` схлопнуты в амбер — у него они тоже были практически
одним цветом, различаются геометрией.

---

## 5. Image Trace — точные настройки

Библиотека свотчей уже собрана — `NIGHTFALL-map-full.ase`, двадцать
четыре глобальных цвета в семи группах. Подключение один раз:

**Swatches → меню панели → Open Swatch Library → Other Library… →**
выбрать `NIGHTFALL-map-full.ase`.

Библиотека появится отдельной панелью и сразу окажется в дропдауне **Palette**
внутри Image Trace. Чтобы она подхватывалась в каждом новом документе, положи
файл в `%APPDATA%\Adobe\Adobe Illustrator <версия> Settings\ru_RU\Swatches\`.

Если ASE по какой-то причине не встанет — рядом лежит
`NIGHTFALL-map-full.svg`: открыть, Select All, Swatches → New Color Group →
Selected Artwork, галочка **Convert Process to Global**.

Затем на каждом объекте:

| Параметр | Значение | Зачем |
|---|---|---|
| Mode | Color | — |
| **Palette** | твоя библиотека NIGHTFALL | это и есть гарантия 7–12 цветов |
| Colors | 8–10 | библиотека содержит 24, слайдер отбирает ближайшие; больше 10 не ставить |
| Paths | 90% | ниже — теряются мелкие грани |
| Corners | 90% | техника, углы должны остаться углами |
| Noise | 20–40 px | режет крап от антиалиасинга |
| **Method** | **Abutting** | Overlapping кладёт фигуры стопкой, потом щели на стыках |
| Create | Fills only, Strokes off | обводку рисуешь сам, единой толщиной |
| Snap Curves To Lines | **вкл** | прямые становятся прямыми, а не 40-узловыми кривыми |
| Ignore White | выкл | подложка не белая, а маджента/зелёная |

После Expand:

1. Select → Same → Fill Color на подложке → Delete.
2. Object → Path → Simplify, порог около 0.5 px — снимает узлы, оставшиеся
   от антиалиасинга.
3. Сгруппировать по цвету и назначить классы из словаря `SPEC-DRAWING.md`
   (`building`, `cement`, `wood`, `danger`, `cta_*`) — тогда объект встанет
   в карту и подхватит токены темы без правок.

**Порог для проверки:** объект после чистки должен укладываться в 25–60 путей.
Больше сотни — значит Gemini отдал не плоские зоны, а градиент. Не чинить в
векторе, перегенерировать с усиленным блоком EDGES.

---

## 6. Набор объектов — Таможня

Замеры сняты с рендера `customs_z5_4096.png` (4096×2069, 3.86 px на метр,
аспект совпал с viewBox с точностью 0.28%). Детекция ловит только окрашенные
объекты, поэтому серые бытовки и бетон недосчитаны — это нижние границы.

```
859  мелочь <4.5 м        бочки, ящики, поддоны, мусор
235  4.5–7.5 м вытянутое  легковые
124  5.5–7.5 м компактное будки, кунги, генераторы
 60  7.5–11 м             контейнеры 6 м, фургоны, наливняки
 45  11–16 м              автобусы, 12-метровые контейнеры, вагоны
 27  16–26 м              платформы, секции состава
  8  26 м+                составы
```

Плюс порядка 25–30 круглых резервуаров в трёх кустах: четыре крупных в
западном парке, ряд из двенадцати севернее, шесть тёмных в центре.

### 6.1 Символы — двенадцать, через пайплайн Gemini

Каждый генерируется **один раз в каноническом повороте 0°** и расставляется
инстансами. Порядок в таблице — порядок генерации.

| # | ID символа | Объект | Размер | Экз. | `{SUBJECT}` — суть | `{MATTE}` |
|---|---|---|---|---|---|---|
| 1 | `obj-container` | **Морской контейнер — якорь** | 6 и 12 м | 150+ | corrugated shipping container, 6 m, ribbed side walls, double doors at one end | зелёный |
| 2 | `obj-block` | Бетонный блок, отбойник | 2–6 м | ~100 | precast concrete barrier block, trapezoid cross-section | зелёный |
| 3 | `obj-cabin` | Бытовка, кунг, будка | 5–7 м | ~120 | site cabin with flat-sided panelled walls, low pitched roof, on short skids | зелёный |
| 4 | `obj-car` | Легковая | 4.5 м | ~235 | small hatchback car, 4.5 m, sloped bonnet and boot | зелёный |
| 5 | `obj-van` | Фургон, грузовик | 5.5–7 м | ~40 | box van, 5.5 m, flat vertical rear box taller than the cab | зелёный |
| 6 | `obj-bus` | Автобус | 12 м | ~10 | city bus, 12 m, flat roof, even window band down both sides | зелёный |
| 7 | `obj-wagon-box` | Крытый вагон | 14 м | ~30 | covered railway boxcar, 14 m, sliding door centred on each side, on two bogies | зелёный |
| 8 | `obj-wagon-flat` | Платформа | 14 м | ~20 | flat railway wagon, 14 m, bare deck with low side stakes, on two bogies | зелёный |
| 9 | `obj-wagon-tank` | Вагон-цистерна | 12 м | ~10 | railway tank wagon, horizontal cylindrical barrel on a frame, on two bogies | маджента |
| 10 | `obj-tanker` | Наливняк топливный | 9 м | 6+ | tanker truck, horizontal cylindrical barrel behind a forward cab, six wheels | маджента |
| 11 | `obj-tank` | Резервуар вертикальный | 8–20 м | ~28 | vertical cylindrical storage tank on short legs, flat top, external ladder up one side | маджента |
| 12 | `obj-crane` | Кран | 15–25 м | ~4 | lattice tower crane, square mast with a single horizontal jib | зелёный |

Контейнеры 6 и 12 м — **один символ с масштабом**, не два. Резервуар крупный и
малый — тоже один: лестница на боку при 30 px не читается, различие только в
размере.

### 6.2 Уникальная геометрия — шесть, рисуется руками

Через Gemini не идут: у них нет повторяемости, ради которой существует
пайплайн.

| # | Объект | Почему не символ |
|---|---|---|
| 13 | Заводские цеха, западная промзона | сложный индивидуальный план |
| 14 | Резервуарный парк с обваловкой | обваловка — контур местности, не объект |
| 15 | Два моста через реку | единственные переходы, форма индивидуальна |
| 16 | Красные модульные ряды на востоке | повтор секции — это `<pattern>`, не объект |
| 17 | Отвал породы, юго-восток | рельефное пятно |
| 18 | Стройка в центре: котлован и отвалы | форма земляных масс |

### 6.3 Что не векторизуется вообще

859 объектов мельче 4.5 м — бочки, ящики, поддоны, мусор. При 3.86 px на метр
бочка занимает **2 пиксела**: информации не несёт, но съедает 859 инстансов и
замусоривает карту так, что ориентиры перестают читаться.

Деревья и кустарник — заливка `--map-vegetation`, никогда поштучно. Отдельное
дерево рисуется только если само стало ориентиром.

### 6.4 Коллизии — разрешать до генерации

Группировка по классу силуэта, проверяется каждая группа больше одного.

**Цилиндры: резервуар (11) / наливняк (10) / вагон-цистерна (9).**
Различитель — силуэт, самый устойчивый признак. Резервуар вертикальный, на
ногах, без колёс. Наливняк горизонтальный, с кабиной и колёсами. Вагон-цистерна
горизонтальный, без кабины, на двух тележках. Пропорции задавать числом, иначе
модель уравняет их по высоте.

**Вагоны: крытый (7) / платформа (8) / цистерна (9).**
Самая дорогая коллизия в наборе. Крытый вагон даёт полное укрытие, платформа
не даёт никакого — игрок, спутавший их, пойдёт прятаться за пустую раму. Крытый
это сплошной прямоугольник, платформа — тонкая полоса настила с просветами по
бортам. Различие обязано читаться на 54 px.

**Коробки: контейнер (1) / фургон (5) / бытовка (3).**
Контейнер — рёбра поперёк стенки, без шасси. Фургон — коробка выше кабины.
Бытовка — гладкие панели, низкая двускатная крыша. Различие внутреннее, а не
силуэтное, поэтому **не выживет ниже 64 px**. Если карта будет показываться
мельче, разводить заливкой из контейнерной четвёрки — но помнить, что цвет
общий канал, и потратив его на различение, им уже не закодировать состояние.

**Длинные прямоугольники: легковая (4) / автобус (6) / вагоны (7–9).**
Различитель — соотношение сторон, и работает только если задано числом:
4.5 м / 12 м / 14 м на двух тележках. На масштаб в кадре полагаться нельзя,
модель не измеряет площадь.

### 6.5 Якорь

Первым делать контейнер и в одиночку. Он показывает все шесть ступеней разом —
верхняя плоскость, две боковых, тень под свесом — и по нему быстрее всего
понять, сошлась стилистика. 8–12 вариантов, докрутить SHADING и EDGES,
утвердить один. **После этого промт закрыт на правки** — дальше меняется
только `{SUBJECT}`.

---

## 7. Порядок работы

1. **Якорь.** Контейнер, 8–12 итераций, только блоки SHADING/EDGES.
   Критерий приёмки числовой, а не «нравится»: после Image Trace выходит
   25–60 путей и не больше 9 цветов.
2. **Заморозка.** Утверждённый контейнер становится IMAGE 1 для всего набора.
3. **Простая геометрия:** блок, бытовка. База референса плотнеет на лёгких
   формах.
4. **Машины одной сессией:** легковая, фургон, автобус. Они различаются только
   пропорцией — разнесённые по дням, соотношения поплывут.
5. **Вагоны одной сессией:** крытый, платформа, цистерна. Три силуэта подряд,
   иначе крытый и платформа станут неразличимы.
6. **Сложные в конце:** наливняк, резервуар, кран. Выше цена срыва, нужна
   плотная база.
7. **Контактный лист.** Все двенадцать на одном холсте в финальном размере.
   Дрейф стиля и коллизии видны только рядом.
8. **Дрейф чинить усилением референса, а не правкой текста.** Правка текста
   сдвигает один объект относительно всех остальных.

Из текста без якоря в приложении не генерировать никогда — объект выпадет из
семейства.

---

## 8. Когда вышло криво

| Симптом | Причина | Что делать |
|---|---|---|
| После трассировки 300+ путей | пришёл градиент вместо ступеней | усилить SHADING: «banding is the goal, not a defect», перегенерировать |
| Объект блестит, выглядит как рендер | сработал прайор PBR | добавить в NEGATIVE: `no specular, no gloss, no metal reflection` |
| Появилась земля, ящики, мусор рядом | не сработала сдержанность | оставить только клаузу restraint, убрать перечисление — она сильнее списка |
| Края мягкие, кей рвётся | не отработал EDGES | проверить, что генерил Pro, а не Flash; `⋯ → Redo with Pro` |
| След не совпал с картой | IMAGE 2 воспринят как стиль | усилить: `IMAGE 2 is a geometry guide only` |
| В углу блёстка | SynthID | обрезать, `nothing in the corners` снижает вероятность, но не убирает |
| Модель дорисовала надписи на борту | объект «просит» текст | тройной бан: `no letters, no words, no numbers` |

---

## 9. Про источник

Кроп с tarkov.dev используется **только как след и поворот** — то есть как
геометрический гид. Сам объект описывается словами: «цилиндрическая цистерна
на коротких ногах», а не «нарисуй вот это». Так лучше по двум причинам сразу.

Практическая: кроп в 40 px не содержит информации о том, как объект выглядит,
и попытка его скопировать даёт мыло. Описание даёт модели работать с реальным
знанием о том, что такое цистерна.

Юридическая: объект, отрисованный по словесному описанию плюс твой
собственный якорь, — оригинальная работа. Обводка чужого рисунка —
производная. Для набора, который ты подписываешь и ставишь на портал с
подписками, разница существенная.

Отсюда же следует, что кроп с карты можно чаще всего вообще не прикладывать —
реальный предмет модель знает лучше, чем схематичное пятно на чужой карте.
А поскольку объект теперь генерируется в каноническом повороте и разворачивается
уже инстансом, поворот с кропа снимать не нужно. IMAGE 2 остаётся полезен
только там, где у конкретного экземпляра нестандартные пропорции.


Flat vector-style minimalist illustration of a single object for a 2D top-down game map. Fully posterized cutout art built exclusively from solid, unblended flat shapes with hard stencil edges. REFERENCE: IMAGE 1 is the strict style anchor. Exactly match its rendering style: the same clean tonal banding, the same hard unfeathered edges, the same top-left light direction, and the exact same level of geometric simplification. Do NOT copy the subject from IMAGE 1. SUBJECT: {SUBJECT} GEOMETRY & CAMERA: - High-angle orthographic top-down view (slightly angled to show top and side planes clearly, no perspective distortion or vanishing points). - Canonical orientation: long axis horizontal, front facing right. - Build the object using only basic geometric volumes (blocks, cylinders, wedges). Omit any micro-details, bolts, texture, rust, or small mechanical parts. SHADING & TONAL STEPS: - Render the object using EXACTLY 5 to 6 discrete tonal steps of cool neutral grey, plus 1 optional accent color ONLY if hazardous/marked parts are explicitly named in SUBJECT. - Zero gradients, zero smooth transitions, zero ambient occlusion, zero drop shadows, and zero anti-aliased blurring between zones. - Upward-facing planes must use the lightest solid grey steps; vertical planes use middle grey steps; undersides and cavities use the darkest solid grey step. - Single light source strictly from the top-left. BACKGROUND & CANVAS: - Single solid, uniform, unlit matte {MATTE} color filling the entire background. - Clean separation between the object and the background with crisp, hard borders. - No ground, no environment, no shadows cast on the ground, no text, no borders, no watermarks, no decorative elements.