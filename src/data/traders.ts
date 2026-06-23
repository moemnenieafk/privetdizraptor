// Торговцы EFT для раздела «Кодекс → Торговцы».
// Описания — из существующих карточек (side-quests); изображения локальны.

export interface Trader {
  slug: string;
  nameRu: string;
  nameEn: string;
  image: string;
  location: string;
  specializes: string;
  currency: string;
  description: string;
}

export const TRADERS: Trader[] = [
  {
    slug: 'prapor', nameRu: 'Прапор', nameEn: 'Prapor', image: '/images/traders/eft/prapor.webp',
    location: 'Портовая база', specializes: 'Оружие, патроны, снаряжение', currency: '₽',
    description: 'Прапорщик внутренних войск, заведующий складами снабжения на портовой базе, прикрывавшей эвакуацию промышленных объектов TerraGroup.',
  },
  {
    slug: 'therapist', nameRu: 'Терапевт', nameEn: 'Therapist', image: '/images/traders/eft/therapist.webp',
    location: 'Городская больница', specializes: 'Медикаменты, провизия, контейнеры', currency: '₽',
    description: 'Заведующая отделением травматологии центральной городской больницы Таркова. Осталась в городе по личным причинам.',
  },
  {
    slug: 'skier', nameRu: 'Лыжник', nameEn: 'Skier', image: '/images/traders/eft/skier.webp',
    location: 'Таможенный терминал', specializes: 'Оружие, снаряжение', currency: '₽',
    description: 'Работник таможенного терминала порта. Изначально занимался сбытом товаров с терминала, но со временем переключился на оружие.',
  },
  {
    slug: 'peacekeeper', nameRu: 'Миротворец', nameEn: 'Peacekeeper', image: '/images/traders/eft/peacekeeper.webp',
    location: 'Блокпост ООН', specializes: 'Западное оружие и снаряжение', currency: '$',
    description: 'Снабженец из контингента ООН. Работает на одном из центральных блокпостов в портовой зоне Таркова, торгуя западным оружием.',
  },
  {
    slug: 'mechanic', nameRu: 'Механик', nameEn: 'Mechanic', image: '/images/traders/eft/mechanic.webp',
    location: 'Мастерская в промзоне', specializes: 'Модификации оружия, оружие', currency: '₽',
    description: 'Химик-заводчанин, с юности увлекался модификацией оружия и сложной техники. Работает в закрытой мастерской в промзоне.',
  },
  {
    slug: 'ragman', nameRu: 'Барахольщик', nameEn: 'Ragman', image: '/images/traders/eft/ragman.webp',
    location: 'Барахолка на окраине', specializes: 'Броня, разгрузки, рюкзаки, одежда', currency: '₽',
    description: 'Владелец крупной барахолки на окраине Таркова. Продаёт всё, что связано с одеждой, снаряжением и экипировкой.',
  },
  {
    slug: 'jaeger', nameRu: 'Егерь', nameEn: 'Jaeger', image: '/images/traders/eft/jaeger.webp',
    location: 'Приозёрский заповедник', specializes: 'Снаряжение для выживания, оружие', currency: '₽',
    description: 'Работник лесного охотничьего хозяйства Приозёрского заповедника. Профессиональный охотник и специалист по выживанию.',
  },
  {
    slug: 'fence', nameRu: 'Скупщик', nameEn: 'Fence', image: '/images/traders/eft/fence.webp',
    location: 'Чёрный рынок', specializes: 'Скупка и перепродажа, случайный ассортимент', currency: '₽',
    description: 'Центральная фигура на чёрном рынке Таркова. Его сеть осведомителей и точек сбыта охватывает весь город и его окрестности.',
  },
  {
    slug: 'ref', nameRu: 'Реф', nameEn: 'Ref', image: '/images/traders/eft/ref.webp',
    location: 'Неизвестно', specializes: 'Редкое снаряжение (бартер)', currency: 'Бартер',
    description: 'Таинственный торговец, специализирующийся на редком снаряжении и оружии западного образца. Его мотивы и происхождение неизвестны.',
  },
  {
    slug: 'lightkeeper', nameRu: 'Смотритель Маяка', nameEn: 'Lightkeeper', image: '/images/traders/eft/lightkeeper.webp',
    location: 'Маяк', specializes: 'Эндгейм-снаряжение, бартеры', currency: '₽',
    description: 'Бывший сотрудник Управления по обеспечению безопасности объектов ФСИН. Контролирует вход в сектор Маяка.',
  },
  {
    slug: 'btr-driver', nameRu: 'Водитель БТР', nameEn: 'BTR Driver', image: '/images/traders/eft/btrdriver.webp',
    location: 'Маршруты по локациям', specializes: 'Транспорт и услуги', currency: '₽',
    description: 'Водитель БТР-82А, который может перевозить игроков между локациями за определённую плату, а также предоставляет услуги.',
  },
];

export function getTrader(slug: string): Trader | null {
  return TRADERS.find((t) => t.slug === slug) ?? null;
}
