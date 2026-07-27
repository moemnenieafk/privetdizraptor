# EFT icons — 54 promts

Собрано по Figma `2171:1833`. 21 негативный + 7 положительных + 1 рентген-фигура + 5 ресурсов + 1 прочее + 19 навыков (7 физических, 5 ментальных, 7 практических).

---

## 0. Решение по подложке: НЕ генерировать

Плашка — детерминированный вектор, её место в Figma, а не в модели. Причины:

- **Идентичность.** 25 сгенерированных плашек будут 25 разными плашками. Одна векторная — одна.
- **Варианты цвета бесплатны.** Тебе нужны красный, жёлтый и зелёный варианты. Это смена токена, а не 25 перегенераций.
- **Обратимость.** Меняешь радиус или inner shadow — правишь один компонент, а не гоняешь набор заново.

Параметры из твоего файла:

| | Градиент (radial, центр → край) | Обводка | Inner shadow |
|---|---|---|---|
| Негатив | `#8C1F1F` → `#3C0E0E` | `#000000` 1.5px | `#000000`, radius 24, offset 0 |
| Позитив | `#2C831D` → `#11350B` | `#000000` 1.5px | `#000000`, radius 24, offset 0 |
| Предупреждение* | `#8C7A1F` → `#3C330E` | `#000000` 1.5px | `#000000`, radius 24, offset 0 |

\* Жёлтый в твоём файле не задан — вывел по той же формуле, что красный и зелёный. Нужен для 13, 15 и 21. Утверди как токен перед стартом.

Все: 48×48, corner radius 4.

---

## 1. Два типа иконок

Часть твоих описаний — изолированный объект, часть — заливка всего кадра. Промты у них разные.

**Тип A — объект.** Генерится один объект на прозрачном фоне, кладётся на векторную плашку.
Все, кроме перечисленных ниже.

**Тип B — заливка.** Содержимое занимает весь кадр (поток крови, потрескавшаяся земля, вспышка). Генерится квадратом, в Figma клипается по плашке, градиент подкладывается снизу на Multiply 40–60%.
Это: **02, 11, 16, 17, 19, 20, P04**.

Отдельно стоят **светящиеся** — 05, 06, 07, P04, R01, S01 и красные зоны в 23. У них своё переопределение материала и фона, см. §3.5.

---

## 2. Инвариант — Тип A

```
3D rendered game UI symbol, physically based rendering, clean simple form, restrained and functional rather than decorative.

REFERENCE: IMAGE 1 is the style anchor for this entire set. Match its lighting direction, material finish, contrast level and colour treatment exactly. Only the depicted object differs.

SUBJECT: {переменный слот}

Material: PBR shading, semi-matte surface with medium-high roughness, soft controlled specular highlights, subtle ambient occlusion in crevices. No wet gloss, no mirror finish.

Lighting: one key light from the upper left at a 45 degree angle, soft low-intensity fill from the lower right, cool desaturated rim light along the top right edge. No other light sources, no coloured gels. Identical lighting setup in every image of this set.

Camera: orthographic front view, straight on, no perspective distortion, no tilt, object centred and filling roughly 75 percent of the canvas.

Detail level: shape the object with large primary forms only. No fine surface detail, no small parts, no wear, scratches or panel lines. Any feature too small to survive at 48 pixels must be omitted rather than rendered.

Restraint: render exactly what SUBJECT describes and nothing more. Exactly one object unless SUBJECT states a count. No gems, jewels, crystals, ornaments, engravings, inscriptions, splashes, sparks, particles, smoke or decorative additions. Nothing that is not explicitly named in SUBJECT may appear.

Background: one perfectly flat, evenly lit, solid {MATTE} field filling the entire frame, completely uniform in colour, with no gradient, no vignette, no texture, no grain, no pattern and no checkerboard. A plain matte colour field and nothing else.

Separation: the object must not reflect, refract or pick up any colour from the background, and must cast no shadow onto it. Keep the object's outline hard and clearly defined, with no glow, no bloom, no haze, no depth of field and no motion blur at its edges. Nothing in the corners of the frame.

Constraints: no frame, no border, no bezel, no rounded rectangle, no plaque, no badge, no panel, no background plate, no text, no letters, no numbers, no watermark.
```

### Чем заменять {MATTE}

Никогда не проси прозрачность — Gemini альфу не отдаёт и рисует шахматку картинкой. Матовый фон берётся контрастным к объекту по тону:

| Объект | {MATTE} |
|---|---|
| Красные и тёплые — 01–07, 12–14, 18 | `pure saturated green (#00C000)` |
| Зелёные — 19, P02 | `pure saturated magenta (#C000C0)` |
| Белые, серые, чёрные — 08, 21 | `pure saturated green (#00C000)` |
| Смешанные и человеческие фигуры — 15, P01, P03 | `pure saturated blue (#0040FF)` |
| Светящиеся — 05, 06, 07, P04, R01, S01 | матовый фон не используется, см. §3.5 |

Контактную тень из генерации убрал намеренно: на матовом фоне она превращается в серую грязь и портит кей. Тень ставится в Figma отдельным слоем — заодно будет одинаковой во всех 25.

## 3. Инвариант — Тип B

Отличается тремя блоками:

```
Camera: orthographic front view, straight on, flat and frontal, no perspective distortion.

Composition: the subject fills the entire square canvas edge to edge, with no empty margin and no isolated object. Nothing in the corners of the frame.

Background: the subject IS the background. No separate backdrop, no plate, no frame, no border, no vignette.
```

Остальные блоки — как в Типе A.

---

## 3.5 Переопределение — СВЕТЯЩИЕСЯ объекты

Применяется к **05, 06, 07, P04, R01, S01** и к красным зонам в 23. Базовый инвариант объект гасит: там `semi-matte surface` и прямой запрет `no glow, no bloom`. Для этих иконок соответствующие блоки заменяются целиком.

```
Material: the object is emissive — it is a light source in itself, not a lit surface. Its core blows out to near-white along the centre of every limb and falls off through saturated colour toward the edges. A tight warm halo of light surrounds the whole shape, and short thin arcs of energy branch off from its outer edges and fade out. Hot, radiant and charged, never matte plastic.

Lighting: the object lights itself. No external key light, no fill light, no rim light. Nothing else in the frame is lit by it.

Background: pure flat black (#000000) filling the entire frame, completely uniform, with no gradient, texture or vignette. The glow is allowed to bleed into the black.
```

**Фон здесь чёрный, не хромакейный.** Свечение по определению полупрозрачное и размытое — по краю halo альфа-кей даст грязный ореол. Светящееся composited аддитивно: чёрный фон плюс режим наложения **Screen** или **Add** в Figma убирает чёрное математически, точно и без ручной чистки. Вырезать ничего не надо.

Побочный эффект в плюс: под Screen плашка просвечивает сквозь свечение, и объект сидит на ней естественно, а не наклейкой.

---

## 4. НЕГАТИВНЫЕ ЭФФЕКТЫ

**01 — Кровотечение** · тип A
```
SUBJECT: exactly two falling droplets of dark red blood, one small and one noticeably larger, both smooth teardrops pointed at the top and rounded at the bottom, the larger one lower and slightly left, the smaller one higher and slightly right, with a clear gap between them.
```

**02 — Сильное кровотечение** · тип B
```
SUBJECT: thick blood covering most of the frame as one continuous connected mass. It fills a heavy band across the entire top edge, and from the top right corner it runs down the whole right side in a wide unbroken flow that reaches the bottom edge. Rounded drip tongues of varying length hang down from the top band into the middle of the frame, each ending in a heavy bulb. Across the remaining darker area, separate round beads of blood of varying size sit scattered on the surface. Only the lower left region stays comparatively clear.
```

**03 — Свежая рана** · тип A
```
SUBJECT: one adhesive bandage plaster applied at a slight diagonal over bare skin, with a rectangular gauze pad in the middle showing a dark red stain soaking through from underneath.
```

**04 — Перелом** · тип A
```
SUBJECT: one stylised x-ray view of a single long bone, the bone glowing pale bluish-white against dark, snapped clean through the middle with a sharp jagged break and the two halves visibly offset, in the exaggerated skeletal x-ray style of a fighting game finisher.
```

**05 — Боль** · тип A
```
SUBJECT: one jet engine exhaust flare seen from behind, a sharp concentrated burst of white-hot light at the centre widening into a short cone of hot orange and deep red, its edges torn and irregular, an abstract impression of a pain flash rather than a machine.
```

**06 — Боль в мышцах** · тип A
```
SUBJECT: one male torso with one arm, seen frontally, the whole body a smooth featureless dark grey form, with the bicep muscle of the arm lit from within in a saturated red glow. Only the bicep is red, everything else stays grey.
```

**07 — Сильная боль в мышцах** · тип A
```
SUBJECT: one male arm bent in a bicep flex pose, seen frontally, the entire arm burning with saturated red heat from shoulder to fist, glowing brightest across the bicep, the surface reading as if lit from inside.
```

**08 — Контузия** · тип A
```
SUBJECT: one funnel-shaped vertigo vortex seen straight on from the front, formed by smooth concentric ridges spiralling inward and receding into a small dark opening at the centre, rendered in white and desaturated grey. The outer end of the band terminates in a visible free tail that breaks the circular outline.
```

**09 — Тремор рук** · тип A
```
SUBJECT: a set of five concentric rings expanding outward from a single centre point and reaching the edges of the frame, evenly spaced with clear gaps, each ring a smooth rounded torus of uniform thickness, the innermost a small solid disc. All rings lie flat and parallel to the viewer at the same depth, reading as a shockwave from an epicentre.
```

**10 — Туннельный эффект** · тип A
```
SUBJECT: one tunnel seen straight down its axis, formed by a series of concentric square-cornered rings receding away from the viewer into darkness, each ring smaller than the last, creating an endless corridor with a small dark opening at the far end.
```

**11 — Обезвоживание** · тип B
```
SUBJECT: dry cracked earth filling the entire frame, a parched grey-brown surface broken into irregular polygonal plates by deep dark fissures, with one single droplet of clean blue water in the upper right, rounded and full, the only saturated element in the image.
```

**12 — Усталость (Энергия)** · тип A
```
SUBJECT: one battery shown in cutaway cross-section standing upright, its interior almost entirely empty with only a small red charge remaining at the very bottom, and one simple angular lightning bolt beside it to the right.
```

**13 — Перегруз** · тип A · плашка предупреждения
```
SUBJECT: one classic round cast-iron kettlebell weight with a thick arched handle, seen straight on from the front, dark and heavy. It sits at a comfortable distance from the frame, with a clear even margin of empty space on all four sides. The face of the weight is completely blank and unmarked.
```

**14 — Сильный перегруз** · тип A · плашка негатива
```
SUBJECT: one classic round cast-iron kettlebell weight with a thick arched handle, seen straight on from the front, dark and heavy, shot much closer so that it dominates the frame. The top of the handle almost touches the top edge and the body almost touches the left and right edges, leaving only a very narrow margin. The face of the weight is completely blank and unmarked.
```

**15 — Усталость** · тип A · плашка предупреждения
```
SUBJECT: one anonymous faceless human figure seen from the front as a smooth featureless silhouette, shoulders slumped and head tilted down, with one upright battery standing directly behind the figure and rising above its head, a simple angular lightning bolt on the face of the battery.
```

**16 — Оглушение** · тип B
```
SUBJECT: one pair of aviator sunglasses seen straight on from the front, two large teardrop-shaped opaque black lenses of equal size joined by a single thick bridge, temple arms omitted, sitting against a blown-out white flash filling the rest of the frame.
```

**17 — Вспышка** · тип B · СМ. §6, ОПИСАНИЕ ДУБЛИРУЕТ 16
```
SUBJECT: a blown-out white flash filling the entire frame, brightest at the centre and falling off toward the edges, the light hard and blinding with no visible source object.
```

**18 — Дебафф** · тип A
```
SUBJECT: one six-pointed medical cross in saturated red, extruded with visible thickness, with a single smooth snake coiled vertically around a straight staff at its centre. Large primary forms only, the snake reduced to two simple coils and a plain head with no scales.
```

**19 — Отравление** · тип B
```
SUBJECT: a toxic acid-green field filling the entire frame, and at its centre one large droplet of the same acid green, inside which a pale skull and two crossed bones are visible as if suspended in the liquid.
```

**20 — Паническая атака** · тип B
```
SUBJECT: a chaotic burst of white light against a dark field, composed entirely of scattered crescent shapes and four-pointed stars of varying size, radiating outward from an off-centre point with no regular pattern or symmetry.
```

**21 — Радиационное поражение** · тип A · плашка предупреждения
```
SUBJECT: one radiation hazard trefoil symbol in solid black, three thick wedge-shaped blades arranged evenly around a central disc, extruded with visible thickness, flat and frontal.
```

---

### Рентген-фигура: генерится ОДНА

Манекен разрезан на семь зон EFT — они лежат готовыми масками в `mannequin-masks/`:

| Файл | Зона |
|---|---|
| `00-silhouette-full.png` | полный силуэт, эталон геометрии |
| `01-golova.png` | голова |
| `02-grud.png` | грудь |
| `03-zhivot.png` | живот |
| `04-ruka-levaya.png` / `05-ruka-pravaya.png` | руки |
| `06-noga-levaya.png` / `07-noga-pravaya.png` | ноги |
| `08-vsyo-krome-golovy.png` | всё кроме головы — это и есть иконка 22 |

Порядок обратный интуитивному: **манекен задаёт геометрию, скелет подгоняется под него.** Тогда маски садятся пиксель в пиксель по определению, и любая комбинация зон собирается переключением слоёв в Figma. Генерировать надо только 23. Иконка 22 — это 23 плюс включённая маска `08`, отдельной генерации не требует.

**23 — Базовый скелет** · тип A · единственная генерация в этой группе
```
SUBJECT: one stylised x-ray view of a standing human figure seen from the front, full body, arms hanging free at the sides, no weapon and no equipment. The body reads as a translucent pale bluish-grey shell with the skeleton clearly visible inside it, evenly lit throughout. No red anywhere, no glowing areas, no highlighted zones, every part of the body rendered in the same neutral cool tone. Large primary forms only, in the exaggerated skeletal x-ray style of a fighting game finisher.
```

**Блок референсов для 23 заменяется на двойной.** В остальных 25 промтах остаётся одиночный, как в §2:

```
REFERENCE: IMAGE 1 is the style anchor for this set. Match its rendering, lighting, material finish and contrast exactly.

REFERENCE: IMAGE 2 defines the pose, proportions and outline of the figure. Reproduce that exact silhouette, stance and limb placement, matching its proportions precisely even where they differ from real anatomy. IMAGE 2 is a geometry guide only — do not copy its flat white-on-black rendering, and do not treat it as a style reference.
```

IMAGE 2 = `00-silhouette-full.png`.

{MATTE} = `pure saturated green (#00C000)`. Синий брать нельзя — тело само голубовато-серое, кей порвёт.

**Оружие из промта убрано намеренно.** У манекена руки свободно опущены. Оставишь винтовку — модель получит два противоречащих указания, силуэт разойдётся с масками, и вся схема развалится.

---

## 5. ПОЛОЖИТЕЛЬНЫЕ ЭФФЕКТЫ

**P01 — На болеутоляющих** · тип A
```
SUBJECT: one human figure seated cross-legged in a lotus pose, seen from behind as a smooth featureless dark silhouette, with a simple glowing ring hovering horizontally above the head and a soft warm glow emanating from the centre of the chest, visible through the silhouette.
```

**P02 — Бафф** · тип A
```
SUBJECT: one six-pointed medical cross in saturated green, extruded with visible thickness, with a single smooth snake coiled vertically around a straight staff at its centre. Large primary forms only, the snake reduced to two simple coils and a plain head with no scales.
```

**P03 — Восстановление HP** · тип A
```
SUBJECT: one equal-armed medical cross in clean white with a thin dark outline, extruded with visible thickness, centred on top of a solid red circle that sits directly behind it and extends slightly beyond the arms of the cross.
```

**P04 — Берсерк** · тип B
```
SUBJECT: an extreme close-up of one single human eye filling the entire frame, cropped tight so that only the eye and the skin immediately around it are visible. The iris and pupil burn with intense red-orange light from within, blowing out to near-white at the very centre and falling off through hot orange to deep red across the surrounding skin. The upper and lower eyelids sit as heavy dark horizontal masses at the top and bottom of the frame. Smooth skin with no pores, no eyelashes and no visible reflections. The image reads as abstract fury, not as a photographic or medical portrait.
```

---

## 5.5 РЕСУРСЫ

Не статус-эффекты, а показатели состояния. Плашка им нужна своя — нейтральная тёмная, а не красная и не зелёная: у них нет знака «плохо / хорошо», они просто показывают уровень. В исходниках фон `#383838`, ровная заливка без градиента.

**R01 — Энергия** · тип A · **светящийся, см. §3.5** · фон чёрный, сборка через Screen
```
SUBJECT: one lightning bolt of raw electrical energy, a single sharp angular zig-zag descending from upper right to lower left, with straight edges, hard points and no curves. The bolt burns white-hot along its centre line and saturates to intense yellow at its edges, radiating a tight warm halo into the surrounding black. Short thin electric filaments branch off from its points and fade out. It reads as live current, not as a solid yellow object.
```

**R02 — Регенерация** · тип A · {MATTE} = `pure saturated green (#00C000)`

Вариант A — как в исходнике:
```
SUBJECT: one six-pointed asterisk star in neutral pale grey, formed by three thick bars of equal length crossing at a single centre point at sixty degree intervals, each bar with squared-off ends and slightly concave sides. Solid and symmetrical, extruded with visible thickness.
```

Вариант B — рекомендуемый, см. §6:
```
SUBJECT: one heartbeat pulse line in neutral pale grey, a single horizontal bar that rises into one tall sharp peak at the centre, drops into a short trough beside it and returns to horizontal at both ends. Even thickness throughout, extruded with visible thickness.
```

**R03 — Гидрация** · тип A · {MATTE} = `pure saturated magenta (#C000C0)`
```
SUBJECT: one water droplet in clean saturated blue, a smooth teardrop with a sharp point at the top widening into a full round bottom, perfectly symmetrical about its vertical axis.
```

**R05 — Восстановление выносливости** · тип A · {MATTE} = `pure saturated green (#00C000)`
```
SUBJECT: one anonymous human figure running in profile from left to right, seen from the side, arms and legs thrown wide in a full sprinting stride, torso leaning forward into the run. The figure is a smooth featureless form with no face, no clothing detail and no equipment. Three short straight horizontal speed lines trail behind it on the left, of varying length, each separated from the body by a clear gap.
```

**R06 — Температура тела** · тип A · {MATTE} = `pure saturated green (#00C000)`
```
SUBJECT: one medical thermometer standing upright, seen straight on from the front, a narrow vertical tube with a large round bulb at its bottom. The bulb and the lower part of the tube are filled with liquid to a little under half the tube's height, the rest of the tube left empty, reading as a normal healthy temperature. Three short horizontal scale marks sit to the right of the tube at even intervals, each separated from it by a clear gap. Thick simple forms, no numbers, no lettering and no fine graduation lines anywhere.
```

**P05 — Блокировка кровотечений** · тип A · {MATTE} = `pure saturated green (#00C000)`
```
SUBJECT: one hollow blood droplet outline in deep red, a thick rounded ring forming a teardrop shape with a sharp point at the top and a full round bottom, the opening in its centre large and clearly open. Overlapping its lower left, in front of it and closer to the viewer, sits one solid X made of two thick crossed bars in clean pale white with rounded ends. A clear physical gap separates the X from the droplet ring all the way around, so the two never touch or merge. Thick heavy forms only.
```

**P06 — Остановка кровотечения** · тип A · {MATTE} = `pure saturated green (#00C000)`
```
SUBJECT: one hollow blood droplet outline in deep red, a thick rounded ring forming a teardrop shape with a sharp point at the top and a full round bottom, the opening in its centre large and clearly open. Nothing else in the frame — no cross, no badge, no additional element. Thick heavy forms only.
```

**P07 — Восстановление конечностей** · тип A · пара к 04, генерить в одном сеансе
```
SUBJECT: one stylised x-ray view of a single long bone, the bone glowing pale bluish-white against dark, whole and unbroken along its entire length. Across its middle, at the exact point where it was once snapped, a thick band of newly grown bone wraps around the shaft, denser and noticeably brighter than the rest of the bone, marking the healed break. The two halves are perfectly aligned with no gap and no offset — the silhouette is one continuous piece. In the exaggerated skeletal x-ray style of a fighting game finisher.
```

---

## 5.6 ПРОЧЕЕ

**S01 — Эффект навыка** · тип A · **светящийся, см. §3.5** · фон чёрный, сборка через Screen
```
SUBJECT: one lightbulb switched on and glowing, seen straight on from the front, a rounded glass envelope narrowing into a short cylindrical base. The glass burns white-hot at its centre and saturates to warm golden yellow toward its edges, radiating a broad soft halo into the surrounding black. Eight short straight rays of light point outward from the bulb at even angles, thick and blunt, each separated from the glass by a clear gap. No filament, no screw thread, no socket detail.
```

---

---

## 5.7 НАВЫКИ

Отдельный визуальный класс. Не символ на плашке, а полнокадровая сцена — так их подаёт и сама игра. Плашка статус-эффектов сюда не применяется: это квадратная иллюстрация во всё поле.

**Инвариант навыков** заменяет §2 целиком:

```
Atmospheric painted game artwork for a skill icon, cinematic and moody, filling the entire square frame edge to edge. Rich material texture, deep shadows, strong directional light, shallow depth of field. Photographic realism pushed toward stylised game art, not a flat symbol and not a clean studio render.

SUBJECT: {переменный слот}

Composition: tightly cropped, the subject filling the frame with no empty margin, no isolated object floating in space and nothing in the corners.

Palette: {указан в каждом SUBJECT}. Desaturated overall with one dominant colour carrying the mood.

Constraints: no frame, no border, no plaque, no badge, no text, no letters, no numbers, no watermark, no logo. No recognisable real person's face.
```

Фон здесь часть картинки — ни матовый кей, ни чёрный не нужны.

### Физические

**SK01 — Выносливость** · заменяет R04
```
SUBJECT: one anonymous private military contractor seen from behind at three-quarter angle, marching under full load — a heavy rucksack, chest rig stuffed with pouches, a rifle slung across the pack and a second weapon at his side. Head down, shoulders driven forward by the weight. Cold desaturated blue-grey palette, overcast light, dust in the air.
```

**SK02 — Здоровье**
```
SUBJECT: one star of life medical symbol, six-pointed, with a caduceus staff standing at its centre, rendered as a heavy metal emblem lit from behind so its edges glow. Saturated green palette, radiating light behind the emblem, faint smoke drifting across the frame.
```

**SK03 — Иммунитет**
```
SUBJECT: one heavy protective shield seen straight on, its face catching a cold sheen of light, surrounded on all sides by drifting virus particles and spore shapes that break apart as they approach it. Cold teal and pale cyan palette, clinical and sterile, soft glow behind the shield.
```

**SK04 — Жизнеспособность**
```
SUBJECT: one private military contractor standing, rendered almost entirely as a black silhouette against a dark ground, with a single human heart glowing hot red inside his chest, its light bleeding faintly through the silhouette. Near-black palette with red as the only living colour, heavy shadow everywhere else.
```

**SK05 — Метаболизм**
```
SUBJECT: a dense chaotic web of neural filaments branching and firing across the entire frame, threads splitting and crossing at random, brightest where they converge near the centre. Hot orange and yellow palette, glowing from within, energy dissipating into darkness at the edges.
```

**SK06 — Сила**
```
SUBJECT: a tightly cropped view of one muscular male arm in a plain t-shirt, gripping an AK-74N rifle resting on the shoulder, the frame cutting the body so only the arm, shoulder and part of the weapon are visible. Tensed forearm, veins raised, skin catching hard light. Desaturated olive and grey palette, harsh daylight.
```

**SK07 — Стрессоустойчивость**
```
SUBJECT: an extreme close-up of the left eye of a private military contractor, cropped to the eye and the skin around it. Streaks of blood and sweat run down the skin, the brow is set hard and the gaze is steady and locked forward, not flinching. Desaturated grey-brown palette, harsh raking light, wet skin. No glow, no light coming from the eye itself.
```

### Ментальные

**SK08 — Внимательность**
```
SUBJECT: the right hand and forearm of a private military contractor in a fingerless glove, reaching forward into an open metal safe. Inside the safe, three valuable objects catch a warm rim of light against the surrounding gloom: a thick gold coin with an embossed symbol on its face, a small painted collectible figurine of a helmeted armoured soldier, and a red plastic access card. Everything else in the frame falls away into shadow. Cold grey-green palette with the highlights on the valuables as the only warm colour. No logos, no branding, no readable text on any object.
```

**SK09 — Восприятие**
```
SUBJECT: a close crop across the face of a private military contractor wearing a balaclava and helmet, showing BOTH eyes and the bridge of the nose, the rest of the face covered. The eyes are narrowed to a hard squint, pupils shifted to one side, catching something off-frame that has not been seen yet. Tense brow, absolute alertness. Desaturated cold palette, low raking light picking out only the eye region.
```

**SK10 — Интеллект**
```
SUBJECT: the head and shoulders of a private military contractor in a helmet, seen in profile as a near-black silhouette against a dark ground, with a human brain visible inside the skull glowing cold electric blue and casting its light faintly through the silhouette. The figure reads as a dark outline; the brain is the only illuminated element. Near-black palette with blue as the only colour.
```

**SK11 — Память**
```
SUBJECT: one human brain in close-up filling most of the frame, suspended in a dark neural void. Inside it, at the centre, exactly five bright knotted junctions glow, each one a tight cluster where several threads tie together, connected to each other by thick strong strands. The surrounding neural threads are dim and thin by comparison, so the five knots clearly dominate. Cold blue and cyan palette, deep dark surroundings.
```

**SK12 — Харизма**
```
SUBJECT: a close crop of a man's face cutting off at the eyeline, showing the lower half only — a thick weathered beard, old scars across the cheek and jaw, and a short, almost finished cigar clenched in the corner of his mouth with smoke curling from it. The mouth is set in a confident crooked smirk. Warm amber palette, low golden light, smoke haze in the air. Not a recognisable real person.
```

### Практические

**SK13 — Скрытное передвижение**
```
SUBJECT: a low camera angle aimed at the ground, showing a private military contractor from the waist down only — legs bent in a careful half-crouch, boots rolling weight onto the toe mid-step. No faction patches or insignia anywhere. On the ground beneath the forward boot, faint concentric rings spread outward across the dirt like ripples, an abstract rendering of the sound of the footfall. Dark desaturated palette, dim low light, the rings the only bright element.
```

**SK14 — Уход за оружием**
```
SUBJECT: a field-stripped AK-74N laid out at a three-quarter angle — receiver, bolt carrier group, gas tube and pistol grip separated across a dark surface. A cold blue rim of light outlines the bolt carrier and the pistol grip, picking them out from the rest of the parts, which sit dimmer. Dark palette, blue as the only colour, deep shadow between the components.
```

**SK15 — Работа с магазинами**
```
SUBJECT: a very tight close-up of two hands loading a curved rifle magazine, one thumb pressing a single 5.45x39 cartridge down onto the stack while the other hand grips the magazine body. Frozen at the exact moment the round seats. Brass and steel catching hard light, the hands weathered and dirty. Desaturated palette with the cartridge brass as the warm accent. No text or markings on the casing.
```

**SK16 — Хирургия**
```
SUBJECT: a close view of two hands in black tactical combat gloves. One hand holds a pair of black trauma shears — angled blunt-tipped blade, large offset finger loops — and the other steadies an open fold-out fabric field surgical kit, its dark red pouch unrolled flat to show gauze, dressings and instruments held in fabric loops inside. About to begin an operation in the field. Focus on the gloved hands and the kit. Cold clinical palette against a dark battlefield background, blood smeared on the gloves. No text, no lettering and no branding anywhere on the pouch.
```

**SK17 — Ручное производство**
```
SUBJECT: a heavy improvised workbench in an underground shelter, seen at a three-quarter angle. Tools and screwdrivers lie scattered across it beside a small pile of loose gunpowder and a scattering of empty brass cartridge casings. Warm dim work light from one side, deep shadow beyond the bench. Cluttered, functional, used. Generic makeshift workshop, no recognisable branding or signage.
```

**SK18 — Управление убежищем**
```
SUBJECT: a wide interior view of an underground shelter with several built rooms visible along its length, and in the foreground, held closer to the camera and in sharp focus, a clipboard holding a printed report. The report is rendered as rows of plain horizontal lines and small tick marks only — absolutely no letters, no words and no numbers anywhere on it. Cold industrial palette, dim overhead lighting, the clipboard catching the strongest light.
```

**SK19 — Поиск**
```
SUBJECT: a first-person view looking down at a fallen enemy operator lying still on the ground, seen from the searcher's own eyeline. The searcher's own right hand and forearm enter the frame from the lower right, gloved, reaching toward one pouch on the fallen man's chest rig. Through the fabric of that pouch a spare rifle magazine shows as a pale blue x-ray silhouette, fully loaded, the individual cartridges visible inside it as a dense stacked column running the length of the magazine. and a thin bright green outline traces the pouch itself. The rest of the rig and the body stay dim and unlit, the fallen figure shown plainly with no wounds or gore. Dark palette, the green outline and the x-ray magazine the only luminous elements.
```

## 6. Что решить до старта

**Крестов в наборе стало четыре.** 18 (красный шестиконечный со змеёй), P02 (зелёный шестиконечный со змеёй), P03 (белый крест на красном круге) и R02 (серая шестиконечная звезда). На 48px все четыре — «крестик», различать их придётся только по цвету, а цвет у P03 и 18 уже почти совпадает. Поэтому для R02 дан вариант B: пульс-линия. Силуэт горизонтальный, ни на один крест не похож, читается как «жизненные показатели» и переживает 48px, потому что это один жест, а не решётка из перекладин. Брал бы его.

**R01 и S01 обе жёлтые и светящиеся.** Молния и лампочка на 48px различаются только силуэтом — угловатый зигзаг против округлой колбы с лучами. Этого достаточно, но лучи у S01 должны остаться толстыми и с явным зазором от колбы: тонкие превратятся в мыло и лампочка станет просто жёлтым пятном, неотличимым от вспышки.

**Цвет столбика в R06 — это канал состояния, не декор.** Температура в игре переменная, и заливать базовую иконку красным значит потратить единственный свободный параметр впустую. Держи норму нейтральной, а цвет отдай состоянию: холодный голубой — переохлаждение, нейтральный светлый — норма, красный — жар. Три варианта одного промта, силуэт общий, меняется одна строка. Плюс красный не сталкивается с красным зарядом батареи в 12.

**12 и R06 — оба «вертикальный сосуд с уровнем».** Батарея в разрезе и градусник на 48px рискуют слиться: одинаковая вытянутая форма с заполненной нижней частью. Различает их круглая колба внизу у градусника — она явно ломает прямоугольник, тогда как у батареи низ плоский, а характерный колпачок сверху мелкий и пропадёт первым. Колбу в отборе вариантов держи крупной.

**Молний стало три.** 12 (батарея с молнией), 15 (фигура с батареей и молнией) и R01 (чистая молния). Все три про энергию, так что смысловой конфликт слабый, но визуально 12 и R01 рядом будут путаться. Развести можно тем, что у 12 доминанта — батарея в разрезе, а молния мелкая сбоку; у R01 молния занимает весь кадр и других форм нет. Проверь на листе.

**Капель стало пять.** 01 (красные, сплошные), 02 (тип B, поток), 11 (голубая на земле), R03 (голубая, сплошная), P05 и P06 (красные, полые). Ключ различения — заливка: сплошная капля значит «кровь идёт», полая значит «кровотечения нет». Держи это правило жёстко, оно единственное, что разводит P05/P06 от 01 на малом размере. И следи, чтобы отверстие в кольце оставалось крупным: затянется — правило сломается.

**Капель было три.** 01 (красные), 11 (голубая на потрескавшейся земле) и R03 (голубая). 01 разводится цветом, 11 — типом B и заливкой кадра. Пара R03 / 11 опаснее: обе голубые капли. У 11 капля мелкая и в углу, у R03 — крупная и по центру, этого должно хватить, но это единственное различие.

**Ресурсам нужна своя плашка.** Красная и зелёная кодируют «плохо» и «хорошо». Энергия, регенерация и гидрация знака не несут — они показывают уровень. Если посадить их на красную, пользователь прочитает полную флягу как проблему. Нужен нейтральный тёмный токен, в исходниках это `#383838`.

**04 и P07 — пара, генерить подряд.** Это одна и та же кость в двух состояниях, поэтому она обязана быть одной и той же костью: та же длина, та же толщина, те же головки. Разнесёшь по времени — получишь две разные кости, и пара развалится. Так же, как 13/14 и 16/17.

Различаются они силуэтом, и это сильнейший из возможных признаков: у 04 контур разорван на два смещённых куска, у P07 — цельный. На 48px внутренние детали пропадут, а разница «две части против одной» останется. Плюс плашки разного цвета, красная против зелёной.

Шину в P07 намеренно не рисую. Она добавляет второй объект, который на малом размере превратится в грязь поперёк кости, и смысл смещается с «зажило» на «лечат прямо сейчас» — а эффект называется «восстанавливает», то есть про результат.

**16 и 17 сейчас одно и то же.** В Figma у «Оглушения» и «Вспышки» дословно одинаковое описание — чёрные очки авиатора на белом фоне вспышки. Я развёл их так: 16 — очки на вспышке, 17 — чистая вспышка без объекта. Если задумка была другая, скажи; но два одинаковых кадра в наборе оставлять нельзя.

**Надпись «КГ» на гире не генерируй.** Модели врут в тексте всегда — получишь «KΓ», «KC» или орнамент. В промтах 13 и 14 лицевая часть гири намеренно оставлена пустой. «КГ» ставится в Figma текстовым слоем шрифтом проекта. Заодно получишь возможность локализовать.

**Проценты заполнения кадра не работают.** Модель не измеряет площадь — «60% кадра» она читает как «немного», и результат выходит разреженным. Везде, где у тебя в Figma стояли проценты (02, 13, 14), я заменил их на описание по зонам и на отношение к краям кадра: «доходит до нижнего края», «почти касается левого и правого краёв», «ровный отступ со всех сторон». Это модель отрабатывает.

**13 и 14 теперь различаются дистанцией съёмки.** Не «60 против 80 процентов», а «ровный отступ со всех сторон» против «почти касается краёв». Разница стала заметно грубее, и на 48px у неё есть шанс прочитаться даже без опоры на цвет плашки.

**Змея на кресте (18, P02).** Жезл Асклепия на 48px превратится в утолщение посреди креста. Различение дебафф/бафф всё равно идёт по цвету, красный против зелёного, — змея там не работает. Стоит подумать, нужна ли она вообще; без неё крест чище и читается мгновенно.

**P04 «Берсерк» красный, хотя эффект положительный.** Плашка позитива у тебя зелёная, но это тип B — содержимое перекрывает её целиком, и наружу зелёный не выйдет. Пользователь прочитает иконку как негативную. Варианты: либо сжать кадр так, чтобы по периметру оставалось зелёное кольцо плашки, либо принять как есть — берсерк в игре эффект обоюдоострый, и «горячее» прочтение ему семантически не противоречит. Решать до генерации: это влияет на композицию промта.

**Фигуры разведены ракурсом.** 15 фронтально, SK01 со спины, R05 в профиль — три разных вида, и на 48px это работает лучше, чем любые внутренние детали. Держи ракурсы разными и дальше, если фигур станет больше.

**Навыки — другой класс, другой размер показа.** Это полнокадровые сцены, а не символы на плашке. На 48px они не работают и не должны там появляться: их место — экран навыков, карточка, тултип. Проверять их на общем листе с иконками статус-эффектов бессмысленно, критерии разные.

**R04 удалён, его промт ушёл в SK01.** Ресурс «выносливость» и навык «Выносливость» ты описал одинаково — гружёный боец. У ресурса в игре иконки нет вообще, там полоса, поэтому дублировать нечего.

**Глаз в наборе теперь трижды: P04, SK07, SK09.** Развёл по кадрированию, это единственное, что работает:
- **P04** — один глаз, макро, горит изнутри, эмиссивный.
- **SK07** — один глаз, макро, свечения нет, кровь и пот.
- **SK09** — ОБА глаза и переносица, кадр шире, видна балаклава.

Пара P04/SK07 держится только на свечении. Если при отборе окажется, что различие слабое, безопаснее менять SK07: у берсерка свечение — смысловая основа, а у стрессоустойчивости нет.

**Мозг дважды: SK10 и SK11.** SK10 — голова в профиль силуэтом, мозг внутри черепа, фигура человека в кадре есть. SK11 — мозг отдельно, крупно, человека в кадре нет. Разные планы, не путаются.

**SK14 и SK17 рискуют слиться в «вещи на столе».** Разобранный автомат и верстак с инструментами на общем листе читаются одинаково. Разводит их план и свет: SK14 — плоская выкладка сверху-сбоку, холодный синий контур на двух деталях, фон почти пуст; SK17 — объёмная сцена с глубиной, тёплый рабочий свет сбоку, кадр заполнен. Если при отборе окажется похоже, тяни SK14 в более крупный план: две подсвеченные детали должны занимать кадр, а не теряться в общей выкладке.

**Кольца в SK13 и в 09 — одна форма.** У тремора концентрические круги это весь объект, у скрытности — деталь на земле под ботинком в жанровой сцене. Разные классы и разные экраны, так что конфликта на практике нет, но не усиливай кольца в SK13: чем они мельче и бледнее относительно ног, тем лучше.

**SK19 наследует рентген из 04 и 23.** Это удача, а не совпадение: просвечивание уже работает в наборе как язык, и повторное использование делает набор цельнее. Держи в SK19 ту же бледно-голубую подачу рентгена, что и в 04.

**Нейронные сети дважды: SK05 и SK11.** SK05 — абстрактная паутина без органа, горячая оранжевая. SK11 — конкретный мозг с пятью узлами, холодная синяя. Цвет и наличие органа разводят их надёжно, но не меняй палитры местами.

**SK02 «Здоровье» написан по референсу, не по твоему тексту** — описания к нему в списке не было. Если задумывалось другое, правь этот SUBJECT.

**Рентген-фигура на 48px не выживает.** Фигура в полный рост на плашке 48×48 — силуэт высотой около 30 пикселей, зоны поражения в нём не различить. Ей нужен свой размер показа: тултип, карточка эффекта, экран здоровья. На плашке 48px прочитается только «человек», без информации о том, что повреждено.

**06, 07, 15, P01, P04, R05, 23, SK01, SK04, SK06, SK07, SK08, SK09, SK10, SK12 — человеческие фигуры.** Самое сложное для модели: лишние пальцы, кривые пропорции. Гони с запасом вариантов и ставь их в конец очереди, когда стилевой якорь уже утверждён.

**Про 48px в целом.** Твои описания заметно богаче, чем несёт плашка 48×48. Рентген кости, фигура в лотосе с нимбом, персонаж с батарейкой за спиной — на финальном размере от каждого останется один силуэт и цвет. Это нормально, если богатый рендер живёт где-то ещё: в тултипе, в Кодексе, на странице эффекта. Если 48px — единственное место показа, часть описаний стоит упростить до одной доминирующей формы.

---

## 7. Пайплайн

1. **Якорь — 21 (радиация).** Простейшая форма, быстрее всего доводится свет и материал. Утверждаешь его первым, дальше он идёт как IMAGE 1 во все остальные.
2. **Порядок:** 21 → 12 → 01 → 03 → 13 → 14 → 09 → 10 → 08 → 04 → 05 → P07 → P03 → 18 → P02 → 02 → 11 → 16 → 17 → 19 → 20 → 06 → 07 → 15 → P01 → R01 → R03 → R02 → R06 → P06 → P05 → S01 → P04 → R05 → 23 → SK02 → SK03 → SK05 → SK04 → SK06 → SK01 → SK11 → SK10 → SK08 → SK12 → SK09 → SK07 → SK14 → SK17 → SK18 → SK13 → SK19 → SK15 → SK16. От геометрии к телам.
3. **Исходники BSG не прикладывать.** К промту идёт ровно одна картинка — утверждённый якорь набора. Оригинальные иконки из игры в генерацию не заходят: что рисовать, уже сказано текстом, а вложение тянет за собой рамку, замыленность и монохром исходника. Побочный плюс — иконки остаются оригинальными работами, а не производными.
4. **Кроп угла.** Gemini ставит метку SynthID в углу кадра — она видна на твоих прошлых генерациях. Обрезать обязательно, в промте `nothing in the corners` только уменьшает вероятность.
5. **Соотношение сторон** задавай контролом в интерфейсе, не текстом промта.
6. **Сборка в Figma:** плашка (вектор) → объект (тип A, Normal) или заливка (тип B, клип по плашке, градиент под ней на Multiply 40–60%) → общий inner shadow сверху.
7. **Проверка листом.** Все 35 иконок статус-эффектов и ресурсов на одном полотне в 48px, разом. Семь навыков проверяются отдельно и в своём размере. Дрейф света и слипшиеся пары ловятся только так.
