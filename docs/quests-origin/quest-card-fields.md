# Поля квеста — референс для дизайна карточки

> Источники: `src/types/quest.ts`, `src/lib/eft-api.ts` (GraphQL), `QuestNode`, `QuestDrawer`

---

## КОРНЕВЫЕ ПОЛЯ `TaskRaw`

| Поле | Тип | Сейчас используется | Где на карточке |
|---|---|---|---|
| `id` | `string` | везде | не отображается, технический ключ |
| `name` | `string` | QuestNode, Drawer | **Заголовок карточки** — главный текст |
| `normalizedName` | `string` | URL/поиск | не показывается |
| `kappaRequired` | `boolean` | QuestNode (иконка), Drawer | **Бейдж Каппа** — маленький значок рядом с именем |
| `lightkeeperRequired` | `boolean` | QuestNode (иконка), Drawer | **Бейдж Маяк** — аналогично |
| `minPlayerLevel` | `number` | QuestNode (бейдж блокировки), Drawer | **Бейдж уровня** — показывать на locked-карточке |
| `experience` | `number` | Drawer (секция наград) | **Награда XP** — лучше вынести на карточку в компактном виде |

---

## ТОРГОВЕЦ `trader: TaskTrader`

| Поле | Тип | Где на карточке |
|---|---|---|
| `trader.name` | `string` | **Сабтайтл** над именем квеста — «ПРАПОР» |
| `trader.normalizedName` | `string` | Ключ для `traderImg()` — фото торговца |
| `trader.imageLink` | `string?` | Опционально — аватар торговца из API |

**Почему:** торговец — первичная группировка, визуально задаёт цветовой акцент карточки.

---

## ПРЕД-УСЛОВИЯ `taskRequirements`

```ts
taskRequirements: Array<{ task: { id: string; name: string } }>
```

| Поле | Где на карточке |
|---|---|
| `task.id` | граф — ребро «из» этого квеста |
| `task.name` | в Drawer или тултипе: «Требует: [Имя квеста]» |

**Почему:** показывать список блокирующих квестов на locked-карточке полезнее, чем просто «ЗАБЛОКИРОВАНО».

---

## ЗАДАЧИ `objectives: TaskObjective[]`

Общие поля у всех задач:

| Поле | Тип | Где |
|---|---|---|
| `id` | `string` | ключ списка |
| `__typename` | дискриминатор | определяет иконку и суб-поля |
| `description` | `string` | **Текст задачи** — основная строка в Drawer |
| `optional` | `boolean` | **Метка «НЕ ОБЯ.»** — уменьшенная прозрачность |
| `type` | `string` | дублирует `__typename`, не нужен в UI |

### `TaskObjectiveItem` — собрать предметы
| Поле | Где |
|---|---|
| `item.name` / `item.shortName` | название предмета |
| `item.image512pxLink` | иконка предмета рядом с задачей |
| `count` | «× 5» — количество |
| `foundInRaid` | **FiR бейдж** красным — критически важно |

### `TaskObjectiveShoot` — уничтожить
| Поле | Где |
|---|---|
| `target` | цель (Scav, Sniper...) |
| `distance.value` | дистанция в метрах |
| `distance.compareMethod` | «>=», «<=» — направление ограничения |

### `TaskObjectiveBasic` — посетить/выполнить
| Поле | Где |
|---|---|
| `maps[].name` | **Метка локации** — очень важно для фильтрации и отображения на карточке |
| `maps[].normalizedName` | ключ для фильтра карт |

### `TaskObjectiveTraderLevel` — уровень торговца
| Поле | Где |
|---|---|
| `trader.name` | имя торговца |
| `trader.normalizedName` | аватар |
| `level` | «ЛВЛ. 3» — требуемый уровень |

**Почему этот тип важен:** если у игрока уровень торговца ниже — это блокирует квест. Сейчас показывается как бейдж на карточке, правильно.

### Маппинг иконок задач

| Иконка | CSS-класс | `__typename` / `type` |
|---|---|---|
| LL-бейдж | `icon-eft-quests-rep` | `TaskObjectiveTraderLevel` |
| Лупа | `icon-eft-quests-investigate` | `TaskObjectiveBasic` → `findItem`, `findQuestItem` |
| Пин | `icon-eft-quests-visit` | `TaskObjectiveBasic` → `visit`, `plantItem` / `TaskObjectiveMark` |
| Череп | `icon-eft-quests-eliminate` | `TaskObjectiveShoot` |
| Бегущий | `icon-eft-quests-survive` | `TaskObjectiveBasic` → `survive`, `extract` |
| Рука | `icon-eft-quests-loot` | `TaskObjectiveItem` |
| Корзина | `icon-eft-quests-modify` | `TaskObjectiveBasic` → `buildWeapon`, `modifyWeapon` |

---

### `TaskObjectiveMark` — разметить точку
| Поле | Где |
|---|---|
| `markerItem.name` / `shortName` | название маркера |
| `markerItem.image512pxLink` | иконка |

### `TaskObjectivePlayerLevel` — уровень игрока
| Поле | Где |
|---|---|
| `playerLevel` | порог уровня — дублирует `minPlayerLevel`, но через задачу |

---

## НАГРАДЫ `finishRewards: FinishRewards`

### Опыт
```ts
task.experience: number  // отдельное поле на корне TaskRaw
```
→ **«+12 000 XP»** — хорошо видно даже на компактной карточке

### Репутация торговца
```ts
finishRewards.traderStanding: Array<{
  trader: { name, normalizedName },
  standing: number
}>
```
→ **«Прапор +0.03»** — строка с аватаром торговца и дельтой репутации

### Предметы-награды
```ts
finishRewards.items: Array<{
  item: { id, name, shortName, image512pxLink },
  count: number
}>
```
→ **Горизонтальный скролл иконок** — сейчас реализован в Drawer

---

## RUNTIME-ПОЛЯ `QuestNodeData` (не из API, вычисляются локально)

| Поле | Откуда | Как влияет на карточку |
|---|---|---|
| `status` | `computeStatusMap()` | `locked` / `active` / `completed` — цвет рамки и стиль |
| `lockReason` | то же | `prereq` / `level` / `both` — что именно показать в бейдже |
| `levelGap` | то же | разница уровней — если ≤ 5 подсвечивать желтым |
| `dimmed` | фильтр | `opacity-20 grayscale` когда не в фильтре |
| `freshlyUnlocked` | после завершения prereq | анимация «НОВЫЙ» + бейдж |
| `chainRole` | hover-хайлайт | `ancestor` / `descendant` / `self` — цвет обводки |
| `pinned` | Zustand `pinnedQuests` | иконка закладки на карточке |
| `traderLevels` | профиль игрока | для проверки `TaskObjectiveTraderLevel` |

---

## РЕКОМЕНДАЦИИ ПО ЗОНАМ КАРТОЧКИ

```
┌──────────────────────────────┐
│ [img] ПРАПОР         [K][LK] │  ← trader.name + kappaRequired + lightkeeperRequired
│ Название квеста              │  ← task.name (главный текст)
│                              │
│ [map-icon] Завод  +12k XP    │  ← objectives[].maps + experience (новое!)
│──────────────────────────────│
│ [ ВЫПОЛНЕНО? ]    [🔖]       │  ← кнопка + pin
│ ▓▓▓░░░░░░░░ 2/5             │  ← прогресс-бар itemProgress (активный)
└──────────────────────────────┘
             ↓ (бейджи поверх)
         [ЛВЛ. 25]  [Прапор ЛВЛ. 3]   ← minPlayerLevel + traderLevel lock
```

**Что сейчас не показывается на карточке, но стоит добавить:**
- `experience` — XP за квест (только на активных, компактно)
- `maps` из `TaskObjectiveBasic` — локация(и) квеста
- `taskRequirements[].task.name` — список блокирующих квестов на locked-карточках
