---
status: ✅ сделано
affects: account, tracking, items
date: 2026-07-04
done: 2026-07-04
---
# Трекинг: Избранные предметы (плитки EftItemTile)

> [!success] Закрыто 2026-07-04 (ревизия 2026-07-14)
> Проверено в коде: `GET /api/eft/prices?ids=`, `account/TrackingFavoritesDigest.tsx`, суб-таб «Избранное».


## Цель
Домен «Избранное» во вкладке «Трекинг» ([[player-tracking-tab]]): предметы, отмеченные ★ в каталоге, — полноценными плитками `EftItemTile` (иконка, тинт, цены трейдер/барахолка) с живыми ценами из НАШЕГО зеркала. Личный «прайс-борд» игрока.

## Развилки — ЗАКРЫТЫ V4DYA (2026-07-04, Q&A)
| Развилка | Решение |
|---|---|
| Цены client-side | **Новый GET `/api/eft/prices?ids=`** поверх готового `getEftPricesByIds` (наше зеркало; избранное в localStorage — сервер ids не знает). Без миграций |
| Облачный синк избранного | **Отложить** — v1 локально (`useFavoritesStore`, ключ `cta-favorites`); синк между устройствами — отдельной задачей (таблица + RLS + роут + провайдер по паттерну достижений) |
| Вид | **Сетка 1/sm:2/xl:3**, полный компаунд `EftItemTile` (Header+Media+Name+Pricing, как SimilarItems); мобилка — канон (плитка ≤256px по центру); **кнопка «СБРОС ИЗБРАННОГО»** (модалка, `clearFavorites`) + CTA «Каталог»; загрузка — `animate-pulse` скелеты (не спиннеры) |

## Контекст
- Стор ЕСТЬ: `src/store/useFavoritesStore.ts` (`favoriteIds`, `toggleFavorite`, `clearFavorites`; persist `cta-favorites`). Звёзды уже в `EftItemTile.Header` + `FavoritesStrip`.
- Серверные читалки ЕСТЬ: `getEftPricesByIds` (`src/db/prices.ts`) + каталог `items` (имя/размеры). Роут собирает готовые `EftItemData[]` (маппинг цен как `toSimilarEftItem` в item detail page).
- `cta-favorites` НЕ в PROGRESS_KEYS — сброс прогресса игры избранное не трогает (это не прогресс). Отдельная кнопка сброса — в домене.

## План
1. `src/app/api/eft/prices/route.ts` — GET `?ids=a,b,c` (кап ~200): items+prices → `EftItemData[]` (pricing: лучшие traderBuy/fleaBuy/traderSell/fleaSell; без topStat/индикаторов — дайджест).
2. `src/app/account/TrackingFavoritesDigest.tsx` — favoriteIds (mounted-гард) → fetch роута → сетка `EftItemTile` компаундом; скелеты `animate-pulse`; пусто → CTA «Каталог» (`/eft/items`); счётчик + «СБРОС ИЗБРАННОГО» (ResetControl).
3. `TrackingPanel` — суб-таб «Избранное» (после «Предметы»).
4. `tsc` → приёмка → коммит.

## Критерий готовности
- [*] `tsc` чисто; ★ в каталоге → плитка появляется во вкладке с ценами из зеркала
- [*] Снятие ★ (в каталоге или на плитке вкладки) — синхронно; сброс чистит всё
- [*] Пусто → CTA; скелеты при загрузке; мобилка не ломается

## Гарды
- БД/миграции не трогаем; роут read-only поверх зеркала. Коммит по «ок».

---

## Исполнено (2026-07-04) — на приёмке
`tsc` чисто, БД/миграции не тронуты.
- **Новый `GET /api/eft/prices?ids=`** (`src/app/api/eft/prices/route.ts`): read-only поверх зеркала (items + `getEftPricesByIds`), валидация 24-hex, кап 200, отдаёт готовые `EftItemData[]` (лучшие traderBuy/fleaBuy/traderSell/fleaSell; порядок = порядок ids).
- **Новый `src/app/account/TrackingFavoritesDigest.tsx`**: счётчик + «СБРОС ИЗБРАННОГО» (модалка) + CTA «Каталог»; скелеты `animate-pulse`; сетка 1/sm:2/xl:3 (мобилка ≤256px по центру) полным компаундом `EftItemTile` — **звезда в Header плитки на общем сторе: снятие ★ прямо во вкладке живьём убирает плитку** (без рефетча — локальный фильтр); пусто → CTA.
- Суб-таб «Избранное» (после «Предметы», иконка lucide Star — маски-звезды в icons.css нет; рендер табов расширен под этот случай).

---
*Хаб: [[player-tracking-tab]] · Процесс: [[engineering-loop]]*
