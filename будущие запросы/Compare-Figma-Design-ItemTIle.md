Role & Task:
Обнови архитектуру компонента @src/components/features/items/EftItemTile/EftItemTile.tsx на основе паттерна Compound Components. Изучи прикрепленные скриншоты дизайна. Разработай план реализации (Plan Mode) перед написанием кода.

1. Global UI Rules:

Иконки-индикаторы: Контейнер 24x24px (кнопка/обертка), внутри иконка 16x16px. Источник: @src/styles/icons.css.

Форматирование цен: Динамическое сокращение (Intl.NumberFormat). Значения < 100 000 выводить полностью, >= 100 000 сокращать (например, 150k), чтобы избежать наслоения UI.

2. Dynamic Top Indicator (#9A8866):
Располагается в верхней части карточки. Значение зависит от item.category:

Backpacks, Rigs (без плит) -> Вместимость слотов (целое число).

Armor, Helmets, Armored Rigs, Visors -> Прочность (current/max).

Headphones -> Расчетный показатель порога слышимости (дистанция).

Ammo, Ammo Packs -> Скрыто (или кастомный показатель).

Mods -> Ключевой стат (Эргономика / Отдача / Вес).

Provisions, Meds -> Время действия эффекта ИЛИ кол-во применений.

Keys, Keycards -> Кол-во применений.

Info, Special -> Вес.

3. Modules & Interactive Tooltips (Compound Elements):
Реализуй следующие подключаемые модули-индикаторы. Интерактивные тултипы открываются по клику/ховеру:

[Profit Barter] (Top-Left): класс .icon-eft-prog-barter. Состояния: Выгодный (--color-nvg-green), Невыгодный (--color-danger), Нейтральный (--color-text-secondary). Тултип: "Рассчёт бартера".

[Profit Craft] (Top-Right): класс .icon-eft-prog-craft. Состояния и цвета как у Barter. Тултип: "Рассчёт крафта".

[Quest Progress] (Bottom-Right): класс .icon-eft-quests-side. Связь с телеметрией заданий.

[Armor Class]: класс .icon-eft-armor-class-1 (динамическая цифра 1-6).

[Trader Loyalty]: класс .icon-eft-profile-rep-1 (динамическая цифра 1-4). Размер 12x12px. Инлайн-позиционирование рядом с иконкой торговца.

[Price per Slot]: класс .icon-eft-items-price-slot. Цвет: --color-nvg-green (если выгодно) или базовый серый.

[Quest Unlock Trade]: класс .icon-eft-quests. Расположение: рядом с заблокированным торговцем.

[Level Requirement]: Hex-иконка (stroke 1.5px, no fill) с числом (1-80). Состояния: Доступ закрыт (--color-danger), Доступ открыт (--color-nvg-green). Связь с PlayerTelemetry.tsx.

[Out of Stock / "Нет"]: Красная иконка + текст. Выравнивание динамическое (left/right) в блоке цен.

4. Category Overrides:

Ammo, Ammo Packs: Обязательные индикаторы в блоке медиа. Слева: Урон (контейнер 24x24px, цвет текста #E3433F). Справа: Пробитие (контейнер 24x24px, цвет текста #E68E25).

Execution Steps:

Сгенерируй Markdown-план архитектуры (интерфейсы пропсов, структура Compound Component).

Задай мне уточняющие вопросы через AskUserQuestion, если не хватает данных по маппингу категорий или стейт-менеджменту.

Дождись моего аппрува перед написанием TSX-кода.