---
title: Рельеф и материал карт EFT из клиента — чекпоинт
status: ✅ работает на Таможне (2026-09-03), масштабируется на все карты
tags: [maps, terrain, unity, assetripper, extraction, checkpoint]
---

# Рельеф и материал карт EFT прямо из клиента

Два слоя подложки карты — **карта высот** и **карта материала поверхности** — берутся из файлов
игры **бесплатно и точно**, без нейросети. Проверено на Таможне: покрытие 100 %, шаг 0.68 м.

## Результат (Таможня, эталон)

| Слой | Файл | Цифры |
|---|---|---|
| Высоты | `gen/customs/ground/customs-height-16bit.png` + `-height-meters.npy` | 4096×2082, перепад **53 м** (−26.7…+26.3) |
| Рельеф (отмывка) | `customs-hillshade.png` | свет 315°/45° |
| Материал | `customs-material.png` + `-material-index.npy` | 7 семейств: soil 59.5 / gravel-sand 28.0 / rock 6.3 / dirt 6.2 % |

Проверка привязки: отмывка совпала с растром z6 — река, дороги, площадки зданий на местах.
Значит **`manifest.boundsFromConfig` = мировые координаты Unity**, отдельная калибровка не нужна.

## Как это устроено

Ground-слои карты EFT — это **Unity Terrain**:
- **высоты** — `TerrainData.m_Heightmap.m_Heights` (нормализованные), мировая высота = `posY + h * scale.y`;
- **материал** — `TerrainData.m_SplatDatabase`: веса слоёв поверхности. У Таможни **12 слоёв**
  с говорящими именами: `Grass`, `Ground`, `Gravel_Road_A/B`, `Forest_Ground`, `Stone_Ground`,
  `Rock_Ground`, `Gravel`, `Grassy_Ground`, `Sand`, `Pebbles_Ground`, `Soil_Grass`.
  Это **разметка дизайнера BSG** — точнее любой генерации.

Карта режется на слайсы 700×700 м (`Slice_<ряд>_<колонка>`), Таможню закрывают два: `Slice_3_2`,
`Slice_3_3` (res 1025², size 700×180×700, шаг 0.684 м).

## ⚠️ ГОЧИ (стоили нескольких заходов)

1. **`TerrainData` НЕ лежит в `levelN`.** Скан всех 714 сцен на `TerrainData` даёт **ноль** и ведёт
   к ложному выводу «карты EFT сделаны мешами, террейна нет». Он лежит в **`sharedassetsN.assets`**
   (у Таможни — `sharedassets17`). Проверять там, либо в экспортированном проекте — `Assets/TerrainData/`.
2. **Unity-террейн рисуется не `MeshRenderer`.** Поэтому диагностика по рендерерам его не видит,
   а ортографический depth-рендер сцены даёт покрытие **~25 %** (только здания и дороги) — земли
   в кадре нет. Не гоняться за рендером, читать данные.
3. **Слайсы, которые «пустые», могут быть террейном.** `Slice_3_2`/`Slice_3_3` в иерархии сцены
   имеют 0 дочерних Transform — вся геометрия в компоненте `Terrain`. Не считать такие узлы пустыми.
4. **`Terrain_Base` LOD-патчи ≠ рельеф карты.** 7 слайсов 64×64 (шаг 11 м) — это рельеф
   **окружения** за игровой зоной, покрытие игровой рамки **0.4 %**. Годятся как фон, не более.
5. **Дубли `AITerrain_*`** повторяют `Slice_*` (тот же res/pos/size) — отбрасывать по позиции.
6. **Splat не покрывает асфальт и воду.** Дороги/площадки Таможни — отдельные меши
   (`around_factory*` в сцене `custom_Road`), река — меш `Shoreline_Lake_Water`. Их добирают
   рендером маски по тем же границам.
7. **Индексы коллекций AssetRipper меняются при каждой загрузке** — искать заново, не кэшировать.
8. **AssetRipper 2.0 headless:** форм-поле `path` (строчными!), поиск — параметр `q`,
   `/Assets/Model.glb?Path=…` отдаёт меш сразу в GLB. Path = `{"C":{"B":{"P":[]},"I":<колл>},"D":<pathID>}`.
9. **Имена сцен = оглавление карты.** `globalgamemanagers → BuildSettings.scenes` (дамп:
   `docs/registry/eft-scenes.json`) — у Таможни `custom_AZS`/`custom_AZS_old`, `custom_Obshezhitie`,
   `custom_mazuto`, `custom_Terrain`… Это точнее любой вики.

## Инструменты

| Файл | Роль |
|---|---|
| `scripts/eft-terrain/TerrainExporter.cs` | Unity-batch: `GetHeights()` + `GetAlphamaps()` + имена слоёв → `.bin` |
| `scripts/eft-terrain/build-heightmap.py` | сшивка высот в рамку карты → 16-бит PNG + hillshade + метры |
| `scripts/eft-terrain/build-material.py` | splat → 7 семейств палитры → PNG + индексы для трассировки |
| `scripts/eft-terrain/HeightRenderer.cs` | ортографический depth-рендер (фолбэк для карт без террейна) |

Запуск Unity:
```
Unity.exe -batchmode -quit -projectPath <proj> -executeMethod TerrainExporter.Run \
          -scenes "Assets/Content/Locations/<Map>/<map>_Terrain.unity" -out <bin> -logFile -
```

## 🚀 Прорыв: Unity больше не нужен

`UnityPy` читает `TerrainData` **прямо из `sharedassetsN.assets`**:
`m_Heightmap.m_Heights` (1025² значений), `m_Heightmap.m_Scale` (0.684 / 180 / 0.684),
`m_SplatDatabase.m_TerrainLayers` (12) + `m_AlphaTextures` (3 RGBA-текстуры = 12 каналов).

Значит путь «AssetRipper → 14 ГБ проект → Unity batch» нужен **только для разведки**. Боевой
конвейер для всех карт — чистый Python, минуты на карту, без 140 ГБ экспорта.
Мировые позиции слайсов берутся из иерархии сцены `levelN` (корень `terrain` → дети `Slice_R_C`).

План на все карты: `docs/decisions/eft-all-maps-terrain-plan.md`.
