---
status: ✅ сделано
done: 2026-07-03
affects: account, tracking, hideout
date: 2026-07-03
---
# Трекинг: Убежище (модули + бак материалов)

## Что сделано (2026-07-03) — принято V4DYA
Домен «Убежище» вкладки «Трекинг» ([[player-tracking-tab]]) + **тот же дизайн на странице раздела** `/eft/progress/hideout/modules` (взамен HubCard-хаба). Вынесено из [[tracking-needed-items]] по решению V4DYA.

- **Общий компонент `src/components/features/hideout/HideoutBuildTracker.tsx`** (один дизайн, два потребителя): вкладка — компакт (272px, gap-4), страница — wide (**348px, gap-7=28px**); мобилка — стек, модули 2-в-ряд (канон cta-mobile).
- **Две колонки**: слева выбираемый модуль (иконка станции, имя, плашки уровней, ✓ на максимуме; высота = правой панели, скролл почти незаметный); справа — «стройка».
- **Геймификация «бак материалов»**: карточки предметов в едином стиле медиаконтейнеров (QuestItemTracker: darkbase + inner-shadow + рамка 53×53); **клик = +1 материал → вертикальная заливка контейнера снизу** (бак); «−» и «карточка предмета» (`/eft/items/item/<slug>`) — кнопки по вертикальному центру контейнера при ховере; общий бар уровня; **кнопка «Построить»** (активна при полном баке → level+1, материалы тратятся).
- **FIR**: синк убежища зеркалит `attributes.foundInRaid` (104/317 требований; jsonb — без db:push, пере-синк выполнен); галочка `icon-eft-quests-side` на контейнере + канонный бейдж «Найдено в рейде» (обводка/фон/`type-micro`).
- **Стор**: `useHideoutStore` + `itemProgress` (ключ `station|level|itemId`, localStorage) + `clearLevelProgress`; сброс убежища чистит всё.
- **Данные**: `getHideoutStations()` + `getHideoutNeeds()` (+`slug` из зеркала prices для кросс-линка).
- **Фиксы**: класс `.icon-eft-vents` отсутствовал в icons.css (добавлен); маппинг иконок kebab→snake + спец-кейсы (`medstation→med_station`, `illumination→illumitation`-опечатка, `intelligence-center→intelligence_centre`, `library` — фолбэк).
- Подстраницы станций доступны из панели («Страница модуля» → `/modules/<slug>`).

---
*Хаб: [[player-tracking-tab]] · Процесс: [[engineering-loop]]*
