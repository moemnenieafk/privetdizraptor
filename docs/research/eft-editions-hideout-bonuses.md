---
type: research
topic: Escape from Tarkov editions — hideout/stash bonuses
date: 2026-08-21
method: deep-research (fan-out + adversarial verify); synthesis step aborted on session limit — findings below are the individually-verified claims
consumed-by: src/lib/hideout-edition.ts (editionFloor)
---

# EFT: издания и бонусы для Убежища (Схрон + предпостроенные модули)

Собрано deep-research'ем 2026-08-21. Приоритет — офиц. вики EFT и BSG-справка. Синтез-шаг
упал на лимите сессии, поэтому ниже — **индивидуально верифицированные** утверждения (голоса
адверсариал-проверки), а не слитый нарратив.

## Стартовый размер Схрона по изданию (ПОДТВЕРЖДЕНО)

| Издание | Схрон (ячейки) | → уровень модуля Схрон | Голоса |
|---|---|---|---|
| Standard | 10×30 | **L1** | 2-1 |
| Left Behind | 10×40 | **L2** | 3-0 |
| Prepare for Escape | 10×50 | **L3** | 3-0 |
| Edge of Darkness | 10×68 | **L4** (макс. модуля) | 3-0 |
| The Unheard | 10×72 | **L4** + бонус-ячейки сверх макс. | 3-0 |

Размеры ячеек — прямые цитаты BSG-справки (`arena.tarkov.com/support/knowledge/529`) и dotesports.
Маппинг размер→уровень модуля Схрона (1-4) — вывод: у станции Схрон 4 уровня, издания стартуют с
разного. Unheard (10×72) > макс. уровня модуля (10×68) — лишние ячейки это отдельный бонус издания,
в терминах уровней модуля = L4 (макс).

## Прочие подтверждённые факты

- **Edge of Darkness снят с продажи** навсегда (BSG), но существующие владельцы **сохраняют бонусы и EoD-статус** через текущий вайп и далее (ggrecon, 3-0 / 2-1).
- **The Unheard**: гамма-контейнер 3×3 независимо от BEAR/USEC + weapon case + scav junk box + ammo case (dotesports, 2-0).
- Младшие издания (Standard/LB/PFE) получили увеличенный стэш и опцию отдельной покупки PvE-режима (forbes, 2-0).

## Круг сектантов (Cultist Circle) — НЕ доверифицировано

Утверждения «TUE даёт предпостроенный Круг сектантов» и «Круг — обычный строимый модуль для всех
изданий» **оба остались unverified** — голоса адверсариал-проверки упали на лимите сессии (errored,
НЕ опровергнуты). Известный факт EFT (перк The Unheard: «Cultist Circle will be built in the Hideout»)
+ утверждение V4DYA → в коде оставлен `TUE → cultist-circle L1`. **Перепроверить при след. ресёрче.**

## Источники

- BSG support: https://arena.tarkov.com/support/knowledge/529
- dotesports (Unheard items): https://dotesports.com/general/news/all-items-and-boosts-in-escape-from-tarkovs-unheard-edition
- ggrecon (EoD): https://www.ggrecon.com/guides/escape-from-tarkov-edge-of-darkness/
- forbes (EoD free features): https://www.forbes.com/sites/mikestubbs/2024/05/01/escape-from-tarkov-eod-owners-get-new-features-free-after-outrage/

## Как учтено в коде

`src/lib/hideout-edition.ts` → `editionFloor(station, edition)`:
```
Standard: { stash: 1 }, LB: { stash: 2 }, PFE: { stash: 3 },
EOD: { stash: 4 }, TUE: { stash: 4, 'cultist-circle': 1 }
```
`built()` в HideoutBuildTracker и чтение уровней в NeededMergedClient берут `max(сохранённый, editionFloor)`.
