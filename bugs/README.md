---
type: index
status: active
created: 2026-08-18
---

# Bugs — входящие из Telegram

Сюда попадает **каждое новое сообщение** из рабочего чата ЦТА (Telegram-супергруппа),
нормализованное в карточку бага. Одно сообщение → один файл.

- Механизм приёма, маска, нормализация, watermark: [[docs/state/telegram-bug-intake.md]]
- Триггер обработки: «новый ЦТА-баг в ТГ»

## Соглашение об именах
`YYYY-MM-DD-HHMM--<краткий-слаг>.md` — дата/время из `message.date` (Telegram, не угадано).

## Статусы карточки (frontmatter `status`)
- `new` — заведён, не разобран
- `triaged` — понят, готов к работе
- `in-progress` — чиню
- `done` — исправлено → карточка переезжает в `done/`
- `wontfix` / `dup` — отклонён / дубль

## Раскладка
- корень `bugs/` — активные (`new`/`triaged`/`in-progress`)
- `bugs/done/` — починенные (`status: done`, с секцией «Резолюция»)
- `bugs/attachments/` — скрины (эмбеды по полному пути `bugs/attachments/…`, не зависят от места карточки)

## Открытые баги
<!-- список пополняется по мере приёма -->
- [[bugs/2026-08-28-1148--perks-constructor-share-broken.md]] — Конструктор перков: сломана кнопка «Поделиться» (permalink сборки) (`new`)
- [[bugs/2026-08-28-1158--perks-constructor-hero-images.md]] — Конструктор перков: не грузятся hero-изображения билдов (`in-progress` — фикс готов, ждёт пуша+verify)

## Починенные — `done/`
Сессия 2026-09-04 (grill→diag→fix, всё в main):
- [[bugs/done/2026-09-02-2137--assets-r2-blocked-in-russia.md]] — Ассеты/RU: **блокировки не было**. Замер с московского канала чистый (сайт 0.14 с, оба хоста ассетов 200, SNI-фильтра нет). Настоящий дефект — расщеплённое делегирование NS (4 сервера из 6 вели на чужой хост с 409), вылечен у REG.RU. Ассеты переехали на `cdn.cta.quest`. В карточке разбор пяти ошибок метода
Сессия 2026-08-23 (grill→code→live-verify, ветка `fix/collector-food-duplicates`):
- [[bugs/done/2026-08-23-1617--collector-food-eaten-duplicates.md]] — Коллекционер: дубли еды = устаревший ручной оверрайд `eft-collector.ts` (крон синканул objectives), снесён целиком → 44 предмета, 0 дублей

Сессия 2026-08-18 (`/autopilot` grill→code→verify, всё в main, merge `715ce4c0`):
- [[bugs/done/2026-08-18-0922--maps-marker-floor-invisible.md]] — Карты: подложка этажа гасла после сохранения (single-SVG base-load)
- [[bugs/done/2026-08-18-0929--marker-item-link-not-shown.md]] — Карты: связанный предмет не виден в карточке
- [[bugs/done/2026-08-18-0933--marker-wizard-reset-dataloss.md]] — Карты: визард сбрасывал данные на шаге 2+
- [[bugs/done/2026-08-18-0940--marker-wizard-next-disabled-loot-name.md]] — Карты: «Далее» неактивна без имени лута
- [[bugs/done/2026-08-18-0926--media-library-thumbnail-grid.md]] — Медиа: миниатюры → сетка 1×1
- [[bugs/done/2026-08-18-0940--media-library-multiselect-manage.md]] — Медиа: мультивыбор + переименование
