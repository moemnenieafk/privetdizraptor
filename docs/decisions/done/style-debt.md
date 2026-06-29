---
status: ✅ сделано
affects: NIGHTFALL, ui
date: 2026-06-26
done: 2026-06-28
---

# Стиль-долг (NIGHTFALL)

**Статус:** ✅ сделано 2026-06-28 — гибрид: механика (`b6c90a8`) + типы (`c365f63`).
**Затрагивает:** [[snapshot-2026-06]]

## Контекст
Накопленный долг против правил:
- **`any`** — 8 шт / 4 файла: `actions/youtube.ts:38`, `useItemsFilter.ts` (×4), `ItemTile.tsx:27`, `AchievementsClient.tsx` (×2).
- **`font-mono`** (бан) — 7 файлов: `AccountCenter` (×8), `AccountHeader`, `RarityBadge`, `SearchEmptyState`, `TacticalTelemetryCard`, `TelemetryDetailsClient`, `AchievementsClient` → `font-blender-medium`.
- **Сырой HEX** в классах: `AccountCenter` (`bg-[#9146FF]/10`), `ProfileSettingsModal` (градиент). HEX в inline/градиентах: QuestNode, ItemModules, QuestCard, Header, QuestMapClient. Словари цветов (`traderColors.ts`, BSG-фоны) — спорно, это данные.
- **`rounded-[Npx]`** — 6 шт → `rounded-xs`.

## Вопросы
- Делать одним заходом `/tw-fix` + `/refactor` или дробить по файлам?
- Цвета-данные (словари) — выносить в токены или оставить как данные? (граница «верстка vs словарь»)
- `any` в `useItemsFilter` — ввести нормальные типы item-полей (Discriminated Union из `item_properties`)?

## За / Против
| | За | Против |
|---|---|---|
| Один большой проход | Долг закрыт разом | Большой diff, риск регрессий |
| По файлам/итерациям | Контролируемо, легко ревьюить | Долго тянется |

## Вывод (сделано)
Гибрид-подход (механика батчем + `any` аккуратно), 2 коммита:
- **Механика** (`b6c90a8`): `font-mono` ×17 → `font-blender-medium`; `rounded-[1px]` ×4 → `rounded-xs` (`rounded-[3px]` ×2 — легит arbitrary, оставлены).
- **`any`** (`c365f63`): типизированы `useItemsFilter` (+ ФИКС бага vps-сортировки: `.width/.height` → `gridWidth/gridHeight`), `youtube`, `AchievementsClient`, `ItemTile`; новый `ItemBuyOffer` + опц. `types/buyFor` в `BaseItemMetadata`.

Развилки:
- **Бренд-цвета** (Twitch/YouTube/Discord/Steam) — оставлены как ДАННЫЕ, фон через inline-style (внешние бренды ≠ NIGHTFALL-токены).
- **Цвета-словари** (traderColors и т.п.) — не трогали (это данные).
- **Подход** — гибрид.

Проверка: `tsc` чисто; счётчики `font-mono` / `rounded-[1px]` / `HEX-в-классах` / `any` → 0.
