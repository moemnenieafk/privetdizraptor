---
status: ✅ решено (архитектурно)
affects: account, auth, architecture
date: 2026-06-26
done: 2026-06-28
---
# Supabase JWT ES256 / data-plane RLS — решено архитектурно

> [!success] Закрыто 2026-06-28 (ревизия 2026-07-14)
> Закрыто: рантайм на Drizzle/service-role, client-RLS не используется. Проверено в коде: `api/account/avatar` — service-role роут.


**Статус:** ✅ решено 2026-06-28 — не платформенным фиксом, а узакониванием обхода как архитектуры (выбор V4DYA). 🔴 в роадмапе снят.
**Затрагивает:** [[account-real-data]]

## Проблема (латентный долг, НЕ активный блокер)
Включены Supabase «JWT signing keys» → юзер-токены получают `kid`, и data-plane (Storage/PostgREST) перестаёт валидировать их для RLS → `auth.uid()` = NULL → RLS-политики режут операции через supabase-js с юзер-сессией (403). Баг **alg-независимый**: откат на Legacy HS256 уже пробовали — не помогло. «Правильный» фикс (вкладка Legacy JWT Secret / тикет Supabase) платформенно неточный и, как оказалось, не нужен — см. решение.

## Решение (архитектура доступа к данным)
ЦТА **не полагается на client-side RLS через supabase-js**. Правило:
- **Чтение/запись данных** — через **Drizzle (owner-роль, мимо RLS)** в RSC/роутах.
- **User-scoped Storage/записи** (аватар и т.п.) — через **service-role API-роут**, где безопасность держит сам роут: сессия (`getUser`→401) + ключ/скоуп жёстко из `user.id` сессии (не из тела). Образец: `src/app/api/account/avatar/route.ts`.
- **supabase-js** — только для **auth-сессии** (`getUser`/login), НЕ для RLS-данных.

Почему ок: проект — агрегатор, весь рантайм и так на Drizzle; единственная Storage-операция (аватар) закрыта безопасным service-role роутом. Client-side RLS не нужен.

## Если когда-нибудь понадобится client-RLS
(real-time с RLS, прямые client-загрузки в Storage, UGC) — тогда вкладка Legacy JWT Secret / тикет Supabase. До тех пор долг закрыт by-design.

→ Гочи и история диагностики: память [[supabase-jwt-es256-dataplane]].
