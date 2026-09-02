---
title: Таможня (Customs) — канонические именованные места
status: справочник для сверки объектов (2026-09-02)
tags: [maps, customs, registry, landmarks]
---

# Таможня — 27 канонических именованных мест

Источник: чек-лист WeMod Maps (place-of-interest), сверено с EFT Wiki и гайдами; русские
названия — как их зовёт V4DYA и русское комьюнити. **Парадигма (V4DYA, 2026-09-02): сначала
находим реальные имена локации, потом задаём вопросы по листу сверки** — так идентификация
точнее, а семантика карты сохраняется.

| # | Английское | Русское / как зовёт комьюнити | Часть карты | В реестре |
|---|---|---|---|:-:|
| 1 | Customs Building aka **Big Red** | Большой красный склад, «Биг Ред» | запад | — |
| 2 | **Warehouse #17** | Склад 17 | запад | — |
| 3 | **Warehouse #7** | Склад 7 | запад | — |
| 4 | **Warehouse #4** | Склад 4 | центр | ✅ T-0080 |
| 5 | **Warehouse #3** | Склад 3 | центр | ✅ T-0084 |
| 6 | **Green Screen** aka Warehouse #6 | Склад 6, «зелёный экран» | центр | — |
| 7 | **Old Gas Station** | Старая заправка | запад | ✅ T-0087 |
| 8 | **New Gas Station** | Новая заправка | восток | ✅ T-0076 |
| 9 | **Crackhouse** | Крэкхаус | запад | ✅ T-0089 |
| 10 | **Boiler Room** | Бойлерная (комплекс) | запад | ✅ T-0093 |
| 11 | — (здание бойлерной) | Здание бойлерной, две огромные трубы | запад | ✅ T-0094 |
| 12 | **Dorms – 3 Storey** | Общага трёхэтажка | восток | ✅ T-0075 |
| 13 | **Dorms – 2 Storey** | Общага двухэтажка | восток | — |
| 14 | **Big Skeleton** | Скелетон (большой) | центр | ✅ T-0082 |
| 15 | **Mini Skeleton** | Мини-скелетон | центр | — |
| 16 | **Fortress** | Фортпост / «Fortress Решалы» | восток | ✅ T-0079 |
| 17 | **Depot** | Депо / «Депо Решалы» | восток | ✅ T-0085 |
| 18 | **Trailer Park** | Трейлерный парк, стоянка | запад | ✅ T-0078 |
| 19 | **Main Bridge** | Главный мост | центр | ✅ T-0083 |
| 20 | **Junk Bridge** | Мусорный мост | центр | — |
| 21 | **Industrial Plant** | Промзона / завод | центр | — |
| 22 | **Power Station** | Подстанция | — | — |
| 23 | **Storage** | Хранилище | — | — |
| 24 | **Ice Cream Shack** | «Мороженое», ларёк | — | — |
| 25 | **Sniper Ridge** | Снайперская гряда | юг | — |
| 26 | **Military Checkpoint** | Военный КПП (RUAF) | юг | — |
| 27 | **ZB-013 Switch** | Рубильник ZB-013 | восток | — |

Плюс не из чек-листа, но названо V4DYA: **Ангар офисов Таркон** (Tarcone / Customs Office) — ✅ T-0086,
**Выход на ж/д путях** — ✅ T-0088.

## Что это даёт

- **17 из 27** уже опознаны и лежат в реестре как `kind: "landmark"`.
- Оставшиеся 10 — контрольный список: ищем их на листах сверки №2–8, а не выдумываем имена.
- Экстракты (ZB-1011, ZB-013, Dorms V-Ex, Crossroads, RUAF Roadblock, Military Base CP,
  Warehouse 17 scav) уже синкаются в БД маркеров — в реестр объектов их не дублируем.

## Источники

- [WeMod Maps — Customs place-of-interest checklist](https://wand.com/maps/escape-from-tarkov/customs/checklist/place-of-interest/location)
- [Timesaver — Full Tarkov Customs Map Guide 2026](https://timesaver.gg/blog/tarkov-customs-map-guide)
- [EFT Wiki — Customs](https://escapefromtarkov.fandom.com/wiki/Customs)

---

## 🎯 Имена сцен от разработчика (BSG) — точнее вики

Извлечено из `globalgamemanagers` → `BuildSettings.scenes` (714 сцен, полный список по всем
локациям: `docs/registry/eft-scenes.json`). Это **внутренние имена BSG** — самый достоверный
источник семантики карты.

| level | Сцена | Что это |
|---|---|---|
| 4 | `custom_AI` | навигация ботов |
| 5 | `custom_multiScene` | общая сборка |
| 6 | `custom_AZS` | **Новая заправка** (АЗС) |
| 7 | `custom_AZS_old` | **Старая заправка** |
| 8 | `custom_DesignStuff` | дизайнерский реквизит |
| 9 | `custom_Garage` | **Гаражи** |
| 10 | `custom_Obshezhitie` | **Общаги** (внешка) |
| 11 | `custom_Obshezhitie_1_indoor` | **Общага 2-этажка**, интерьеры |
| 12 | `custom_Obshezhitie_2_indoor` | **Общага 3-этажка**, интерьеры |
| 13 | `custom_Light` | свет |
| 14 | `custom_Road` | **дороги** |
| 15 | `custom_Scripts` | логика |
| 16 | `custom_Tamozhnya` | **Здание таможни** (Tarcone / офисы) |
| 17 | `custom_Terrain` | **РЕЛЬЕФ** (меш-террейн + деревья) |
| 18 | `custom_TrailerPark` | **Трейлерный парк** |
| 19 | `custom_background` | фон-декорации за границей карты |
| 20 | `custom_city` | **городская часть** |
| 21 | `custom_factoryStorageZone` | **складская зона** (Склады 3/4/17, Биг Ред) |
| 22 | `custom_mazuto` | **мазутка** — Бойлерная / топливное хозяйство |
| 170–176 | `Custom_Expansion_*` | расширение: Abandoned Lab, Abandoned Plant, ChemicalFactory, Construction Factory, Pump Station, RepairBox |

**Следствия:**
- Расширение Таможни даёт ещё 6 именованных зон, которых нет в вики-чек-листе.
- `custom_background` = та самая **размытая зона вне игры** (мы её отсекаем детектором Лапласиана) —
  подтверждение, что отсечка верна.
- Для любой карты портала: сначала смотреть `eft-scenes.json` — имена сцен дают структуру локации
  бесплатно и точнее любых гайдов.
