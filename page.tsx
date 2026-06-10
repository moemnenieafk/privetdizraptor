import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Модули убежища"
const HIDEOUT_MODULES_CARDS = [
  {
    id: 'defective-wall',
    title: 'Аварийная стена',
    description: 'Устранение дефекта стены для постройки новых модулей.',
    href: '/eft/progress/hideout/modules/defective-wall',
    iconPath: '/icons/eft/04-progression/hideout-modules/defective_wall.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'security',
    title: 'Безопасность',
    description: 'Усиление двери убежища для защиты от внешних угроз.',
    href: '/eft/progress/hideout/modules/security',
    iconPath: '/icons/eft/04-progression/hideout-modules/security.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'bitcoin-farm',
    title: 'Биткоин ферма',
    description: 'Пассивный доход за счет майнинга криптовалюты.',
    href: '/eft/progress/hideout/modules/bitcoin-farm',
    iconPath: '/icons/eft/04-progression/hideout-modules/bitcoin_farm.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'vents',
    title: 'Вентиляция',
    description: 'Улучшение циркуляции воздуха, необходимое для других модулей.',
    href: '/eft/progress/hideout/modules/vents',
    iconPath: '/icons/eft/04-progression/hideout-modules/vents.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'workbench',
    title: 'Верстак',
    description: 'Создание и модификация оружия и оружейных модулей.',
    href: '/eft/progress/hideout/modules/workbench',
    iconPath: '/icons/eft/04-progression/hideout-modules/workbench.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'air-filtering-unit',
    title: 'Воздушный фильтратор',
    description: 'Ускоряет прокачку физических навыков персонажа.',
    href: '/eft/progress/hideout/modules/air-filtering-unit',
    iconPath: '/icons/eft/04-progression/hideout-modules/air_filtering_unit.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'water-collector',
    title: 'Водосборник',
    description: 'Сбор и очистка воды для питья и крафта.',
    href: '/eft/progress/hideout/modules/water-collector',
    iconPath: '/icons/eft/04-progression/hideout-modules/water_collector.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'generator',
    title: 'Генератор',
    description: 'Обеспечивает электроэнергией все модули убежища.',
    href: '/eft/progress/hideout/modules/generator',
    iconPath: '/icons/eft/04-progression/hideout-modules/generator.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'rest-space',
    title: 'Зона отдыха',
    description: 'Ускоряет восстановление энергии вне рейда.',
    href: '/eft/progress/hideout/modules/rest-space',
    iconPath: '/icons/eft/04-progression/hideout-modules/rest_space.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'cultist-circle',
    title: 'Круг сектантов',
    description: 'Таинственный модуль для проведения ритуалов и получения редких предметов.',
    href: '/eft/progress/hideout/modules/cultist-circle',
    iconPath: '/icons/eft/04-progression/hideout-modules/cultist_circle.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'med-station',
    title: 'Медблок',
    description: 'Производство медикаментов и ускоренное восстановление здоровья.',
    href: '/eft/progress/hideout/modules/med-station',
    iconPath: '/icons/eft/04-progression/hideout-modules/med_station.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'heating',
    title: 'Обогрев',
    description: 'Поддержание комфортной температуры, ускоряет восстановление энергии.',
    href: '/eft/progress/hideout/modules/heating',
    iconPath: '/icons/eft/04-progression/hideout-modules/heating.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'weapon-rack',
    title: 'Оружейный стенд',
    description: 'Демонстрация и быстрый доступ к вашим лучшим сборкам оружия.',
    href: '/eft/progress/hideout/modules/weapon-rack',
    iconPath: '/icons/eft/04-progression/hideout-modules/weapon_rack.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'illumination',
    title: 'Освещение',
    description: 'Обеспечивает освещение в убежище, необходимое для работы.',
    href: '/eft/progress/hideout/modules/illumination',
    iconPath: '/icons/eft/04-progression/hideout-modules/illumination.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'nutrition-unit',
    title: 'Пищеблок',
    description: 'Приготовление еды и напитков для поддержания гидратации и энергии.',
    href: '/eft/progress/hideout/modules/nutrition-unit',
    iconPath: '/icons/eft/04-progression/hideout-modules/nutrition_unit.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'intelligence-centre',
    title: 'Разведцентр',
    description: 'Снижение комиссии на барахолке и ускорение таймера Дикого.',
    href: '/eft/progress/hideout/modules/intelligence-centre',
    iconPath: '/icons/eft/04-progression/hideout-modules/intelligence_centre.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'booze-generator',
    title: 'Самогонный аппарат',
    description: 'Производство алкоголя для бартера и крафта.',
    href: '/eft/progress/hideout/modules/booze-generator',
    iconPath: '/icons/eft/04-progression/hideout-modules/booze_generator.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'lavatory',
    title: 'Санузел',
    description: 'Производство различных материалов из найденных в рейде предметов.',
    href: '/eft/progress/hideout/modules/lavatory',
    iconPath: '/icons/eft/04-progression/hideout-modules/lavatory.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'stash',
    title: 'Склад',
    description: 'Увеличение размера вашего схрона для хранения большего количества предметов.',
    href: '/eft/progress/hideout/modules/stash',
    iconPath: '/icons/eft/04-progression/hideout-modules/stash.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'solar-power',
    title: 'Солнечная батарея',
    description: 'Снижает расход топлива для генератора.',
    href: '/eft/progress/hideout/modules/solar-power',
    iconPath: '/icons/eft/04-progression/hideout-modules/solar_power.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'gear-rack',
    title: 'Стенд со снаряжением',
    description: 'Хранение и быстрый доступ к комплектам снаряжения.',
    href: '/eft/progress/hideout/modules/gear-rack',
    iconPath: '/icons/eft/04-progression/hideout-modules/gear_rack.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'shooting-range',
    title: 'Тир',
    description: 'Тестирование оружия и сборок без выхода в рейд.',
    href: '/eft/progress/hideout/modules/shooting-range',
    iconPath: '/icons/eft/04-progression/hideout-modules/shooting_range.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'gym',
    title: 'Тренажерный зал',
    description: 'Улучшение физических навыков персонажа.',
    href: '/eft/progress/hideout/modules/gym',
    iconPath: '/icons/eft/04-progression/hideout-modules/gym.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'hall-of-fame',
    title: 'Уголок боевой славы',
    description: 'Витрина для ваших достижений и трофеев.',
    href: '/eft/progress/hideout/modules/hall-of-fame',
    iconPath: '/icons/eft/04-progression/hideout-modules/hall_of_fame.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'scav-case',
    title: 'Ящик диких',
    description: 'Отправка Диких на поиск лута с непредсказуемым результатом.',
    href: '/eft/progress/hideout/modules/scav-case',
    iconPath: '/icons/eft/04-progression/hideout-modules/scav_case.svg',
    variant: 'rectangle' as const,
  },
];

export default function HideoutModulesHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Заголовок страницы */}
        <div className="mb-12 flex flex-col items-center text-center">
          <h1 className="text-3xl md:text-5xl font-blender-medium uppercase tracking-widest text-[var(--primary)] mb-3 drop-shadow-[0_0_15px_rgba(230,142,37,0.2)]">
            Модули убежища
          </h1>
          <p className="text-text-secondary max-w-2xl text-sm md:text-base font-blender-book">
            Обзор всех модулей, их уровней, требований для постройки и получаемых бонусов.
          </p>
        </div>

        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {HIDEOUT_MODULES_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
