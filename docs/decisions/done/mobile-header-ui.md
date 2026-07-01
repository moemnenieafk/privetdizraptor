---
status: ✅ сделано
affects: header
date: 2026-07-01
done: 2026-07-01
---
# Хедер мобильной версии сайта

## Цель
Сделать 1 в 1 дизайн как на макетах `design-ui-ux-figma/mobile/header` (4 состояния: main-page, default-закрыт, меню-открыто гость, меню-открыто залогинен). Подход — **поэлементная адаптация** существующих модулей, без глобального реворка хедера.

## Границы
- **В scope:** `layout/Header.tsx` (респонсив-ветки), `header-modules/BurgerMenu.tsx` (пересборка дровера), новый `header-modules/MobileMenuStats.tsx`, `ui/Carousel.tsx` (+2 опц. пропа под компактный слайд).
- **НЕ трогаем:** `PlayerTelemetry` (god-node по `usePlayerStore` — мост 11 областей), `HeaderNavigation`-дропдауны, `StreamStatus`, items-`HubNav`, десктоп-раскладку (только добавляем `<xl`-ветки).

## Вывод (развилки закрыты с V4DYA, 2026-07-01)
- **Стата/логин в дровере** → новый презентационный `MobileMenuStats` на том же `usePlayerStore`/`useQuestStore` (1:1 макет, god-node не трогаем, переиспользуем `ProfileSettingsModal`). Сам `PlayerTelemetry` НЕ адаптируем.
- **Свитчер игр** → карусель внизу дровера (`ui/Carousel` + `GAMES_DATA`, компактные лого-тайлы по CSS-маске), `GameLogo`-дропдаун прячем `<xl`.
- Брейкпоинт мобилки = `<xl` (там уже живёт бургер). Брейдкрамбы на мобилке скрыты — в макете их нет.

## Карта «десктоп → мобилка»
- `PlayerTelemetry` (ROW1) → `hidden xl:block`; стата уезжает в дровер (`MobileMenuStats`).
- `GameLogo` (ROW2) → `hidden xl:flex`; переключение игр — карусель в дровере.
- `TacticalSearch` (ROW2) → на всю ширину (соседи скрыты `<xl`).
- `NewbieButton` (ROW2) → `hidden xl:flex`; на мобилке живёт в дровере (триггерит общий `NewbieModal` из `Header` через `onOpenNewbie`).
- `BurgerMenu` → full-screen дровер: [лого][`MobileMenuStats`][нав][Я НОВИЧОК][карусель игр]; крестик = морф-тоггл бургера (не отдельный X).

## Критерий готовности
- [x] `tsc --noEmit` чисто
- [x] визуал 1:1 по 4 макетам (главная / default / гость-меню / залогинен-меню)
- [x] стата-таблетки тапаются (Каппа↔Смотритель, PVP↔PVE), карусель центрирует текущую игру

---

## Исполнено (2026-07-01) ✅ — принято V4DYA, закоммичено + влито в main, заметка → `done/`
`tsc --noEmit` ✅ чисто. Десктоп-раскладка не тронута (только добавлены `<xl`-ветки).

- **`ui/Carousel.tsx`** — 2 опц. пропа (`slideClassName`, `viewportPadClassName`) с дефолтами = прежние значения → главная байт-в-байт не затронута.
- **`header-modules/MobileMenuStats.tsx`** (новый) — блок статы/логина на `usePlayerStore`+`useQuestStore`+`useUser`; ряд авторизации (имя · настройки · выход) + 3 таблетки (Прогресс% / Режим / Войти|Уровень+Фракция); переиспользует `ProfileSettingsModal`.
- **`header-modules/BurgerMenu.tsx`** — пересобран из мини-панели `w-72` в full-screen дровер (лого · `MobileMenuStats` · нав · `NewbieButton` · карусель игр по `GAMES_DATA`, активная игра — тайл в `--primary`). **Бургер = единая кнопка-тоггл с морф-анимацией «2 линии ↔ крестик»** (обе линии съезжаются к центру + поворот ±45°, transition 300ms, реверсивно), `z-102` над дровером; отдельный X убран; + scroll-lock фона и закрытие по Escape.
- **`layout/Header.tsx`** — `PlayerTelemetry`/`GameLogo`/`NewbieButton`/`Breadcrumbs` → `hidden xl:*`; поиск на всю ширину; `onOpenNewbie` проброшен в дровер.

**Приёмка (V4DYA, `npm run dev`, вьюпорт <xl / 375px):**
- [x] `/` (main-page): только лого-лок
- [x] внутр. страница закрыто: лого + бургер, ниже — поиск на всю ширину
- [x] бургер (гость): лого+X · [0% / PVP / ВОЙТИ] · нав · Я НОВИЧОК · карусель игр
- [x] бургер (залогинен): + ряд имя·шестерёнка·выход и таблетка «54 BEAR»
- [x] анимация бургера: две линии плавно морфят в крестик и обратно (открытие / закрытие / Escape)
- [x] десктоп (≥xl) не изменился

→ закоммичено (docs+code) и fast-forward в `main`; заметка → `done/`.

*Процесс: [[engineering-loop]]*
