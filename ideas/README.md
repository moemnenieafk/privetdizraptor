---
type: index
status: active
created: 2026-08-18
---

# Ideas — входящие из Telegram

Сюда попадает **каждое новое сообщение** из ветки «идеи» рабочего чата ЦТА
(Telegram-супергруппа), нормализованное в карточку идеи по улучшению сайта.
Одно сообщение → один файл.

- Механизм приёма, маска, нормализация, watermark: [[docs/state/telegram-ideas-intake.md]]
- Триггер обработки: «новая ЦТА-идея в ТГ»
- Бот: `@cta_ideas_parcer_bot` (токен — env `TELEGRAM_IDEAS_BOT_TOKEN`, в гит НЕ коммитим)

## Соглашение об именах
`YYYY-MM-DD-HHMM--<краткий-слаг>.md` — дата/время из `message.date` (Telegram, не угадано).

## Статусы карточки (frontmatter `status`)
- `new` — заведена, не разобрана
- `triaged` — понята, оценена
- `planned` — принята в работу (в roadmap/спеку)
- `done` — реализована → карточка переезжает в `done/`
- `rejected` / `dup` — отклонена / дубль

## Раскладка
- корень `ideas/` — активные (`new`/`triaged`/`planned`)
- `ideas/done/` — реализованные (`status: done`, с секцией «Резолюция»)
- `ideas/attachments/` — скрины/референсы (эмбеды по полному пути `ideas/attachments/…`)

## Открытые идеи
<!-- список пополняется по мере приёма -->
- [[ideas/2026-08-18-1947--quests-kappa-collector-found-sort.md]] — Задания: трекер предметов Kappa (Коллекционер) с авто-сортировкой найденных вниз (`new`, @dudeplease)

## Реализованные (`done/`)
Пачка «Карты» от 2026-08-18 (грилл-сессия по каждой → код → живой верифай на Заводе):
- [[ideas/done/2026-08-18-1731--maps-floor-only-markers-toggle.md]] — тоггл «Показать все этажи» (инверсия: офф-флор уже были скрыты) (`done`)
- [[ideas/done/2026-08-18-1652--maps-loot-search-loading-indicator.md]] — скелетон + лупа при поиске предмета (Лут + Связь-предмет) (`done`)
- [[ideas/done/2026-08-18-1729--maps-marker-no-screenshots-indicator.md]] — danger-бейдж `ImageOff` на контентных маркерах без скринов (админ) (`done`)
- [[ideas/done/2026-08-18-1642--maps-batch-add-markers.md]] — батч-СОЗДАНИЕ однотипных маркеров кликами (шаблон→постановка) (`done`)
