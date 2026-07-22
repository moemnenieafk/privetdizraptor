---
title: Промты hero-баннеров билдов (NanoBanana)
section: progress / seasons / perks
purpose: image-gen prompts для спиннера курируемых билдов
format: 9:16 · 196×348px (рендерить x4 → 784×1392 и ужимать)
model: NanoBanana (Gemini 2.5 Flash Image)
tags:
  - eft
  - seasons
  - perks
  - assets
  - image-prompts
updated: 2026-07-22
---

# Hero-баннеры билдов · промты для NanoBanana

Баннеры для рулетки-спиннера курируемых билдов ([[eft/progress/seasons/perks.md]], `src/data/season-builds.ts`). Формат карточки **9:16, 196×348px**. Всего **21 билд**.

## Как пользоваться

1. **Единый базовый стиль** (`BASE`) копируется в КАЖДЫЙ промт без изменений — он держит весь сет в одном визуальном языке (одна рулетка = один стиль).
2. Дальше подставляется строка **`Focus:`** конкретного билда + акцентный цвет по вайбу.
3. Промты — **на английском** (модель так точнее). Названия билдов — русские, **в картинку НЕ пишем**.
4. **Текст-тайтл — в UI, не в картинке.** Кириллицу image-модель ломает. Низ баннера в `BASE` уходит в чёрное — туда UI кладёт короткий тайтл (`font-blender-medium uppercase tracking-widest`).
5. Рендерить в **×4 (784×1392)** и ужимать до 196×348 — на тамбнейле резче, шум/зерно не разваливаются.
6. Для консистентности сета — **один seed** на всю пачку (или соседние), одинаковый базовый стиль.
7. **Если модель ругается** («I don't seem to have access to that content») — убери из промта кровь, открытые раны, пытки/допрос и флирт/женские силуэты. Хардкор подаём через грязь, искры, пыль, потрёпанную экипировку и решимость, а не через насилие. Ниже проблемные промты уже переписаны в safe-редакции.

### Акцентный свет по вайбу (совпадает с чипом в UI)

| Вайб | Акцент-свет (`{ACCENT}`) |
|------|--------------------------|
| meta | warm amber-orange |
| speed | cold teal-blue |
| comfort | muted militia-green |
| pain | blood red |
| meme | electric violet |
| loot | dirty gold |

---

## BASE (префикс ко всем)

```
Vertical 9:16 poster (784x1392), hardcore tactical extraction-shooter key art
in the gritty aesthetic of Escape from Tarkov. Cinematic semi-realistic 3D
render with a hand-painted edge. Gloomy post-Soviet Norvinsk region: rusted
industrial steel, wet concrete, overcast haze, volumetric fog with god-rays.
Muted desaturated gunmetal-and-olive palette lit by a single {ACCENT} rim/accent
light. One bold central silhouette that stays readable at thumbnail size,
shallow depth of field, fine film grain, faint chromatic aberration, drifting
dust motes. Strong dark vignette; the bottom third fades to near-black empty
negative space reserved for a title overlay. Low-key dramatic lighting, moody,
high production value. No text, no letters, no logos, no watermark, no UI,
no frame, no border.
Focus: <см. билд>
```

---

## Билды

Легенда тона: 🎯 серьёзный · 🎭 мем · ⚖ микс.

### 1. `kappa-doorstep` — «Каппа с порога» · meta · 🎯⚖
**Короткий тайтл:** КАППА С ПОРОГА · `{ACCENT}` = warm amber-orange
> Focus: a rare hexagonal secure-container held aloft in a shaft of amber light on a grimy metal altar, a hooded PMC's gloved hands presenting it like a holy relic; mocking, almost sacred grandeur.

### 2. `all-in` — «Всё и сразу» · meta · ⚖
**Тайтл:** ВСЁ И СРАЗУ · amber-orange
> Focus: a ragged PMC half-buried under an avalanche of rare loot — secure container, bundles of keys, graphics cards, dog-tags — grinning through exhaustion with empty turned-out pockets; opulence and ruin at once.

### 3. `safecracker-shift` — «Медвежатник на смене» · speed · ⚖
**Тайтл:** МЕДВЕЖАТНИК · cold teal-blue
> Focus: extreme close-up of a worn gloved hand turning a brass key in a battered steel safe, a heavy key-ring and scattered rubles glinting, a hard-hat headlamp throwing teal light; blue-collar heist mood.

### 4. `average-joe` — «Середнячок с работой» · comfort · 🎭
**Тайтл:** СЕРЕДНЯЧОК · muted militia-green
> Focus: a tired everyman PMC in mediocre mismatched gear shrugging, holding a dented coffee thermos, faint half-filled skill bars frozen at the midpoint hovering behind him; deadpan office-worker energy.

### 5. `pain-department` — «Отдел страданий» · pain · 🎯🎭
**Тайтл:** ОТДЕЛ СТРАДАНИЙ · blood red
> Focus: a weathered PMC standing defiant in a harsh red-lit derelict room, cracked visor and battered mismatched gear, shoulders squared and fists clenched, sparks and dust swirling around him; stoic masochistic bravado — grit over gore.

### 6. `zero-sum` — «Ровно по нулям» · meme · 🎭
**Тайтл:** РОВНО ПО НУЛЯМ · electric violet
> Focus: a PMC balanced perfectly on a knife-edge beam like a tightrope walker, an old iron balance-scale beside him sitting dead level; clean symmetrical composition, zen amid chaos.

### 7. `therapist-affair` — «Особые отношения с Терапевтом» · meme · 🎭
**Тайтл:** РОМАН С ТЕРАПЕВТОМ · electric violet
> Focus: a PMC at a field-medic trader counter sealing a friendly deal with a firm handshake, stacks of medkits and bandages tagged with bright discount labels, a conspiratorial thumbs-up, warm violet light; wry dark humor of being the medic's favorite regular customer.

### 8. `bush-looter` — «Из кустов по лут» · loot · ⚖
**Тайтл:** ИЗ КУСТОВ · dirty gold
> Focus: a foliage-camouflaged PMC peering out from dense wet bushes, only eyes and a rifle muzzle visible, a bulging loot bag at his side catching warm gold light; patient predator.

### 9. `never-tired` — «Вечный движ» · comfort · ⚖
**Тайтл:** ВЕЧНЫЙ ДВИЖ · muted militia-green
> Focus: a PMC mid-sprint with strong motion-blur streaking across broken terrain, boots kicking up mud, a green rim-light trailing behind him; tireless kinetic momentum.

### 10. `soft-landing` — «Мягкая посадка» · comfort · ⚖
**Тайтл:** МЯГКАЯ ПОСАДКА · muted militia-green
> Focus: a PMC touching down softly from a jump like a cat, knees bending gracefully with no impact dust, a Scav in the misty background tossing him a wad of rubles; smooth and lucky.

### 11. `mosin-boyar` — «Мосинбоярин» · meme · 🎭🎯
**Тайтл:** МОСИНБОЯРИН · electric violet
> Focus: a bearded PMC posed like an old Russian boyar-tsar, cradling a battered Mosin bolt-action rifle across his chest like a scepter, a faint fur-collar imperial silhouette, candle-lit gloom; deadpan grandeur.

### 12. `champion-liver` — «Печень чемпиона» · meme · 🎭
**Тайтл:** ПЕЧЕНЬ ЧЕМПИОНА · electric violet
> Focus: a grinning PMC toasting the camera with a cheap juice box in one hand and a can of fish in the other, an EpiPen tucked in his rig, snack wrappers scattered around; reckless feast humor.

### 13. `sniper-tower` — «Снайперская вышка» · meta · 🎯
**Тайтл:** СНАЙПЕРСКАЯ ВЫШКА · warm amber-orange
> Focus: a lone sniper lying prone atop a tall rusted watchtower above a sea of fog, long bolt-action rifle, a single amber scope-glint piercing the dark; patient lethality.

### 14. `boar-tank` — «Ходячий кабан» · comfort · ⚖
**Тайтл:** ХОДЯЧИЙ КАБАН · muted militia-green
> Focus: a hulking heavyset PMC bruiser planted in the mud like a walking tank, massive shoulders, thick neck, unbothered scowl, boar-like heavy stance; immovable brute with a hint of humor.

### 15. `kappa-intact` — «Каппа без жертв» · loot · 🎯⚖
**Тайтл:** КАППА БЕЗ ЖЕРТВ · dirty gold
> Focus: a composed professional PMC with a rare secure container on a full intact chest rig, calmly carrying stacked loot cases in both arms, warm gold light; the have-it-all operator.

### 16. `ghost-exit` — «Тихий выход» · speed · 🎯⚖
**Тайтл:** ТИХИЙ ВЫХОД · cold teal-blue
> Focus: a semi-translucent ghostly PMC slipping through thick extraction fog toward a faint teal EXIT glow, footsteps leaving no trace; silent, spectral, weightless.

### 17. `passive-income` — «Пассивный доход» · loot · 🎭
**Тайтл:** ПАССИВНЫЙ ДОХОД · dirty gold
> Focus: a relaxed PMC lounging on a crate like a crime boss while rubles rain down and two Scavs hand over stacks of cash as tribute, gold light and drifting dust; effortless mafia-don swagger.

### 18. `field-medic` — «Полевой медик» · comfort · ⚖
**Тайтл:** ПОЛЕВОЙ МЕДИК · muted militia-green
> Focus: a battlefield-medic PMC with a red-cross armband kneeling in the fog, wrapping a fresh clean bandage around his own forearm, a scatter of used medkits and a juice box clipped to his rig, green light; heroic-yet-doomed irony of the medic who patches everyone but himself.

### 19. `foreman` — «Прораб без бумажек» · loot · 🎭⚖ *(новый)*
**Тайтл:** ПРОРАБ · dirty gold
> Focus: a PMC in a battered hard hat standing on a hideout construction site, rolled blueprints under one arm, rebar and wet concrete and stacked rubles around him, keys on his belt; blue-collar empire-builder crossed with a soldier.

### 20. `barefoot-infantry` — «Босая пехота» · speed · 🎯⚖ *(новый)*
**Тайтл:** БОСАЯ ПЕХОТА · cold teal-blue
> Focus: a lightly-equipped armorless PMC charging across muddy terrain hauling a heavy weapon crate on one shoulder, no body armor, raw and rugged, cold teal storm light; mobility over protection.

### 21. `black-division-assault` — «Штурм Чёрной дивизии» · meta · 🎯 *(новый)*
**Тайтл:** ШТУРМ · warm amber-orange
> Focus: a determined PMC surging forward through a breach of smoke, sparks and swirling dust, weapon shouldered, dynamic forward lunge, warm amber light flaring through the fog with faint shadowy silhouettes ahead; high-adrenaline assault energy.

---

## Следующий шаг (код)

Чтобы спиннер подхватил баннеры, в `CuratedBuild` (`src/data/season-builds.ts`) добавить:
- `banner: string` — путь к картинке (напр. `/images/eft/seasons/kord-breach/builds/<id>.webp`);
- `short: string` — короткий тайтл-оверлей (см. «Тайтл» выше).

Складывать ассеты в `public/images/eft/seasons/kord-breach/builds/`. Скажи — заведу поля + отрисовщик тайтла в рулетке.

## Связанное
- [[eft/progress/seasons/perks.md]] — раздел и конструктор
