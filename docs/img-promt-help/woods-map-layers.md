# Woods (Лес) — 4 слоя из исходника (рельеф · растительность · камни · материал)

Вход: **`woods-main_0.16-8192.webp`** (D:\Games\raster\woods, 8192×8298, ~квадрат).
Фичи Леса: **плотная хвойная тайга** (лес — доминанта), центральный **скальный массив** + гряды/обрывы,
**болота/пруды** (верх-центр), **большое озеро** (низ-центр), **река** (справа), сильные холмы/овраги.
Задача та же, что у Customs: image-to-image вытащить 4 слоя, положить поверх стилизованной карты.
Модель — Nano Banana (`gemini-3-pro-image` через ProxyAPI). 8K → гнать регионами ~4K (4 квадранта),
первый удачный регион — style-anchor вторым вложением.

---

## 1. РЕЛЬЕФ / перепад высот
```
From this top-down map of a forested wilderness, produce a GRAYSCALE ELEVATION MAP. Keep the exact layout. Read height: hills, ridges, the large rocky massif and cliff lines = light grey to white; the big lake, the marsh ponds and the river = dark grey to black; forest floor and clearings = mid grey; smooth gradients on every slope, sharper steps at the cliffs. Output smooth grayscale only — no colour, no trees, no outlines, no text.
```
В Figma: Multiply/Soft-Light ~50% под объектами. На Лесу рельеф сильный — даст самый большой эффект.

## 2. РАСТИТЕЛЬНОСТЬ (доминирующий слой)
```
From this top-down map, extract ONLY the vegetation — this is a dense coniferous forest. Redraw the tree cover as flat top-down canopies in the SAME positions and density as the source: tightly packed dark-green conifer canopies (spikier star shapes), thinning to single trees near clearings, roads, marsh edges and the lakeshore; low bushes at forest edges. Three flat tones (base, a top-left highlight, a bottom-right shadow) and a thin dark outline. Everything that is NOT a tree or bush — ground, roads, water, rocks, buildings — becomes fully transparent. No photo texture, no ground, no cast shadows. Output a clean vegetation-only layer.
```
В Figma: верхний слой. На Лесу это самый «объёмный» слой — генерь в высоком разрешении/регионами.

## 3. КАМНИ / СКАЛЫ (яркая фича Леса)
```
From this top-down map, extract ONLY the rocks and cliffs. Redraw each as a flat top-down vector shape in the SAME position and size: grey angular faceted rock, each facet a flat tone (base grey, a darker facet toward the bottom-right, a lighter facet toward the top-left) with a thin dark outline; the large central rocky massif as a cluster of big faceted boulders, cliff lines and ridges as stepped bands that show the drop, scattered outcrops as smaller angular clumps at their real positions. Everything that is NOT rock — forest, ground, water, roads, buildings — becomes fully transparent. No photo texture, no ground, no cast shadows. Output a clean rocks-only layer.
```
В Figma: на земле, до объектов, под кронами. Центральный массив + обрывы = ключевые ориентиры.

## 4. МАТЕРИАЛ ПОЛА
```
From this top-down map, produce a flat GROUND-MATERIAL map, keeping the exact layout. Repaint ground surfaces as flat colour zones by material: dirt roads and tracks = warm brown; forest floor and grass = muted olive green; the marsh ponds, the large lake and the river = dark blue-grey (marsh a murkier green-brown); sandy or gravel clearings and the sawmill yard = warm tan; bare rock ground = grey. Give each material a subtle flat pattern but no photo texture, no trees, no rocks, no buildings, no objects, no outlines around zones.
```
В Figma: база под объектами (или подмешать к своей земле ~50%).

---

## Порядок слоёв (низ → верх)
**материал → рельеф (Multiply ~50%) → камни/скалы → здания/дороги/объекты → растительность → разметка.**

## Практика для Леса
- **Регионы:** 8K квадрат → 4 квадранта ~4K; первый вылизанный — анкер для остальных (швы: `seamless, line up with neighbour tiles`).
- Сильнейшие глубинные акценты: **скальный массив** (светлый ↑) и **озеро/болота/река** (тёмные ↓) — на них рельеф-слой сыграет ярче всего.
- Лес = тайга → в растительности проси **conifers / spikier star shapes**, не круглые кроны.
- Болота: в материале — «murkier green-brown», чтобы отличались от чистой воды озера.
