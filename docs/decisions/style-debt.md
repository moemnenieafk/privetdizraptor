---
status: 🔵 обдумываю
affects: NIGHTFALL, ui
date: 2026-06-26
---

# Стиль-долг (NIGHTFALL)

**Статус:** 🔵 обдумываю
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

## Вывод
*(заполнить)*
