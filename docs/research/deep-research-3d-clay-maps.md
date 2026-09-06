---
status: 🔬 research готов — гибрид A+C взлетает; узкое место не рендер, а подготовка контуров
affects: maps, 3d, threejs, webgl, webgpu, nightfall, eft, cdn, mobile
date: 2026-09-05
owner: "[[docs/decisions/3D/3d-clay-map-rendering.md]]"
---

# Deep Research: 3D clay-карта в браузере — контур, свечение, бюджеты

**Вопрос V4DYA:** заменить растровые тайлы на настоящую 3D-сцену с вращением и зумом.
Вся геометрия — в матовом clay без текстур, поверх — светящийся слой данных.
Направление выбрано заказчиком: **гибрид A+C** — массовая застройка экструдируется
из наших 2D-силуэтов по этажам, десяток знаковых строений идёт реальными мешами клиента.

Контекст, варианты и открытые развилки — в решении `docs/decisions/3D/3d-clay-map-rendering.md`.
Здесь только то, что удалось подтвердить первичкой или **измерить на наших же артефактах**.

**Версия-якорь: three.js r185 / npm `three@0.185.1`** (r185 — 2026‑07‑01, `0.185.1` — 2026‑07‑01;
r186 на 2026‑09‑05 не вышел). ⚠️ С **r181** документация перестроена на JSDoc и URL сменились
на `https://threejs.org/docs/pages/<Class>.html` — старые `docs/api/en/…` отдают 404.
Всё, что найдено в интернете со старыми ссылками, устарело как минимум на год.

---

## Вердикт

**Гибрид A+C взлетает, и с большим запасом — но не по той причине, которую мы ожидали.**
Мы боялись рендера: 65 367 объектов, стриминг, LOD. Замер показывает, что рендер — не проблема:
вся застройка Таможни в экструзии укладывается в **367 тыс. треугольников и один draw call**,
а наземный этаж целиком весит **139 КБ по проводу** (brotli, meshopt) — это меньше одного
растрового тайла 256 px в JPEG-качестве, которое мы сегодня раздаём сотнями.

Настоящее узкое место в другом: **сырые контуры слоёв 6 и 7 в девять раз тяжелее, чем нужно.**
Почти 89 % из них мельче 0.5 м² — это ящики, трубы, столбы забора, щебень. В растре они рисуют
фактуру и стоят ноль, в 3D каждый превращается в призму и стоит вершины. Экструдировать
контуры «как есть» — 829 тыс. треугольников на один этаж одной карты; после фильтра по площади
и упрощения Дугласа–Пекера тот же этаж даёт 89 тыс. Вся тяжесть задачи переехала
из браузера в **офлайн-подготовку**, а это ровно та часть конвейера, где у нас Blender,
Python и ночные прогоны.

**Главный компромисс:** ради этой лёгкости мы навсегда отказываемся от индивидуальной формы
объектов. Экструзия — это призма с плоской крышей; крыш, скатов, навесов и балконов в ней нет
и не будет. Референсы говорят, что это нормально (геометрия там приглушена до фона),
но проверить это можно только глазами V4DYA на живом кадре, а не расчётом.
**Второй компромисс, менее очевидный:** контур, на котором всё держится, дешевле всего
рисовать не `EdgesGeometry` (она не инстансится) и не постпроцессом, а **той же 2D-линией,
из которой мы выдавили призму**. Рёбра нашей геометрии буквально лежат во входных данных.

---

## Числа для прототипа

На эти цифры опираться при замере. Помечено, что **измерено на наших данных**,
что взято из **первички**, а что — **арифметика** и подлежит проверке.

| Метрика | Цель | Откуда |
|---|---|---|
| Треугольники, вся застройка одной карты (все этажи) | **≤ 500 тыс.** | измерено: 71 тыс. (Ледокол) … 456 тыс. (Развязка) |
| Треугольники, наземный этаж Таможни | **89 тыс.** (с крышками) / 65 тыс. (только боковины) | измерено |
| Треугольники, меш рельефа при шаге 4 м | ~126 тыс. | арифметика от heightmap 2082×4096 |
| Треугольники, дороги как fat lines | ~42 тыс. | измерено (1 236 путей / 8 240 вершин) × 6 tri/сегмент |
| **Итого сцена, без знаковых мешей** | **≈ 300–700 тыс. tri** | сумма выше |
| Знаковые меши клиента (10 шт., clay) | бюджет **≤ 300 тыс. tri суммарно** | назначено нами, не измерено |
| **Draw calls в кадре** | **≤ 30** | Mugen87: «2000 — очень много, идеально ~20» |
| Вес геометрии по проводу, наземный этаж | **139 КБ** (brotli+meshopt) | **измерено** |
| Вес геометрии по проводу, карта целиком | **≈ 0.8–1.0 МБ** | арифметика: 2.13 КБ на 1000 tri |
| Вес рантайма: three + r3f (gzip) | **≈ 229 КБ** | bundlephobia (вторичное) |
| Декодер meshopt (gzip) | **7.5 КБ** | измерено по файлам three.js r185 |
| Декодер Draco (gzip) | **73 КБ** | измерено по файлам three.js r185 |
| fps десктоп | 60 при вращении | цель |
| fps мобилка | 30, либо фолбэк на тайлы | цель |

⚠️ Прикидки из устного обсуждения — «150–300 тыс. треугольников, <15 МБ, <100 draw calls» —
**подтвердились по порядку и оказались пессимистичными по весу**: реальный вес на порядок
меньше названного. Теперь эти числа можно возводить в канон, но уже в исправленном виде.

---

## 0. Что мы измерили на своих артефактах

Это самый ценный раздел заметки: он не пересказывает чужие доки, а отвечает на вопрос
«сколько это стоит **у нас**». Всё считано 2026‑09‑05 по файлам
`map-exports/OBJECTS-MAPS/gen/<карта>/{walls,obstacles}/*.svg`.

### 0.1 🔴 Почти девять контуров из десяти — мусор для 3D

Наземный этаж Таможни, слои `walls` + `obstacles`, масштаб 13.14 px/м (из `frame.affine`
в `customs-obstacles.json`), треугольники — призма с крышкой (`3V − 2` на контур):

| Фильтр | Контуров | Вершин 2D | Треугольников |
|---|---|---|---|
| **как есть** | **40 675** | **303 620** | **829 510** |
| площадь ≥ 0.5 м² | 4 564 (**11.2 %**) | 61 078 | 174 106 |
| ≥ 0.5 м² + RDP 0.10 м | 4 509 | 35 929 | 98 769 |
| **≥ 0.5 м² + RDP 0.15 м** | **4 474** | **32 574** | **88 774** |
| ≥ 0.5 м² + RDP 0.25 м | 4 187 | 27 068 | 72 830 |
| ≥ 0.5 м² + RDP 0.50 м | 3 395 | 20 397 | 54 401 |

Распределение по площади (те же 40 675 контуров):

| Порог площади | Осталось контуров | Вершин |
|---|---|---|
| ≥ 0.5 м² | 4 564 — **11.2 %** | 61 078 |
| ≥ 1 м² | 2 938 — 7.2 % | 46 708 |
| ≥ 2 м² | 2 016 — 5.0 % | 36 755 |
| ≥ 4 м² | 1 351 — 3.3 % | 28 334 |
| ≥ 25 м² | 429 — 1.1 % | 10 876 |

**Читается так: 88.8 % контуров мельче 0.5 м² и вместе дают доли процента суммарной площади
силуэтов.** Это ящики, трубы, столбы забора, щебень. Отбросив их, мы не теряем ничего, что
видно с высоты птичьего полёта, и снимаем **80 % вершин**. Ещё вдвое снимает упрощение
Дугласа–Пекера с допуском 15 см — величина заведомо меньшая толщины контурной линии на экране.

**Итог: 829 510 → 88 774 треугольников, редукция ×9.3, ни один силуэт не потерян.**

Формула прироста от экструзии контура в V вершин: боковины 2V треугольников,
крышка ≈ V−2 (earcut), низ не рисуем (его не видно) → **≈ 3V−2 треугольников на контур**.

### 0.2 Все карты, все этажи — после фильтра ≥ 0.5 м² и RDP 0.15 м

| Карта | SVG-слоёв | Контуров «как есть» | Вершин «как есть» | Контуров после | Вершин после | **Треугольников** |
|---|---|---|---|---|---|---|
| Развязка | 8 | 158 812 | 1 262 787 | 22 057 | 166 844 | **456 418** |
| Маяк | 2 | 89 599 | 775 206 | 10 595 | 138 269 | **393 617** |
| Таможня | 12 | 161 591 | 1 208 656 | 16 234 | 133 135 | **366 937** |
| Улицы Таркова | 12 | 171 772 | 784 007 | 22 227 | 119 639 | **314 463** |
| Берег | 8 | 83 293 | 606 966 | 9 934 | 90 945 | **252 967** |
| Терминал | 8 | 258 995 | 1 937 885 | 15 247 | 82 685 | **217 561** |
| Лес | 2 | 46 215 | 411 269 | 6 532 | 73 978 | **208 870** |
| Резерв | 8 | 226 439 | 968 102 | 8 728 | 63 324 | **172 516** |
| Ground Zero | 8 | 70 180 | 351 120 | 4 897 | 30 208 | **80 830** |
| Ледокол | 46 | 47 721 | 274 383 | 2 528 | 25 527 | **71 525** |

Худший случай — **Развязка, 456 тыс. треугольников на всю карту со всеми этажами**.
Это меньше, чем один персонаж в современной игре. Страх «63 706 мешей Улиц не влезут
в один glTF» снимается: 63 706 мешей — это исходная геометрия клиента, а экструзия силуэтов
Улиц даёт **314 тыс. треугольников**, то есть примерно 8 МБ несжатого glTF.

⚠️ Одна оговорка: Ледокол собран из **46 SVG** (16 палуб × слои), и это единственная карта,
где число «этажей» реально велико. Ставить его в прототип как «самую маленькую» карту
поэтому неверно — он самый дробный.

### 0.3 🔴 Завод как кандидат прототипа — артефактов НЕТ

`map-exports/OBJECTS-MAPS/gen/factory/` — **пустая директория**. Пустые также `the-lab/`
и `labyrinth/`. Это ровно та тройка, что осталась в хендоффе (`docs/state/HANDOFF-eft-map-layers-next.md`)
с нерешённым вопросом поворота 90/270° и 13 % анизотропии. Прежде чем строить на Заводе
3D-прототип, придётся сначала прогнать по нему конвейер слоёв и закрыть привязку.

**Кандидат-замена для прототипа — наземный этаж Таможни:** данные проверены по 34 дверям,
рамка сверена, числа уже измерены (см. 0.4), и это эталонная карта по всем остальным осям.

### 0.4 Реальный вес: собрали glTF и сжали

Собрал из наших контуров настоящий `.glb` (наземный этаж Таможни, `walls` + `obstacles`,
фильтр ≥ 0.5 м², RDP 0.15 м, экструзия боковин на 6 м, плоские нормали, без крышек),
затем прогнал реальными упаковщиками. Всё — измерение, не оценка.

| Вариант | Файл | gzip ‑9 | brotli ‑11 |
|---|---|---|---|
| glTF float32, как есть | 3 909 672 B (3.91 МБ) | 901 117 B | 602 273 B |
| **gltfpack `-cc` (meshopt)** | 373 788 B (365 КБ) | 148 067 B | **139 364 B** |
| gltfpack `-c` (meshopt) | 388 964 B | 158 838 B | — |
| **`gltf-transform draco`** | **189 088 B (185 КБ)** | 157 692 B | 155 638 B |

Статистика от gltfpack: вход 65 148 треугольников / 130 296 вершин →
выход **65 148 треугольников / 115 384 вершин, 1 draw call**, буферы: вершины 311 633 B,
индексы 75 776 B.

**Что из этого следует — и это прямой ответ на вопрос «Draco или Meshopt»:**

- **По голому файлу Draco вдвое компактнее** (185 КБ против 365 КБ).
- **По проводу с brotli — Meshopt выигрывает** (139 КБ против 156 КБ), потому что его
  битстрим специально сделан байтовым и дожимаемым, а Draco уже энтропийно закодирован
  и брotli ему почти ничего не добавляет (189 → 156 КБ, всего 18 %).
- **Декодер Meshopt в 10 раз легче:** 7.5 КБ gzip против 73 КБ у Draco
  (измерено по файлам, которые бандлит сам three.js r185: `meshopt_decoder.module.js` 29 256 B →
  7 714 B gzip; `draco_decoder.wasm` + `draco_wasm_wrapper.js` 250 876 B → ≈74 764 B gzip).
- Дон МакКурди прямо пишет в JSDoc `KHRDracoMeshCompression`: «**For geometry <1MB, the size
  of the WASM decoder library may outweigh size savings.**» Наши файлы как раз <1 МБ.

➡️ **Канон для нас: `EXT_meshopt_compression` + brotli на R2.** Draco не берём.

### 0.5 Клей-градация по классу — она уже в данных

В SVG слоёв стоят группы `<g id="…">`: **`building` · `props` · `fence` · `plant` · `stone` ·
`openings`**. Открытая развилка №1 из решения («один цвет или градация по классу») закрывается
бесплатно: класс уже размечен на этапе экструзии, останется положить его в `COLOR_0`
или в отдельный `BatchedMesh` на класс.

### 0.6 Рельеф 1:1 невозможен

`customs-height-meters.npy` — **(2082, 4096) float32**, то есть 8.53 млн отсчётов ≈ 17 млн
треугольников. Меш рельефа обязан быть прорежен. При шаге 4 м по миру (рамка Таможни
≈ 1247 × 809 м) получается сетка ≈ 312 × 202 = 63 тыс. вершин / **126 тыс. треугольников** —
это и берём в бюджет. Шаг 2 м даёт 505 тыс. треугольников и уже соизмерим со всей застройкой.

---

## 1. Контур и форма без текстур

### 1.1 🔴 Главный вопрос: работает ли outline с InstancedMesh — ответ по исходникам

Проверено прямо в коде three.js `dev` (r185+), не по пересказам.

**`USE_INSTANCING` включается ровно от одного условия.** `src/renderers/webgl/WebGLPrograms.js`:

```js
const IS_INSTANCEDMESH = object.isInstancedMesh === true;
const IS_BATCHEDMESH   = object.isBatchedMesh   === true;
…
instancing: IS_INSTANCEDMESH,
```

и чанк `src/renderers/shaders/ShaderChunk/project_vertex.glsl.js`:

```glsl
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
```

➡️ **`LineSegments` с `EdgesGeometry` — не `InstancedMesh`, значит `USE_INSTANCING`
для него не выставляется вообще.** Нативного инстансинга рёбер в three.js нет.
`EdgesGeometry` при этом сама по себе безобидна — она просто «can be used as a helper object
to view the edges of a geometry», `thresholdAngle` по умолчанию **1°**
(«An edge is only rendered if the angle (in degrees) between the face normals of the adjoining
faces exceeds this value»).

**Что работает с инстансингом — по убыванию полезности для нас:**

| Техника | С `InstancedMesh` | С `BatchedMesh` | Стоимость |
|---|---|---|---|
| `EdgesGeometry` + `LineSegments` | ❌ нет | ❌ нет | — |
| drei `<Outlines>` (inverted hull) | ✅ **да** | не проверено | ×2 геометрии, +1 draw call на пачку |
| `OutlinePass` (examples/jsm) | ✅ на уровне шейдера | не проверено | +1 depth-проход сцены, +2 блюра |
| TSL `outline()` (`three/addons/tsl/display/OutlineNode.js`) | не проверено | не проверено | аналог OutlinePass для WebGPU |
| `ToonOutlinePassNode` (ядро TSL) | не проверено | не проверено | только `MeshToonMaterial`/`MeshToonNodeMaterial` |
| pmndrs `OutlineEffect` | ✅ целиком, ❌ отдельный инстанс | — | depth-mask-проход |
| **screen-space edge из depth+normal** | ✅ источник неважен | ✅ | **константа, независимо от числа объектов** |
| **наша 2D-линия силуэта как `Line2`** | ✅ (сегмент = инстанс) | — | 6 tri/сегмент, 1 draw call |

**drei `<Outlines>`** — единственный из готовых, кто явно ветвится по типу родителя
(`src/core/Outlines.tsx`): `if (parent.skeleton) { … } else if (parent.isInstancedMesh)
{ mesh = new THREE.InstancedMesh(…) }` — копирует `instanceMatrix` и `count`.
Техника — вывернутая копия (`THREE.BackSide`, нормали наружу), props: `thickness` (0.05),
`color`, `screenspace` (постоянная толщина при зуме), `opacity`, `angle` (склейка нормалей
по углу, дефолт `Math.PI`), `polygonOffset`, `renderOrder`.
Цена — **дублирование геометрии**: 89 тыс. треугольников превращаются в 178 тыс.

**`OutlinePass`** («A pass for rendering outlines around selected objects») инстансинг
в шейдере маски поддерживает — в `_getPrepareMaskMaterial()` есть `#ifdef USE_INSTANCING`
и применение `instanceMatrix`, плюс `morphtarget_pars_vertex` и `skinning_pars_vertex`.
Но это **инструмент подсветки выделения**, а не архитектурный контур: он рисует силуэт
вокруг *выделенной группы* целиком, а не рёбра внутри неё. Конвейер: depth-проход
невыделенных → маска выделенных → Sobel-подобная детекция краёв → два гауссовых блюра
(полное и четвертное разрешение, `downSampleRatio` = 2) → аддитивный оверлей.
**Для нас это инструмент «подсветить здание по клику», а не базовый рендер.**

**pmndrs `OutlineEffect`** работает с `InstancedMesh` как с целым объектом; подсветить
**один инстанс** штатно нельзя — известный обходной путь из обсуждения r3f #1409/#1410
состоит в добавлении отдельного обычного меша с той же матрицей.

### 1.2 Screen-space контур из depth и normal — самый масштабируемый путь

Официального «edge-detection pass» в three.js нет, но есть **работающий референс механики
внутри ядра примеров**: `examples/jsm/postprocessing/RenderPixelatedPass.js`. Он делает ровно то,
что нам нужно, просто с другой художественной целью:

- создаёт beauty-таргет с `depthTexture = new DepthTexture()`;
- рендерит сцену **второй раз** с `scene.overrideMaterial = new MeshNormalMaterial()` в отдельный таргет;
- в фрагментном шейдере считает `depthEdgeIndicator(depth, normal)` и `normalEdgeIndicator(…)`
  по четырём соседям: `getDepth(x,y)` из `tDepth`, `getNormal(x,y)` из `tNormal` (распаковка `*2−1`).

**Стоимость — константа от разрешения экрана, а не от числа объектов.** Это её главное
преимущество: 65 тыс. призм или 650 тыс. — цена одна. Минус — **второй проход сцены**
ради нормалей, то есть удвоение CPU-обхода графа и draw calls.

Этот минус **снимается на WebGPU-пути**: `RenderTarget` в three.js r185 поддерживает MRT
через опцию `count` («Defines the number of color attachments. Must be at least `1`»)
и массив `textures`, а в TSL есть `MRTNode` и `mrt({ … })`. То есть нормали и глубина
пишутся **в том же проходе**, что и цвет, и второй рендер сцены не нужен вовсе.
Именно так устроен официальный пример `webgpu_postprocessing_bloom_emissive` (см. §2.3).

Артефакты screen-space-контура (общие для класса техник, не специфика three.js):
контур одинаковой толщины на любой дистанции (лечится масштабированием порога по глубине),
пропуск рёбер между копланарными поверхностями разного объекта (лечится добавлением
третьего канала — object/class ID в MRT), «дрожание» контура при вращении на почти
касательных гранях (лечится множителем `1 − |N·V|` в пороге).

### 1.3 🔑 Наш собственный ход: рёбра уже лежат во входных данных

Экструзия призмы из контура даёт геометрию, у которой **все силуэтные рёбра — это
исходный 2D-полигон**. Верхнее кольцо — тот же полигон, поднятый на высоту; вертикальные
рёбра — те же вершины. Вычислять `EdgesGeometry` не нужно ни офлайн, ни в рантайме.

Практический рецепт: сложить верхние кольца всех контуров этажа в **один `LineSegments2`**.
`LineSegmentsGeometry extends InstancedBufferGeometry` («A series of vertex pairs, forming
line segments… @augments InstancedBufferGeometry»), базовая геометрия — 8 вершин / 6 треугольников
на сегмент, позиции идут `InstancedInterleavedBuffer` со stride 6. То есть **каждый сегмент —
инстанс, а вся сеть контуров — один draw call**.

Замер: наземный этаж Таможни после фильтра — 32 574 вершины контуров ≈ 32 570 сегментов
→ **195 тыс. треугольников fat-line, 1 draw call, ~780 КБ инстансных атрибутов в VRAM**.
Дороже, чем screen-space, но абсолютно предсказуемо, и толщина/цвет управляются точно.

**Развилка для прототипа:** начать с fat-line-контуров (просто, детерминированно,
даёт ровно вид референса №1), а screen-space-детектор держать как второй режим для случая,
когда 195 тыс. треугольников линий начнут мешать.

### 1.4 Rim light / fresnel вместо AO

Готового rim/fresnel-материала в three.js нет — ни в `src/materials/`, ни как TSL-нода
(проверено по `src/nodes/TSL.js`: экспорта `fresnel`/`rimLight` там нет).
Есть **строительный блок**: `F_Schlick` экспортируется из
`src/nodes/functions/BSDF/F_Schlick.js` с ссылками в комментариях на
«Original approximation by Christophe Schlick '94» и оптимизированный вариант Epic,
SIGGRAPH '13 (`cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf`).

Практически rim — это одна строка в фрагментном шейдере: `pow(1 − max(0, dot(N, V)), k)`,
добавленная к цвету. Стоит доли инструкции на пиксель и на тёмной сцене даёт ровно тот
«светящийся край объёма», который в референсах читается как форма. **Это самая дешёвая
из всех рассмотренных техник и она не зависит ни от инстансинга, ни от числа объектов.**

### 1.5 Ambient occlusion — вторичен, но если решим

**Запечь офлайн в `COLOR_0`.** Спека glTF 2.0 разрешает для `COLOR_n` типы `VEC3`/`VEC4`
с компонентами `float32` / `unorm8` / `unorm16`, семантика — «RGB or RGBA vertex color
**linear multiplier**», значения обязаны лежать в `[0.0, 1.0]`. То есть **AO в `unorm8` —
3 байта на вершину**. Для наземного этажа Таможни (115 384 вершины после сварки) это
+346 КБ несжатых, после meshopt/brotli — единицы-десятки килобайт.

⚠️ **Но `MeshMatcapMaterial` не поддерживает `aoMap`** — проверено по
`src/renderers/shaders/ShaderLib/meshmatcap.glsl.js`: `<aomap_pars_fragment>` там нет.
Зато **`<color_pars_fragment>` и `<color_fragment>` есть**, то есть вершинные цвета работают.
➡️ Рецепт «matcap + AO, запечённый в `COLOR_0`» — рабочий; «matcap + aoMap» — нет.

Blender умеет печь AO в цветовой атрибут (Cycles → Bake, Target = Active Color Attribute) —
подтверждено манулом Blender и трекером (`developer.blender.org/T85057`, `T97930`,
где обсуждаются именно артефакты такого бейка). ⚠️ Известная гоча из тех же тикетов:
пер-корнерный бейк даёт разрывы на семплинг-шуме — для наших плоскозатенённых призм
это как раз рискованно.

**Realtime-альтернативы:**
- `GTAOPass` (three.js addons, добавлен в **r160** взамен `HBAOPass`) — «better quality than
  `SSAOPass` but is also more computationally expensive». Требует G-buffer (depth + normal)
  через `setGBuffer()` либо создаёт свои таргеты. Параметры: `radius`, `distanceExponent`,
  `thickness`, `scale`, `samples`, `screenSpaceRadius`, `blendIntensity`, плюс Poisson-денойз
  (`pdSamples` 16, `pdRings` 2, `pdRadiusExponent` 2).
- `N8AO` (N8python) — README заявляет полуразрешающий режим «generally 2×–4×» быстрее
  с фиксированной ценой depth-aware апскейла «around 1ms»; пресеты Performance/Low/Medium/High/Ultra
  = 8/16/16/64/64 AO-семплов. Прямого сравнения с `GTAOPass` в числах автор не даёт.

**Рекомендация:** AO в первом прототипе **не делать вообще**. Референсы держатся на контуре
и rim; если после сборки V4DYA скажет «плоско» — сначала пробовать rim и градацию clay
по классу (§0.5), и только потом платить за AO.

### 1.6 Clay-материал — что выбрать

| Материал | Свет нужен? | Текстура нужна? | Вердикт |
|---|---|---|---|
| `MeshMatcapMaterial` | ❌ «does not respond to scene lights» | ✅ **одна matcap** | лучший вид, но формально «текстура есть» |
| `MeshNormalMaterial` | ❌ | ❌ | цвет = нормаль, для clay не годится (радужный) |
| `MeshLambertMaterial` | ✅ | ❌ | **честный clay без текстур, дешевле Phong/Standard** |
| `MeshPhongMaterial` | ✅ | ❌ | блик нам не нужен |
| кастом / TSL | ✅/❌ | ❌ | Lambert + rim + градация по классу |

**`MeshMatcapMaterial`** — «This material is defined by a MatCap (or Lit Sphere) texture,
which encodes the material color and shading»; matcap кодирует запечённый свет, поэтому
на свет не реагирует. Поддерживает `flatShading`, `normalMap`, `bumpMap`, `alphaMap`, `fog`,
`vertexColors`. Вес matcap-текстуры: PNG 256×256 в градациях серого ≈ 10–20 КБ; можно
512×512 ≈ 40–60 КБ. ⚠️ Формально это нарушает «без текстур», фактически — это 15 КБ
на всю сцену и ноль ассетов BSG. **Это не тот вес, за который стоит бороться.**

**`MeshLambertMaterial`** — «A material for non-shiny surfaces, without specular highlights…
uses **per-fragment shading**… **performance will be greater when using this material over
the `MeshPhongMaterial`, `MeshStandardMaterial` or `MeshPhysicalMaterial`**, at the cost of
some graphical accuracy». Это буквальное определение clay: матовая поверхность,
никаких бликов, дешевле всего из освещаемых.

➡️ **Рекомендация:** `MeshLambertMaterial` одним цветом + одна направленная лампа под углом
+ rim в кастомном чанке + `COLOR_0` для градации по классу. Matcap держать как второй
вариант «одной строкой» для сравнения глазами: у TSL есть нода `MatcapUV` (`src/nodes/utils/MatcapUV.js`),
которой можно скормить процедурный градиент вместо текстуры — тогда «без текстур» соблюдено буквально.

---

## 2. Светящийся слой данных

### 2.1 Почему обычная линия не имеет толщины — первичка

Долго искали формулировку в спеке WebGL; она нашлась там, где и должна быть — **в самом three.js**.
JSDoc свойства `linewidth` в `src/materials/LineBasicMaterial.js`, дословно:

> «Controls line thickness or lines. Can only be used with `SVGRenderer`.
> **WebGL and WebGPU ignore this setting and always render line primitives with a width of one pixel.**»

Это утверждение движка, а не спеки. В спеке WebGL/OpenGL ES ограничение выражено косвенно
(`ALIASED_LINE_WIDTH_RANGE`, минимально гарантированный диапазон — `[1, 1]`), а на практике
все браузеры на Windows идут через ANGLE, где широкая линия не поддерживается.
**Точной строки «line width MUST be 1» в спеке Khronos я не нашёл** — см. «Что осталось неизвестным».

### 2.2 `Line2` / `LineMaterial` / `LineGeometry`

`src/…/examples/jsm/lines/LineMaterial.js`, JSDoc класса:

> «A material for drawing wireframe-style geometries. Unlike `LineBasicMaterial`,
> it supports **arbitrary line widths** and allows using **world units** instead of screen space units.»

Свойства и дефолты:

| Свойство | Дефолт | Смысл |
|---|---|---|
| `linewidth` | 1 | толщина в **CSS-пикселях**, если `worldUnits === false` |
| `worldUnits` | false | переключение в мировые единицы |
| `dashed` | false | пунктир |
| `dashScale` / `dashSize` / `gapSize` | 1 / 1 / 1 | геометрия пунктира |
| **`dashOffset`** | **0** | «Where in the dash cycle the dash starts» |
| `resolution` | `Vector2()` | размер вьюпорта, обязателен |
| `alphaToCoverage` | false | сглаживание края |

**`dashOffset` — это и есть «бегущее свечение».** Анимация маршрута сводится к
`material.dashOffset -= delta * speed` в `useFrame`, без единого кастомного шейдера.
Это самый дешёвый способ из всех перечисленных в постановке — дешевле uv-скроллинга,
потому что скроллить нечего.

Геометрия: `LineSegmentsGeometry extends InstancedBufferGeometry`, **8 вершин / 6 треугольников
на сегмент**, `InstancedInterleavedBuffer` со stride 6. Маршрут в 200 точек = 199 сегментов
= 1 194 треугольника, 1 draw call. Пренебрежимо.

Официальные примеры: `webgl_lines_fat`, `webgl_lines_fat_raycasting`, `webgl_lines_fat_wireframe`
(и WebGPU-близнецы). В drei то же самое обёрнуто как `<Line>`, плюс `<CatmullRomLine>`,
`<CubicBezierLine>`, `<QuadraticBezierLine>`.

### 2.3 🔑 Selective bloom — три способа, и третий на порядок дешевле

**Способ 1 — официальный пример three.js `webgl_postprocessing_unreal_bloom_selective`.**
Механика:

```js
const BLOOM_SCENE = 1;
bloomLayer.set( BLOOM_SCENE );
sphere.layers.enable( BLOOM_SCENE );
// перед bloom-проходом:
darkenNonBloomed(obj)  → materials[obj.uuid] = obj.material; obj.material = darkMaterial;
// после:
restoreMaterial(obj)   → obj.material = materials[obj.uuid];
// два композера:
bloomComposer.renderToScreen = false;   // рендерит затемнённую сцену + UnrealBloomPass
finalComposer  → mixPass: texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv) * bloomStrength
```

⚠️ **Это самый дорогой вариант из трёх:** он делает `scene.traverse()` дважды за кадр
(CPU, O(N) по всему графу) и **рендерит сцену второй раз целиком**. На нашем графе
это удвоение всей стоимости кадра ради двух светящихся линий.

**Способ 2 — pmndrs `SelectiveBloomEffect`** («A selective bloom effect. This effect applies
bloom to selected objects only»). Через `Selection` + слой камеры: `DepthPass` по выделению →
`ClearPass` → `DepthMaskPass` (сравнение глубин, отбрасывание непопавших) → обычный `BloomEffect`.
Материалы не подменяет, но всё ещё делает **отдельный depth-проход по выделенным объектам**.
Флаги: `inverted` (переключает `EqualDepth` → `NotEqualDepth`), `ignoreBackground`
(`DISCARD_MAX_DEPTH` vs `KEEP_MAX_DEPTH`).

**Способ 3 — MRT в одном проходе, WebGPU/TSL.** Официальный пример
`webgpu_postprocessing_bloom_emissive`:

```js
mrt( { output: output, emissive: vec4( emissive, output.a ) } )
scenePass.setMRT( mrtNode );
const emissivePass = scenePass.getTextureNode( 'emissive' );
const bloomPass = bloom( emissivePass, 2.5, .5 );
renderPipeline.outputNode = outputPass.add( bloomPass );
```

**Сцена рендерится ОДИН раз**, emissive пишется во второе цветовое вложение того же прохода,
блум считается только по нему. Ни обхода графа, ни подмены материалов, ни второго рендера.

➡️ **Для нашего случая (тёмная сцена, светятся только маршрут и метки) правильный ответ —
способ 3.** Он же снимает второй проход, нужный для screen-space-контура (§1.2): нормали
и object ID пишутся в те же MRT-вложения. **Selective bloom и outline закрываются одним
проходом сцены — это самый весомый технический аргумент за WebGPU-путь во всём исследовании.**

**Способ 3-бис для WebGL-пути:** наши светящиеся объекты — это два-три объекта, а не 65 тысяч.
Значит вместо «затемнить всё остальное» можно сделать наоборот: `camera.layers.set(GLOW_LAYER)`
и отрендерить **только слой свечения** в маленький таргет, блумнуть его, аддитивно наложить.
Стоимость — один рендер трёх объектов, а не всей сцены. Механика слоёв документирована:
«A layers object assigns an 3D object to 1 or more of **32 layers** numbered 0 to 31…
**an object must share a layer with a camera to be visible** when that camera's view is rendered».
Официального примера ровно на этот рецепт нет — это наш вывод из механики слоёв.

### 2.4 Tone mapping и emissive

Прямая нота в доках `UnrealBloomPass`:

> «This pass is inspired by the bloom pass of Unreal Engine. It creates a mip map chain
> of bloom textures and blurs them with different radii… **When using this pass,
> tone mapping must be enabled in the renderer settings.**»

Доступные константы `WebGLRenderer.toneMapping`: `NoToneMapping` (**дефолт**),
`LinearToneMapping`, `ReinhardToneMapping`, `CineonToneMapping`, `ACESFilmicToneMapping`,
`CustomToneMapping`, `AgXToneMapping`, `NeutralToneMapping`. `toneMappingExposure` = 1.

Ключевой рычаг — `Material.toneMapped`: «Defines whether this material is tone mapped
according to the renderer's tone mapping setting», дефолт `true`. Для UI-подобных
светящихся элементов (пины, метки), которые должны иметь **точно заданный цвет NIGHTFALL**
и не съезжать от тонмаппинга, ставится `toneMapped = false`.

`MeshStandardMaterial.emissive` («Emissive (light) color of the material, essentially a solid
color unaffected by other lighting», дефолт чёрный) + `emissiveIntensity` («Intensity of the
emissive light. Modulates the emissive color», дефолт 1). ⚠️ **Про значения выше 1.0 и про
bloom в доках three.js не сказано ничего** — это практика, а не документированное поведение.
Работает оно потому, что HDR-буфер композера хранит >1, а тонмаппинг сжимает обратно.

**Рекомендация:** `ACESFilmicToneMapping` для сцены (он даёт мягкое плечо, на котором
свечение не выжигается в белый), `toneMapped = false` на метках-иконках, `emissiveIntensity`
2–4 на маршруте, порог блума ~0.9.

### 2.5 Дороги: fat lines, не полигоны

У нас дороги — извлечённая геометрия: Таможня — **1 236 путей / 8 240 вершин**
(`customs-roads-full.svg`), 36 782 м² полотна.

| Вариант | Треугольников | Проблемы |
|---|---|---|
| Полигоны полотна с emissive | ~16 тыс. (триангуляция 8 240 вершин) | **z-fighting с рельефом**, лечится `polygonOffset`; вид «заливка», а не «контур» |
| `DecalGeometry` | зависит от рельефа | JSDoc: «decal projections can be distorted when used around corners»; на 1 236 дорогах — 1 236 проекций |
| **`Line2` по осевым** | **~42 тыс.** (7 000 сегментов × 6) | нет z-fighting (линия рисуется поверх с `depthTest`/`renderOrder`), толщина в CSS-пикселях постоянна при зуме |

➡️ **Fat lines.** Это ровно вид референса №1 («дороги тонкой светлой контурной линией
по тёмному»), это дешевле по треугольникам, чем кажется, и это единственный вариант,
где толщина линии не зависит от зума — что для карты принципиально.
Осевые линии из полотен вытягиваются офлайн (скелетизация), это одноразовая работа Python.

---

## 3. Метки и иконки

### 3.1 Объёмный пин vs плоская экструзия vs билборд

| Вариант | tri/метка | 500 меток | Читаемость при вращении |
|---|---|---|---|
| Объёмный пин-капля (сфера+конус, low-poly) | 200–400 | 100–200 тыс., **1 draw call** через `InstancedMesh` | отличная — форма читается с любого угла |
| Экструзия SVG-иконки (`ExtrudeGeometry`) | 300–3000 (см. 3.2) | 150 тыс.–1.5 млн | **плохая — с ребра иконка исчезает** |
| Билборд-квад с SDF | **2** | **1 000 tri, 1 draw call** | идеальная — всегда фронтально |

➡️ Для **навигационных** меток (сотни точек интереса) — билборды с SDF.
Для **сюжетных** акцентов (пин старта/финиша маршрута, как в референсах 1 и 3, их единицы) —
объёмный пин-капля: он читается как объект сцены, отбрасывает силуэт, и его двадцать штук.
**Плоская экструзия иконки — худший из трёх:** дорого и разворачивается ребром к камере.

### 3.2 `SVGLoader` + `ExtrudeGeometry` — ограничения, и что из них устарело

`SVGLoader` («A loader for the SVG format…») возвращает `{ paths, xml }`, где каждый path
несёт `.color` и `.userData.style`.

**Что парсер понимает** (switch в `parseNode`): `svg`, `style`, `g`, `path`, `rect`,
`polygon`, `polyline`, `circle`, `ellipse`, `line`, `defs`, `use`.
**Что явно не понимает** (предупреждения в коде): «THREE.SVGLoader: **Filters are not supported**»,
«THREE.SVGLoader: **Gradient strokes are not supported**».

🔴 **Опасение из решения про дыры и `evenodd` — устарело.** `SVGLoader.createShapes()`
помечен «**Deprecated: since 185**» с указанием использовать `shapePath.toShapes()`,
а сам `ShapePath.toShapes()` в r185 разбирает вложенность по **числу оборота с учётом fill-rule**:
считает знак площади подпути («counter-clockwise (signed area > 0) contributes +1 to the winding
number at an interior point, clockwise contributes −1»), классифицирует «An entry is an outer
shape if it has no container or if its container is itself a hole; otherwise it's a hole in
its container» и корректно обрабатывает «solid nested inside a hole becomes a new top-level shape».
➡️ **Дыры и `evenodd` в r185 работают.** Обходить это офлайном больше не нужно.

**`ExtrudeGeometry`** — опции и дефолты:

| Опция | Дефолт |
|---|---|
| `curveSegments` | **12** |
| `steps` | 1 |
| `depth` | 1 |
| `bevelEnabled` | **true** |
| `bevelThickness` | 0.2 |
| `bevelSize` | `bevelThickness − 0.1` |
| `bevelOffset` | 0 |
| `bevelSegments` | **3** |

⚠️ **Дефолты враждебны бюджету.** `bevelEnabled: true` + `bevelSegments: 3` добавляют
три кольца геометрии по контуру; `curveSegments: 12` на каждой кривой Безье.
Иконка lucide (тонкие обводки, много кривых) при дефолтах легко даёт **1 500–3 000 треугольников**;
при `bevelEnabled: false, curveSegments: 4` — **300–600**.
Точных чисел по конкретным иконкам в первичке нет, это оценка по числу сегментов —
**померить на нашем наборе**.

Отдельная гоча под наш набор: **lucide-иконки нарисованы `stroke`, а не `fill`.**
`ExtrudeGeometry` экструдирует заливку. Обводку сначала надо превратить в контур —
`SVGLoader.pointsToStroke()` («Generates stroke geometry from an array of 2D points»,
возвращает `BufferGeometry` или `null`) даёт 2D-геометрию обводки, но не `Shape` для экструзии.
Практичнее прогнать stroke→fill офлайн (Inkscape `--actions="object-stroke-to-path"`,
или `vpype`/`svgpathtools`) — тем более что набор конечный.

### 3.3 Офлайн-атлас vs рантайм

Аргументы за офлайн (Blender → один glTF со всеми иконками):
- `curveSegments`/`bevel` подбираются один раз и глазами, а не наугад в рантайме;
- stroke→fill решается на этапе подготовки, где есть нормальные инструменты;
- иконки грузятся одним файлом и одним `InstancedMesh` на иконку;
- не тянем `SVGLoader` в бандл вообще.

Аргументы против: любое добавление иконки требует прогона конвейера.
Учитывая, что набор — lucide + свой монохром и он меняется раз в спринт, **офлайн выигрывает**.

### 3.4 Instanced billboard + SDF

Каноническая первичка по SDF-глифам — Chris Green (Valve), **«Improved Alpha-Tested
Magnification for Vector Textures and Special Effects»**, SIGGRAPH 2007 Courses, pp. 9–18,
`https://dl.acm.org/doi/10.1145/1281500.1281665`. Суть: хранить не альфу, а поле расстояний
в канале текстуры низкого разрешения; при магнификации билинейная интерполяция расстояния
даёт **резкий край на любом зуме**, а порогом можно получить обводку и свечение бесплатно.
Для монохромного иконочного набора это идеальный формат: одна текстура-атлас на все иконки,
2 треугольника на метку, край не мылится при зуме.

Насколько дешевле: официальный пример three.js `webgl_buffergeometry_instancing_billboards`
создаёт **`const particleCount = 75000;`** инстансных билбордов — то есть порядок
«десятки тысяч меток в одном draw call» подтверждён примером из ядра.

### 3.5 Постоянный экранный размер и билборд-разворот

**Билборд** — механика в том же примере: позиция инстанса переводится в view space,
после чего локальные XY квада прибавляются уже там:

```glsl
vec4 mvPosition = modelViewMatrix * vec4( translate, 1.0 );
mvPosition.xyz += position * scale;
```

Поскольку в view space оси X/Y всегда параллельны экрану, квад автоматически смотрит в камеру.
Тот же принцип формализован в `Sprite`: «A sprite is a plane that **always faces towards
the camera**, generally with a partially transparent texture applied».

**Постоянный экранный размер** — `SpriteMaterial.sizeAttenuation`: «Specifies whether size
of the sprite is attenuated by the camera depth (**perspective camera only**). Default is `true`».
Ставим `false` → размер в мировых единицах перестаёт зависеть от дистанции.
В своём шейдере то же делается делением на `mvPosition.z` (или его отсутствием).

⚠️ Для **ортографической** камеры `sizeAttenuation` не работает по определению
(в орто нет перспективного деления) — там постоянный размер получается сам,
но при зуме метка растёт вместе со сценой, и компенсировать надо делением на `camera.zoom`.

В TSL для этого есть готовые ноды: `src/nodes/utils/SpriteUtils.js` и `SpriteSheetUV.js`.

---

## 4. Бюджеты и производительность

### 4.1 Что реально меряет `WebGLRenderer.info`

Из `src/renderers/webgl/WebGLInfo.js`:

```js
function update( count, mode, instanceCount ) {
    render.calls ++;
    switch ( mode ) {
        case gl.TRIANGLES: render.triangles += instanceCount * ( count / 3 ); break;
        …
    }
}
```

- `render.calls` — «The number of draw calls per frame». **Один инкремент на каждый
  `gl.drawArrays / drawElements / *Instanced / multiDraw*`.** Инстансный рендер = **1 call**
  при любом `instanceCount`; multi-draw = **1 call**, треугольники считаются по сумме.
- `memory.geometries` / `memory.textures` — живые GPU-ресурсы, `reset()` их **не трогает**.
- ⚠️ Сброс происходит **в начале каждого `render()`** (`this.info.render.frame ++;
  if ( this.info.autoReset === true ) this.info.reset();`). При пост-процессинге
  (несколько `render()` за кадр) обязательно `renderer.info.autoReset = false` + ручной `reset()`.

### 4.2 Потолки — жёстких нормативов в первичке НЕТ

**В официальных доках three.js численных бюджетов не существует.** В FAQ такого вопроса нет.
Единственный измеренный кейс — манул «Optimizing Lots of Objects»:

> «There are up to 360×145 boxes we're going to create… the actual number of boxes we're going
> to create is around **19000**.» → «On my machine I see a framerate **under 20fps**.»
> После `BufferGeometryUtils.mergeGeometries`: «now, at least on my machine, I get **60 frames per second**».

Железо не названо, статья унаследована от threejsfundamentals (~2018–2020).

**Реплики мейнтейнеров на официальном форуме** — первичные по авторству, эмпирические по природе:

| Кто, когда | Цитата |
|---|---|
| Mugen87, 2019‑08‑13 | «**2000 draw calls is still quite a lot. Ideally you have something like 20.**» |
| Mugen87, 2020‑02‑04 | «The amount of draw calls (**27**) seems to be okay. I'm not sure if your scene really needs **almost 500.000 triangles**.» |
| Mugen87, 2020‑05‑15 | «draw calls in the range of **100 − 500**… On top of that, you render **almost three million triangles**… It's not surprising that the FPS drops.» |
| drcmda (автор r3f), 2024‑08‑21 | «yes **808 draw calls is bad. 427 geometries is bad.**» |
| доки r3f | держать меши в пределах **1000**, «a few hundred or less» |

**Диагностический приём мейнтейнеров, полезнее любого числа:** если уменьшение окна браузера
поднимает fps — упор во fill rate; если fps не меняется — упор в CPU-оверхед draw calls.

➡️ **Наш бюджет ≤ 30 draw calls** укладывается в «идеально ~20 … 27 нормально» с запасом,
а 300–700 тыс. треугольников — в «500 тыс. многовато, 3 млн уже больно».

### 4.3 `InstancedMesh` vs `BatchedMesh`

Определения из доков r185 — разделение однозначное:

- **`InstancedMesh`**: «Use this class if you have to render a large number of objects with
  **the same geometry and material(s) but with different world transformations**.»
- **`BatchedMesh`**: «A special version of a mesh with **multi draw batch rendering** support.
  Use this class if you have to render a large number of objects with **the same material
  but with different geometries or world transformations**.»

**Статус `BatchedMesh` на r185 — стабильный, не экспериментальный.** В `src/objects/BatchedMesh.js`
нет ни слова `experimental`, ни предупреждающих нот; поиск по `src/` на «experimental» даёт
только `NodeUtils.js` и `MeshSSSNodeMaterial.js`.

Конструктор: `new BatchedMesh( maxInstanceCount, maxVertexCount, maxIndexCount = maxVertexCount*2, material )` —
**всё это преаллокация** (типизированные массивы + data-текстуры матриц), занижать нельзя,
завышать платно по памяти. Меняется на лету: `setInstanceCount()`, `setGeometrySize()` (обе с r170),
плюс `optimize()` и read-only `unusedVertexCount`/`unusedIndexCount`.

Возможности, которых **нет у `InstancedMesh`**:

| Возможность | `BatchedMesh` | `InstancedMesh` |
|---|---|---|
| Разные геометрии в одном вызове | ✅ `addGeometry` / `setGeometryIdAt` | ❌ |
| **Пер-объектный frustum culling** | ✅ `perObjectFrustumCulled` = **true** по умолчанию | ❌ (issue #27170 — **open** с 2023‑11‑10) |
| **Депт-сортировка внутри пачки** | ✅ `sortObjects` = **true**, `setCustomSort()` | ❌ |
| Пер-инстансный цвет и **альфа** | ✅ `setColorAt(id, Color \| Vector4)` (r165 / r183) | ✅ только цвет |
| Пер-инстансная видимость | ✅ `setVisibleAt` | ❌ (только через матрицу нулевого масштаба) |
| Пер-инстансный LOD | 🟡 вручную через `setGeometryIdAt` | ❌ |
| `addLOD` в ядре | ❌ **нет** (пакет `@three.ez/batched-mesh-extensions`) | ❌ |

Хронология по release notes: появился аддоном в **r158** (2023‑10‑27), переехал в ядро в **r159**,
инстансинг+сортировка+culling в **r166**, `setGeometryIdAt`/`deleteInstance` в r169,
`optimize()` и ресайз в **r170**, пример LOD+BVH в **r178**, per-instance opacity и wireframe в **r183**,
удаление устаревших путей инстансинга в **r184**.

### 4.4 🔴 Гоча: `BatchedMesh` ≠ один draw call везде

`WebGLRenderer.js`:

```js
if ( object.isBatchedMesh ) {
    if ( ! extensions.get( 'WEBGL_multi_draw' ) ) {
        for ( let i = 0; i < drawCount; i ++ ) {          // ← N обычных draw calls
            uniforms.setValue( _gl, '_gl_DrawID', i );
            renderer.render( starts[i] / bytesPerElement, counts[i] );
        }
    } else {
        renderer.renderMultiDraw( … );                     // ← 1 call
    }
}
```

Поддержка `WEBGL_multi_draw` (MDN BCD, `api/WEBGL_multi_draw.json`):
**Chrome 86+, Safari 15+, Edge/Opera/Samsung/WebView — зеркала Chrome.
Firefox — `version_added: false`.** И это не «пока нет»: Bugzilla **#1536673**
«Implement webgl draft ext WEBGL_multi_draw» — **RESOLVED / WONTFIX**
(создан 2019‑03‑19, последнее изменение 2025‑09‑18).

Мотивация из самой спеки Khronos (WebGL extension #40, «Last modified date: September 08, 2023,
Revision: 8») — буквально наш случай: «**CAD vendors rendering large models comprised of many
individual parts face scalability issues issuing large numbers of draw calls from WebGL.**»

⚠️ **И под WebGPU BatchedMesh тоже разворачивается в цикл** — в спеке WebGPU нативного
multi-draw нет, `WebGPUBackend.js` вызывает `drawIndexed()` в цикле по `drawCount`.
Выгода там — экономия на переключении pipeline/state, а не «одна команда».

➡️ **Практический вывод для нас.** Наша экструзия — это одна геометрия на этаж, а не
десятки тысяч разных. Значит **`BatchedMesh` нам, скорее всего, не нужен вообще**:
все призмы этажа сливаются в **один `BufferGeometry`** (`mergeGeometries`), и это честный
1 draw call на любом браузере, включая Firefox. `BatchedMesh` понадобится только там,
где нужен пер-объектный culling или клик по отдельному зданию — и вот там на Firefox
он деградирует. Разграничение:

| Слой | Механизм | Draw calls |
|---|---|---|
| Экструзия этажа (застройка) | **merged `BufferGeometry`** | 1 на этаж на класс |
| Рельеф | 1 меш | 1 |
| Дороги, маршрут | `LineSegments2` | 1–2 |
| Растительность, камни | `InstancedMesh` на прототип | 1 на прототип |
| Знаковые меши (10 шт.) | обычные `Mesh` + `THREE.LOD` | 10 |
| Метки | `InstancedMesh` билбордов | 1 на иконку |

Итого при 6 классах clay и 5 этажах: **≈ 25–35 draw calls**. Укладываемся.

### 4.5 WebGPURenderer / TSL — статус на 2026‑09

🔴 **Официально всё ещё «experimental».** Манул `WebGPURenderer` (файл правлен 2026‑07‑12):

> «**The renderer itself is still in an experimental state** although its maturity level has been
> greatly improved in the last years. Still, depending on your application and scene setup,
> **you will encounter missing features or a better performance with `WebGLRenderer`**.»

И про WebGL, там же:

> «`WebGLRenderer` is still maintained and **the recommended choice for pure WebGL 2 applications**.
> However, keep in mind that **there are no plans to add larger new features** to the renderer
> since the project's focus is now on `WebGPURenderer`.»

При этом в API-доках слова «experimental» нет: «This renderer is the new alternative of
`WebGLRenderer`… By default, the renderer tries to use a WebGPU backend if the browser supports
WebGPU. **If not, `WebGPURenderer` falls backs to a WebGL 2 backend.**» Опция `forceWebGL`
(дефолт `false`) — «uses a WebGL 2 backend no matter if WebGPU is supported or not».

**Барьеры миграции (дословно из манула):** `ShaderMaterial`, `RawShaderMaterial` и
`onBeforeCompile()` **не поддерживаются** — только node materials / TSL.
`EffectComposer` и его пассы **не поддерживаются** — свой стек постпроцессинга на нодах.

**Поддержка браузерами** (MDN BCD `Navigator.gpu`, `status.experimental: false`):

| Браузер | Версия | Оговорка |
|---|---|---|
| Chrome | 113 (ChromeOS/macOS/Windows), 144 (+Linux, Intel Gen12+) | Chrome 147–148: +NVIDIA на Wayland (2026‑04‑22) |
| Chrome Android | **121** | только Android 12+, GPU Qualcomm и ARM |
| **Firefox** | **141** | ⚠️ **только Windows**; Firefox 147 (2026‑01‑13) добавил macOS на Apple Silicon; Linux и Intel-macOS — Nightly |
| **Firefox Android** | ❌ нет | |
| **Safari** | **26** | iOS 26, iPadOS 26, macOS Tahoe/Sequoia/Sonoma, visionOS 26 |

WebKit, Safari 26.0 release notes: «**WebGPU supersedes WebGL on macOS, iOS, iPadOS,
and visionOS and is preferred for new sites and web apps.**»

⚠️ **`info` в WebGPU другой формы.** `src/renderers/common/Info.js`: `render.calls` там —
**кумулятивно за всё время**, аналог WebGL-метрики — **`render.drawCalls`** (плюс `frameCalls`,
`timestamp`). Зато `memory` намного богаче: `attributesSize`, `texturesSize`, `uniformBuffersSize`,
`total` — всё в байтах. Кросс-рендерный дашборд на `info.render.calls` даст неправду.

Механизмы «много объектов», доступные только на WebGPU-бэкенде:
- `Object3D.static` (дефолт `false`) — «A static 3D object can be processed by the renderer
  slightly faster since certain state checks can be bypassed.»
- `BundleGroup` (Render Bundle API) — «This module is only fully supported by `WebGPURenderer`
  with a WebGPU backend. **With a WebGL backend, the group can technically be rendered
  but without any performance improvements.**»
- `BufferGeometry.setIndirect()` — indirect draw из compute-шейдера, «Can only be used with
  `WebGPURenderer` and a WebGPU backend». Пример: `webgpu_struct_drawindirect`.
- **Occlusion culling** — `Renderer.isOccluded( object )` + флаг `object.occlusionTest = true`,
  реализован в обоих бэкендах (`WebGPUBackend` через occlusion query set,
  `WebGLBackend` через WebGL2 query objects). **В `WebGLRenderer` этого нет и не будет**
  (issue #3355 закрыт, PR #15450 не влит).

**Официальных бенчмарков «WebGPU против WebGL на N объектах» от команды three.js нет.**
Есть воспроизводимый стенд `webgpu_performance_renderbundle.html` (4000 мешей,
переключатели backend/renderBundle/count через URL) — числа надо снимать самим.

➡️ **Рекомендация по рендереру.** Идти на **`WebGPURenderer` с автоматическим WebGL2-фолбэком**,
потому что три ключевые для нас вещи — MRT-selective-bloom одним проходом (§2.3),
screen-space контур без второго рендера (§1.2) и occlusion culling — существуют только там.
Но помнить про честное «experimental» в мануле: **прототип должен пройти обе ветки**
(`forceWebGL: true` и без), иначе мы узнаем о деградации на релизе.

### 4.6 Сжатие: Meshopt против Draco

Наши измерения — в §0.4, и они закрывают вопрос. Здесь — что говорят авторы.

**Draco** своего коэффициента не публикует; в README только changelog-числа
(v1.3.0 «up to 10% (on average ~2%)», v1.4.1 «WASM… increased performance by ~200%»).
Заявленные 95 % — из JSDoc Дона МакКурди (`KHRDracoMeshCompression`):

> «For models where geometry is a significant factor (**>1 MB**), Draco can reduce filesize
> by **~95%** in many cases… **For geometry <1MB, the size of the WASM decoder library may
> outweigh size savings.**»
> «**decompression happens before uploading to the GPU**… compressing geometry with Draco
> does _not_ affect runtime performance.»

**Meshopt**, README zeux — прямо про мотив:

> «several mesh compression libraries, like Google Draco, are available, they typically are
> designed to **maximize the compression ratio at the cost of disturbing the vertex/index order**
> (which makes the meshes inefficient to render on GPU) or **decompression performance**.»
> Vertex codec: «**3–6 GB/s on modern desktop CPUs**… compression ratio… typically around **2–4×**
> (compared to already quantized and optimally packed data).»
> Index codec: «targets **1 byte per triangle** as a best case (**6× smaller than raw 16-bit
> index data**); on real-world meshes, it's typical to achieve **1–1.2 bytes per triangle**.»
> «the result of the encoding… **remains compressible with general purpose compressors**.»

Спека `EXT_meshopt_compression`: «**very fast decoding (using WebAssembly SIMD, the decoders
run at ~1 GB/sec on modern desktop hardware)**» — ⚠️ 3–6 ГБ/с это нативный C++, в браузере ~1 ГБ/с.

МакКурди по `EXTMeshoptCompression`:
> «**For the full benefits of meshopt compression, apply gzip, brotli, or another lossless
> compression method** to the resulting file… **without this secondary compression,
> the size reduction is considerably less.**»
> «While **Meshopt decoding is considerably faster than Draco decoding, neither compression
> method will improve runtime performance directly.**»

Единственная числовая таблица прямого сравнения — гист zeux
(`gist.github.com/zeux/b48678a44944187c16f55ad6cca45e78`, обновлён 2019‑05‑23, нативный код,
Core i7‑8650U). Из шести сцен `codec+zstd` выигрывает у Draco на четырёх (sponza −8 %,
village −18 %, bistro −26 %, mustang паритет), проигрывает на плотных «чистых» мешах
(buddha +61 %, nyra +52 %). Разрыв по времени декодирования — **1.5–2 порядка**:
12.79 мс против 782 мс на bistro.

🔴 **Статус-новость:** PR KhronosGroup/glTF **#2517 «KHR_meshopt_compression proposal»**
создан 2025‑08‑06, **смёржен 2026‑01‑23**. `gltfpack` умеет писать оба варианта:
`-c`/`-cc` → `EXT_meshopt_compression`, `-ce khr` / `-cz` → `KHR_meshopt_compression`.
⚠️ **Не проверено, понимает ли `GLTFLoader` в three.js r185 новый `KHR_`-вариант.**
Пока безопасно писать `EXT_` (поддержан с r122 через `GLTFLoader.setMeshoptDecoder()`).

**`gltfpack -si` — что заявляет автор.** Точный help:

```
-si R: simplify meshes targeting triangle/point count ratio R (default: 1; R should be between 0 and 1)
-se E: limit simplification error to E (default: 0.01 = 1% deviation; E should be between 0 and 1)
-sa:   aggressively simplify to the target ratio disregarding quality
-slb:  lock border vertices during simplification to avoid gaps on connected meshes
```

**Безопасного значения R автор не называет принципиально** — качеством управляют через
`target_error` (`-se`, дефолт 1 % от габарита меша), а ratio не гарантируется:
«it is **not guaranteed to reach the target index count and can stop earlier**».

🔴 **И прямое предупреждение ровно про нашу геометрию:**

> «The algorithm **follows the topology of the original mesh**… **For meshes with inconsistent
> topology or many seams, such as faceted meshes, it can result in simplifier getting "stuck"
> and not being able to simplify the mesh fully.** Therefore it's critical that identical
> vertices are **"welded"** together.»
> «This is **especially problematic for meshes with faceted normals (flat shading),
> as the simplifier may not be able to reduce the triangle count at all**.»

Наши призмы — ровно плоскозатенённая hard-surface геометрия с дублированными вершинами.
➡️ **Полагаться на `gltfpack -si` нельзя; упрощать надо на уровне 2D-контуров (§0.1),
где мы контролируем результат.** Плюс обязательный `-slb`, если карта режется на плитки —
иначе на стыках появятся дыры.

Мой замер `-si 0.5` на нашей геометрии: 65 148 → **22 495 треугольников** (ratio 0.345),
файл 143 КБ. ⚠️ Результат **ниже запрошенного отношения**, тогда как документация обещает
«can stop earlier» (то есть выше). Расхождение не объяснено — не закладываться, померить отдельно.

Прочее по `gltfpack`, полезное нам: атрибутно-осведомлённое упрощение **теперь дефолт**
(`-sv` оставлен для совместимости, `-svd` помечен «avoid production usage»);
без `-c` пишется обычный glb с `KHR_mesh_quantization` (three.js понимает с r111+);
gltfpack **сам сливает меши** ради draw calls; `-kn`/`-km` сохраняют именованные ноды
и материалы — **для кликабельной карты `-kn` обязателен**, иначе всё сольётся в один объект;
кастомные атрибуты `_ID`, `_BATCHID`, `_FEATURE_ID_n`, `_COLOR_0` **сохраняются как есть** —
готовый канал для пер-объектной идентификации внутри слитого меша.

### 4.7 `EXT_mesh_gpu_instancing` — и почему он нам может не подойти

Расширение **ратифицировано Khronos**. Определяет атрибуты `TRANSLATION` (VEC3 float),
`ROTATION` (VEC4 float/byte-norm/short-norm, кватернион), `SCALE` (VEC3 float);
трансформ — «InstanceXform = **Translation * Rotation * Scale**».

🔴 **Гоча под наши данные:** у нас экземпляры лежат **матрицами 4×4** из клиента.
Расширение произвольных матриц не принимает — только TRS-разложение. Матрица с shear
(а он появляется при неоднородном масштабе в цепочке родителей Unity) **не разложится**,
и объект встанет криво. Перед экспортом обязательна проверка на разложимость каждой матрицы
и явный отчёт по неразложимым — это ровно тот класс тихой лжи в собственном выходе,
который мы уже ловили в слоях карт.

Также расширение «should specify it in `extensionsRequired`» — фолбэка нет.
Три.js его читает: пример `webgl_loader_gltf_instancing`.

---

## 5. Стриминг и LOD

### 5.1 Главный вывод: стриминг нам, скорее всего, не нужен

Измерение §0.2–0.4 переворачивает исходную оценку риска. Вся застройка худшей карты —
456 тыс. треугольников, ≈ 1 МБ по проводу. Это **меньше, чем один экран растровых тайлов
на текущей карте**. Опасение «63 706 мешей Улиц в один glTF не влезут» относилось
к исходной геометрии клиента; экструзия силуэтов даёт на два порядка меньше.

➡️ **Стриминг переносится из «главного риска» в «оптимизацию по факту».**
Порядок действий: сначала грузить карту одним файлом на этаж, мерить, и только если
не влезаем — резать.

### 5.2 Если всё-таки резать — что использовать

**`THREE.LOD`** («A component for providing a basic Level of Detail (LOD) mechanism.
Every LOD level is associated with an object, and rendering can be switched between them
at the distances specified»). `addLevel(object, distance = 0, hysteresis = 0)`.
Гистерезис есть и работает:

```js
const distance = _v1.distanceTo( _v2 ) / camera.zoom;
let levelDistance = levels[i].distance;
if ( levels[i].object.visible ) levelDistance -= levelDistance * levels[i].hysteresis;
```

⚠️ **Деление на `camera.zoom`** — значит LOD корректно работает и с ортокамерой.
Пер-инстансного LOD в `THREE.LOD` нет (уровень — целый `Object3D`), но `InstancedMesh`
можно положить целым уровнем. В drei это `<Detailed distances={[…]} hysteresis={0}>`.

**3D Tiles (OGC).** Спека: 1.0 = OGC 18‑053r2, 1.1 = OGC 22‑025r4 (первая нормативная
редакция 1.1.0 — 2022‑07‑26). Ключевые понятия:
- `geometricError` — «specifies the error, **in meters**, of the tile's simplified representation
  of its source geometry»; используется с экранными метриками для расчёта SSE, и если SSE
  превышает допуск — тайл уточняется;
- `refine`: `"REPLACE"` (дети вместо родителя) или `"ADD"` (дети в дополнение);
- **glTF 2.0 — «the primary tile format»**; `b3dm`/`i3dm`/`pnts`/`cmpt` «were **deprecated
  in 3D Tiles 1.1**»;
- ⚠️ гоча координат: «for consistency with the *z*-up coordinate system of 3D Tiles,
  glTFs shall be transformed from *y*-up to *z*-up at runtime… by rotating the model
  about the *x*-axis by π/2 radians»;
- implicit tiling даёт «**random access of tiles based on their tile coordinates**» —
  то есть URL тайла вычисляется, а не читается из дерева.

**`NASA-AMMOS/3DTilesRendererJS` — живой и без Cesium.** Релизы: 0.5.2 (2026‑08‑24),
0.5.1 (2026‑08‑07), 0.5.0 (2026‑07‑15); коммиты в master — 2026‑09‑03/04.
Runtime-зависимости всего три (`pbf`, `pmtiles`, `@mapbox/vector-tile`), движки — опциональные
peer'ы (`three >= 0.167.0`, `@react-three/fiber ^8.17.9 || ^9.0.0`). Cesium Ion — опциональный
источник данных, не зависимость. **Есть официальная r3f-обёртка** (`3d-tiles-renderer/r3f`).
Draco / KTX2 / Meshopt поддержаны через `GLTFExtensionsPlugin`.
Лицензия Apache 2.0.

⚠️ Гоча прямо из README: «**Cache limits are hard caps.** No new tiles load once the `LRUCache`
reaches `maxSize` or `maxBytesSize`. If the tiles needed for the current view do not fit
then **coarser tiles are displayed and refinement stops**.»

Генерация своих тайлов: `3d-tiles-tools` (CesiumGS, npm 0.5.4, 2026‑07‑15), `py3dtiles`
(GitLab, PyPI 12.1.1 — ⚠️ GitHub-зеркало `Oslandia/py3dtiles` помечено как мигрировавшее,
не брать за канон), `py3dtilers`.

➡️ **Вердикт по 3D Tiles: для нас избыточно.** Это стриминг гигабайтных геоданных с диска;
наша карта помещается в память целиком. Формат добавит конвейер генерации тайлов и LRU-кэш
с жёсткими лимитами, не решая ни одной существующей проблемы.

### 5.3 🔑 Culling: `visible = false` работает лучше, чем frustum culling

`Object3D.frustumCulled` (дефолт `true`) проверяется **пообъектно, на CPU, каждый кадр**
в `projectObject()`, по bounding sphere. Но в начале того же метода стоит:

```js
if ( object.visible === false ) return;
```

➡️ **Обход всего поддерева обрывается.** Значит группировка сцены по плиткам мира
(`Group` на плитку, `group.visible = false` для дальних) снимает CPU-стоимость обхода графа,
чего пообъектный frustum culling не делает — он всё равно платит O(N) за обход и по сфере
на каждый объект. Для нашей сцены с ~30 верхнеуровневыми объектами это неактуально,
но станет актуальным, если пойдём в пообъектную кликабельность.

**Occlusion culling в вебе:** в `WebGLRenderer` нет и не будет; в `WebGPURenderer`
есть (`Renderer.isOccluded()`, `object.occlusionTest = true`) и работает в том числе
на WebGL2-бэкенде через query objects. ⚠️ Величина задержки (сколько кадров латентности
у запроса) в JSDoc не описана — мерить самим.

### 5.4 Как разносить гибрид A+C по LOD

Первички «как правильно» на смешанную сцену нет — ниже наш синтез, не цитата.

Спека 3D Tiles допускает смешение явно: «**Any combination of tile formats and refinement
approaches can be used, enabling flexibility in supporting heterogeneous datasets.**»
Но `geometricError` измеряется **в метрах**, а «ошибка на метр» у дешёвой призмы и у детального
меша принципиально разная — один общий `errorTarget` будет либо недогружать одно,
либо перегружать другое.

**Наша схема:**

| Слой | Механизм | LOD |
|---|---|---|
| Экструзия застройки | merged geometry на этаж | не нужен — 456 тыс. tri влезают целиком |
| Рельеф | один меш | 2 уровня по шагу сетки (4 м / 8 м), `THREE.LOD` |
| Знаковые меши (10 шт.) | отдельные glTF | **`THREE.LOD`, 3 уровня, подгрузка по требованию** |
| Растительность, камни | `InstancedMesh` | скрывать целыми пачками по дистанции |
| Метки | билборды | без LOD |

Десять объектов не требуют системы стриминга. Требуется ленивая загрузка десяти файлов —
это `THREE.LOD` + `GLTFLoader` и двадцать строк кода.

Референс прогрессивной подгрузки, если понадобится: официальный пример
`webgl_loader_gltf_progressive_lod` на `@needle-tools/gltf-progressive` — «Mesh and texture
LODs are loaded on demand depending on the mesh size on screen», заявленный эффект
«initial download reduced by **98.8 %**» (2.9 МБ вместо 237.9 МБ).

### 5.5 Планка сверху: официальный пример на 500 000 инстансов

`examples/webgl_batch_lod_bvh.html` (добавлен в r178, автор @agargaro) рендерит
**500 000 инстансов** десяти геометрий, у каждой **5 LOD-уровней**, сгенерированных
meshoptimizer'ом, с порогами по высоте на экране 8 % / 4 % / 3.3 % / 2 %:

```js
batchedMesh.addGeometry( geometryLOD[0], -1, LODIndexCount[i] );
batchedMesh.addGeometryLOD( geometryId, geometryLOD[1], 0.08 );
```

Плюс `three-mesh-bvh` для culling и рейкастинга (`computeBoundsTree()` — BLAS, `computeBVH()` — TLAS).
⚠️ `addGeometryLOD` — **не API three.js**, а пакет `@three.ez/batched-mesh-extensions`.

➡️ Наши 65 367 объектов — на порядок ниже потолка, показанного примером из ядра.

---

## 6. Камера

### 6.1 `MapControls` vs `OrbitControls`

JSDoc `examples/jsm/controls/MapControls.js`, дословно:

> «This class is intended for transforming a camera **over a map from bird's eye perspective**.
> The class shares its implementation with `OrbitControls` but uses a specific preset for
> mouse/touch interaction and **disables screen space panning by default**.
> - Orbit: Right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate.
> - Zoom: Middle mouse, or mousewheel / touch: two-finger spread or squish.
> - Pan: Left mouse, or arrow keys / touch: one-finger move.»

```js
this.screenSpacePanning = false;
this.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
this.touches = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE };
```

⚠️ **Правка расхожего мифа:** в сети часто пишут «у MapControls `screenSpacePanning = true`».
В исходнике **`false`** — панорама идёт по плоскости мира (карте), а не по плоскости экрана.

➡️ **Берём `MapControls`.** Наш пользователь пришёл с Leaflet, где ЛКМ тащит карту.
Ломать этот жест — потерять узнавание. Вращение уезжает на ПКМ, что для «второго» действия нормально.

### 6.2 Ортографическая vs перспективная

`OrthographicCamera.updateProjectionMatrix()`:

```js
const dx = ( this.right - this.left )  / ( 2 * this.zoom );
const dy = ( this.top   - this.bottom ) / ( 2 * this.zoom );
```

➡️ **Зум у орто сжимает frustum, а не двигает камеру.** `updateProjectionMatrix()` обязателен
после смены `zoom` — но `OrbitControls` делает это сам, у него отдельная ветка
`if ( this.object.isOrthographicCamera )`.

🔴 **Главная гоча:** для ортокамеры **`minDistance`/`maxDistance` не ограничивают приближение** —
ограничивают **`minZoom`/`maxZoom`**. Перепутать их = «пользователь улетел в текстуру».

Дефолты ограничителей `OrbitControls`:

| Свойство | Дефолт |
|---|---|
| `minDistance` / `maxDistance` | `0` / `Infinity` |
| `minZoom` / `maxZoom` | `0` / `Infinity` |
| `minPolarAngle` / `maxPolarAngle` | `0` / `Math.PI` |
| `minAzimuthAngle` / `maxAzimuthAngle` | `-Infinity` / `Infinity` |
| `enableDamping` / `dampingFactor` | `false` / `0.05` |
| `screenSpacePanning` | `true` |
| `zoomToCursor` | `false` |

Клампинг: `this._spherical.phi = Math.max( minPolarAngle, Math.min( maxPolarAngle, phi ) )`.
➡️ **«Камера не уходит под карту» = `maxPolarAngle < Math.PI / 2`.**

**Что даёт «макетный» вид референсов — именно ортокамера:** параллельные линии остаются
параллельными, здания не «падают» к краям кадра, картинка читается как макет, а не как фото.
Расплата — исчезает естественная глубина; её добирают туманом и tilt-shift'ом (§7).

➡️ **Рекомендация:** ортокамера + `MapControls` + `minPolarAngle ≈ 0.35 рад` (≈20° от горизонта
сверху) / `maxPolarAngle ≈ 1.3 рад` + `zoomToCursor: true` (зум к курсору — привычка из Leaflet)
+ `enableDamping: true`.

---

## 7. Depth of field

### 7.1 `BokehPass` — отпадает

`examples/jsm/postprocessing/BokehPass.js`: `focus = 1.0`, `aperture = 0.025`, `maxblur = 1.0`.
В конструкторе создаётся `_renderTargetDepth` и `_materialDepth = new MeshDepthMaterial()`
с `RGBADepthPacking`. ➡️ **Сцена рендерится дважды за кадр.** Для нас это удвоение
всей стоимости кадра ради размытия. Отпадает.

### 7.2 `DepthOfFieldEffect` (pmndrs, 6.39.4) — дорого

Дефолты: `focusDistance = 3.0`, `focusRange = 2.0`, `bokehScale = 1.0`,
`resolutionScale = 0.5`, `target = null` («Set to `null` to disable auto focus»).
⚠️ `worldFocusDistance`, `worldFocusRange`, `focalLength` — **DEPRECATED**
(многие туториалы всё ещё их показывают).

**Семь проходов на кадр:** `cocPass` → `blurPass` (Kawase, `KernelSize.MEDIUM`) → `maskPass`
→ `bokehFarBasePass` → `bokehFarFillPass` → `bokehNearBasePass` → `bokehNearFillPass`,
плюс 6 отдельных render target'ов. Depth берётся у композера, второго рендера сцены нет —
здесь он дешевле `BokehPass`.

Артефакты — из комментариев самих авторов: `maskPass` нужен, чтобы «**Prevent sharp colors
from bleeding onto the background**»; в `setSize()`: «**These buffers require full resolution
to prevent color bleeding**» — то есть `renderTargetFar`, `renderTargetCoC` и `renderTargetMasked`
держатся в полном разрешении, и `resolutionScale` экономит не всё.

### 7.3 🔑 `TiltShiftEffect` — и это, скорее всего, ответ

В README pmndrs он спрятан в категории «Blur», но файл существует:
`src/effects/TiltShiftEffect.js`. Параметры:

| Параметр | Дефолт |
|---|---|
| `offset` | 0.0 — смещение зоны фокуса |
| `rotation` | 0.0 — поворот зоны, радианы |
| `focusArea` | 0.4 — относительный размер зоны |
| `feather` | 0.3 — мягкость краёв |
| `kernelSize` | `KernelSize.MEDIUM` |
| `resolutionScale` | 0.5 |

**Ключевое: tilt-shift в pmndrs — экранная полоса фокуса, а не depth-based эффект.**
Он не читает глубину, не требует depth-текстуры, использует один `TiltShiftBlurPass`
вместо семи проходов. И это ровно то, как выглядят наши референсы: резкая горизонтальная
полоса по центру, размытые верх и низ.

При наклонном виде сверху экранная полоса почти совпадает с полосой постоянной глубины —
визуально разницу с честным DOF поймать нельзя. Заодно снимается вопрос «артефакты
при движении камеры»: их нет, потому что нет ни CoC-буфера, ни depth-aware блюра.

⚠️ Официального tilt-shift в самом three.js (`examples/jsm`) нет — только в pmndrs.
В `@react-three/postprocessing` 3.1.1 есть обёртки `TiltShift.tsx` и `TiltShift2.tsx`.

### 7.4 Ещё дешевле: туман

`Fog( color, near = 1, far = 1000 )` — «linear fog that grows linearly denser with the distance»;
`FogExp2( color, density = 0.00025 )` — «exponential squared fog, which gives a clear view
near the camera and a faster than exponentially densening fog farther».
Ставится `scene.fog = …`, отключается на материале `material.fog = false`.

**Стоимость — ноль дополнительных проходов**, туман применяется прямо в шейдере материала.
На тёмной сцене цвет тумана = цвет фона даёт ровно то, что нужно постеру: дальний край карты
растворяется в фоне.

➡️ **Рекомендация:** `FogExp2` цветом фона (глубина, бесплатно) + `TiltShiftEffect`
(полоса фокуса, один блюр-пасс) + `Bloom` только на слое свечения.
Ни одного depth-based эффекта, ни одного второго рендера сцены. Честный DOF не делать.

---

## 8. React / Next.js

### 8.1 r3f и React 19

Актуальные версии на 2026‑09‑05 (npm registry): `@react-three/fiber` **9.7.0** (2026‑07‑31),
`@react-three/drei` **10.7.8** (2026‑08‑05), `@react-three/postprocessing` **3.1.1** (2026‑08‑27),
`postprocessing` **6.39.4** (2026‑07‑27), `3d-tiles-renderer` **0.5.2** (2026‑08‑24).

Доки r3f, дословно:

> «Fiber is compatible with **React v18 and v19**… **`@react-three/fiber@8` pairs with `react@18`,
> `@react-three/fiber@9` pairs with `react@19`.**»

peerDependencies 9.7.0: `react >= 18`, `three >= 0.128`.

**Next.js:** доки требуют ровно одного —

```js
transpilePackages: ['three'],
```

⚠️ **Про `'use client'`, `next/dynamic({ ssr: false })` и SSR-ошибки `<Canvas>` в официальных
доках r3f прямых указаний НЕТ** — только отсылка к стартеру `pmndrs/react-three-next`.
Всё, что гуляет в интернете по этому поводу, — community-практика.
Для нас это совпадает с §4.6 CLAUDE.md, поэтому делаем так и так, но **не выдаём за требование доков**.

### 8.2 Производительность — что говорят доки r3f

`https://r3f.docs.pmnd.rs/advanced/scaling-performance`:
- `frameloop="demand"` — рендер только по требованию, «This saves battery and keeps noisy fans in check»;
- **держать меши в пределах ~1000, «a few hundred or less»**;
- `InstancedMesh` — «hundreds of thousands of objects in a single draw call»;
- `regress()` во время интеракции + дебаунс ~200 мс, `AdaptiveDpr` (множитель pixel ratio 0.5–1.0);
- пример в доках демонстрирует «skipping heavy post-processing effects like ambient occlusion»
  во время движения камеры.

➡️ Последний пункт — прямое разрешение нашей дилеммы по tilt-shift: **гасить пост-эффект
на время вращения, включать при остановке**. Референсы всё равно статичны.

### 8.3 drei — что закрывает наши задачи

| Хелпер | Зачем нам |
|---|---|
| `Instances` / `Instance` / `Merged` | декларативный `InstancedMesh` — растительность, камни, метки |
| `Detailed` | обёртка `THREE.LOD` (`distances`, `hysteresis`) — знаковые меши |
| `Line` (+ `CatmullRomLine`, `CubicBezierLine`) | fat lines — маршрут, дороги, контуры |
| `Outlines` / `Edges` | контур: inverted hull (работает с `InstancedMesh`) / `EdgesGeometry` |
| `Bvh` | BVH-акселератор рейкастинга — клик по объекту |
| `Bounds` | автоподгон камеры под габарит карты (`fit`, `clip`, `observe`) |
| `useMatcapTexture` | matcap, если пойдём этим путём |
| `AdaptiveDpr` / `AdaptiveEvents` / `PerformanceMonitor` / `DetectGPU` | авто-качество, решение «включать ли пост» |
| `Preload` | компиляция шейдеров до первого кадра — убирает фриз при въезде |
| `MapControls` / `OrthographicCamera` | камера |
| `Stats` / `StatsGl` | замер |

⚠️ `Html` живёт **не** в `src/core/`, а в `src/web/Html.tsx` — при deep-import путь другой.
`EffectComposer` — **не в drei**, он в `@react-three/postprocessing`.

### 8.4 Вес бандла

**[вторичное — bundlephobia, снято 2026‑09‑05]:**

| Пакет | Версия | minified | **gzip** |
|---|---|---|---|
| `three` | 0.185.1 | 708.9 КБ | **178.1 КБ** |
| `@react-three/fiber` | 9.7.0 | 159.5 КБ | **50.6 КБ** |
| `@react-three/drei` | 10.7.8 | 1575.6 КБ | 488.2 КБ (весь пакет; реально — только импортированное) |
| `postprocessing` | 6.39.4 | 318.3 КБ | **109.5 КБ** |
| `3d-tiles-renderer` | 0.5.2 | 104.0 КБ | 29.2 КБ |

**Тришейкинг three.js — частичный.** Issue `mrdoob/three.js#24199` «Making 'three' tree-shakeable» —
**closed**; из тела: «In my test bundle importing only `Vector2` is producing a **295 KB
(uncompressed)** file still with lots of remaining side-effects even after **r141**…
(down from a **1 MB** bundle in r140)». Смежное `#25855` «Tree-shaking not working with ESBuild» —
**всё ещё открыто**.

➡️ **Планировать бюджет от ~180 КБ gzip за three, а не от «отрежем ненужное».**
Итого рантайм 3D-карты ≈ **229 КБ gzip** (three + r3f) + постпроцессинг, если берём pmndrs.
Всё это уходит в отдельный чанк через `next/dynamic({ ssr: false })` и не трогает остальной портал.

---

## 9. Мобильные

### 9.1 Гарантированные минимумы WebGL

MDN WebGL best practices, «effectively universal across all systems»:

```
MAX_TEXTURE_SIZE               4096
MAX_CUBE_MAP_TEXTURE_SIZE      4096
MAX_RENDERBUFFER_SIZE          4096
MAX_VIEWPORT_DIMS              [4096, 4096]
MAX_VERTEX_TEXTURE_IMAGE_UNITS    4
MAX_TEXTURE_IMAGE_UNITS           8
MAX_COMBINED_TEXTURE_IMAGE_UNITS  8
MAX_VERTEX_ATTRIBS               16
MAX_VARYING_VECTORS               8
MAX_VERTEX_UNIFORM_VECTORS      128
MAX_FRAGMENT_UNIFORM_VECTORS     64
```

Дословно оттуда же: «**Don't assume you can use thirty texture samplers per shader just
because it works on your machine!**»

Прочее, релевантное нам:
- Бюджет VRAM считать **на пиксель**: `vramBudget = maxVRAMBytes / (innerWidth*dpr * innerHeight*dpr)`.
- Draw calls: «If you have **1000 sprites** to paint, try to do it as a **single `drawArrays()`
  or `drawElements()`** call.»
- ⚠️ **Не рассчитывать на рендер во float-текстуры на мобилках** — «many mobile systems reject
  `FRAMEBUFFER_INCOMPLETE_ATTACHMENT`», проверять `EXT_color_buffer_float`.
  **Это прямо касается HDR-буфера под bloom.**
- Избегать RGB-форматов (эмулируются как RGBA); избегать `alpha: false` при создании контекста.
- Блокирующие вызовы (до 1 мс+): `getError()`, `checkFramebufferStatus()`, `readPixels()` без PBO.
- «**The only acceptable WebGL errors are `OUT_OF_MEMORY` and `CONTEXT_LOST`.**»

**Распределение `MAX_TEXTURE_SIZE`** [вторичное — Web3D Survey, дата выборки не указана]:
общее 4096 — 100 %, 8192 — 97 %, 16384 — 83 %; **Android: 8192 — 76 %, 16384 — всего 6 %**.

**ARM Mali Best Practices** [первичный по авторству, вторичный по способу получения —
страница `developer.arm.com/documentation/102643` редиректит, тело не отдалось]:
«no more than **a few hundred draw calls per frame**»; «Aim to keep **triangle screen area
above 10 pixels**»; доля очень мелких треугольников выше **5–10 %** — тревожный признак;
непрозрачную геометрию рисовать front-to-back ради Early ZS.
⚠️ **Числа перепроверить по живой странице перед тем, как класть в канон.**

Потеря контекста: `webglcontextlost` — «fired when the user agent detects that the drawing
buffer associated with a `WebGLRenderingContext` object **has been lost**»; не всплывает.
Смежное: `webglcontextrestored`, `isContextLost()`, `WEBGL_lose_context.restoreContext()`.

### 9.2 Стоит ли фолбэчить на растровые тайлы

**Да — и это дешевле, чем кажется, потому что тайлы уже есть.**

Аргументы за фолбэк:
- WebGPU на Android — только Chromium 121+ на Android 12+ с GPU Qualcomm/ARM;
  **Firefox Android WebGPU не поддерживает вообще**. То есть на телефоне мы почти наверняка
  на WebGL2-бэкенде и без MRT-фокусов из §2.3 и §1.2;
- HDR-буфер под bloom на мобилке под вопросом (`EXT_color_buffer_float`);
- «triangle screen area above 10 pixels» — при взгляде на карту целиком с телефона
  наши призмы дают именно мелкие треугольники, то есть худший режим для tile-based GPU;
- вся текущая инфраструктура (Leaflet, R2, маркеры, поиск, боссы, heatmap, визард) уже работает.

➡️ **Рекомендация:** мобилка остаётся на растровых тайлах, 3D — режим для десктопа
с автоопределением (`DetectGPU` из drei + проверка `navigator.gpu`) и явным переключателем.
Это же снимает открытую развилку №2 из решения в мягкой форме: **3D не заменяет тайлы,
а становится вторым режимом просмотра**, и весь инструментарий тянуть в 3D сразу не нужно.

---

## Что осталось неизвестным

Честный список. Не заполнять догадками — это позиции для собственного замера.

1. **Численных бюджетов «draw calls / треугольники для среднего ноутбука и телефона»
   в первичке НЕ СУЩЕСТВУЕТ.** Есть один измеренный кейс в мануле (19 000 мешей → <20 fps),
   реплики мейнтейнеров на форуме и рекомендация r3f «до 1000 мешей». Разбивки по классам
   устройств нет нигде. Всё, что выдаёт поиск с круглыми числами, — SEO-агрегаторы
   с фактическими ошибками в соседних абзацах. **Мерить самим.**
2. **Официальных бенчмарков WebGPU vs WebGL от команды three.js нет.** Есть воспроизводимый
   стенд `webgpu_performance_renderbundle.html` (4000 мешей, переключатели через URL) —
   снимать числа на нашем железе.
3. **Понимает ли `GLTFLoader` r185 новый `KHR_meshopt_compression`** (смёржен в спеку 2026‑01‑23)
   или пока только вендорский `EXT_`. Проверить перед выбором `-cz`/`-ce khr` в конвейере.
4. **Расхождение `gltfpack -si 0.5` → ratio 0.345** на нашей геометрии. Документация обещает
   «can stop earlier» (то есть *больше* треугольников), а получилось меньше. Не закладываться.
5. **Сколько треугольников даёт наша конкретная иконка** после stroke→fill и экструзии.
   Оценка 300–3000 сделана по числу сегментов, не измерена. Померить на реальном наборе lucide.
6. **Точной строки «line width MUST be 1» в спеке Khronos не нашёл.** Первичка — JSDoc three.js
   («WebGL and WebGPU ignore this setting»). Формально это утверждение движка, а не стандарта.
7. **Работают ли `OutlinePass`, TSL `outline()` и `ToonOutlinePassNode` с `BatchedMesh`** —
   не проверено ни по докам, ни по коду.
8. **Величина задержки occlusion query** в `WebGPURenderer` (сколько кадров латентности) —
   в JSDoc не описана.
9. **Тело страницы ARM Mali Best Practices** — не отдалось; числа взяты из поисковых сниппетов
   по официальному домену. Перепроверить.
10. **Формулировок r3f-доков про `'use client'` / `ssr:false` нет.** Community-практика.
11. **Насколько разложимы наши матрицы 4×4 в TRS** для `EXT_mesh_gpu_instancing` — не проверено.
    Есть риск shear из цепочек родителей Unity.
12. **Дата сбора выборки Web3D Survey** на странице не указана — проценты нельзя привязать ко времени.
13. **Юридическая сторона раздачи голой геометрии BSG** (знаковые меши в части C гибрида) —
    вопрос не технический, в исследование не входил, в решении помечен открытым. Остаётся открытым.
14. **Как выглядит наш clay живьём.** Все выводы про «читаемость держится на контуре» —
    из референсов, а не из нашего кадра. Это может проверить только глаз V4DYA.

---

## Дешёвый эксперимент

**Полдня. Цель — получить ОДНО число и одну картинку.**

### Что собирать

Кандидат карты из постановки — **Завод**, но 🔴 `map-exports/OBJECTS-MAPS/gen/factory/`
**пуста**: конвейер слоёв по Заводу не прогонялся, и он в той самой тройке
(Завод / Лаба / Лабиринт) с нерешённым поворотом 90/270° из хендоффа.
Прогон конвейера + закрытие привязки — это отдельный день, а не полдня.

➡️ **Брать наземный этаж Таможни.** Данные проверены по 34 дверям, рамка сверена,
числа уже измерены (§0.4), и это эталонная карта по всем остальным осям.

Сцена минимальная, ровно язык референса №1:

1. меш рельефа из `customs-height-meters.npy`, шаг 4 м (≈126 тыс. tri);
2. экструзия `walls` + `obstacles` наземного этажа, фильтр ≥ 0.5 м², RDP 0.15 м,
   высота по классу (`building` 6 м, `fence` 2 м, `props` 1.5 м) — **89 тыс. tri, 1 draw call**;
3. верхние кольца тех же контуров как `LineSegments2` (32 574 сегмента → ~195 тыс. tri,
   1 draw call), светлым по тёмному — контур;
4. дороги как `LineSegments2` из осевых;
5. **один** светящийся маршрут (`Line2` + `dashOffset` в `useFrame`) и **два** пина-капли;
6. `MeshLambertMaterial` + одна `DirectionalLight` + `FogExp2` цветом фона;
7. ортокамера + `MapControls`, `maxPolarAngle < π/2`, `minZoom`/`maxZoom`;
8. `TiltShiftEffect` + `Bloom` только на слое свечения (WebGL-вариант из §2.3-бис:
   `camera.layers.set(GLOW)` → маленький таргет → аддитив).

### Какое ИМЕННО число он должен дать

**Главное: `renderer.info.render.calls` и `renderer.info.render.triangles` при вращении,
плюс fps.**

| Метрика | Ожидание | Провал, если |
|---|---|---|
| **`render.calls`** | **≤ 12** | > 30 — значит что-то не слилось |
| **`render.triangles`** | **≈ 410 тыс.** (126 рельеф + 89 застройка + 195 контуры) | > 700 тыс. |
| **fps при непрерывном вращении, 1920×1080** | **60** | < 45 |
| **Вес geometry по проводу** | **≤ 400 КБ** (139 КБ застройка + рельеф + линии, meshopt+brotli) | > 1.5 МБ |
| Время от `fetch` до первого кадра, холодный кэш | ≤ 2 с | > 5 с |
| То же с `forceWebGL: true` | не хуже −20 % fps | сильнее — WebGPU-путь обязателен |

**Одно число, ради которого всё затевается: `render.triangles` ≈ 410 тыс. при `render.calls` ≤ 12
и 60 fps.** Если оно подтвердится — гибрид A+C закрыт как технический риск, и дальше
вопрос только художественный.

**И одна картинка:** стоп-кадр под тем же углом, что референс №1, показать V4DYA.
Вопрос к нему ровно один — **«читается ли карта без AO, на одном контуре и rim?»**
Если нет, следующий шаг не оптимизация, а `COLOR_0` с градацией по классу (§0.5),
и только потом AO.

### Чего в эксперименте НЕ делать

Знаковых мешей клиента, знаний о LOD, 3D Tiles, стриминга, `BatchedMesh`,
экструзии иконок, честного DOF, мобильной версии. Всё это либо уже отвечено на бумаге,
либо не влияет на число выше.

---

## Ссылки на решение

Контекст, три варианта (A / B / C), референсы V4DYA, наши гочи по координатам
(`coordinateRotation: 180` — отражение, неквадратный пиксель, купол неба, двойные сцены)
и открытые развилки — в **`docs/decisions/3D/3d-clay-map-rendering.md`**.

Что это исследование меняет в решении:

- **«Стриминг — главный риск»** → снято. Измерено: худшая карта 456 тыс. tri, ≈1 МБ по проводу.
  Главный риск переехал в **офлайн-подготовку контуров** (88.8 % мусора, §0.1).
- **«Без AO сцена сливается в серую кашу»** → под вопросом. AO вторичен, несущее —
  контур + rim; и контур у нас **уже лежит во входных данных** (§1.3).
- **«`SVGLoader` не умеет дыры и `evenodd`»** → устарело. В r185 `ShapePath.toShapes()`
  разбирает вложенность по числу оборота с учётом fill-rule (§3.2).
- **«Иконки — вероятно, офлайн»** → подтверждено, но по другой причине: не из-за дыр,
  а из-за `stroke` в lucide и дефолтов `ExtrudeGeometry` (§3.2–3.3).
- **Открытая развилка №1 (один цвет или градация)** → градация бесплатна, классы
  `building/props/fence/plant/stone/openings` уже в SVG (§0.5).
- **Открытая развилка №3 (мобилка)** → фолбэк на тайлы рекомендован с обоснованием (§9.2).
- **Открытая развилка №4 (какие карты первыми)** → 🔴 **у Завода артефактов нет**,
  директория пуста. Прототип строить на Таможне.
- **Прикидки «150–300 тыс. tri, <15 МБ, <100 draw calls»** → по треугольникам подтвердились,
  по весу оказались пессимистичными на порядок. Исправленные числа — в шапке.
