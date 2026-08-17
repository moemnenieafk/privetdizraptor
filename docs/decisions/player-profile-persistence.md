---
status: ✅ Слои A+B+C В ПРОДЕ (2026-08-17, main 265c6b80) + фикс двух синков; live-verify пройден в браузере
affects: dossier, profile, supabase-schema, parser, manual-entry
date: 2026-08-17
---

# Профиль игрока — серверная точка истины + ручной ввод

## Проблема (диагноз)
Профиль сейчас живёт **только в localStorage** двумя сторами (`player-profile-storage` +
`pmc-rich-stats-storage`). Серверной персистенции нет. Отсюда «сброс»: другой браузер/устройство,
чистка кэша, инкогнито → пусто; повторная загрузка перезаписывает единственный слот. Оттолкнуться
не от чего — все калькуляции (архетип, под-треки, EXP+) висят на эфемерном localStorage.

## Ключевая находка про источник данных
Кнопка «Скачай свой профиль» ведёт на **tarkov.dev/players**. Его экспорт (проверено на
`docs/15045.json`) — **тонкий**: `aid · info · pmcStats · scavStats · skills`. **Ни Hideout, ни
TradersInfo, ни Quests в нём нет.** Уровень убежища есть только в **полном игровом/SPT-профиле**
(`Hideout.Areas[]`, `TradersInfo`, `Quests[]`), который live-игрок штатно не выгружает.

Следствие:
- парсер поддерживает **обе формы**: тонкую (tarkov.dev) и полную (SPT/игра). Hideout/трейдеры/
  квесты извлекаются **если присутствуют**, иначе `null` — не выдумываем.
- для большинства (tarkov.dev) **ручной ввод убежища — основной источник**, не запасной.

## Решения V4DYA (2026-08-17)
1. **Аноним** — работает как сейчас (localStorage), но видит мягкий призыв «войди, чтобы сохранить
   профиль навсегда». Залогинился → снапшот уезжает на сервер и становится точкой истины.
2. **Ручной ввод** — полный, но группами: все ~30 Common-скиллов (сворачиваемо по категориям, как в
   `DossierPmcStats`) + все станции убежища + трейдеры. Уровень/престиж/фракция — там же.

## Архитектура

### Хранение
- **Залогинен** → Supabase-таблица `cta_player_profiles` (owner = `profiles.id`), запись/чтение через
  **server-action на Drizzle owner-role** (мимо RLS — иначе ES256-гоча юзер-JWT, см. memory
  `supabase-jwt-es256-dataplane`; тот же путь, что `getKarmaMap`/чекпоинты).
- **Аноним** → localStorage (как сейчас). При логине — one-shot миграция localStorage → сервер.
- Форма записи: **JSONB-снапшот** нормализованной вью (`PlayerView` + hideout/traders) +
  индекс-колонки `level`, `experience`, `updated_at`. JSONB = «все нюансы без потери» и
  forward-compat (§4.4: тип повторяет форму данных).

### Источники правки (сосуществуют)
- **JSON-загрузка** — массовое заполнение снапшота (тонкий или полный профиль).
- **Ручной редактор** — патч отдельных полей (скилл, станция, трейдер).
- Семантика: **last-write-wins по полю**. Один редактируемый снапшот; загрузка bulk-fill, ручные
  правки — patch. Загрузка тонкого профиля **не затирает** вручную введённое убежище (мержим по
  ключам, не заменяем целиком).

### Схема (черновик, ждёт «добро» — §5 необратимо)
```
cta_player_profiles
  id           uuid pk default random
  user_id      uuid → profiles.id  (on delete cascade)
  game_id      uuid → games.id     (on delete cascade)
  snapshot     jsonb   -- PlayerView + hideout[] + traders[] (+ manual overrides)
  level        int
  experience   bigint
  source       text    -- 'tarkov.dev' | 'game-profile' | 'manual' | 'mixed'
  updated_at   timestamptz default now()
  unique (user_id, game_id)   -- один профиль на игру (upsert)
```
DDL применяется **прямым SQL** (db:push требует TTY — memory `maps-drawer-unify`), не `push --force`.

## План (слоями)
- **A. Парсер+типы** ✅ (2026-08-17): `RawPlayerProfile.Hideout?`/`TradersInfo?`; `PlayerView` +
  `hideout[]`/`traders[]`; `normalizeProfile` извлекает if-present (defensive). `SKILL_CATALOG`
  (skill-icons.ts) — канон-список навыков без алиасов, база для ручного редактора.
- **B. Серверная персистенция** ✅ (2026-08-17, в проде): `schema-player-profile.ts` +
  `player-profile-ddl.ts` (накат `db:migrate-all` — таблица `cta_player_profiles`, unique
  `(user_id,game_id)`, RLS read); `db/player-profile.ts` (get/upsert owner-role); server-actions
  `save/loadPlayerProfileAction`; `lib/player-profile-sync.ts` (buildSnapshot/applySnapshot);
  hub/page.tsx грузит снапшот → `AdaptiveHubClient` применяет (сервер = точка истины) + one-shot
  миграция localStorage→сервер при первом логине; `DossierUploadBlock` сохраняет на сервер
  (залогинен) / призыв войти (аноним).
- **C. Ручной редактор** ✅ реализован локально (2026-08-17): секция «Ручной ввод прогресса» в Досье
  (свёрнута по умолчанию), группами — навыки по 4 категориям (`SKILL_CATALOG`) + станции убежища
  (`data/hideout-catalog.ts`, type→имя/max из `AREA_NAMES`) + трейдеры. Степперы −/число/+ с клампом.
  - **Стор** `useManualProfileStore` (persist `manual-profile-storage`): `{skills,hideout,traders}`.
  - **Трейдеры** — write-through в `usePlayerStore.traderLevels` (их читает весь сайт: бартеры/квест-мапа)
    + зеркало в `manual.traders` для снапшота (решение V4DYA 2026-08-17).
  - **Навыки/убежище** — мерж-слой поверх `view` (`lib/tarkov/player-view-merge.ts`,
    `resolveSkillLevel`/`resolveHideoutLevel`/`effectiveSkills`), last-write-wins, работает при `view=null`.
    `DossierPmcStats` показывает эффективные навыки (загруженные ⊕ ручные).
  - **Персистенция**: `buildSnapshot` авто-тянет `manual` из стора; `applySnapshot` гидрирует стор +
    накатывает ручных трейдеров в `traderLevels`. Правка → залогинен: дебаунс-save (700мс); аноним:
    localStorage + призыв войти.
  - ⚠ `maxLevel` станций — провизорный (живого профиля с Hideout нет), выверить при появлении сэмпла.

## Баг «стата сбрасывается при загрузке» + развязка двух систем (2026-08, RCA в браузере)
**Симптом:** залогинен, сейв «Сохранено в профиль», но на F5 detailed-стата (K:D, убийства, смерти,
выживания) → «—», хотя базовые поля (уровень, рейды, часы) держатся.

**Корень (не Слой B!):** параллельно жила ВТОРАЯ облачная система — **Слой 4d** (`PlayerProfileSync`
в layout + `/api/eft/player-profile` + таблица `player_profiles`), синкающая `usePlayerStore`
(мультипрофиль). На логине она async-GET-ит облако и `setState({profiles})` — целиком заменяя профиль.
А её схема (`PlayerProfilePersist` + `parseProfile`) была **урезана**: без `kills/deaths/kd/killed/
survived/experience/memberCategory` (добавили позже, забыли внести). GET возвращался ПОСЛЕ
`applySnapshot` и затирал аддитивную стату урезанной копией.

**Фикс (3 уровня):** (1) `PlayerProfilePersist` + `parseProfile` расширены аддитивными полями (JSONB
passthrough, миграции нет); (2) `PlayerProfileSync` **мержит** облако поверх локального (`{...local,
...cloud}`) — не теряет аддитивное, даже если облачная строка старая; проверено вживую: облако 4d
теперь хранит полный профиль.

**Развязка ответственности (убрана конкуренция систем):**
- **Слой 4d** (`PlayerProfileSync`, site-wide) = ЕДИНСТВЕННЫЙ владелец идентичности `usePlayerStore`
  (ник/уровень/K:D/трейдеры, мультипрофиль).
- **Слой B** (`cta_player_profiles` снапшот) сжат до уникального: рич-вью ЧВК (`usePmcStatsStore`:
  навыки/мастерство/рейды) + ручные оверрайды. `identity` из снапшота **удалён** (`PlayerProfileSnapshot`,
  `buildSnapshot`/`applySnapshot`, денорм в `db/player-profile.ts`) — больше не дублирует и не конкурирует.

## Открытые вопросы
- Полный игровой/SPT-профиль — поддержать импорт сразу (Hideout оттуда) или ручной ввод как единственный путь к убежищу на старте?
- Мультипрофиль (сейчас до 5 локальных) — на сервере один на игру или тоже слоты?
