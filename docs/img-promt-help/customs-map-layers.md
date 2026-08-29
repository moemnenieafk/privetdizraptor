# Customs — 3 слоя из исходника (рельеф · растительность · материал)

Вход для генерации: **`customs-main-8192.webp`** (D:\Games\raster\customs, 8192×4138) — богатый
игровой рендер: деревья, песчаный холм (право-низ), река/пруды, откосы, дороги, материалы.
Задача: image-to-image вытащить 3 слоя и положить поверх стилизованной Figma-карты — уйдёт плоскость.

Модель: Nano Banana (`gemini-3-pro-image`, через ProxyAPI) или FLUX Kontext. Все три — image-to-image
по этому исходнику. Карта 2:1 > вывода модели → гнать **регионами (~4K)** или даунскейлом
(для рельефа/материала даунскейл ок — они «мягкие»; растительность хочет разрешения → регионы).

---

## 1. РЕЛЬЕФ / перепад высот (grayscale height + shaded relief)
Вариант A — карта высот (для тени под картой):
```
From this top-down map of an industrial area, produce a GRAYSCALE ELEVATION MAP. Keep the exact layout. Read height from the terrain: hills, the large sandy mound, embankments, ridges and rooftops = light grey to white; flat ground = mid grey; the river, ponds, ditches and pits = dark grey to black; smooth gradients along every slope. Output smooth grayscale only — no colour, no trees, no building detail, no outlines, no text.
```
Вариант B — готовый рельеф-оверлей:
```
...instead a soft shaded-relief overlay, single light from the top-left: raised ground and the sandy mound lightened, slopes, riverbanks and low ground softly shadowed with a thin ambient-occlusion darkening at every height edge, neutral grey, transparent where the ground is flat.
```
В Figma: слой A/B — **Multiply или Soft-Light, ~40–60%** под объектами. Это и есть «перепад высот».

---

## 2. РАСТИТЕЛЬНОСТЬ (изолированный стилизованный слой)
```
From this top-down map, extract ONLY the vegetation. Redraw every tree and bush as a flat top-down vector canopy in the SAME position and size as in the source: rounded organic green blobs with three flat tones (base, a top-left highlight, a bottom-right shadow) and a thin dark outline; dense clusters where the source is densely wooded, single trees where sparse; conifers as spikier star shapes. Everything that is NOT a tree or bush — ground, roads, water, buildings, the sandy mound — becomes fully transparent. No photo texture, no ground, no cast shadows on the background. Output a clean vegetation-only layer.
```
В Figma: **верхний слой** поверх всего (кроме разметки). Ложится по позициям деревьев исходника.

---

## 3. МАТЕРИАЛ ПОЛА (плоские зоны поверхностей)
```
From this top-down map, produce a flat GROUND-MATERIAL map, keeping the exact layout. Repaint every ground surface as a flat colour zone with clean edges by material: paved roads and lots = dark grey asphalt; dirt tracks and bare earth = warm brown; grass fields = muted olive green; the large sandy mound and gravel pits = warm tan; river and ponds = dark blue-grey; concrete pads = light grey. Give each material a subtle flat pattern (faint panel lines on concrete, light speckle on gravel) but no photo texture, no trees, no buildings, no objects, no outlines around zones.
```
В Figma: **база под объектами** (или подмешать к твоей земле на ~50%, чтобы разбить одноцветную траву).

---

## 4. КАМНИ / СКАЛЫ (изолированный слой)
```
From this top-down map, extract ONLY the rocks, boulders and rocky cliffs. Redraw each as a flat top-down vector shape in the SAME position and size as in the source: grey angular faceted rock masses, each facet a flat tone — base grey, one darker shadow facet toward the bottom-right, one lighter highlight facet toward the top-left — with a thin dark outline; cliffs and ridges as stepped bands that show the drop, boulder fields as clusters of angular blobs at their real positions. Everything that is NOT rock — ground, roads, water, grass, trees, buildings — becomes fully transparent. No photo texture, no ground, no cast shadows on the background. Output a clean rocks-only layer.
```
В Figma: **слой земли-рельефа**, под объектами и растительностью (кроны деревьев могут наезжать
на камни сверху). Скалы по краям карты = граница; валуны у переходов/укрытий — ориентиры.

---

## Порядок слоёв в Figma (низ → верх)
1. **Материал пола** (слой 3) — база поверхностей.
2. **Рельеф/высоты** (слой 1, Multiply/Soft-Light ~50%) — объём и тень.
3. **Камни / скалы** (слой 4) — на земле, до объектов.
4. Твои **здания / дороги / объекты** (руками + библиотека канонов).
5. **Растительность** (слой 2) — сверху (кроны наезжают на камни/объекты).
6. **Разметка** (лут / выходы / названия).

Итог: плоская карта получает глубину (рельеф) + живость (деревья) + фактуру (материал),
но остаётся в твоём чистом стиле, а не фотографией.

## Практика
- Река/пруды справа и песчаный холм — самые сильные «глубинные» акценты: на них рельеф-слой
  сработает заметнее всего (тёмная вода ↓, светлый холм ↑).
- Если модель на слое рельефа тянет цвет/детали — жёстче: `grayscale only, no colour, elevation only`.
- Для консистентности регионов первый удачный регион цепляй вторым вложением как style-anchor.
