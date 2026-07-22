---
status: ✅ реализовано (22.07) — рулетка, баннеры, советы, 2-колоночные перки, звук; в рабочем дереве, коммит при пуше
affects: progress, seasons, ui, assets, sfx
date: 2026-07-22
---
# Сезоны · итерация 2 (рулетка, онбординг, арт)

Продолжение [[seasons-perks-builder]]. Довели `/eft/progress/seasons/perks` до «продающего» вида: рулетка билдов с pseudo-3D, hero-баннеры, карусель советов ЦТА, перки в две колонки, приятный звук.

## Сделано

### Билды и данные (`src/data/season-builds.ts`)
- +3 курируемых билда под сезонные вводные (всего **21**): `foreman` (убежище без FIR + крафты x2), `barefoot-infantry` (дефицит брони → мобильность), `black-division-assault` (Чёрная дивизия + +25% XP). Каждый завязан на конкретный сезонный перк, не просто набор.
- Валидность прогнал node-скриптом: у всех баланс 0, ≥1 негатив, без взаимоисключений.
- `withBanners()` (паттерн как `withIcons` у перков) проставляет `banner` (webp) и `short` (тайтл) по id.

### Hero-баннеры (NanoBanana) — `docs/eft/progress/seasons/build-banner-prompts.md`
- Единый **BASE-стиль** (Tarkov/Норвинск, один акцент-свет по вайбу) + строка `Focus:` на каждый билд. 9:16, рендер ×4 → ужать до 196×348.
- **Гочи генерации:** кириллицу в картинку НЕ пишем (модель ломает) — тайтл оверлеем в UI. Gemini ругается на кровь/раны/пытки/флирт («I don't seem to have access to that content») → переписали в «grit через пыль/искры/решимость». 5 промтов в safe-редакции.
- Арт готов: `public/images/seasons/season01/builds/NN-vibe-id.webp` (21 шт, генерил V4DYA).

### Рулетка — `SeasonBuildGallery` (переписан)
- **Pseudo-3D coverflow** на `requestAnimationFrame` по дробной позиции `pos`; `wrappedDelta()` даёт круговое смещение → бесконечная лента, рендер окна ±4 карты.
- Центр: scale 1 + амбер-рамка/свечение + тайтл; соседи — scale/opacity/rotateY. **КРУТИТЬ** (3 оборота, ease-out, приземление), **ХАОС** (случайный валидный билд + глитч), клик по соседу — доворот.
- Caption выбора (вайб, баланс, тэглайн, метры, иконки, «Собрать» → скролл к `#season-builder`).
- **ГОЧА (свечение):** `overflow-hidden` резал свечение/тени по краям. Замена — `overflow-x: clip` (клипает по горизонтали, гасит горизонтальный скролл страницы) при видимом `overflow-y` → вертикальное свечение цело. Комбо `overflow-x:clip + overflow-y:visible` валидно (hidden+visible схлопнулось бы в auto/scroll).

### Полный список сборок — `SeasonBuildList` (там же)
- Вынесен из рулетки ВНИЗ страницы, после конструктора. Строки: миниатюра баннера + инфо + «Собрать». Фильтр по вайбам переехал сюда; КРУТИТЬ теперь берёт случайный из всех.

### Советы ЦТА — `SeasonTips` + `SeasonIntro`
- Deep research по Kord Breach (blast.tv, insider-gaming, timesaver.gg) → 10 онбординг-советов в `src/data/season-tips.ts`.
- Карусель: автоплей 7с с паузой на hover, точки+счётчик `06/10` справа-вверху, прогресс-бар (keyframe `season-tip-progress` в globals.css, `scaleX`). Акцент — **тил сезона `--color-lightkeeper`**, НЕ амбер.
- `SeasonIntro` = логотип (348px) + советы (`flex-1`). Высота обоих фикс **128px** (`h-32`). Блок наверху конструктора (перенесён с хаба).

### Перки в две колонки — `SeasonPerkBuilder`
- Бафы слева / дебафы справа (`lg:grid-cols-2`), сетка `[repeat(auto-fill,minmax(160px,1fr))]`, карточка фикс `h-40` (ровные ряды). Сезонные — полосой снизу.
- Панель бюджета: статы + статус над тонкой «полоской» (потрачено из набранного), справа — компактные кнопки.

### Звук — `src/lib/sfx.ts`
- Новый мягкий тон `'reel'` (triangle 340→190 Гц, тихий) для прокрутки. Тики разрежены по времени (≥45мс) → эффект храповика, не жужжит. Глобальный `'tick'` не трогали (он = звук ошибки в BarterRush).

### Копирайт
- Убрано дублирование «Сезон 1 · KORD BREACH» в шапке (несёт логотип). Описание → приветственное с призывом собрать персонажа и поделиться.

### Свободный выбор зелёных ✅
- Логика переработана: `valid = баланс ≥ 0 И ≥ 1 негатив`. Позитивы выбираются **свободно** (баланс уходит в минус — легальное промежуточное состояние), панель показывает 3 статуса: «в минусе · добери N» / «нужен хотя бы 1 минус» / «персонаж собран».
- Убраны из стора жёсткая блокировка неоплаченных позитивов и **каскадное снятие** (`dropCascade` удалён). Единственный запрет в `perkStates` — конфликт (взаимоисключения). `applyPreset` больше не валидирует (шаринг грузит любое собранное состояние).
- Файлы: `src/lib/season-points.ts`, `src/store/useSeasonStore.ts`, `SeasonPerkBuilder` (панель + blockText).

## Файлы
- `src/data/season-builds.ts`, `src/data/season-tips.ts` (new)
- `src/components/features/seasons/`: `SeasonBuildGallery.tsx` (rewrite), `SeasonPerkBuilder.tsx`, `SeasonTips.tsx` (new), `SeasonIntro.tsx` (new)
- `src/lib/sfx.ts`, `src/app/globals.css`
- `src/app/eft/progress/seasons/page.tsx`, `.../perks/page.tsx`
- `docs/eft/progress/seasons/`: `perks.md`, `build-banner-prompts.md`

## Референсы
- Figma: рулетка `node 2056-1436`, блок советов `2062-2877`.
- Валт: [[eft/progress/seasons/perks]], [[eft/progress/seasons/build-banner-prompts]].

---
*Процесс: [[engineering-loop]]*
