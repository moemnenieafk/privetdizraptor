---
status: ✅ сделано
affects: egress, prices, infra
date: 2026-06-28
done: 2026-06-28
---
# Снижение DB-egress: кэш + частичная выборка цен + пререндер

**Статус:** ✅ сделано (2026-06-28) — Фаза 1 + Фаза 2.
**Затрагивает:** `src/db/prices.ts` · `src/lib/server-cache.ts` · `eft-category` · `indicators` · поиск/деталь/контекст/бартер-квест · `[...category]`

## Контекст
После переноса иконок на R2 (см. [[icon-hosting-r2]]) остался вторичный egress — серверные чтения прайс-таблицы. `getEftPriceMapFromDb()` = полная таблица `prices` **~5.5 МБ** (замерено), тянулась на каждый вызов многими потребителями (server-actions на каждый запрос, динамические страницы).

## Решение
1. **In-memory TTL-кэш** (`server-cache.ts` → `memoTTL`). `unstable_cache` не годится: 5.5 МБ > лимита Vercel Data Cache (2 МБ) → молча не кэшировалось бы. Кэш в памяти инстанса, dedup in-flight, ошибки не кэшит.
2. **Частичная выборка** вместо всей карты:
   - `getEftPricesByIds(ids)` — по списку id
   - `getEftPriceBySlug(slug)` — slug→id+цена
   - `getEftPricesByCategory(cat)` — «похожие»
   - `getEftPriceIndex()` — лёгкий индекс (без `sellFor`/`buyFor`, ~0.6 МБ, кэш)
3. **Пререндер** динамических ценовых страниц где уместно.

## Миграции
| Потребитель | Было | Стало |
|---|---|---|
| Поиск (`search-actions`) | вся карта | индекс (корпус) + by-id (`sellFor` топ-12) |
| Деталь предмета (`item/[slug]`) | вся карта | by-slug + by-id + by-category |
| `tarkov-context` | вся карта | лёгкий индекс |
| `getBartersByQuest` (questmap, task) | вся карта | лёгкий индекс |
| Категории `/eft/items/[...category]` | динамика, 5.5 МБ/запрос | **PRERENDER** + revalidate=3600 (`loadEnriched`/`getEftIndicatorsFromDb` мемоизированы → билд не 76×) |
| `tarkov-supply` | вся карта | оставлено (скорит ВСЕ для топ-12, нужен `sellFor`; in-memory кэш) |
| barters / loot-rate / price-slot / questmap / progress/* | — | уже **PRERENDER** (билд-тайм) |

## Результат
Единственный рантайм-потребитель полной карты — `tarkov-supply` (кэширован). Остальное — точечно (by-id/slug/category/индекс) или статикой. `tsc` чисто; прод проверен (категории PRERENDER + корректные счётчики: gear 739, weapons 168, …).

## Бэклог
- `tarkov-supply` можно увести в крон-предрасчёт топ-12 (тогда и его полная карта уйдёт из рантайма).
