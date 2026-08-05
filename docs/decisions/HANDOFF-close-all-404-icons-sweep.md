# СВИП: закрыть ВСЕ 404 иконок EFT (self-render) — HANDOFF для нового чата

> Вызвать: открой этот файл и скажи «добиваем 404-свип». Опирается на скилл `/game-asset-extraction` (Гейт-3 РЕШЁН).
> Подготовлено 2026-08-04. V4DYA выбрал **вариант B (поштучно, правильно)** свежим заходом — авто-резолвер даёт МУСОР (мапит броню в патроны), в прод так нельзя.

> ## 🔴 ТЕКУЩЕЕ СОСТОЯНИЕ (2026-08-05) — ОСТАЛОСЬ **9**
> **Оружие ЗАКРЫТО (7/7). Вода ЗАКРЫТА.** Осталось 9 «прочего»: **8 брони-скинов + Admin's key** — ВСЕ 9 требуют решения/глаза V4DYA (см. **✅ ПРОДОЛЖЕНИЕ-4**). Автономный остаток исчерпан: вода была последней «фикс-пайплайна» дырой.
> Движок многопроходной сборки + инструменты в git: коммит **`760acde6`** → `origin/autopilot/road-to-release` (PR в main не открыт). Скилл `/game-asset-extraction` прокачан (многопроходность, реконструкция, `dump_slots.py`) — держится локально.
> Свежий дифф-критерий: `node scripts/icon-render/diff_r2_missing.mjs` (было 60 → **9**).

## ✅ ПРОДОЛЖЕНИЕ-4 (2026-08-05, этот чат) — вода ЗАКРЫТА, осталось 9
- **Bottle of Ymxc Water `6a3557f8` ✅ ЗАЛИТА ПРАВИЛЬНО** (R2 HTTP 200, 1:1 с игрой). ⚠ Сперва залил НЕВЕРНО: name-матч «water bottle» → `item_water_bottle` (бутылка АКВА) — V4DYA поймал по скрину. Реальный предмет = **Aquamari со скин-принтом YMXC (油腻香车, скелеты)**, бандл `item_filterbottle/item_drink_water_skeleton_loot.bundle`. Понадобились ТРИ фикса:
  1. **Бандл:** food/drink превью-модель в **`_loot`**, не `_container` (в `_container` hands-префаб без PreviewPivot). Скип физ-прокси `collider`/`collision` в `extract_item.py` (лут-модель еды несёт видимый GO «collider»).
  2. **`extract_item.py` material-скоринг:** ОДИН меш (`item_filterbottle_LOD0`) нёс ДВА материала — белую базу и скин-принт `item_drink_water_skeleton`. Дедуп по имени меша брал первый (базу). Теперь при дубле берём материал, чьё имя лучше совпадает со стемом префаба (скин-принт). Общий паттерн кастом-принтов (стример-бутылки и т.п.).
  3. **`render_unity.mjs`:** `usable_items` под `/weapons/` больше НЕ `weaponMode` (иначе IconRenderer грузит бандл сам и берёт базовый материал, минуя фикс №2) → plain-режим. Ножи/гранаты (не usable_items) не задеты.
  **Уроки:** (а) name-матч даёт НЕ ТОТ предмет — сверять с игрой/скрином глазами; (б) food/drink — `*_loot`, не `*_container`.
- **8 брони-скинов — ПОДТВЕРЖДЕНО: оффлайн НЕ рендерятся.** Базовый бандл носителя несёт ОДИН набор текстур (дефолт `_d/_g/_n`); скин-вариантов (death/viking/gray/камо) НЕТ ни в бандле, ни в каталоге клиента (grep: viking=0, death=только аудио, customization-для-брони=0), SPT этих preset-id не знает (0/399, gladiator-пресетов 0). Скин = **рантайм-оверрайд текстуры**, которой нет в извлекаемых бандлах. → варианты (решение V4DYA): (а) глубокий RE системы кастомизации (character/arena-бандлы) — риск ямы; (б) залить базу в ДЕФОЛТ-цвете как best-effort (камо неверное); (в) **вынести в отдельный «оффлайн-нерендерятся» список** — критерий готовности это прямо допускает.
- **Admin's key `6a33c179`:** новый 1.1.0-ключ, в SPT/локали ни имени, ни описания; какой физ-меш (генерик `item_key_1..14` ИЛИ новая лаб-карта `item_keycard_event_labyrinth_access` / `item_keycard_quest_master_lab`) — offline не определить (прошлые кандидаты danexert/auto/tech мимо). → глаз V4DYA; могу собрать контакт-лист кандидатов на выбор.

## 🎯 ЦЕЛЬ
Ни у одного EFT-предмета нет 404 у картинки — **у каждого иконка**. **ТОЛЬКО self-render из клиента** (принцип V4DYA: с tarkov.dev не берём НИЧЕГО — ни зеркало, ни fallback; глазами сверять силуэт можно, пиксели лить нет).

## 📊 ПРОГРЕСС СЕССИИ 2026-08-04 (продолжение) — было 60, залито 42, ОСТАЛОСЬ 18
Дифф R2 = **18** (7 оружие + 11 прочее). Инструмент диффа теперь скрипт: `scripts/icon-render/diff_r2_missing.mjs` (= критерий готово).

### ⏩ ПРОДОЛЖЕНИЕ-2 (2026-08-04, этот чат) — залит ironkey, ОСТАЛОСЬ ~17
- ✅ **Black Division Encryption Keys `6a5f9cfc…`** — залит `probe_enc_ironkey` (белый USB IronKey), R2 HTTP 200 verify OK. ЗАКРЫТ.
- ⛔ **Admins KEY `6a33c179…`** — оффлайн НЕ резолвится: id нет в SPT 4673 (1.1.0 свежий); единственный «admin»-ключ в локали = «OLI administration office key» → `item_key_8` (ДРУГОЙ, существующий). Генерик-меш ключ, точный 1.1.0-бандл неизвестен. Кандидаты danexert/auto/tech — мимо. → ждёт глаза V4DYA по семье `item_key_1..14` ЛИБО отложен.
- **MK-18 `…007b`** отрендерен (out-unity), НО оптика = дефолт-коллиматор ≠ «PM II 5-25» (крупный прицел) → как SVDS, не льём без правки сборки.
- **Ачивки (параллельный поток) НА ПАУЗЕ:** Gemini image-модель на free-tier = лимит 0 (нужен биллинг). 109 исходных PNG скачаны в `!non-related/achievement-sprites/`, апскейл-скрипт `scripts/gemini-upscale-icon.mjs` готов, ждёт решения V4DYA по оплате.

### ✅ ПРОДОЛЖЕНИЕ-3 (2026-08-05) — ВСЕ 7 СТВОЛОВ ЗАКРЫТЫ, было 17 → **ОСТАЛОСЬ 10** (0 оружие)
**Залито live (R2, HTTP 200, силуэт сверен глазами):** 24 RPDN · 27 AK-308 Vudu · 28 AS VAL MOD4 · 29 TKPD · 7a AK-308 COMPM4 · 74 M16A1 · 2d NL545 PRO. **Оружейный бакет свипа = 0.**
- **Gap-стволы (24/27/28/29):** резолв новых 1.1.0-модов из зеркала (`weapon_presets.parts`) + греп клиента по имени → курированный `scripts/reports/gap-mods-map.json`. Сборка полного дерева: `scripts/icon-render/build_full_trees.mjs` (мерж состава + SPT + gap-map, ранг-сорт, вложение дублей слота).
- **Реконструкции (7a/74/2d):** SPT (4673) НЕ содержит эти базы, mirror — без parts. Собраны ВРУЧНУЮ из клиент-частей (`scripts/reports/reconstruct-{map,asm}.json`): 7a = адаптация дерева 27 (своп Vudu→CompM4 QRP2); 74 = каноническая M16A1 (m16 508mm/A2 birdcage/FSB/A1-цевья/carry-handle/A1-приклад/A2-грип/STANAG-30); 2d = когерентная FDE-сборка NL545 (cgnl fde upper/292mm/nl545 10.5" M-LOK/MOE FDE stock/AK-74 6L23 mag).
- **🔑 КЛЮЧЕВОЙ АПГРЕЙД РЕНДЕРЕРА `IconRenderer.cs` (закоммичено `760acde6` → `origin/autopilot/road-to-release`):** (1) **многопроходная сборка** — слот части может принадлежать под-моду, что цепляется ПОЗЖЕ (напр. `mod_handguard` ТКПД живёт на `mod_mount_001` «стойка цевья», НЕ на root). Крутим проходы пока цепляется хоть что-то → порядок дерева не критичен, парентинг можно оставлять `root`. (2) **глобальный фолбэк слота** — не нашли у названного родителя, ищем среди ВСЕХ прицепленных частей. Это разблокировало ТКПД + все реконструкции. ⚠️ НЕ трогать скоринг выбора меш-префаба (max-mesh): попытка `слоты*1000+меш` регрессировала `mod_tactical` других стволов — откачено.
- **Диагностика слот-топологии:** `scripts/icon-render/dump_slots.py` — печатает корневые GameObject бандла + их слот-эмпти `mod_*` (где физически висит слот).
- **Артефакты сессии:** новые `build_full_trees.mjs`, `dump_slots.py`, `item_info.mjs` (в git); харнесс в `scripts/reports/` (gitignore, локально): `gap-mods-map.json`, `full-weapon-trees.json`, `reconstruct-{map,asm}.json`. Скилл `game-asset-extraction/SKILL.md` прокачан секцией «⚡ МНОГОПРОХОДНАЯ СБОРКА» + 4 источника состава дерева + реконструкция.

**ОСТАЛОСЬ 10 (всё «прочее», НЕ оружие):**
- **8 брони-скинов** (31/32/33/3b/42/49/6e/71): база рендерит НЕ тот цвет (customization-оверрайд, отдельного бандла нет). Нужны оверрайд-текстуры скинов ИЛИ глаз V4DYA по контактному листу. Кандидаты в `armor-review.png` + `review-queue.json`.
- **Admin's KEY `6a33c179`:** ни один кандидат-бандл не подошёл (danexert/auto/tech) — глаз V4DYA / точный бандл.
- **Bottle of Yxmc Water `6a3557f8`:** food/drink `_container` бандлы падают на `PreviewPivot` в `extract_item.py` → нужен фикс экстрактора под food-preview-pivot, потом рендер.

**РЕШЕНИЯ V4DYA (сессия):** гибрид (очевидно-верное лью, сомнительное — ревью); броня-скины = извлечь текстуру-оверрайд; **19 оптик-пресетов = дефолт-сборки** (точный состав недоступен offline нигде, апгрейд позже); мелочь = добить по исключению + утвердить глазами.

**Залито в прод (R2, HTTP 200), силуэт сверен глазами — 42:**
- Мелочь 3/6: KA-BAR, Microtech Jagdkommando, .50 AE FMJ.
- Броня 16/24: CPC-ATACS, Stich×3 (Marpat/A-TACS/Coyote), TV115-Black, Strandhogg×2 (MC-Black/Abupat), Hexatac-MC, Thor-CRV, OTV-Woodland, Def2-Flecktarn, Redut×3 (Woodland/Arena/Black), Gladiator-LightMC, Korund-Kamysh(reed). [Kirasa — синий, в ревью.]
- Оружие 23/30: 7 из mirror-parts (SR-25, MP5-PRO, Veresk, MDR, MK18-Zeus, M32A1, PKP) + 13 SPT-дефолт (G36, AK-12, ADAR, AK-74, Vityaz, UZI, MP5-MRS, MCX-Spear, TRG-M10, AXMC, HK416-RAL×2, SVDS) + 2 QBZ + MK18(7b, reuse 2a).

**🧱 ТОЧНОЕ ДОСТИЖИМО (offline), но НЕ авто:**
- **4 неполных ствола (24 RPDN / 27 AK-308-Vudu / 28 AS-VAL-MOD4 / 29 TKPD):** состав ТОЧНЫЙ есть в зеркале, база из клиента (`ak308/`, `val_mod4/`, `svdk/tkpd`), НО новые 1.1.0-моды нет в SPT items.json. Нужные бандлы В КЛИЕНТЕ ЕСТЬ (напр. RPDN: `barrel_rpd_ds_arms_370mm_762x39`, `handguard_rpd_ds_arms_railed_handguard`, флешлайт `flashlight_surefire_m600_ultra_scout`), но резолвить ВРУЧНУЮ по слоту+модели. `build_gap_mods.mjs` (авто) ДАЛ ФРАНКЕНШТЕЙНОВ (RPD+цевьё FAL, AK308+дульник DVL-10) — не рендерить его выход. Имена gap-модов в зеркале (RU) → grep клиента по слот-папке+модели.
- **3 ствола без SPT-дефолта (74 M16A1 / 7a AK-308-COMPM4 / 2d NL545):** база из клиента, но нет ни parts, ни дефолт-пресета → Gate-3 реконструкция из слот-дефолтов префаба (`_std`).

**🔧 КОРРЕКТИРОВКИ ПЛАНА (важно для остатка):**
1. **Фан-аут (Путь 1) МЁРТВ.** `icon_path` в зеркале не заполнен (не индикатор). У 10 stripped базы в зеркале НЕТ; у остальных иконка базы могла быть с tarkov.dev → нарушение self-render. **Все брони = item-рендер носителя (Путь 2).** Плитники под `rig_*`, камо = суффикс бандла (`_arena_bp_01`, `_reed_bp2`, `_black_bp03`, `_marpat_bp2`, `_coyote_bp03`, `_abu_bp2`, `_woodland_bp2`, `_flecktarn_bp03`, `rig_gladiator_s_light_*`).
2. **Драйвер прокачан:** `--assembly-map <id→[parts]>` = много стволов за ОДИН Unity-batch (готово).
3. **Оружие — 3 источника состава:** (а) `weapon_presets.parts` зеркала (11/30, плоский tpl+slot — рендерер прощает при слот-ранге); (б) `build_spt_default_trees.mjs` — ПОЛНОЕ дерево SPT-дефолта (13/19, но стандартная сборка ≠ оптик-версия); (в) новые 1.1.0 базы (AK-308/AS-VAL-MOD4/TKPD) — из КЛИЕНТ-каталога (SPT отстаёт), моды часто в пробелах.

**Осталось 18 → очередь `scripts/reports/review-queue.json`:**
- **7 оружие:** 24/27/28/29 (точное, ручной резолв gap-модов — см. выше), 74 M16A1 / 7a AK-308-COMPM4 / 2d NL545 (Gate-3 реконструкция).
- **8 брони — скины/камо через текстуру-оверрайд (решение V4DYA):** Gladiator Death/Viking/Gray, Kirasa-green, Trooper-Coyote, AVS-Multicam, TacTec-Storm, ANA-M2-Alpine. Отдельного бандла НЕТ (customization-оверрайд). Кандидаты-бандлы отрендерены в `armor-review.png`; нужно найти ГДЕ лежат оверрайд-текстуры скинов и применить (глубже свапа бандла).
- **3 мелочь (по исключению + глаз V4DYA):** вода `6a3557f8…` — food/drink `_container` бандлы падают на `PreviewPivot` (нужен фикс `extract_item.py` под превью-пивот еды); Admin's key `6a33c179…` — механич. ключ, генерик-меш, кандидаты (danexert=ланьярд/auto=автоключ/tech=оранж) НЕ подходят; Encryption Keys `6a5f9cfc…` — лучший кандидат `item_flash_card_ironkey` (белый USB IronKey). Кандидаты в `misc-cand-sheet.png`.

**Новые скрипты (сессия):** `diff_r2_missing.mjs`, `item_info.mjs`, `contact_sheet.mjs`, `build_weapon_trees.mjs`, `build_spt_default_trees.mjs`, `build_gap_mods.mjs`(⚠️авто-матч ненадёжен). Драйвер `render_unity.mjs` +флаг `--assembly-map`.

**Новые скрипты сессии:** `diff_r2_missing.mjs`, `item_info.mjs`, `contact_sheet.mjs`, `build_weapon_trees.mjs`, `build_spt_default_trees.mjs`. Харнесс: `{misc,armor,weapon}-map.json`, `weapon-presets.json`, `review-queue.json`, контактные листы `*-sheet*.png`.

---

## ШАГ 0 — пересними актуальный список дыр (ПЕРВЫМ ДЕЛОМ)
Полный список = **дифф R2-бакета vs каталог зеркала** (НЕ `find-missing`, он видит только существующие webp). На 2026-08-04 = **60** (30 оружие + 30 не-оружие). Могло измениться.
```js
// node -e '...' (грузит .env.local; см. рабочее в этой сессии). Логика:
// 1) S3 ListObjectsV2 Bucket=R2_BUCKET Prefix="items/eft/512/" → Set существующих id
// 2) все EFT item-id: db.items where game_id=(games where name~/escape from tarkov/)
// 3) missing = каталог − R2 ; split по имени: isWeapon=/assault rifle|submachine|machine gun|sniper|carbine|marksman|grenade launcher|shotgun|pistol|revolver/i
// → scripts/reports/missing-weapons.json + missing-other.json
```
Env: `.env.local` (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_ICON_BASE_URL).

## ЧТО УЖЕ СДЕЛАНО (сессия 2026-08-04, всё в проде)
- 125 иконок 1.1.0 (моды/бартер/документы TerraGroup/жетоны Black Division) в R2.
- 13 жетонов через **`dogtagMode`** (кадр по пластине, цепь вверх).
- **Гейт-3 РЕШЁН** — сборка цельных стволов. AK-74N (эталон), QBZ-191, Howa Type 20 — пиксель-корректны, в R2. **Код в main: коммит `e7889f07`.**
- 29 контейнеров фан-аутом (Wooden 1-17, Plastic 1-11, BD Crate 1).
- **Осталось: 60.**

## МЕХАНИЗМЫ (готовы, в main + скилле)
1. **Оружие (Gate-3 сборка):** `npm run icons:render-unity -- --map <id→container.json> --ids <id> --assembly <preset-дерево.json> --win "D:/Games/Escape from Tarkov/EscapeFromTarkov_Data/StreamingAssets/Windows"`.
   - **☠️ КОНВЕНЦИЯ МОНТАЖА (не сломать):** мод = POSITION mount-relative (меш в origin), ROTATION уже weapon-space (авторская). Монтаж = трансляция root мода в **мировую позицию слота** + **СОХРАНИТЬ авторский поворот** (`SetParent(inst, worldPositionStays=true)` + `mi.position=slot.position`). Поворот слота НЕ наследовать, НЕ обнулять.
   - **Пресет-дерево:** `[{partId,parentId,slot,bundleKey,root}]`. `root:true` = сам ствол (из `--map`); дети крепятся к слоту parentId (или к inst, если parent пуст). Порядок: родитель раньше ребёнка.
   - **Источник дерева:** SPT `globals.json` `ItemPresets` (274 существующих ствола: `{_tpl,slotId,parentId}`; резолв `_tpl`→бандл через SPT `items.json` `_props.Prefab.path`). Экстрактор — inline (см. `ak74n-tree.json` как эталон формата).
   - Эталон-харнесс: `scripts/reports/{ak74n,qbz,howa}-{preset,map}.json`.
2. **Обычный item:** `--map --ids` БЕЗ `--assembly` (один предмет = один бандл).
3. **Фан-аут (одинаковый визуал):** `node scripts/icon-render/upload_r2_ids.mjs --src <webp> --ids <a,b,c>`.
4. **Заливка:** `node scripts/icon-render/upload_r2_ids.mjs --ids <a,b,c>` (берёт `out-unity/{id}.webp` → R2 `items/eft/512/{id}.webp` + синк public). Verify: `curl` публичного URL → HTTP 200.

## ПЛАН ПО 60 (поштучно, вариант B)

### A. 30 стволов (оружейные пресеты) — `missing-weapons.json`
- **Существующие guns** (M16A1, AK-74 Krechet, MP5 ×2, IWI UZI, SVDS, AK-12, HK G36, PP-19 Vityaz, KAC SR-25, SR-2M Veresk, Custom NL545, ADAR, Desert Tech MDR-иногда) → дерево из **SPT ItemPresets** (найти по имени ствола, извлечь, зарезолвить, рендер).
- **Новые 1.1.0** (SIG MCX Spear, Sako TRG M10, QBZ192, QMK171A, HK416A5 RAL, Milkor M32A1, PKP, TKPD, AS VAL MOD4, Degtyarev RPDN, AK-308 пресеты) → **реконструировать дерево из слот-иерархии клиент-префаба** + `_std`-эвристика мод-бандлов (как делали для QBZ/Howa: `weapons/<model>/weapon_*_container.bundle` + дефолт-моды `<type>_<model>_..._std`).
- **⚡ ЭФФЕКТИВНОСТЬ:** сейчас драйвер = 1 пресет за прогон Unity → для 30 стволов это 30 запусков. **Прокачать драйвер под пер-id пресеты** (`--assembly-map <id→presetFile>` → каждый job свой пресет → рендер многих за ОДИН Unity-batch). Иначе долго.

### B. 24 «Stripped» плитника — `missing-other.json`
- «Stripped» = плитник/броня БЕЗ плит = визуал **базового армор-предмета**. 
- **Путь 1 (быстрый, точный):** найти БАЗОВЫЙ армор-item (та же модель+цвет, но без «Stripped») в зеркале, у которого УЖЕ есть иконка → **фан-аут** база→stripped-id.
- **Путь 2:** резолв армор-бандла (`content/items/equipment/armor_*|rig_*`, по семье+цвету) → item-рендер.
- ⚠️ **Авто-токен-матчер НЕНАДЁЖЕН** (мапил BNTI→патрон, ANA→маска, First Spear→гарнитура) — резолвить **поштучно/по семьям** глазами.
- Семьи: Fort Gladiator S (Death/Viking/Lightweight-Multicam/Gray), Fort Redut M (SK-Woodland/Prisoner/Black), Fort Defender 2 (Flecktarn), Interceptor OTV (Woodland), NPP Klass Korund VM (Kamysh), BNTI Kirasa N (Green), Stich Profi V2 (Marpat/A-Tacs/Coyote), ARS Arma CPC (A-Tacs FG), 511 Tactec (Storm), Crye AVS (Multicam), Wartech TV-115 (Black), ANA M2 (Multicam-Alpine), First Spear Strandhogg (Multicam-Black/Abupat), Highcom Trooper TFO (Coyote), Hexatac HPC (Multicam), NFM Thor.

### C. 6 мелочи — в `missing-other.json`
KA-BAR Usmc knife, Microtech Jagdkommando knife, Admins KEY, Bottle of Yxmc Water, .50 AE FMJ, Black Division Encryption Keys → grep бандл в `content/items/` (knives/`item_key_*`/food/ammo/`item_barter_*`) → item-рендер.

## ГОЧИ (hard-won)
- Драйвер `--win` передавать ЯВНО (дефолт устарел на `C:/Battlestate…`, реальный `D:/Games/Escape from Tarkov/…`).
- Драйвер копирует свежий `IconRenderer.cs` в `unity/_project/Assets/Editor/` КАЖДЫЙ прогон — правки применяются.
- `find-missing-icons.mjs` мис-флагает фан-аут-группы (69 Twitch и т.п.) → полный список дыр бери **R2-диффом**, не им.
- Прод-путь R2 (`upload_r2_ids.mjs`), НЕ Supabase. `render_unity --upload` льёт в Supabase — для прода не использовать.
- Unity license-warning'и в логе НЕ фатальны (рендерит штатно).
- BattlEye-safe: только офлайн-чтение файлов, игра ВЫКЛЮЧЕНА.

## ФАЙЛЫ
- Код (в main): `scripts/icon-render/render_unity.mjs`, `scripts/icon-render/unity/IconRenderer.cs`.
- Скилл: `.claude/skills/game-asset-extraction/SKILL.md` (Гейт-3 РЕШЁН + принцип self-render).
- Бриф оружия: `!future-requests/weapons-gate3-sprint.md`.
- Списки/харнесс: `scripts/reports/{missing-weapons,missing-other,missing-r2-eft,missing-selfrender}.json`, `{ak74n,qbz,howa}-{preset,map}.json`, `qbz-map.json`.
- Каталог бандлов клиента: `D:/…/StreamingAssets/Windows/Windows.json` (ключ→{FileName,Crc,Dependencies}).
- SPT (пресеты/имена): `D:/Games/SPT/SPT_Runtime/SPT_Data/database/{globals.json,templates/items.json,locales/global/ru.json}`.

## КРИТЕРИЙ ГОТОВО
Шаг-0 дифф R2 vs каталог зеркала = **0** (или только предметы без модели в клиенте — их вынести отдельным списком). Каждая залитая — verify HTTP 200 + глазом silhouette.
