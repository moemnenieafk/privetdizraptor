// Граф карты сюжетной истории «Борей» (Figma: секция boreas-quest-map, node 1579-1027).
// Позиции узлов — из макета (нормализованы), раскладка ручная (художественная), НЕ dagre.
// Чеки «ВЫПОЛНЕНО?» узлов активации разделяют ключи с шагом 01 гайда (синхронизация
// гайд ↔ карта через useStoryProgressStore).

export type StoryMapNodeKind = 'hideout' | 'item' | 'story' | 'ask' | 'location' | 'branch' | 'note';

export interface StoryMapTaskLine {
  text: string;
  /** класс иконки задачи (icon-eft-quests-investigate / -visit / -eliminate ...) */
  icon: string;
  /** счётчик вида 0/30 (для килл-задач) */
  count?: number;
}

export interface StoryMapNodeData {
  id: string;
  kind: StoryMapNodeKind;
  x: number;
  y: number;
  /** Шапка: заголовок + иконка (маска ИЛИ фото торговца ИЛИ иконка карты). */
  title: string;
  iconClass?: string;
  traderPhoto?: string;
  mapIcon?: string;
  /** hideout */
  build?: { normalizedName: string; name: string; level: number };
  /** item-строка (плитка 48px + имя + 0/N + loot-иконка) */
  item?: { id: string; name: string; count: number; loot?: boolean };
  /** строки-задачи */
  tasks?: StoryMapTaskLine[];
  /** ключ чека в useStoryProgressStore (узлы активации = ключи шага 01 гайда) */
  conditionKey?: string;
}

export interface StoryMapEdgeData {
  from: string;
  to: string;
}

export interface StoryQuestMapData {
  slug: string;
  title: string;
  nodes: StoryMapNodeData[];
  edges: StoryMapEdgeData[];
}

const POSTER_ID = '699f0b877c23862b4b0ee19c';

export const BOREAS_MAP: StoryQuestMapData = {
  slug: 'boreas',
  title: 'Борей',
  nodes: [
    // ── Активация (три альтернативы; чеки = блоки шага 01 гайда: boreas|1|idx) ──
    {
      id: 'act-flea', kind: 'item', x: 0, y: 0,
      title: 'БАРАХОЛКА / ПОИСК ПРЕДМЕТА', iconClass: 'icon-eft-currency-ruble',
      item: { id: POSTER_ID, name: 'Плакат Paradigm Shipping', count: 1, loot: true },
      conditionKey: 'boreas|1|1',
    },
    {
      id: 'act-hideout', kind: 'hideout', x: 512, y: 0,
      title: 'УБЕЖИЩЕ ЧВК', iconClass: 'icon-eft-prog-hideout',
      build: { normalizedName: 'intelligence-center', name: 'Разведцентр', level: 3 },
      conditionKey: 'boreas|1|0',
    },
    {
      id: 'act-ticket', kind: 'story', x: 1024, y: 0,
      title: 'БИЛЕТ', iconClass: 'icon-eft-quests-story-ticket',
      tasks: [{ text: 'Квест выдает Mr.Kerman в сюжете', icon: 'icon-eft-quests-investigate' }],
      conditionKey: 'boreas|1|2',
    },

    // ── Основная цепь ──
    {
      id: 'ask-mechanic', kind: 'ask', x: 512, y: 408,
      title: 'МЕХАНИК', traderPhoto: '/images/traders/eft/mechanic.webp',
      tasks: [{ text: 'Спросить у Механика, откуда пришел сигнал бедствия', icon: 'icon-eft-quests-investigate' }],
      conditionKey: 'boreas|map|ask-mechanic',
    },
    {
      id: 'loc-woods', kind: 'location', x: 512, y: 724,
      title: 'ЛЕС', mapIcon: 'icon-eft-maps-woods',
      item: { id: '590c2e1186f77425357b6124', name: 'Набор инструментов', count: 1, loot: true },
      tasks: [
        { text: 'Найти оборудование под вышкой сотовой связи на локации Лес', icon: 'icon-eft-quests-visit' },
        { text: 'Починить оборудование под вышкой сотовой связи на локации Лес', icon: 'icon-eft-quests-modify' },
        { text: 'Сообщить Механику о выполнении задачи', icon: 'icon-eft-quests-investigate' },
      ],
      conditionKey: 'boreas|map|loc-woods',
    },
    {
      id: 'loc-lighthouse', kind: 'location', x: 512, y: 1228,
      title: 'МАЯК', mapIcon: 'icon-eft-maps-lighthouse',
      item: { id: '69bb4499957ebbdeb600393f', name: 'Распоряжение Paradigm Shipping', count: 1, loot: true },
      tasks: [
        { text: 'Найти документацию Paradigm Shipping', icon: 'icon-eft-quests-investigate' },
        { text: 'Рассказать Механику про «Борей»', icon: 'icon-eft-quests-investigate' },
      ],
      conditionKey: 'boreas|map|loc-lighthouse',
    },
    {
      id: 'transport', kind: 'note', x: 512, y: 1674,
      title: 'ТРАНСПОРТ', iconClass: 'icon-eft-quests-visit',
      tasks: [{ text: 'Договорится с кем-нибудь о транспорте на ледокол', icon: 'icon-eft-quests-investigate' }],
      conditionKey: 'boreas|map|transport',
    },

    // ── Ветвление транспорта ──
    {
      id: 'ask-btr', kind: 'ask', x: 256, y: 2044,
      title: 'ВОДИТЕЛЬ БТР', traderPhoto: '/images/traders/eft/btrdriver.webp',
      tasks: [{ text: 'Спросить у Водителя БТР, есть ли у него транспорт для доставки на ледокол', icon: 'icon-eft-quests-investigate' }],
      conditionKey: 'boreas|map|ask-btr',
    },
    {
      id: 'ask-prapor', kind: 'ask', x: 768, y: 2044,
      title: 'ПРАПОР', traderPhoto: '/images/traders/eft/prapor.webp',
      tasks: [{ text: 'Спросить у Прапора, о возможности эвакуации с борта ледокола', icon: 'icon-eft-quests-investigate' }],
      conditionKey: 'boreas|map|ask-prapor',
    },

    // ── Развилка «Небеса в огне» (судьба кейса) ──
    {
      id: 'fs-kept', kind: 'branch', x: 768, y: 2452,
      title: 'НЕБЕСА В ОГНЕ', iconClass: 'icon-eft-quests-story-falling',
      tasks: [{ text: 'Вы оставили кейс себе', icon: 'icon-eft-quests-investigate' }],
      item: { id: '68fa8e253666e2fd5b00a626', name: 'Бронированный кейс', count: 1 },
      conditionKey: 'boreas|map|fs-kept',
    },
    {
      id: 'fs-hidden', kind: 'branch', x: 1280, y: 2452,
      title: 'НЕБЕСА В ОГНЕ', iconClass: 'icon-eft-quests-story-falling',
      tasks: [{ text: 'Вы сказали Прапору, что не нашли кейс в самолете', icon: 'icon-eft-quests-investigate' }],
      item: { id: '68fa8e253666e2fd5b00a626', name: 'Бронированный кейс', count: 1 },
      conditionKey: 'boreas|map|fs-hidden',
    },
    {
      id: 'fs-given', kind: 'branch', x: 1792, y: 2452,
      title: 'НЕБЕСА В ОГНЕ', iconClass: 'icon-eft-quests-story-falling',
      tasks: [{ text: 'Вы отдали кейс Прапору', icon: 'icon-eft-quests-investigate' }],
      item: { id: '68fa8e253666e2fd5b00a626', name: 'Бронированный кейс', count: 1, loot: true },
      conditionKey: 'boreas|map|fs-given',
    },

    // ── Исходы у Прапора ──
    {
      id: 'prapor-items', kind: 'ask', x: 768, y: 2918,
      title: 'ПРАПОР', traderPhoto: '/images/traders/eft/prapor.webp',
      tasks: [{ text: 'Передать Прапору необходимые предметы', icon: 'icon-eft-quests-investigate' }],
      item: { id: '5d0378d486f77420421a5ff4', name: 'Военный фильтр питания', count: 3, loot: true },
      conditionKey: 'boreas|map|prapor-items',
    },
    {
      id: 'prapor-kill', kind: 'ask', x: 1280, y: 2918,
      title: 'ПРАПОР', traderPhoto: '/images/traders/eft/prapor.webp',
      tasks: [{ text: 'Убить любые цели на Резерве', icon: 'icon-eft-quests-eliminate', count: 30 }],
      item: { id: '5d0378d486f77420421a5ff4', name: 'Военный фильтр питания', count: 3, loot: true },
      conditionKey: 'boreas|map|prapor-kill',
    },
  ],
  edges: [
    { from: 'act-flea', to: 'ask-mechanic' },
    { from: 'act-hideout', to: 'ask-mechanic' },
    { from: 'act-ticket', to: 'ask-mechanic' },
    { from: 'ask-mechanic', to: 'loc-woods' },
    { from: 'loc-woods', to: 'loc-lighthouse' },
    { from: 'loc-lighthouse', to: 'transport' },
    { from: 'transport', to: 'ask-btr' },
    { from: 'transport', to: 'ask-prapor' },
    { from: 'ask-prapor', to: 'fs-kept' },
    { from: 'ask-prapor', to: 'fs-hidden' },
    { from: 'ask-prapor', to: 'fs-given' },
    { from: 'fs-kept', to: 'prapor-items' },
    { from: 'fs-hidden', to: 'prapor-kill' },
    { from: 'fs-given', to: 'prapor-kill' },
  ],
};

export const STORY_MAPS: Record<string, StoryQuestMapData> = {
  boreas: BOREAS_MAP,
};
