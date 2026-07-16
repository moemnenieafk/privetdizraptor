import type { PlayerRole } from '@/lib/role-inference';

// Что показывать игроку под его роль в адаптивном хабе «Ульты» (/eft/hub).
// Все href — реально существующие маршруты EFT (сверено с headerConfig).

export interface HubLink {
  title: string;
  description: string;
  href: string;
}

export interface RoleHub {
  intro: string;
  links: HubLink[];
}

export const ROLE_HUBS: Record<PlayerRole, RoleHub> = {
  rookie: {
    intro: 'Не понимаешь Тарков? Начни отсюда — адаптируем по шагам.',
    links: [
      { title: 'Путь Новобранца', description: 'Интерактивный курс из 10 этапов — учим мир игры руками.', href: '/eft/progress/rookie' },
      { title: 'Кодекс: история мира', description: 'Что это за место и почему все стреляют.', href: '/eft/gamesetting/lore' },
      { title: 'Первые квесты Прапора', description: 'С чего начать прогресс.', href: '/eft/quests/prapor' },
      { title: 'Боеприпасы', description: 'Какой патрон брать на старте.', href: '/eft/items/ammo' },
    ],
  },
  progressor: {
    intro: 'Гриндишь квесты? Держи всё для чистого прохождения.',
    links: [
      { title: 'Карта заданий', description: 'Граф квестов и зависимости.', href: '/eft/questmap' },
      { title: 'Задания', description: 'Все квесты по торговцам и сюжету.', href: '/eft/quests' },
      { title: 'Трекер предметов', description: 'Что нужно сдать и куда.', href: '/eft/progress/tracker' },
      { title: 'Важные предметы', description: 'Что не выкидывать из схрона.', href: '/eft/progress/needed' },
    ],
  },
  trader: {
    intro: 'Живёшь барахолкой? Вот где деньги.',
    links: [
      { title: 'Прибыль бартера', description: 'Где бартер выгоднее покупки.', href: '/eft/progress/barter' },
      { title: 'Цена за слот', description: 'Что тащить ради ₽ за клетку.', href: '/eft/items/price-slot' },
      { title: 'Рейтинг предметов', description: 'Что ценно и ходово.', href: '/eft/items/loot-rate' },
      { title: 'Прибыль убежища', description: 'Крафты, что приносят профит.', href: '/eft/progress/hideout/craft-profit' },
    ],
  },
  gunsmith: {
    intro: 'Кайфуешь от сборок? Собери мету и реши Gunsmith.',
    links: [
      { title: 'Сборки оружия', description: 'Конструктор со стат-движком.', href: '/eft/progress/loadouts' },
      { title: 'Найти сборку', description: 'Решатель квестов Оружейника.', href: '/eft/progress/loadouts/find' },
      { title: 'Видео-гайды', description: 'Разборы и сборки от Димы.', href: '/eft/videos/guides' },
      { title: 'Боеприпасы', description: 'Пробитие и урон под ствол.', href: '/eft/items/ammo' },
    ],
  },
  engineer: {
    intro: 'Оптимизируешь убежище? Копи правильное.',
    links: [
      { title: 'Убежище ЧВК', description: 'Станции и порядок апгрейдов.', href: '/eft/progress/hideout' },
      { title: 'Модули убежища', description: 'Что нужно под каждый уровень.', href: '/eft/progress/hideout/modules' },
      { title: 'Важные предметы', description: 'Что копить под постройки.', href: '/eft/progress/needed' },
      { title: 'Прибыль убежища', description: 'Крафты и окупаемость.', href: '/eft/progress/hideout/craft-profit' },
    ],
  },
  raider: {
    intro: 'Хардкор и боссы? Данные для рейда — быстро.',
    links: [
      { title: 'Боссы', description: 'Спавны, лут, характеристики.', href: '/eft/gamesetting/bosses' },
      { title: 'Карты', description: 'Спавны, экстракты, маркеры.', href: '/eft/maps' },
      { title: 'Лут-контейнеры', description: 'Что где лежит.', href: '/eft/loot-containers' },
      { title: 'Бронежилеты', description: 'Броня под задачу.', href: '/eft/items/gear/armor' },
    ],
  },
  viewer: {
    intro: 'Пришёл за контентом? Свежак Димы и комьюнити.',
    links: [
      { title: 'Видео', description: 'Архив роликов @fullkamen.', href: '/eft/videos' },
      { title: 'Гайды', description: 'Обучающие разборы.', href: '/eft/videos/guides' },
      { title: 'Стримы', description: 'Записи и статус эфира.', href: '/eft/videos/streams' },
      { title: 'Мастер-классы', description: 'Разборы от шерпов комьюнити.', href: '/eft/comlink/masterclasses' },
    ],
  },
  rat: {
    intro: 'Тихий лут без лишнего боя? Держи данные, чтобы не спалиться.',
    links: [
      { title: 'Карты', description: 'Спавны, выходы, простреливаемые линии.', href: '/eft/maps' },
      { title: 'Лут-контейнеры', description: 'Где лежит ценное.', href: '/eft/loot-containers' },
      { title: 'Цена за слот', description: 'Что тащить ради \u20bd за клетку.', href: '/eft/items/price-slot' },
      { title: 'Рейтинг предметов', description: 'Самое ценное и ходовое.', href: '/eft/items/loot-rate' },
    ],
  },
  sherpa: {
    intro: 'Водишь и учишь новичков? Инструменты наставника здесь.',
    links: [
      { title: 'Биржа шерпов', description: 'Найти учеников и наставников.', href: '/eft/comlink/sherpa-exchange' },
      { title: 'Мастер-классы', description: 'Разборы и обучение от комьюнити.', href: '/eft/comlink/masterclasses' },
      { title: 'Поиск напарника', description: 'Собрать группу под рейд.', href: '/eft/comlink/find-partner' },
      { title: 'Кодекс', description: 'База знаний, чтобы объяснять на пальцах.', href: '/eft/gamesetting/lore' },
    ],
  },
  lore: {
    intro: 'Фанат вселенной? Погружайся в мир Норвинска.',
    links: [
      { title: 'История мира', description: 'Что здесь произошло и почему.', href: '/eft/gamesetting/lore' },
      { title: 'Хронология', description: 'События по датам.', href: '/eft/gamesetting/timeline' },
      { title: 'Персонажи', description: 'Кто есть кто в Таркове.', href: '/eft/gamesetting/characters' },
      { title: 'Теории и загадки', description: 'Тайны и версии комьюнити.', href: '/eft/gamesetting/theories' },
    ],
  },
};
