# ЦТА ARCADE — статус реализации

Реализация по спеке [cta-arcade-handoff-final.md](cta-arcade-handoff-final.md) и исходному
дизайн-доку `SaveTheServers.md` (YandexDisk). Дата: 2026-07-25.

## Что сделано (Фазы A–F)

Раздел **«Зал автоматов»** под «Кто ты в Игре» → **`/eft/progress/rookie/arcade`**.
Игра идёт «внутри» фотореалистичного аркадного автомата; движок подключаемый (контракт `ArcadeGame`).

- **Каркас.** `src/lib/arcade-screen.ts` (константы геометрии verbatim из §3/§8),
  `src/components/ui/ArcadeFrame.tsx` (плита в потоке + бокс экрана 4/3 + слой стекла;
  без дырки/маски/transform). Site + клоузап-фуллскрин (`cabinet-front.webp` /
  `arcademachine_cleanplate_closeup_bg.webp`).
- **Хост/движок.** `src/components/features/arcade/`: `ArcadeHost` (оркестрация, site↔fullscreen
  единым инстансом канваса, мобильный флоу), `ArcadeCanvas` (offscreen 2D 640×480 → WebGL CRT-пасс
  `crt.ts` с 2D-фолбэком; rAF+dt; покадровое состояние в ref; пауза visibility+IntersectionObserver;
  Pointer Events одной веткой), `registry.ts`, `types.ts`, `GameSelector`, `SkinShop`, `RotateScreen`.
- **game01 «Спаси сервера».** `games/save-the-servers/`: `config.ts` (ВСЕ константы баланса),
  `state.ts` (физика/спавн/HP/таймлайн/Пельмень/баффы-дебаффы; взмах-свип по траектории курсора +
  заряд ЛКМ; вращение/«поп»), `render.ts` (фон/бутылки/Пельмень/пикапы/HUD в канвасе/эффекты/курсор),
  `sprites.ts`, `index.ts` (сборка + экономика + SFX).
- **Экономика.** `store/useSaveTheServersStore.ts` (кошелёк + 16 скинов, цена index×20, localStorage).
  `store/useArcadeStore.ts` (выбор игры + мьют). Хитбокс чуть растёт с тиром скина.
- **Звук.** Синтез-тоны в `src/lib/sfx.ts` (bounce/thud/powerup/alarm/burst), тумблер у автомата,
  по умолчанию выкл.
- **Мобилка.** В ленте на тач канвас НЕ запускается (постер «Играть») → фуллскрин → портрет = экран
  поворота (`RotateScreen`, есть кнопка «Назад») → ландшафт = игра. `matchMedia('(orientation)')`,
  `wakeLock` (try/catch), safe-area insets, `touch-action:none` только в игре+фуллскрине,
  `orientation.lock` как прогрессив-энхансмент.
- **Навигация.** Ссылка «Зал автоматов» в `RookieHubClient`, breadcrumb `arcade` в `headerConfig.ts`.

## Управление (важно для тестеров)

- **Взмах** = удар считается по траектории движения курсора за кадр (свип-отрезок), один мах бьёт
  несколько бутылок (кулдаун 120 мс на объект). Обычный клик тоже работает.
- **Заряд** = зажатие ЛКМ копит силу (полный за 450 мс, кольцо на курсоре золотеет) → сильнее удар →
  бутылка выше.

## Тюнинг

Весь баланс — [config.ts](../../src/components/features/arcade/games/save-the-servers/config.ts).
Вайб ЭЛТ — пресеты `PRESETS` в [crt.ts](../../src/components/features/arcade/crt.ts).
Спека прямо просит перебалансировать баффы/дебаффы/спавн Пельменя ПОСЛЕ первых тестов.

## Проверка

`npx tsc --noEmit` — чисто. Playwright-скриншоты: десктоп-лента, клоузап-фуллскрин (экран точно в
стекле), мобильный портрет (экран поворота), ландшафт (игра). Консоль без ошибок.

## Отложено / открытые вопросы

- **game02** — ассеты есть (`public/images/arcade/game02/`), геймплей-спеки нет → карточка «Скоро».
  Контракт `ArcadeGame` готов под подключение.
- **Баланс** game01 — по итогам живых тестов (V4DYA + Дима).
- **Имена скинов** в `config.ts` — рабочие; при желании выверить под канон EFT.
- **Пропорция клоузапа** 1.38148 vs эталон 1.38127 — расхождение 0.0002 (< 0.001, в допуске).
- `public/images/arcade/game01/converted/` — дубликат клоузапа от экспорта, в git НЕ коммитился.
