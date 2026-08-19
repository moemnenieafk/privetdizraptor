---
status: ✅ сделано
affects: [[dossier-profile-integration]], [[archetype-feature-map]], [[player-progress-profile]]
date: 2026-08-19
---

# Каппа-трекер в Досье и архетипах

**Статус:** ✅ сделано (реализовано + live-verify)
**Затрагивает:** [[dossier-profile-integration]] · [[archetype-feature-map]] · [[player-progress-profile]]

## Контекст
Трекер «Коллекционер» (контейнер Kappa) перенесён из Заданий в Прогресс (`/eft/progress/collector`).
Дальше — «внедрить и использовать его в системе Досье, определить и распределить по архетипам».
Проблема: прогресс трекера был заперт в самом компоненте (`useQuestStore.itemProgress[COLLECTOR_QUEST_ID]`),
Досье про Каппу не знало, а архетип «Каппавод» (`collector`) инферился очень слабо — только по `prestige>0`
и обобщённым визитам в `quests/questmap`. Реального сигнала «человек собирает Каппу» система не видела.

## Что сделано
Каппа-прогресс стал **производной метрикой** (не заперт в UI), считается на клиенте (без БД — как и сам трекер):

1. **Селектор** `src/lib/kappa-progress.ts` — `kappaProgressFromIds(objectiveIds, itemProgress) → {found,total,ratio,pct}`.
   Единый источник для Досье и инференса.
2. **Инференс** `src/lib/role-inference.ts` — факт `kappaProgress`; распределение по ролям:
   `collector += ratio×6`, `progressor += ratio×1.5`, `tryhard += 1` при ≥80%; ось «спидран↔коллекционер» → к коллекционеру.
3. **UI Досье** — блок прогресса Каппы (`found/total`, бар, `Собрано %`, ссылка на трекер) в карточке
   архетипа, **виден только когда архетип = Каппавод**.
4. **Грид «Избранные разделы»** — фича «Трекер Каппы» в `feature-catalog.ts` + в наборе Каппавода.
5. **Проводка** — `RoleAutoWire` подмешивает `kappaProgress` в факты, пересчёт при изменении трекера.

## Развилки сверки (решения V4DYA)
Live-verify вскрыл два неочевидных факта — по каждому принято решение и реализовано:

- **Сила инференса (чек 7).** При 84% сигнал втекал (reason + ось), но `collector` НЕ становился primary у
  «тяжёлого» профиля: поведенческие счётчики безграничны (`maps≈356`, `prices≈66` → `rat≈420`), а фактовые
  бонусы — единицы. **Решение: жёсткий лок** — при сборе ≥ `KAPPA_PRIMARY_LOCK` (0.75) Каппавод
  детерминированно перехватывает primary мимо поведения (прежний лидер → secondary). Порог тюнингуемый.
- **Зависимость от `tasks` (факт B).** `useQuestStore.tasks` — рантайм-кэш (не персистится), сеялся только
  на карте заданий → холодный вход/refresh/deep-link на `/eft/hub` показывал `tasks=[]` → блок скрыт,
  сигнал `null`. **Решение: серверный набор id'ов** — `getKappaObjectiveIds()` (server-only, из `EFT_QUESTS`)
  прокидывается RSC хаба пропом и засевается страницей трекера в персист-поле `useQuestStore.kappaObjectiveIds`.
  Теперь Каппа считается без рантайм-tasks и переживает refresh. `EFT_QUESTS` в клиентский бандл не тянется
  (server-only модуль `src/lib/kappa-objectives.server.ts`).

## Итог live-verify (dev :3000, залогинен)
Все 9 проверок зелёные: перенос маршрута (рендер/308-редирект/навигация), блок Каппы (`37/44`, бар,
ссылка), реактивность (снял 2 → `35/44 80%`), гейт (только Каппаводу), инференс-лок (на холодной
загрузке `derived.primary=collector`, `secondary=rat`, reason «Каппа собрана под порог…»), грид
(«Трекер Каппы» подсвечен), консоль без ошибок.

## Осталось / долги
- **Тюнинг порога/весов** `KAPPA_PRIMARY_LOCK` (0.75) и `ratio×6` — на усмотрение V4DYA после обкатки.
- Общий архитектурный разрыв масштабов «поведение (сотни) vs факты (единицы)» касается и других
  фактовых архетипов (`tryhard`, `seasonal`) — они так же не всплывают primary у активных игроков.
  Каппа закрыта локом точечно; системный пересчёт — отдельная тема, если понадобится.
- Счётчик предметов у старой `QuestsHubNav` (`count`) в стандартном `SectionHubNav` не выводится —
  осознанная мелкая потеря при переносе.

## Файлы
`src/lib/kappa-progress.ts` · `src/lib/kappa-objectives.server.ts` · `src/lib/role-inference.ts`
`src/store/useQuestStore.ts` · `src/components/providers/RoleAutoWire.tsx`
`src/components/features/adaptive/AdaptiveHubClient.tsx` · `src/app/eft/hub/page.tsx`
`src/data/feature-catalog.ts` · `src/components/features/quests/CollectorTracker/index.tsx`
Перенос маршрута: `src/app/eft/progress/collector/page.tsx` (+ 308-редирект `src/app/eft/quests/collector/page.tsx`)
`src/data/headerConfig.ts` · `src/lib/quest-constants.ts`
