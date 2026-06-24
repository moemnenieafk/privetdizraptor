# Спринт: Безопасность + Account Center на реальном auth

> **Статус:** Фаза 0 ✅ (`5afae97`) · Фаза 1 ✅ (`87ea6c9`) · Фаза 2 игровые профили ✅ (`b2dddfc`, в проде) · Фаза 2-идентичность ✅ (логин/email/пароль/аватар на реальном auth, db:sql накачен, security-review пройден — НЕ закоммичено). Осталось: Фаза 3 (OAuth) + 3 ручных шага Вадима в Supabase Dashboard (см. ниже).
> **Владелец:** бэкенд-сессия. Документ-handoff — читать первым при возобновлении.
> Контекст глубже: auto-memory `[[sprint-backend-state]]`, `[[project-cta-backend]]`, скилл `cta-backend`.

## Решения (зафиксированы)
1. **Игровые профили — ГИБРИД** (localStorage остаётся источником + синк в Supabase при логине, по паттерну `ProgressSync`/`useGamificationSync`). Не «только БД», не «только локально».
2. **Исполнение — ФУЛЛСТЕК** силами бэкенд-сессии: и серверные куски, и проводка UI (хедер, формы, гард роута).

---

## Грунт: что показали две разведки (2026-06-23)

### 🔒 Безопасность

**Уже крепко (НЕ переделывать):**
- RLS на ВСЕХ публичных таблицах: каталог (`games`/`items`/`item_categories`/`item_properties`/`prices`/`barters`/`crafts`/`achievements`/`maps`/`traders`) — read-only; `profiles` — select всем, update/insert только владельцу; `quest_progress`/`barter_progress` — owner-only (`auth.uid() = user_id`).
- Админ-гард двухуровневый: `/admin/layout.tsx` (`getAdmin()` → редирект) + проверка роли в `PUT /api/admin/items/[id]` (403). Роль в `profiles.role`.
- `SUPABASE_SERVICE_ROLE_KEY` — только в скриптах (`scripts/upload-icons.ts`, `scripts/make-admin.ts`), в рантайм-роутах НЕ инстанцируется (везде anon-ключ). Корректно.
- SSR-сессии по best-practice: `middleware.ts` рефрешит сессию (`getUser`) до остальной логики, cookie-хендлеры изолированы.
- `GET/PUT /api/eft/progress` и `/api/eft/barter-progress` — требуют сессию (`currentUserId()` → 401), плюс RLS по `user_id`.

**❗ Ложная тревога (снято):** разведка пометила «секреты закоммичены в `.env.local`». ПРОВЕРЕНО: `.env.local` НЕ в индексе git, gitignored (`.gitignore:40 .env*`), в истории отсутствует. Реальный security-долг — ротация ключей после старого лика в `!future-requests/` (ручное действие Вадима).

**Реальные дыры в коде (дёшево чинятся) → Фаза 0:**

| # | Sev | Что | Файл |
|---|---|---|---|
| S1 | MED | **Open redirect**: параметр `next` в auth-роутах не валидируется (`?next=//evil.com` уведёт после логина) | `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts` |
| S2 | MED | **Крон fail-open**: при незаданном `CRON_SECRET` эндпоинт открыт, любой триггерит запись в БД | `src/app/api/cron/sync-prices/route.ts:16` |
| S3 | MED | **`/api/profile-ocr` без авторизации** + шлёт картинку в платный Gemini → спам = счёт | `src/app/api/profile-ocr/route.ts` |
| S4 | — | 🔑 Ротация ключей Supabase (+ обновить Vercel/GH env) | *действие Вадима* |
| S5 | LOW | Нет rate-limit на публичных эндпоинтах | `src/app/api/*` |

### 👤 Account Center — главный вывод

**Это красивый мокап на 100% zustand/localStorage.** Реальный auth существует, но в UI кабинета/хедера НЕ подключён:
- `isAuthenticated` в хедере — демо-флаг; email/пароль в AccountCenter захардкожены; кнопки форм без обработчиков; роут `/account` не защищён server-side.
- Игровые профили (ник/уровень/prestige/edition/фракция/режим/уровни торговцев) — только `localStorage['player-profile-storage']` → **теряются при выходе/смене устройства**. До 5 профилей, один активный.

**Что УЖЕ ходит в реальный auth (готовый паттерн для переиспользования):**
- `ProgressSync` (`src/components/providers/ProgressSync.tsx`) — квест-прогресс localStorage ↔ `quest_progress` по сессии.
- `useGamificationSync` (`src/hooks/useGamificationSync.ts`) — бартер-XP localStorage ↔ `barter_progress`.
- `useUser()` (`src/hooks/useUser.ts`) — клиентский хук «текущий юзер» (есть, но в кабинете/хедере НЕ используется).

**Ключевые файлы:**
| Путь | Роль | Сейчас |
|---|---|---|
| `src/app/account/AccountCenter.tsx` | главный UI кабинета (5 вкладок) | zustand-мокап |
| `src/app/account/AccountHeader.tsx` | шапка кабинета | юзер из zustand |
| `src/store/usePlayerStore.ts` | игровые профили | localStorage, без БД |
| `src/components/layout/header-modules/PlayerTelemetry.tsx` | хедер-виджет | zustand + демо-auth |
| `src/components/layout/header-modules/ProfileSettingsModal.tsx` | редактор профиля (+OCR) | форма → zustand |
| `src/hooks/useUser.ts` | реальный auth-чек | НЕ подключён к UI |
| `src/db/schema.ts` (`profiles`) | id=auth.users.id, username, avatarUrl, role | есть |

---

## План спринта

### Фаза 0 — Security quick-wins  `[✅ ГОТОВА 2026-06-24, коммит 5afae97]`
- **S1 ✅** — хелпер `src/lib/auth/safe-next.ts` `safeNext(next)` (только относительный путь с одним ведущим `/`; режет `//`, абсолютные URL, backslash) → применён в `callback` + `confirm`. Юнит-тест 9/9.
- **S2 ✅** — крон **fail-closed**: `if (!secret || header !== Bearer) → 401` (`sync-prices/route.ts`). Раньше пустой env пропускал всех.
- **S3 ✅** — `/api/profile-ocr`: гейт сессии (`getUser` → 401, выбор Вадима «жёстко: только сессия») + валидация `mimeType` (png/jpeg/webp). Rate-limit (S5) отложен.
- **S4** — *(Вадим)* ротация ключей — НЕ сделано (действие владельца).

### Фаза 1 — Реальная личность в UI  `[фуллстек]`
- Server-гард `/account` (`createClient()`→`getUser()` → редирект `/login`).
- Хелпер «me»: сессия + строка `profiles` (username/avatarUrl/role) + email из auth.
- `PlayerTelemetry`: `isAuthenticated` ← `useUser()` (не демо); показ реального юзера; sign-out → `/auth/signout`.
- `AccountCenter`: реальный email/username/avatar вместо захардкоженных.

### Фаза 2 — Персистентность  `[фуллстек]`
**Аккаунт-идентичность (`profiles`) — ✅ ГОТОВО (2026-06-24, db:sql накачен, security-review пройден):**
- ✅ `PUT /api/account/username` — валидация 3–15 `[A-Za-z0-9_-]`, кулдаун 2 мес (`profiles.usernameChangedAt`), уникальность case-insensitive: app-level 409 + **DB unique-индекс** `profiles_username_lower_uniq` (ловит гонку, catch 23505).
- ✅ `POST /api/account/avatar` — клиентский canvas-кроп → webp → заливка СЕССИОННЫМ клиентом в `cta-media/avatars/{uid}.webp` (RLS `auth.uid()`, service-key в рантайме НЕ трогаем). Серверная валидация: Content-Length 413, тип/размер ≤500КБ, magic-byte RIFF/WEBP. → `profiles.avatarUrl` (+cache-bust).
- ✅ `POST /api/account/email` — `auth.updateUser({email})`, подтверждение Supabase. `POST /api/account/password` — `resetPasswordForEmail` на e-mail **из сессии** (анти-абьюз) → новая страница `/reset-password` (фолбэк на `?code=`).
- ✅ Решение по паролю: **сброс по e-mail** (как мокап), не updateUser-на-месте. Аватар: **кроп/масштаб сейчас** (canvas). Выбор Вадима.
- Файлы: `src/app/api/account/{username,email,password,avatar}/route.ts`, `src/app/reset-password/*`, `src/lib/cta-api.ts` (обёртки), `src/lib/auth/me.ts` (+usernameChangedAt), `src/app/account/AccountCenter.tsx` (живые формы), `supabase/account-identity.sql`, `src/db/schema.ts`.

**⚠️ 3 ручных шага Вадима в Supabase Dashboard (без них письма сброса/смены email ведут в никуда):**
1. **Email-шаблоны** Auth → Email Templates: **Reset Password** и **Change Email Address** должны зеркалить magic-link (token_hash) — вести на `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` (и `type=email_change`) с `next={{ .RedirectTo }}`. *(Для пароля есть фолбэк `?code=`, для email — нет, шаблон обязателен.)*
2. **Redirect URLs** Auth → URL Configuration: добавить `/reset-password` (и `/account`).
3. (опц.) Свой SMTP — иначе общий лимит Supabase единственный бэкстоп против email-абьюза (см. ниже).

**Security-review (multi-agent, 17 находок / 9 подтв.) — что НЕ закрыто (осознанно, в рамках отложенного S5 rate-limit):**
- `POST /api/account/email` шлёт письмо-подтверждение на адрес ИЗ ТЕЛА (так устроена смена email в Supabase) → потенциальный email-relay/исчерпание квоты. Бэкстоп — встроенный rate-limit Supabase. Приоритетная цель, когда возьмёмся за S5: per-user кулдаун смены email (зеркало username-кулдауна) + свой SMTP.

**Игровые профили (ГИБРИД, паттерн `ProgressSync`) — ✅ ГОТОВО (2026-06-24, коммит `b2dddfc`, в проде):**
- ✅ Таблица **`player_profiles`** (PK user+game, jsonb `profiles[]`+`activeProfileId`) + RLS owner-only (`supabase/player-profiles-rls.sql`). db:push+db:sql выполнены, round-trip кириллицы проверен.
- ✅ `GET/PUT /api/eft/player-profile` (сессия→401, cap 5, валидация) + `cta-api` `getCtaPlayerProfile`/`saveCtaPlayerProfile`.
- ✅ `<PlayerProfileSync/>` в `layout.tsx` (гибрид: облако главнее, debounced 1.2с). Работает на реальной Supabase-сессии независимо от демо-флага хедера. Форму стора не трогал.

### Фаза 3 — OAuth / линковка  `[опц., нужны ключи]`
- *(Вадим)* создать приложения Discord/Twitch → client id/secret в Supabase → Auth → Providers (+ те же ключи в Vercel env).
- Вкладка линковки платформ → реальные `supabase.auth.linkIdentity` / `unlinkIdentity`. Steam отложен (OpenID, не нативен Supabase).

---

## ⚠️ Координация (общее дерево с фронт-сессией)
- Фуллстек = бэкенд-сессия трогает **фронт-файлы** (`AccountCenter.tsx`, `usePlayerStore.ts`, `header-modules/*`), которые фронт-сессия активно правит. Чтобы не конфликтовать: **Фазы 1–2 (UI) начинать после того, как фронт-сессия закоммитит текущий заход по этим файлам.**
- `src/db/schema.ts` + `db:push` ведёт ТОЛЬКО бэкенд-сессия (после push — сразу `db:sql`, иначе снесёт RLS/триггеры).
- Все коммиты — через изолированный `git worktree` (см. скилл `cta-backend`, gotcha про общее дерево).

## Порядок выполнения
**Фаза 0** (безопасна прямо сейчас, независима от фронта) → деконфликт с фронт-сессией → **Фаза 1** → **Фаза 2** → **Фаза 3** (опц.).

## Точка возобновления
Фазы 0/1/2/2-идентичность ✅ закрыты (код + db:sql + security-review). **НЕ закоммичено** — закоммитить через изолированный worktree (см. скилл `cta-backend`, gotcha про общее дерево). Дальше — **Фаза 3** (OAuth Discord/Twitch — нужны ключи Вадима) + 3 ручных шага в Supabase Dashboard (email-шаблоны / redirect URLs / SMTP — см. блок Фазы 2). S4 ротация ключей — действие Вадима. Отложенный долг: S5 rate-limit (приоритет — кулдаун смены email).
