---
status: 🟡 построено (ветка feat/billing-subscription-mgmt) + БД накатана на прод (migrate-all+db:sql+audit-rls, 2026-08-25); ждёт live-verify + merge в main
affects: monetization, billing, db, account, admin, gating
date: 2026-08-25
parent: [[monetization-subscriptions]]
build: autopilot (полный автомат), .autopilot/billing-subscription-mgmt/
---
# Биллинг и управление подпиской: админ гейтит любую фишку за динамические тиры

Реализация этапа **E4** из [[monetization-subscriptions]], доведённая до **системы управления**: маппинг «фича → тир» больше не хардкод, а редактируется админом из панели; сам набор тиров — динамический (создать/переименовать/переоценить/архивировать). Задел на мультигейминг. Provider-agnostic каркас биллинга под будущий эквайринг (рельс выбирает Дима — [[deep-research-payment-rails]]).

## Решения (грилл V4DYA, 2026-08-25)
1. **Модель доступа — лестница рангов.** `rank` — целое поле тира в БД (не CHECK). Доступ = `rank(userTier) ≥ rank(gateTier)`. Матрица прав (entitlement sets) — отложена; схема аддитивно к ней готова.
2. **Динамические тиры.** Таблица `tiers`. **free — неудаляемый пол** (rank 0, price 0): переименовать/наполнить можно, удалить/сделать платным — нельзя (серверная валидация + сид всегда восстанавливает канон). Удаление платного тира = **архив** (уходит из витрины, подписчики дослуживают `valid_until`, потом падают на free); физснос — только у тира без единой записи в леджере.
3. **Гейтинг двухуровневый, саморегистрирующийся.** (а) **Разделы** — из коробки: каждый узел `HEADER_DICTIONARY` с `path` → section-ключ `sec:<game>:<path>`, ноль кода. (б) **Фичи-точки** — разраб оборачивает `<Paywall gate="eft.flea.priceSync">` / `requireTier('...')`, ключ в `GATE_REGISTRY` (kind:'feature'), появляется в админ-матрице. Порог/поведение — из БД, дефолт из реестра (fail-safe).
4. **Поведение гейта — поле `behavior`** на точке: `lock` (апселл, дефолт) / `hide` (прячет из навигации + `notFound()` на прямой заход) / `teaser` (урезанная версия, где фича умеет деградировать).
5. **Мультигейм — C по схеме, A по запуску.** `tiers.game_id` и `subscriptions.scope_game_id` nullable (null = портальный). Гейт-ключи неймспейсятся по игре. Доступ к игровой фиче = `max(портальный тир, игровой тир)` (`effectiveRank`). На старте — только портальные тиры (free/operative/veteran).

## Схема БД (DDL-модули, накат — `/api/cron/migrate-billing` + db:push вручную)
- **`tiers`** (`src/db/tiers-ddl.ts`): id, slug (uniq), name, price, rank, game_id(null), archived, perks(jsonb), created/updated. Сид free(0)/operative(199,rank1)/veteran(449,rank2). RLS: select anon+authenticated (витрина), write owner.
- **`feature_gates`** (`src/db/feature-gates-ddl.ts`): feature_key pk, min_tier(→slug), behavior(CHECK lock/hide/teaser), enabled, updated_by, updated_at. Нет строки → дефолт из `GATE_REGISTRY`. RLS: select authenticated, write owner.
- **`billing_events`** (`src/db/billing-events-ddl.ts`): id, user_id(→profiles), provider, external_id, type(grant/payment/refund/renewal/downgrade), tier, amount(numeric→string), currency, status, raw(jsonb), created_at. `unique(provider,external_id) where external_id not null` — идемпотентность вебхука. RLS: select own, write owner.
- **`subscriptions`** — снят CHECK `subscriptions_tier_chk` (тиры динамические); добавлен `scope_game_id`(null).

## Слои кода
- **Данные/примитивы:** `src/db/billing.ts` — `getTiersFromDb/getGatesFromDb/upsertTier/archiveTier/deleteTier/upsertGate/writeBillingEvent/setUserTier(+extend)/tierHasLedgerRefs`. Drizzle-объекты `tiers/featureGates/billingEvents` в `src/db/schema.ts`.
- **Реестр:** `src/data/gate-registry.ts` — `GATE_REGISTRY` (10 фич 1:1 из старого FEATURE_MIN_TIER + kind:feature), `sectionGatesFromHeader()`, `allGateDefs()`, `defaultGate()`.
- **Чистый шов (доменная логика):** `src/lib/gating/tiers.ts` — `tierRankOf/meets/effectiveRank/isProtectedTier/canDeleteTier/validateTierEdit` (без БД/React — единственная точка для будущих тестов).
- **Разрешение (server):** `src/lib/gating/resolve.ts` — `resolveEntitlements/requireTier(behavior-aware)/getGateMap/getTiers(кеш+теги)/invalidateGating/serverEntitlementsSnapshot`.
- **Клиент:** `GatingProvider`/`GatingBoundary` (снимок в `app/layout.tsx`, без сети на каждый Paywall), `useEntitlements`, ребайнднутый `<Paywall gate|feature>` (10 старых вызовов целы), `tierMeta` (безопасный аксессор, открытый `TierId=string`).
- **Навигация:** `src/lib/gating/nav-visibility.ts` (`visibleForGate`), `SectionHubNav`/`SectionNavTab` (бейдж-замок), `MenuItem.gateKey?`. Демо серверного энфорса — `/eft/progress/loadouts(/find)`, `SectionPaywall` (RSC-safe).
- **Биллинг-каркас:** `src/lib/billing/adapter.ts` (`PaymentAdapter` + пустой `ADAPTERS` + TODO Дима), `POST /api/billing/webhook/[provider]` (нет адаптера→501, verify→401, идемпотентно, нерезолвленный юзер→422), `/api/cron/set-tier` пишет в леджер.
- **Админка:** `/admin/billing` (гард getAdmin) — матрица гейтов (тир+behavior+enabled, оптимистик, invalidateGating), редактор тиров (CRUD, free защищён), подписки юзеров (grant/extend/revoke по username), леджер (read-only). Роуты `/api/admin/{gates,tiers,subscriptions}`. Ссылка в `/admin` под `canManageCatalog`.

## Что осталось V4DYA
1. ✅ **Накат схемы — СДЕЛАНО** (2026-08-25, аддитивно без db:push --force): `db:migrate-all` (таблицы+сид тиров free/operative/veteran+альтер subscriptions) → `db:sql` (RLS) → `db:audit-rls` (66/66 таблиц с RLS). Проверено на проде: тиры засеяны, scope_game_id есть, CHECK снят.
2. **Live-verify:** задеплоить ветку (или смёржить) → `/admin/billing` под admin, матрица меняет тир → `<Paywall>` реагирует без деплоя; прямой запрос к гейтнутому API без тира → 403; вебхук-заглушка на неизвестный провайдер → 501.
3. **Merge в main** ветки `feat/billing-subscription-mgmt` (Vercel задеплоит прод).
4. **Платёжный провайдер** (Дима): один адаптер в `ADAPTERS` (ЮKassa/Prodamus/…), ключи в `.env`. Роут+леджер готовы.

Гоча наката: миграционный роут `/api/cron/migrate-billing` не понадобился — таблицы накатаны CLI-путём (`db:migrate-all`), т.к. session-пуллер доступен локально. Секции-гейты НЕ пресидятся (их нет в DDL-модуле) — это ОК: матрица показывает все разделы из реестра, строка в `feature_gates` создаётся при первом назначении тира.

## Долги (не блокеры)
- Хедер-меню (`layout/`) смонтировано вне `GatingBoundary` → фильтр навигации работает на секционной навигации; чтобы гейтить и хедер-меню — перенести `GatingBoundary` выше в `app/layout.tsx` (one-line).
- `UserSubsClient` не показывает текущий тир юзера до действия (нет GET-эндпоинта); `hasLedgerRefs` в UI по последним 50 событиям (сервер точнее — deleteTier→409).
- Массовая расстановка порогов по всем 31 фиче — продуктовое решение V4DYA в матрице (инфраструктура + миграция 10 гейтов 1:1 сделаны).
- Тестов нет (нет раннера, §7.2) — логика сосредоточена в чистом шве `src/lib/gating/tiers.ts` под будущие тесты.

---
*Процесс: [[engineering-loop]] · Родитель: [[monetization-subscriptions]] (этап E4) · Рельс: [[deep-research-payment-rails]] · Прогон: `.autopilot/billing-subscription-mgmt/`*
