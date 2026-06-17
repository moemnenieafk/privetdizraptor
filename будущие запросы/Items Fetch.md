Выступи в роли Senior Fullstack Developer. Необходимо реализовать новую сортировку по динамическому показателю, обновить маппинг категорий модулей оружия для API tarkov.dev и добавить новый пункт меню.
1. Сортировка по Dynamic Top Indicator:
В компонент панели управления @src/components/features/items/CategoryControlBar.tsx добавь новую опцию сортировки: "По показателю" (или "По характеристике"). Она должна встать в один ряд с сортировками по цене/слот, барахолке и торговцам.
Логика сортировки: Сортировка должна идти от большего к меньшему (descending). Так как функция getDynamicTopIndicator(item) возвращает строку (например, "196", "1.2 kg"), для корректной сортировки извлеки из результата чистое числовое значение (вырежи подстроки вроде kg или используй исходное сырое поле предмета, на основе которого этот индикатор строится, например weight, capacity и т.д.).
2. Новая категория "Подствольные устройства":
В конфигурацию меню в раздел "Элементы" добавь новый пункт:
Имя в меню: "Подствольные устройства"
Заголовок страницы: "Подствольные устройства"
Slug (URL): launchers
Иконка: класс .icon-eft-underbarrel-launchers из icons.css.
3. Строгий маппинг типов API (Weapon Mods & Elements):
Обнови конфигурацию typeMapping или функцию получения предметов, распределив подразделы по их точным GraphQL-типам из API tarkov.dev:
Критические [vitalparts]:
Газовые трубки (gasblocks): types.includes('gasblock')
Крышки и ресиверы (receivers-slides): types.includes('receiver')
Стволы (barrels): types.includes('barrel')
Цевья (handguards): types.includes('handguard')
Функциональные [functional]:
Вспом. части (auxiliary-parts): types.includes('auxiliaryMod')
Дульные устройства (muzzle-devices): types.includes('muzzle')
Прицелы (sights): types.includes('sight')
Фонарики и ЛЦУ (light-laser-devices): types.includes('flashlightLaser')
Сошки (bipods): types.includes('bipod')
Такт. рукоятки (foregrips): types.includes('foregrip')
Элементы [elements]:
Крепления (mounts): types.includes('mount')
Магазины (magazines): types.includes('magazine')
Приклады и Ложе (stock-chasis): types.includes('stock')
Рукоятки заряжания (charginghandles): types.includes('chargingHandle')
Подствольные устройства (launchers): types.includes('grenadeLauncher')
Execution Steps:
Выведи код изменений в CategoryControlBar.tsx (добавление новой опции сортировки).
Покажи обновленную функцию фильтрации/сортировки на клиенте, обрабатывающую новый тип сортировки по индикатору.
Выведи обновленный массив конфигурации категорий с новым подствольным модулем и точными системными именами (slugs).
Только чистый код без лишней теории.