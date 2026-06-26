# ПРОДОЛЖЕНИЕ: спринт «Карты» (handoff для новой сессии)

> В новом чате скажи: «прочитай `!future-requests/maps-sprint-continue.md` и продолжим».
> Дата записи: 2026-06-24.

## TL;DR где остановились
Спринт «Карты» (раздел локаций EFT) **реализован и запушен**. Все 8 фаз готовы, билд зелёный,
preview-деплой Vercel **Ready**. Осталось: создать PR в `main`, наполнить данные `quest_zone`,
визуально проверить. PR-через-`gh` ждёт установки GitHub CLI.

## Состояние git / деплой
- Ветка: **`feat/maps-frame-sprint`** (от `main`), запушена в `origin`.
- Коммит: `13de3ed` — `feat(maps): фрейм локаций как QuestMap …` (32 файла, +1261/−173).
- Vercel preview этой ветки: **Ready** (зелёный).
- PR в `main`: **ещё НЕ создан**. Готовый title/body — в этом репо в истории чата; можно создать через
  `gh pr create --base main --head feat/maps-frame-sprint` (после установки gh) или в браузере:
  https://github.com/moemnenieafk/privetdizraptor/pull/new/feat/maps-frame-sprint

## Что было решено (контекст, чтобы не передумывать)
- Спринт = ТОЛЬКО «Карты». Остальные 3 области роадмапа (динамические роуты хабов, оверхоул
  Достижений, интерактивные Модули Убежища) — **отдельными спринтами, не в этом**.
- Полный фрейм как QuestMap; этажи = активный слой + блюр/затемнение; связь квест→карта по
  координатам объективов tarkov.dev; ассеты Shebuka остаются; иконки маркеров — приоритет своих ЦТА.
- План целиком: `~/.claude/plans/replicated-singing-frog.md`.

## Открытые задачи (по приоритету)
1. **Создать PR** в `main` (см. выше). После установки GitHub CLI — могу сам.
2. **Наполнить `quest_zone`** (иначе кнопка «Локация» не подсвечивает зону):
   - Авто: ближайший прогон крона `/api/cron/sync-prices` (синк `syncEftQuestZones` уже там).
   - Вручную: `npm run db:sync-quest-zones`. ВАЖНО: это запись в общую prod-Supabase — из агент-сессии
     блокируется auto-классификатором; запускает пользователь сам.
3. **Визуальная проверка** (`npm run dev`, страница customs): выравнивание маркеров после перехода
   с `imageOverlay` на инлайн-`svgOverlay` (главный риск R1), этажи -1/1/2/3 (затемнение+блюр),
   поиск Ctrl+F, fullscreen, кнопка «Локация» со страницы квеста.
4. ~~(Опц.) Интегрировать **The Lab**~~ — **DONE.** The Lab в `main` (PR#2 `7f3c3d2`) собственным артом
   V4DYA как `staticMap` из `/public` (НЕ через geo-SVG Shebuka — тот путь тупиковый, ошибочно вкатан →
   откат `5d5dcb8`). Подробности и грабли Figma-экспорта — память `[[sprint-maps-frame]]` (кор. 2026-06-26);
   `maps-missing-svg-research.md` помечен СУПЕРСЕДНУТЫМ. Labyrinth/Icebreaker/End-of-Line — SVG так и нет.

## Установка GitHub CLI (в процессе)
- Установщик уже скачан: `C:\Users\vadim\Downloads\gh_2.95.0_windows_amd64.msi` — двойной клик → Install.
- После установки: **перезапустить терминал/сессию**, затем `gh --version`, затем `gh auth login`
  (GitHub.com → HTTPS → Login with a web browser).

## Грабли / важное
- **Лицензия SVG-карт** = CC BY-NC-SA 4.0 (NonCommercial), НЕ MIT (комментарий в `eft-map-config.ts`
  вводит в заблуждение — MIT относится к коду tarkov-dev). Касается ВСЕХ карт; важно при монетизации.
- Падение Vercel preview на `/_not-found` было **не из-за кода**, а из-за отсутствия env в Preview-scope
  (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Уже пофикшено
  пользователем (включил Preview-scope) → билд Ready. Кода не меняли.
- `quest_zone`: db:push НЕ нужен (`type` — свободный text, добавлен kind в union `schema.ts`).
- Ключевые файлы: `src/components/features/maps/` (фрейм/вьюер/этажи/поиск/легенда), `src/db/maps.ts`
  (`getEftInteractiveMapsWithNames`, `syncEftQuestZones`), `src/lib/quest-map-link.ts` (чистый, без
  EFT_QUESTS — для клиентских компонентов), `src/data/map-icons.ts`, `src/data/map-marker-icons.ts`.

См. также память [[sprint-maps-frame]].
