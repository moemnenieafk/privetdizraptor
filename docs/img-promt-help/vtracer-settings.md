# vtracer — продвинутые настройки трассировки

Пакет: `@visioncortex/vtracer` 1.0.0-alpha.3 (уже в `node_modules`). Даёт чистый вектор **только
из плоского входа**. Сырой кроп → мусор; см. «Потолок» ниже.

## Пресеты (Node `convertBuffer`)
```js
// FAITHFUL — максимум деталей (для уже плоского Gemini-флэта)
{ colorMode:'color', hierarchical:'stacked', mode:'spline',
  filterSpeckle:4, colorPrecision:8, layerDifference:16,
  cornerThreshold:60, lengthThreshold:4, spliceThreshold:45,
  pathPrecision:8, maxIterations:10 }

// CLEAN-FLAT — меньше путей (шумноватый вход)
{ ...то же, filterSpeckle:8, colorPrecision:6, layerDifference:24, cornerThreshold:70 }
```
Подстройка: путей слишком много → `colorPrecision 6` + `filterSpeckle 8`; теряет мелочь (стопы) → `filterSpeckle 2`.
Кузова/колёса — `mode:'spline'`; ящики/комнаты/лестницы — `polygon` (снап на линии).

## CLI-эквивалент
```
vtracer -i in.png -o out.svg --colormode color --hierarchical stacked --mode spline \
  --filter_speckle 4 --color_precision 8 --gradient_step 16 \
  --corner_threshold 60 --segment_length 4 --splice_threshold 45 --path_precision 8
```

## Posterize→trace — «бедный человек» Gemini-флэта (без биллинга)
Сырой кроп сперва кванцевать в N плоских цветов БЕЗ дизеринга (sharp), потом трассировать —
резко режет пути. Апскейл ×3 lanczos до трассировки помогает мелким кропам.
```js
const png = await sharp(FILE)
  .resize({ width: 438, kernel:'lanczos3' })
  .png({ palette:true, colours:8, dither:0 })   // ← posterize до ~8 плоских
  .toBuffer();
const svg = await convertBuffer(png, CLEAN_FLAT_OPTS);
```

## Замер на `larek-ground.jpg` (146×123, сырой кроп)
| Пресет | Путей | Цветов | Размер |
|---|---|---|---|
| faithful (cp8, fs4) | 1481 | 1410 | 712 KB — ❌ мусор |
| clean-flat (cp6, fs8) | 220 | 218 | 227 KB — ⚠️ |
| **posterize-8 → trace** | **103** | 44 | 144 KB — ✅ лучший из сырого |
| posterize-12 → trace | 430 | 341 | 528 KB — ❌ 12 цветов вернули шум |

## Потолок качества
- **Сырой кроп + posterize + vtracer** (сейчас, без биллинга): ~40–100 путей, «читаемо», но цвета
  грязноватые, кромки не идеальны. Годится для фоновых/быстрых объектов.
- **Gemini-флэт + vtracer** (после биллинга): ~6–12 плоских инков, <50 путей, печатно-чисто. Канон.

## TODO (когда скажет V4DYA)
Батч-скрипт `scripts/quick-trace.mjs`: папка кропов → папка SVG (posterize-8 → vtracer, авто-подбор
фильтра по размеру) — вектор для Figma сразу по всем кропам, без биллинга.
