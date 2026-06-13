# **Архитектурное проектирование интерфейсов и анализ структур данных в Escape from Tarkov**

Высокая плотность информации и глубина игровой симуляции в тактическом симуляторе Escape from Tarkov предъявляют экстремальные требования к сторонним аналитическим инструментам и базам данных.1 Игроки вынуждены постоянно анализировать баллистические таблицы, параметры износа экипировки, акустические свойства гарнитур и экономические колебания рынка, чтобы принимать эффективные решения как внутри рейда, так и во время подготовки в убежище.2 Разработка эффективного интерфейса для платформ-компаньонов на базе современных веб\-технологий, таких как Next.js и Tailwind CSS, требует глубокого понимания структуры игровых данных, включая недокументированные и скрытые характеристики предметов.1  
Для минимизации когнитивной нагрузки на пользователя интерфейс должен разделяться на два основных формата представления данных: высокоплотный табличный вид (для детального сравнения и сортировки на экранах настольных компьютеров) и плиточный вид (для быстрого визуального распознавания и оперативной работы в качестве второго экрана).2

## **Концепция двухуровневого интерфейса: табличное и плиточное представление**

Табличный вид ориентирован на глубокий аналитический подход вне игрового процесса.2 Он оптимизирован для сопоставления десятков элементов, позволяя осуществлять гибкую сортировку по скрытым числовым коэффициентам и точным экономическим метрикам.1 Плиточный вид имитирует структуру внутриигрового инвентаря, делая упор на визуальное распознавание через цветовое кодирование, шкалы эффективности и интуитивно понятные индикаторы статуса.1

## **Спецификация и структура данных основных категорий предметов**

Для реализации полноценной информационной системы необходимо деконструировать все ключевые категории игрового снаряжения, выделив критически важные параметры для каждого типа отображения.5

### **Бронежилеты и бронеплиты**

Проектирование интерфейса бронезащиты требует совмещения открытых и скрытых баллистических параметров.6 Основная сложность заключается в том, что отображаемые в игре показатели прочности не дают игроку представления о реальной живучести брони без учета физических свойств материалов.8 Скрытый коэффициент разрушаемости полностью меняет ценность бронеплиты.6

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Класс брони** | class | Сортируемый числовой столбец (1–6).1 | Крупная иконка щита с цветовой индикацией класса.3 |
| **Прочность** | durability | Текущая и максимальная прочность в цифрах.1 | Интуитивно понятная шкала состояния (зеленый/красный).1 |
| **Материал** | material.name | Текстовое название материала плиты.1 | Всплывающая подсказка с описанием качества ремонта.8 |
| **Зоны защиты** | zones | Список защищаемых зон (Грудь, Живот, Бока).1 | Интерактивный силуэт человеческого тела со светящимися зонами.7 |
| **Штраф эргономики** | ergoPenalty | Точное числовое значение дебаффа.1 | Компактная метка отрицательного эффекта.1 |
| **Штраф скорости** | speedPenalty | Процент замедления перемещения.1 | Значок скорости с числовым дебаффом.1 |
| **Допустимые плиты** | allowedPlates | Список совместимых бронеплит для замены.1 | Визуальные слоты под установку плит в карточке.1 |

### **Разгрузочные системы**

Разгрузочные системы разделяются на чисто утилитарные и бронированные (бронеразгрузки).1 Для них критически важно отображать конфигурацию внутреннего пространства схрона.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Вместимость** | capacity | Общее количество внутренних слотов.1 | Текстовый индикатор формата «X слотов».1 |
| **Сетка слотов** | grids | Конфигурация карманов (например, два слота 3x2).1 | Визуальная сетка ячеек, имитирующая инвентарь.9 |
| **Класс защиты** | class | Уровень брони (для бронированных разгрузок).1 | Иконка щита поверх изображения разгрузки.3 |
| **Вес** | weight | Физическая масса предмета в килограммах.1 | Компактное текстовое значение веса в углу плитки.1 |

### **Активные наушники**

Активные наушники в игре Escape from Tarkov определяют дистанцию обнаружения акустических контактов.10 Скрытые низкоуровневые параметры звукового процессора полностью меняют звуковую картину для пользователя.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Множитель дистанции** | distanceModifier | Коэффициент усиления слуха (например, 1.135).1 | Процентный прирост дальности (например, \+13.5%).13 |
| **Порог компрессора** | compressorThreshold | Значение ограничения громких звуков выстрелов.1 | Качественная оценка подавления взрывов.12 |
| **Частота среза** | cutoffFrequency | Граница фильтрации фонового шума в Герцах.1 | Текстовый профиль (например, «Высокочастотный»).12 |
| **Громкость окружения** | ambientVolume | Уровень подавления шума ветра и дождя.1 | Степень фильтрации помех (Высокая/Средняя).14 |

### **Шлемы и модификации шлемов**

Шлемы защищают голову игрока, но часто накладывают серьезные ограничения на слух и обзор.1 Модификации шлемов позволяют устанавливать забрала, наушники и броненакладки.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Блокировка наушников** | blocksHeadset | Логический флаг совместимости с гарнитурами.1 | Предупреждающий значок перечеркнутых наушников.3 |
| **Глушение звука** | deafening | Степень приглушения окружающего звука шлемом.1 | Текстовый индикатор звуковой изоляции.1 |
| **Челюсти и забрала** | slots | Наличие слотов под установку модификаций.1 | Интерактивные точки крепления модулей на плитке.16 |
| **Защита глаз** | blindnessProtection | Степень снижения эффекта ослепления (0–1.0).1 | Символ вспышки с процентом защиты.1 |

### **Очки и лицевые маски**

Очки предотвращают ослепление от светошумовых гранат, а некоторые модели обладают баллистической прочностью.1 Лицевые маски и балаклавы могут скрывать инфракрасный силуэт игрока от тепловизоров.17

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Светоподавление** | blindnessProtection | Числовой коэффициент защиты от ослепления.1 | Иконка темных очков с уровнем защиты.1 |
| **Класс защиты очков** | class | Баллистический класс защиты линз (если есть).1 | Небольшой щиток класса защиты в углу плитки.3 |
| **ИК-фильтрация** | types / description | Флаг скрытности в тепловизионном спектре.1 | Маркер «Thermal Mask» для масок Cold Fear.17 |

### **Рюкзаки**

Рюкзаки определяют объем переносимого лута, но накладывают штрафы на скорость передвижения и поворота персонажа.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Размер сетки схрона** | width / height | Физические габариты рюкзака в ячейках.1 | Сетка размеров, занимаемая предметом в инвентаре.9 |
| **Внутренний объем** | capacity | Общее число доступных внутренних ячеек.1 | Индикатор полезного объема относительно габаритов.1 |
| **Штраф поворота** | turnPenalty | Процент замедления вращения мыши.1 | Графический маркер дебаффа чувствительности.1 |

### **Защищенные контейнеры и кейсы**

Контейнеры защищают ценные вещи от потери при смерти.4 Внутриигровые кейсы позволяют компактно структурировать хранилище.9 Они имеют жесткие ограничения на типы помещаемых внутрь предметов.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Фильтр исключений** | excludedCategories | Список запрещенных к помещению типов предметов.1 | Красные значки блокировки несовместимых типов.1 |
| **Разрешенные типы** | allowedCategories | Список разрешенных типов (например, только патроны).1 | Цветовое кодирование назначения кейса в плитке.1 |

### **Повязки и оружейные камуфляжи**

Косметические предметы служат для визуального распознавания союзников в бою и кастомизации оружия.5 Они не влияют на баллистические характеристики персонажа.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Престиж-требование** | requiredPrestige | Уровень престижа, необходимый для покупки.1 | Значок золотой медали с уровнем разблокировки.1 |
| **Редкость предмета** | rarity | Категория редкости (Common, Rare, Legendary).1 | Цветовая рамка плитки в зависимости от редкости.1 |

### **Оружие и магазины**

Сложные механические системы оружия дополняются магазинами, влияющими на скорость перезарядки, проверку патронов и надежность подачи боеприпасов в патронник.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Емкость магазина** | capacity | Максимальное количество патронов в магазине.1 | Числовой индикатор емкости внутри силуэта рожка.1 |
| **Скорость зарядки** | loadModifier | Коэффициент замедления снаряжения магазина патронами.1 | Процентный индикатор скорости снаряжения.1 |
| **Скорость проверки** | ammoCheckModifier | Коэффициент скорости анимации проверки остатка патронов.1 | Иконка глаза с индикатором задержки анимации.1 |
| **Шанс утыкания** | malfunctionChance | Вероятность заклинивания оружия при подаче из магазина.1 | Предупреждающий маркер надежности магазина.1 |

### **Боеприпасы**

Патроны в игре полностью определяют исход перестрелки.3 Скрытые характеристики патронов влияют на здоровье персонажа и состояние его оружия.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Пробитие брони** | penetrationPower | Точное значение пробития (0–100).1 | Графический барометр пробиваемых классов брони.22 |
| **Физический урон** | damage | Урон, наносимый незащищенному телу за выстрел.1 | Крупное числовое значение базового урона пули.1 |
| **Урон прочности** | armorDamage | Процент урона, наносимого прочности брони плиты.1 | Метрика разрушительного потенциала патрона.6 |
| **Шанс кровотечения** | heavyBleedModifier | Множитель вероятности наложения тяжелого кровотечения.1 | Капелька крови с процентом вероятности травмы.1 |
| **Расход выносливости** | staminaBurnPerDamage | Степень снижения выносливости цели при попадании.1 | Иконка бегущего человека со штрафом к стамине.1 |

### **Вспомогательные предметы (Медикаменты, Ключи и Провизия)**

Медикаменты, ключи доступа и еда обеспечивают выживаемость персонажа в рейде и открывают доступ к запертым зонам локаций.1

| Поле данных | Ключ в API | Табличный вид | Плиточный вид |
| :---- | :---- | :---- | :---- |
| **Время применения** | useTime | Длительность анимации использования в секундах.1 | Компактная иконка секундомера с таймером.1 |
| **Снимаемые эффекты** | cures | Список устраняемых негативных состояний тела.1 | Набор цветных иконок эффектов на карточке.1 |
| **Ресурс использования** | uses | Оставшееся количество применений предмета.1 | Дробный индикатор ресурса поверх иконки.1 |
| **Энергия и вода** | energy / hydration | Восстанавливаемые показатели питания персонажа.1 | Желтый и синий прогресс-бары восстановления.1 |

## **Скрытые баллистические и акустические параметры**

Наибольшую ценность для опытных игроков представляют параметры, скрытые разработчиками из стандартного описания предметов в клиенте игры.2 Интеграция этих данных в интерфейсы внешних баз данных дает пользователю ключевое преимущество.2

### **Эффективная прочность бронематериалов**

Как было отмечено ранее, отображаемая прочность бронежилета является условной величиной.8 Настоящее количество выдерживаемых попаданий рассчитывается через показатель эффективной прочности (![][image1]).6 Физика пробития учитывает отношение текущей прочности к первоначальному максимуму плиты, умноженное на коэффициент деструктивности материала 6:  
![][image2]  
Коэффициенты деструктивности существенно различаются в зависимости от патча, что создает необходимость вывода динамических расчетов в табличном виде для предупреждения ошибок при покупке изношенного снаряжения.2 Например, бронесталь с коэффициентом деструктивности ![][image3] теряет прочность при попадании значительно быстрее, чем сверхвысокомолекулярный полиэтилен (СВМПЭ/UHMWPE) с коэффициентом ![][image4], из\-за чего плиты с одинаковым классом защиты обладают принципиально разной живучестью в бою.7

### **Скрытый порог фрагментации патронов**

В игре присутствует параметр «Шанс фрагментации» (fragmentationChance), который при срабатывании наносит цели дополнительные ![][image5] урона.1 Однако серверный код игры содержит жесткое ограничение: **пули с проникающей способностью ниже 20 единиц никогда не фрагментируются**, независимо от заявленной в характеристиках вероятности.7  
Это приводит к тому, что экспансивные патроны (например, калибра 12/70 RIP со ![][image6] шансом фрагментации) физически лишены этой механики.25 В табличном представлении патронов веб\-интерфейс должен автоматически корректировать это поле: если показатель penetrationPower меньше 20, в колонке фрагментации должен отображаться статус «Блокировано механиком игры».7

### **Скрытая акустическая физика активных гарнитур**

Активные наушники не просто линейно увеличивают громкость шагов.12 Игровой движок рассчитывает распространение звука с использованием сложных скрытых параметров для каждой модели гарнитуры.1

* compressorAttack и compressorRelease — время срабатывания и затухания компрессора при резком изменении громкости звукового окружения.1 Быстрая атака мгновенно гасит звук близкого взрыва гранаты, сохраняя слух игрока.1  
* compressorThreshold — пороговое значение децибел, выше которого звуки начинают принудительно приглушаться.1  
* highFrequencyGain и resonance — аппаратное усиление высоких частот.1 Повышенные значения позволяют четко выделять тихие шорохи шагов по кустам и траве, но перегружают слуховой канал шумом сильного дождя или ветра.12  
* cutoffFrequency — частота среза низкочастотного гула.1 Позволяет убрать постоянный фоновый шум работы дизельных генераторов на локациях «Лаборатория» и «Развязка», делая позиционирование врагов более точным.12

### **Скрытые параметры увода ствола оружия**

Отображаемые числовые параметры вертикальной и горизонтальной отдачи оружия в Escape from Tarkov не являются исчерпывающими характеристиками поведения ствола при стрельбе.18 Поведение оружия при автоматическом огне определяется четырьмя скрытыми переменными 18:

* recoilDispersion (дисперсия отдачи) — конус случайного смещения вектора ствола при каждом выстреле.18 Данный параметр отвечает за непредсказуемый горизонтальный увод ствола влево и вправо, который невозможно компенсировать физическим движением мыши вниз.19  
* convergence (скорость схождения) — темп восстановления прицельной марки оружия в исходную точку после выстрела.18 Высокий показатель схождения обеспечивает минимальный начальный подброс ствола при первом выстреле очереди.24  
* recoilAngle (угол увода) — вектор постоянного дрейфа ствола под воздействием непрерывной стрельбы.19 Угол в ![][image7] направляет оружие строго вверх, тогда как отклонения уводят прицел по диагонали.19  
* cameraRecoil (тряска камеры) — амплитуда содрогания поля зрения игрока (FOV) в момент выстрела.19 Высокий показатель создает сильный визуальный дискомфорт и мешает отслеживать попадания по цели, даже если само оружие практически не имеет физической отдачи.28

## **Интеграция экономических данных и репутации торговцев**

Игровая экономика Escape from Tarkov тесно связана с репутацией игрока у торговцев, особенно у Скупщика (Fence), олицетворяющего отношение Диких к ЧВК.1 Высокий или низкий уровень лояльности Скупщика открывает скрытые экономические механики и изменяет стоимость услуг.1

### **Скрытые параметры репутации Fence (Скупщика)**

Репутация у Скупщика влияет на кулдауны выходов Дикого, время работы ящика Диких в Убежище и функционирование бронетранспортера (БТР) на локациях.1

| Поле данных в API | Влияние на игровой процесс (при изменении репутации) | UX/UI визуализация в профиле |
| :---- | :---- | :---- |
| scavCooldownModifier | Множитель времени перезарядки возможности играть за Дикого.1 | Таймер кулдауна с индикацией сэкономленного времени.1 |
| scavCaseTimeModifier | Изменение времени ожидания возвращения Диких с добычей.1 | Прогресс-бар крафта с таймером завершения.1 |
| scavEquipmentSpawnChanceModifier | Повышение шанса появления Дикого с ценным снаряжением.1 | Оценка качества стартового комплекта в процентах.1 |
| btrTaxiDiscount | Скидка на услуги перемещения по карте на БТР.1 | Процент скидки зеленого цвета рядом со стоимостью.1 |
| btrDeliveryDiscount | Снижение цены на отправку найденного лута в схрон из рейда.1 | Иконка посылки со сниженной ценой в рублях.1 |
| btrCoveringFireDiscount | Скидка на заказ огневой поддержки БТР по площади.1 | Значок перекрестия с текущей стоимостью вызова.1 |
| btrDeliveryGridSize | Максимальный объем ячеек для отправки предметов через БТР.1 | Сетка доступного объема доставки из рейда.1 |
| hostileBosses / hostileScavs | Логический статус агрессии боссов и Диких к игроку-Дикому.1 | Предупреждающие маркеры «Агрессия» (Да/Нет).1 |

## **Системные рекомендации по разработке интерфейсов**

Для реализации высокопроизводительного интерфейса на стеке Next.js и Tailwind CSS необходимо минимизировать нагрузку на клиент при обработке баллистических и экономических расчетов в реальном времени.1 Ниже представлен компонент интерактивной карточки оружия, написанный на TypeScript с использованием Tailwind CSS, который наглядно демонстрирует интеграцию скрытых параметров отдачи и автоматический расчет результирующих показателей для игрока.1

TypeScript  
import React from 'react';

interface WeaponStatsProps {  
  name: string;  
  caliber: string;  
  fireRate: number;  
  ergonomics: number;  
  verticalRecoil: number;  
  horizontalRecoil: number;  
  // Скрытые параметры из API  
  recoilDispersion: number;  
  convergence: number;  
  cameraRecoil: number;  
  fleaPrice: number;  
}

export const WeaponStatsCard: React.FC\<WeaponStatsProps\> \= ({  
  name,  
  caliber,  
  fireRate,  
  ergonomics,  
  verticalRecoil,  
  horizontalRecoil,  
  recoilDispersion,  
  convergence,  
  cameraRecoil,  
  fleaPrice,  
}) \=\> {  
  // Расчет условного индекса стабильности зажима (Full-Auto Control Index)  
  // Чем выше конвергенция и ниже дисперсия с вертикальной отдачей, тем послушнее зажим  
  const controlIndex \= Math.round(  
    (convergence \* 100\) / ((verticalRecoil \+ horizontalRecoil) \* 0.1 \+ recoilDispersion \* 0.05)  
  );

  return (  
    \<div className="flex flex-col justify-between w-80 p-5 bg-neutral-950 border border-neutral-900 rounded-xl shadow-2xl hover:border-amber-500/50 transition-all duration-300"\>  
      {/\* Шапка карточки \*/}  
      \<div className="flex justify-between items-start mb-4"\>  
        \<div\>  
          \<span className="text-\[10px\] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded"\>  
            {caliber.replace('Caliber', '')}  
          \</span\>  
          \<h3 className="mt-2 text-base font-black text-neutral-100 tracking-tight line-clamp-1"\>  
            {name}  
          \</h3\>  
        \</div\>  
        \<div className="text-right"\>  
          \<span className="text-\[10px\] text-neutral-500 block uppercase"\>Барахолка\</span\>  
          \<span className="text-sm font-extrabold text-neutral-200"\>  
            {fleaPrice \> 0? \`${fleaPrice.toLocaleString('ru-RU')} ₽\` : 'Нет предложений'}  
          \</span\>  
        \</div\>  
      \</div\>

      {/\* Основные характеристики оружия \*/}  
      \<div className="space-y-3 my-4"\>  
        {/\* Эргономика \*/}  
        \<div\>  
          \<div className="flex justify-between text-xs mb-1"\>  
            \<span className="text-neutral-400"\>Эргономика\</span\>  
            \<span className="font-bold text-neutral-200"\>{ergonomics}\</span\>  
          \</div\>  
          \<div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden"\>  
            \<div className="h-full bg-emerald-500" style={{ width: \`${ergonomics}%\` }} /\>  
          \</div\>  
        \</div\>

        {/\* Отдача \*/}  
        \<div className="grid grid-cols-2 gap-4"\>  
          \<div className="bg-neutral-900/40 p-2 rounded border border-neutral-900"\>  
            \<span className="text-\[10px\] text-neutral-500 block uppercase"\>Вертикальная\</span\>  
            \<span className="text-sm font-black text-neutral-200"\>{verticalRecoil}\</span\>  
          \</div\>  
          \<div className="bg-neutral-900/40 p-2 rounded border border-neutral-900"\>  
            \<span className="text-\[10px\] text-neutral-500 block uppercase"\>Горизонтальная\</span\>  
            \<span className="text-sm font-black text-neutral-200"\>{horizontalRecoil}\</span\>  
          \</div\>  
        \</div\>  
      \</div\>

      {/\* Блок скрытых характеристик \*/}  
      \<div className="border-t border-neutral-900 pt-4 mt-2 space-y-2"\>  
        \<span className="text-\[10px\] font-bold text-neutral-500 uppercase block tracking-wider"\>  
          Скрытые баллистические параметры  
        \</span\>

        \<div className="grid grid-cols-2 gap-2 text-xs"\>  
          \<div className="flex justify-between"\>  
            \<span className="text-neutral-500"\>Дисперсия (Увод):\</span\>  
            \<span className="font-semibold text-amber-500/90"\>{recoilDispersion}\</span\>  
          \</div\>  
          \<div className="flex justify-between"\>  
            \<span className="text-neutral-500"\>Автосхождение:\</span\>  
            \<span className="font-semibold text-emerald-500"\>{convergence}\</span\>  
          \</div\>  
          \<div className="flex justify-between col-span-2"\>  
            \<span className="text-neutral-500"\>Тряска экрана (Camera):\</span\>  
            \<span className="font-semibold text-red-400"\>{cameraRecoil}\</span\>  
          \</div\>  
        \</div\>

        {/\* Сводный расчетный индекс контроля зажима \*/}  
        \<div className="flex justify-between items-center bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 mt-3"\>  
          \<div\>  
            \<span className="text-\[10px\] text-amber-500/70 uppercase block font-bold leading-none"\>  
              Индекс контроля зажима  
            \</span\>  
            \<span className="text-\[9px\] text-neutral-500"\>Спецификация автокомпенсации\</span\>  
          \</div\>  
          \<span className="text-2xl font-black text-amber-500"\>{controlIndex}\</span\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
};

## **Заключение**

Интеграция детального анализа скрытых параметров игровых предметов в единую архитектуру веб\-интерфейса позволяет решить проблему недостаточной информативности официального игрового клиента.2 Своевременное представление скорректированных данных — таких как автоматический расчет реальной живучести брони на базе коэффициентов износа материалов, скрытые лимиты фрагментации патронов и точное физическое поведение ствола при автоматическом огне — значительно упрощает взаимодействие игрока с комплексной экосистемой Escape from Tarkov.6 Разделение интерфейсов на детальные интерактивные таблицы сравнения и визуально легкие плиточные структуры обеспечивает оптимальный баланс между скоростью восприятия информации во время игрового процесса и глубиной анализа во время подготовки к рейдам.2

#### **Источники**

1. 06UIEscapefromTarkov.html  
2. tarkov-api | Skills Marketplace \- LobeHub, дата последнего обращения: июня 12, 2026, [https://lobehub.com/skills/openclaw-skills-tarkov-api](https://lobehub.com/skills/openclaw-skills-tarkov-api)  
3. New player here... what should I prioritize for gear? : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/1bi6fcn/new\_player\_here\_what\_should\_i\_prioritize\_for\_gear/](https://www.reddit.com/r/EscapefromTarkov/comments/1bi6fcn/new_player_here_what_should_i_prioritize_for_gear/)  
4. Trading \- The Official Escape from Tarkov Wiki \- Fandom, дата последнего обращения: июня 12, 2026, [https://escapefromtarkov.fandom.com/wiki/Trading](https://escapefromtarkov.fandom.com/wiki/Trading)  
5. Category:Gear \- The Official Escape from Tarkov Wiki \- Fandom, дата последнего обращения: июня 12, 2026, [https://escapefromtarkov.fandom.com/wiki/Category:Gear](https://escapefromtarkov.fandom.com/wiki/Category:Gear)  
6. Ballistics \- The Official Escape from Tarkov Wiki \- Fandom, дата последнего обращения: июня 12, 2026, [https://escapefromtarkov.fandom.com/wiki/Ballistics](https://escapefromtarkov.fandom.com/wiki/Ballistics)  
7. Armor, Penetration, and Damage \- EFT | Ammo, дата последнего обращения: июня 12, 2026, [https://www.eft-ammo.com/armor-and-penetration](https://www.eft-ammo.com/armor-and-penetration)  
8. Armor durability and material : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/11rbp4f/armor\_durability\_and\_material/](https://www.reddit.com/r/EscapefromTarkov/comments/11rbp4f/armor_durability_and_material/)  
9. Enable Tag for Rigs/Armored Rigs : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/fgg8gx/enable\_tag\_for\_rigsarmored\_rigs/](https://www.reddit.com/r/EscapefromTarkov/comments/fgg8gx/enable_tag_for_rigsarmored_rigs/)  
10. Best Headphones In Tarkov Tier List And Hearing Stats 2026 \- Progressive Radio Network \-, дата последнего обращения: июня 12, 2026, [https://progressiveradionetwork.com/best-headphones-in-tarkov/](https://progressiveradionetwork.com/best-headphones-in-tarkov/)  
11. Escape from Tarkov Headset Tier List \- Comprehensive Guide by SheefGG \- EFT | Ammo, дата последнего обращения: июня 12, 2026, [https://www.eft-ammo.com/headsets-table](https://www.eft-ammo.com/headsets-table)  
12. Escape From Tarkov Headset Tier List \- LepreStore, дата последнего обращения: июня 12, 2026, [https://leprestore.com/guides/eft/escape-from-tarkov-headset-tier-list/](https://leprestore.com/guides/eft/escape-from-tarkov-headset-tier-list/)  
13. Escape from Tarkov Headsets, дата последнего обращения: июня 12, 2026, [https://tarkov.dev/items/headsets](https://tarkov.dev/items/headsets)  
14. Headset Audio Detection Distances (again) : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/195c9hj/headset\_audio\_detection\_distances\_again/](https://www.reddit.com/r/EscapefromTarkov/comments/195c9hj/headset_audio_detection_distances_again/)  
15. \[Discussion\] Earpiece General Statistics 1.0 Update : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/1pu81je/discussion\_earpiece\_general\_statistics\_10\_update/](https://www.reddit.com/r/EscapefromTarkov/comments/1pu81je/discussion_earpiece_general_statistics_10_update/)  
16. Escape from Tarkov Gear components, дата последнего обращения: июня 12, 2026, [https://tarkov.dev/items/handbook/gear-components](https://tarkov.dev/items/handbook/gear-components)  
17. Escape from Tarkov Gear, дата последнего обращения: июня 12, 2026, [https://tarkov.dev/items/handbook/gear](https://tarkov.dev/items/handbook/gear)  
18. What's the point of weapon recoil stats if there is a hidden “camera recoil” stat that overrules it? : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/ry2mhd/whats\_the\_point\_of\_weapon\_recoil\_stats\_if\_there/](https://www.reddit.com/r/EscapefromTarkov/comments/ry2mhd/whats_the_point_of_weapon_recoil_stats_if_there/)  
19. The numbers Mason, they're bullshit. : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/tktbzg/the\_numbers\_mason\_theyre\_bullshit/](https://www.reddit.com/r/EscapefromTarkov/comments/tktbzg/the_numbers_mason_theyre_bullshit/)  
20. Ammunition \- The Official Escape from Tarkov Wiki \- Fandom, дата последнего обращения: июня 12, 2026, [https://escapefromtarkov.fandom.com/wiki/Ammunition](https://escapefromtarkov.fandom.com/wiki/Ammunition)  
21. Escape from Tarkov Ammo chart, дата последнего обращения: июня 12, 2026, [https://tarkov.dev/ammo/](https://tarkov.dev/ammo/)  
22. EFT | Ammo and Armor Charts, дата последнего обращения: июня 12, 2026, [https://www.eft-ammo.com/](https://www.eft-ammo.com/)  
23. BEST BUDGET LOADOUT From The Flea Market | Escape From Tarkov Beginners Guide, дата последнего обращения: июня 12, 2026, [https://www.youtube.com/watch?v=bMspL9ZszfU](https://www.youtube.com/watch?v=bMspL9ZszfU)  
24. Spreadsheet containing the hidden recoil stats for all guns: : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/w9kos4/spreadsheet\_containing\_the\_hidden\_recoil\_stats/](https://www.reddit.com/r/EscapefromTarkov/comments/w9kos4/spreadsheet_containing_the_hidden_recoil_stats/)  
25. Fixing the Fragmentation Bug would help with many common complaints : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/izy21a/fixing\_the\_fragmentation\_bug\_would\_help\_with\_many/](https://www.reddit.com/r/EscapefromTarkov/comments/izy21a/fixing_the_fragmentation_bug_would_help_with_many/)  
26. I cracked the Fragmentation Chance mystery. : r/EscapefromTarkov \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/ojgeaq/i\_cracked\_the\_fragmentation\_chance\_mystery/](https://www.reddit.com/r/EscapefromTarkov/comments/ojgeaq/i_cracked_the_fragmentation_chance_mystery/)  
27. BUG: it is very likely that fragmentation isn't working at the moment. We used M855A1, shot 10 times, I always lost 45 HP. Considering the 43 pen (\>20 pen) and 34% fragmentation chance it had a 1,5% chance of all shots not fragmenting, which is very unlikely, \- Reddit, дата последнего обращения: июня 12, 2026, [https://www.reddit.com/r/EscapefromTarkov/comments/lox8wt/bug\_it\_is\_very\_likely\_that\_fragmentation\_isnt/](https://www.reddit.com/r/EscapefromTarkov/comments/lox8wt/bug_it_is_very_likely_that_fragmentation_isnt/)  
28. How Does Recoil Actually Work in EFT? \- YouTube, дата последнего обращения: июня 12, 2026, [https://www.youtube.com/watch?v=u4QiEEJ\_Rag](https://www.youtube.com/watch?v=u4QiEEJ_Rag)  
29. How Camera Recoil Works in Tarkov\! \- Escape From Tarkov Shorts \- YouTube, дата последнего обращения: июня 12, 2026, [https://www.youtube.com/shorts/AFqHt8Vn6C8](https://www.youtube.com/shorts/AFqHt8Vn6C8)  
30. GitHub \- the-hideout/tarkov-api: Community made GraphQL API with real-time data for everything in the Escape from Tarkov game\!, дата последнего обращения: июня 12, 2026, [https://github.com/the-hideout/tarkov-api](https://github.com/the-hideout/tarkov-api)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAYCAYAAACfpi8JAAABLklEQVR4Xu2Ur0tEQRCAR1RQEMQfCJdEQUVEFEWOKyaLQTEIgthN/gNWsRgNCjaLxaxFwWo1nM2gxb/ArN+wb2Hf7At3y7Mc+8EHb2eWN7O77IpkMj3AMB7iDV7gQjkdcYJz2Aicwv5wUgpPeIYjuIrv5XTELf4a2zgZTuqWMXE/DtnAXRPz6OqvTOwA+0ysaxYlbmQdz03MM45rwXgJ74JxMlq0qhEbq0KP8h6bNpHCjsRFO23kSNxuDNhECtsSF+2kkVF8xWObSGVW4qLayKmJWS7xR9zcWtBzfsChILZV6NHV21vxjN/iFlIbXzhTfGtBfVO0uDKBb9gqxh59Nz7FXefauMYX3BPXhBbx6I494nQQUz7kHxrRXZjHfdzEwXK6kmVckfjIMplM7/IH2h4pSzqDCRIAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAYCAYAAABurXSEAAABp0lEQVR4Xu2VPyhFURzHv5IihEWR8jKQMihRFhkYDKQoBrHJbJJJyUDYpCyiFIMNJcsbyaQw2MifCQsKie+v37m9c1/npdc7yXA+9ene8zvn/vrd8+deIBAI/HuK6BpdoA1pfb9RS7dppWkX0lHaZO7z6ThNmH4vlNEjWkKb6SUdiI3ITAFdp9e0ysTK6Qn9tlw0Y71QQU/phhVrpS+0z4q5SEBXZw/xouXlJV/U9k4jfUS86Bb6SuesmIsl2gZ99k+Ljgp0FW3HXEzSPLiL3qHL9JzewfN+7oXuuWyLlsMnZ0FwFX1Ih6AvJV5Bn/FCD7IvWg6UHKyI9KKlyFJzjXijM1Y7J+roA9xFT1sxG1n2G8sP6Ivf02I6Tz9pd/QANF8Sugo5I0mSdN+KdUELkasg26Aa8ZmzSZ9paX8hXrTMtHwaM+XImhHojAmSdJYeI7Vnz+g7bTdtGxm/RW9pjYkN0ynTF415hn5pvCF7dJX2Qwu+gP5kIg7gPkgT9AmpH4isjmwPybdCd+kY3YSeHe/IbAzSDvj5c0m+emjOznhXIBAIBBz8AMPtWbZNIuIXAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAZCAYAAABOxhwiAAACGklEQVR4Xu2WsUtVURzHf2JCUhEiCIFhWBFOCSKRg7whQ4giaoncXaOWIIUscUgdRBeRFgWXUJycaqrJXCUCJ6OlP8ChIez76XdO77zLi4p7H77hfuDDvfec4/N3zv39zrlmJSVNQavskqezHQlt2Ybj5qzcknPyjWyp7f7FJdmdbczLBfnQ/IdPyqtyPNxHrshZuWI+tj3peyo35AnZKd/LUXlOXpbP5LffowtkSH6XR8FDeSvpvy8/yX7zVJiWb0PfKfnOPLjIsKzIMflAPpKLSX9hDJgH9lm+MF+plH3zICIdcjfcM/bAfNUjt5N78p70KTxNgMCXso0JvAHGRMjhdfPVPyM/WG3gN8KVca/knaSvUAiK4lqTX+Rzq83hbOCwmrT1mL+BCbkQ2ljhzXBtGASwY175FNdH8yJk+2JV/xY4MNER88KmSJlAXGn6KOiL4bkwCJAii1BoFOv10P4vgacQMIEzAX6bReAtvjZ/Ow2DfGV3eRKe/zfwNEWYPMXda75FPo6D8kJqkJ975jsAxMBjwf0p8Hr5yyqnxcjk2XXYfRg/k/TlIm5naeCkCoHHAH5YdacADqbtcM3C3xB8hMnHwHHe/PMgN/yTZXktPHN8c/JxqHAPFOtUuAeK+GvyHGFF2bNT7lk1cN7ay9ru/FBEnHh9Vn9FKNKb8q48n+mDipy0+t8pg+a7FmnSdB9aJSUlJSWN5SeIHlZUudrF9AAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAZCAYAAABkdu2NAAACRUlEQVR4Xu2WQUtVQRiG3yChqChRiKAooghXBSJBhCuLWihRLcL6BeZKiCBaCBpEixAkTHHTIgoiSMRFFOEyatGuFq2Moj9gm0D0ff3m645z56rQuUIxDzzcOXPm3DPvmTkzBygUChuwj7bRbemJQAvdlVb+KyjUDH1AJ1EfZCd9RPuS+so5Qq+llYETsA72wzqUoropWBu1jemkR2FBR+gPepMepgfpJzpBt/sFVdJBB+g7ukSfrD29yhX6mZ6CdfAN3RudV1l1u0MbtdU1zhDdE8pn6S3YffUwr9NXsKBNQTe6RM/Q76gPeIh+hXVEtNKPdPBPC+B2qHPU9gvdH471nwovNJrjoSw0qk2fmuIAXUB9QHX2F6xjQh16SudhnfbA8XVddBG1jt9BLaDOjYayOIcmTc2URgF1HAdM66TK8XVpnVbIF7D37jksrEKNYYtGT+QCqiPzWD9gL10OdU4aUJyEjZYvUAqmgAp6mj6kF9B4G/lrcgG1nL/F+gEvYnMBY7SgvAy/Qvc4Tu/Sy96oanIBRRwmV5cLk6tz0qmpFdgXMC1Kj1F7XyulUcB7yAfUiqsR0P72M9Q5HlCLS0o8NYWmrqa50PS8D+tL5TQKqA5pf+wJxzvoXFBlf0917Kjt7/Abk05N4e+xo4D6AKgcD6gtIKaNfqDD4fgYbPTiL54b9FsoaxT0MfAeaz8GfGpqoYlRWA+oh6Uvmvba6a1DC8552MafQ8Gu0m7YtpAyDXtYOZ7R13QWTfyiKRQKhULhf2UF+KZ0e77zQfkAAAAASUVORK5CYII=>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAABV0lEQVR4Xu2UvyuFURzGH4MibpSBgdykZCYio0xIuYMoC2VSRoNBySCLlMUig/+AieGOYme0KJPR6Mfz9P1e93i9ucP7vqbzqU/3e37cznPPPecAkUgEy/SU7tPexJgYgo1rXmvQX6Yn9JIuBv2Z6aFHsDCz9IlOBeNa7IG20z16TTt8bBv1kJP+mZlh+gpbsMYc/fB6hb7REW830QtahX0n3J2uoM6EFtOiyVCfXh/jZyhxTl/oAN2iaz5+GMzJRKNQCpAWKuzrpN20+XtGRnQ2bmkp6NNhVygFraJxqELQuRj3ukwfYaHa6A1+B/iXUEk2UD/o2rVkAIV6RvrTkRubtN9r3a4z2F8q5uk7nfZ2C71yVReGfvmE12Owm6UwQtf8ju56exC2S0veLgwFWKc7sAVXYTtWYxT2oFboPT1AjjftL/QMzMAOdxrqX6B9yYFIJBLJiS8Vmz6vxysuEAAAAABJRU5ErkJggg==>