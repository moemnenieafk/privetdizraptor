> ⚠️ **СУПЕРСЕДНУТО (2026-06-26):** The Lab уже в `main` собственным артом V4DYA как `staticMap`
> (PR#2 `7f3c3d2`, отдаётся из `/public`). geo-SVG путь через Shebuka `Labs.svg` (CC BY-NC-SA) НЕ нужен
> и был ошибочно вкатан → откат `5d5dcb8`. См. память `[[sprint-maps-frame]]` (коррекция 2026-06-26).
> Файл оставлен как историческая разведка лицензий/источников.

# Deep-research: недостающие open-source слоистые SVG-карты EFT

**Дата:** 2026-06-24 · **Контекст:** спринт «Карты», Фаза 8 (план `~/.claude/plans/replicated-singing-frog.md`).
**Источники (авторитетные, проверены напрямую):**
- SVG-арт: `the-hideout/tarkov-dev-svg-maps` (GitHub API contents + raw).
- Проекции: `the-hideout/tarkov-dev` → `src/data/maps.json`.

## ⚠️ Лицензия (важно для всего набора)
Репозиторий SVG-карт (`tarkov-dev-svg-maps`, автор Shebuka) лицензирован под
**CC BY-NC-SA 4.0** (Attribution-**NonCommercial**-ShareAlike), НЕ MIT.
Комментарий в `src/data/eft-map-config.ts` («MIT») относится к КОДУ tarkov-dev (maps.json),
а не к SVG-арту. Это касается ВСЕХ наших текущих карт Shebuka: NonCommercial → коммерческая
монетизация карт без перелицензирования недопустима; нужна атрибуция + ShareAlike. Решение —
за владельцем проекта (отдельный вопрос вне спринта).

## Вердикт по 4 локациям

| Локация | Слоистый SVG (open-source) | Этажи `<g id>` | Лицензия | Вердикт |
|---|---|---|---|---|
| **The Lab** (Лаборатория) | ✅ `Labs.svg` в репо | `Technical_Level`, `First_Level`, `Second_Level` | CC BY-NC-SA 4.0 | **МОЖНО интегрировать** (нужна калибровка проекции) |
| **The Labyrinth** (Лабиринт) | ❌ нет в репо | — | — | **Только растр** (tarkov.dev tiles `labyrinth/main`, author Tarkov.dev); 2D-вариант re3mr не в каноничном репо, лицензия неясна |
| **Icebreaker** (Ледокол) | ❌ нет в репо | — | — | **Нет open-source SVG** (только 2D-вариант re3mr, без подтверждённого источника/лицензии) |
| **End-of-Line** (Конец пути) | ❌ нет нигде | — | — | **Не карта** — отсутствует в tarkov.dev maps.json (15 карт), данных нет. CTA-плейсхолдер меню |

## The Lab — детали интеграции (единственная интегрируемая)
- **SVG:** `https://raw.githubusercontent.com/the-hideout/tarkov-dev-svg-maps/main/Labs.svg` — слоистый, группы этажей `Technical_Level` / `First_Level` / `Second_Level` (каждая c подгруппами Rooms/Arrows/Doors/Details).
- **Проекция из maps.json** (вариант `the-lab`, но калибрована под РАСТРОВЫЕ тайлы `labs_v4`, для SVG может потребоваться `svgBounds`-override как у reserve):
  - `transform: [0.575, 281.2, 0.575, 193.7]`
  - `coordinateRotation: 270`
  - `bounds: [[-80, -477], [-287, -193]]`
  - `heightRange: [-0.9, 3]`
- **Имена слоёв** отличаются от других карт (`*_Level`, не `Ground_Level`/`Second_Floor`) — учесть в `layers[].svgLayer`.

### Черновик записи `EFT_MAP_CONFIG['lab']` (требует визуальной калибровки на customs-эталоне)
```ts
lab: {
  slug: "lab",
  svgFile: "Labs.svg",
  author: "Shebuka",
  authorLink: "https://github.com/the-hideout/tarkov-dev-svg-maps/",
  minZoom: 2,
  maxZoom: 6,
  transform: [0.575, 281.2, 0.575, 193.7],
  coordinateRotation: 270,
  bounds: [[-80, -477], [-287, -193]],
  heightRange: [-0.9, 3],
  svgLayer: "First_Level",            // наземный
  layers: [
    { name: "Технический", svgLayer: "Technical_Level", show: false, height: [-1000, -0.9] },
    { name: "2-й уровень",  svgLayer: "Second_Level",    show: false, height: [3, 1000] },
  ],
},
```

## Шаги активации The Lab (вне этой сессии — нужны outward-записи)
1. Скачать `Labs.svg`, залить в Storage `cta-media/maps/eft/lab.svg` (`npm run db:upload-maps` / вручную).
2. Добавить запись `lab` в `EFT_MAP_CONFIG` (черновик выше).
3. Откалибровать `bounds`/`svgBounds` визуально (растровые параметры ≠ SVG-координаты; сверить маркеры).
4. `npm run db:sync-maps-geometry` подтянет геометрию маркеров lab; карта появится в индексе автоматически (динамика).
5. (Опц.) `npm run db:sync-quest-zones` — зоны квестов Lab.

## Итог
- **Lab** — закрываемо нашим стеком (слоистый SVG + этажи), при калибровке проекции.
- **Labyrinth / Icebreaker** — open-source слоистых SVG нет; доступны только растровые тайлы tarkov.dev (можно показать как не-слоистую растровую карту, но это не наш Shebuka-паттерн и лицензия тайлов tarkov.dev отдельная).
- **End-of-Line** — не существует как карта в данных; оставить плейсхолдером меню или убрать.
