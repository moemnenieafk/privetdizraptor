# СПРИНТ: Оружие/гранаты — Гейт 3 (сборка дефолт-пресета и рендер иконок)

> Вызвать: открой этот файл и скажи «делаем спринт оружие». Опирается на скилл `/game-asset-extraction` (там Фазы 0–4 + раздел «Гейт 3: ОРУЖИЕ»). Контекст: память `[[eft-asset-extraction]]`.
> Предыстория: в сессии 2026-06-25 закрыто 108 из 198 дыр иконок (моды/экип/бартер). Осталось цельное оружие+граната — оно НЕ лезет в обычный item-пайплайн.

## Цель
Отрендерить и залить иконки 5 предметов, которых нет в `content/items/` (только в `content/weapons/`):

| id | предмет | бандл (weapons/) | тип |
|---|---|---|---|
| `6981d72ed009ad83920da43a` | Saiga-12K automatic (Redline) | `saiga12/weapon_kiba_saiga12k_fa_12g_container.bundle` | ствол (сборка) |
| `69a6bdfa896d77866e096752` | Saiga-12K automatic (Redline) Default | то же | ствол (сборка) |
| `69eb793db978f26a9304e78c` | HK MP7A1 4.6x30 Wedge | `mp7/weapon_hk_mp7a1_46x30_container.bundle` | ствол (сборка) |
| `707265736574000000000021` | Kalashnikov AK-308 7.62x51 RMR | `ak308/weapon_izhmash_ak308_762x51_container.bundle` | ствол (сборка) |
| `69f07893e761ac1c200ae15b` | Model 8230 CS gas grenade | `m8230/weapon_grenade_m8230_container.bundle` | граната (без сборки — НАЧАТЬ С НЕЁ) |

Бандл каждого ствола: `..._container.bundle` (логика/префаб/слоты) + соседний `client_assets.bundle` (визуал/меши) + `textures/`.

## Что уже разведано (факты, не повторять)
- Префаб ствола **имеет PreviewPivot** (иконочная камера) + ~30 мешей + слот-трансформы:
  `mod_muzzle / mod_reciever / mod_magazine / mod_stock / mod_pistol_grip / mod_handguard / mod_sight_rear / mod_charge / patron_in_weapon`.
- Все меши **активны** (m_IsActive=true) — НЕ проблема активации.
- `extract_item.py`+рендер как обычный item → **ПУСТО**: визуал лежит в `client_assets.bundle`, которого нет в `Dependencies` контейнера → Unity его не грузит.
- Грузить ВСЕ бандлы папки оружия как deps → **FAIL** (конфликт/CRC-дубли одинаковых ассетов при загрузке).
- Гранаты (`weapon_grenade_*`) — вероятно одиночный меш без слотов-сборки → проще, начать с M8230.

## План (гейты)
1. **Грана (M8230) — PoC простого случая.** Разобраться, какой бандл из папки `m8230/` несёт меш гранаты (container vs client_assets), собрать МИНИМАЛЬНЫЙ набор deps без дублей, отрендерить через IconRenderer (камера/автофит/материалы переиспользуются). Если граната выходит — значит проблема была чисто в наборе бандлов.
2. **Ствол — какой бандл несёт собранный дефолт-префаб.** Для Saiga `_kiba_..._fa_` проверить: container vs client_assets — где активные меши дефолт-сборки. Грузить container + ровно нужный client_assets (+textures), без задвоения ассетов (источник FAIL). Возможно, instantiate префаба покажет уже собранный дефолт.
3. **Если префаб = голый ресивер (слоты пустые)** — сборка дефолт-пресета:
   - данные пресета: `globals.json` → `ItemPresets` (какие mod-id в каких слотах) ИЛИ SPT `defaultPresets.json` (refringe, Git LFS как items.json);
   - резолв каждого mod-id → бандл (`resolve_bundle.py --items`/`--map`), загрузка mod-префаба, attach к слот-трансформу `mod_*` по имени слота;
   - рекурсивно по дереву слотов (мод тоже может иметь слоты).
4. **Выход** — как у Фазы 4: webp 512+1024, авто-кроп, заливка `--upload` + синк `/public` (sharp, НЕ PIL — PIL зависал; curl в цикле труил файлы — оба избегать).

## Инструменты (готовы, `scripts/icon-render/`)
- `extract_item.py` (Icon-параметры+меши), `unity/IconRenderer.cs` (камера-автофит mode 5, материалы), `render_unity.mjs --map --ids --upload`.
- Возможно понадобится доработать: явная передача доп-бандлов (deps) в job + защита от дублей ассетов при load; ветка «сборка по пресету» в IconRenderer (attach mod-префабов к слотам).
- Unity `2022.3.43f1`, EFT `C:/Battlestate Games/.../StreamingAssets/Windows`.

## Verify
Рендер ≈ фото из игры (камера mode 5 даёт пиксель-точность для item; для собранного ствола сверить силуэт/моды визуально — эталона на tarkov.dev нет). Залить только подтверждённые глазами.

## НЕ в этом спринте (модели нет нигде — отдельно/никогда)
`69cbd36d` Crye AirFrame Ears (Coyote) — варианта нет; `69e24f4f` Team Wendy EXFIL helmet cover (MultiCam Black) — бандла нет; `69d39aac` Echo Belli crate — не найден; 69 Twitch-промо контейнеров — нет модели.
Кейкарты `69bb3f27` Compartment C-1 / `69bb3f7d` C-3 — МОГУТ резолвиться (бандлы `item_keycard_*` в `spec/`); добить name-match/agent отдельно, не блокер оружия.
