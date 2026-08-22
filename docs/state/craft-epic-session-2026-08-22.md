---
type: session-handoff
epic: craft-profit + производство
date: 2026-08-22
status: ✅ ВСЁ В MAIN (origin/main @ 72711d59, 39 коммитов bbef7465..72711d59)
specs: docs/decisions/craft-profit-rework.md · docs/decisions/craft-production-tracker.md
research: docs/research/eft-craft-profit-tarkovdev.md · docs/research/eft-editions-hideout-bonuses.md
---

# Крафт-эпик — хендофф (2026-08-22)

Раздел **`/eft/progress/hideout/craft-profit`** переработан целиком и **запушен в main**.
Всё живьём проверено, `tsc`/`eslint` чисто. Ветка `feat/important-items-merge` синхронна с main.

## Что в main (по областям)

### Данные (слой B — миграция БД проведена)
- `crafts` +колонки `task_unlock_id` / `game_editions` / `required_quest_items`; `TradeSlot.tool`.
- Синк `src/db/barters-crafts.ts` тянет taskUnlock/gameEditions/requiredQuestItems + `attributes.tool`.
- Миграц-скрипт `scripts/add-craft-columns.ts` (аддитив, сессионный пул). **Проведено на проде**:
  taskUnlock=33 · gameEditions=1 · requiredQuestItems=9 · tool-входы=129. ГОЧА: db:push требует TTY → аддитив прямым SQL.

### Экономика (чистый модуль)
- `src/lib/craft-profit.ts` — `computeCraftEconomy` (профит, налог барахолки verbatim, скилл-бонусы:
  Crafting режет время −0.75%/ур, HideoutManagement+Разведцентр режут налог), `savings` (Экономия).
  Формулы = `docs/research/eft-craft-profit-tarkovdev.md` (сверено с исходниками tarkov.dev).
- Ридер `page.tsx` отдаёт СЫРЫЕ цены (basePrice/trader/flea + флаги входов) → клиент считает реактивно.

### UI (`CraftProfitClient.tsx` + `RecipeCard.tsx`)
- **Карточка = 4 состояния + «занята»** (спека craft-production-tracker), Figma 2990-584/772/3001-1629:
  - `Дострой NN` (locked, шапка оранжевая tactical-amber + hideout-build-icon) →
  - `Можно крафтить` (акцент #9A8866 фон+обводка+шапка, кнопка «В производство» без обводки, только фон) →
  - `Производится` (#9A8866 таймер+шапка+кнопка на ЧИСТО ЧЁРНОМ #000, «отменить крафт») →
  - `Готово` (зелёный nvg-green таймер+обводка+свечение на чёрном, «Забрать крафт») →
  - `Станция занята` (сёстры занятой станции).
- **Трекинг**: `useCraftProductionStore` (по станции, снапшот durationSec, start/cancel/collect + remainingSec/productionStatus). Одна станция = один крафт. Заморозка времени на старте.
- **Глобальный `CraftWatcher`** (`src/app/eft/layout.tsx`) — Notification+звук на готовности (паттерн useRestockStore/«Завоз»).
- **Скрепка = закрепить** крафт → секция «Закреплённые» сверху (`useCraftPinStore`, вне фильтров, из грида исключены).
- **Герой-выход**: TrackCell + shortName + «Продажа <flea> ₽»; входы TrackCell + «в схроне».
- **Метрики**: Время/Выручка/Покупка/Комиссия/Экономия/Прибыль/Р-час, полный формат ₽ (177 362 ₽).
- **Квест-анлок** = квест-нода-чип (аватар торговца + имя + «УР. N+», цвет торговца, w-full, клик → questmap).
- **Единая строка контролов** (design-to-code Figma 3015-1878, `CraftControls` УДАЛЁН):
  поиск **348px** (w-87) · gap-7 · **скилл-индикаторы 348px** (read-only уровни из Досье ЧВК) · gap-7 ·
  иконки-фильтры (Только прибыльные/Доступно/Скрыть заблок/Пустой бак — иконки `public/icons/eft/04-progression/crafting/*` через icons.css) · **сортировка растянута** (flex-1, показывает выбранный метод).
  **НАД** вкладками станций.
- Вкладки станций: иконка+уровень+«рецептов A/B», ТОП вместо ВСЕ (profit-icon, счётчик прибыльных, дефолт).
- Семантика цвета «Производство»: перекраска карточки взята из блока `CraftOfferCard` (страница предмета).

## Ключевые файлы
- `src/lib/craft-profit.ts` · `src/components/features/hideout/{RecipeCard,ModuleFilterTabs,RequirementChip}.tsx`
- `src/app/eft/progress/hideout/craft-profit/{page,CraftProfitClient}.tsx`
- `src/store/{useCraftProductionStore,useCraftPinStore}.ts` · `src/components/features/hideout/CraftWatcher.tsx`
- `src/db/{barters-crafts,schema}.ts` · `scripts/add-craft-columns.ts` · `src/styles/icons.css` (crafting-иконки)
- `src/components/ui/kit/TrackCell.tsx` (+проп `badge`, done-заливка nvg-green, rounded-sm)

## Осталось / follow-up (НЕ блокеры)
1. **Мобилка контролов** — фикс-ширины 348+348 рассчитаны на десктоп (контейнер ~1100px). На узких экранах строка не влезет → адаптация по канону `cta-mobile` отдельным заходом.
2. **Эпик «Схрон игрока»** — `docs/decisions/stash-grid-visualization.md` (сетка инвентаря, не начат).
3. **Вход как бартер/крафт** (рекурсивно дешевле, как tarkov.dev), элита Crafting (2 предмета/цикл) — follow-up экономики.
4. **Полный экран «Список нужного»** — сейчас скрепка = закрепить (шоппинг-стор выкинут); если вернёмся к списку докупки — новый заход.
5. Done-зелёный = наш `nvg-green` (#689963); Figma-зелёный чуть ярче — точь-в-точь не матчили (V4DYA не просил).
6. Bitcoin-farm исключён из craft-profit (есть отдельный роут bitcoin-profit).

## Гочи (помнить)
- **Браузер-тул: клик/зум-координаты в пространстве вьюпорта ~1824, скрин 1568 → масштаб ~1.16.** Промахи по кликам/зумам — из-за этого; учитывать.
- `#9A8866` / `#000000` в стейтах карточки — литералы (не токен): @theme-переменные Tailwind вырезает, color-mix со стрип-переменной = пустота (грабли QuestNode/BarterOfferCard). `nvg-green` — токен, используется, потому var(--color-nvg-green) валиден.
- `db:push` требует TTY → миграции аддитивным SQL.
- Один dev на общий `.next`; graphify-хук стартует фон-ребилд на каждый коммит.
- Shared working tree (§7): в дереве чужие untracked — стейджить только свои файлы.

---
*Крафт-эпик закрыт и в main. Продолжение — в новом чате (мобилка / эпик «Схрон» / follow-up экономики).*
