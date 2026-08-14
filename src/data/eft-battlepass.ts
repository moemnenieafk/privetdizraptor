// Реестр Боевого Пропуска Сезона 1 «KORD BREACH» (патч 1.1.0) — награды и их стоимость в документации.
//
// ОТКУДА: docs/eft/Награды_Батлпасс_KORD_BREACH_для_трекера.md (12 страниц БП, прислано V4DYA как канон)
// + голосовой бриф Дмитрия. Это НАШ статичный словарь (как eft-seasons.ts / eft-season-items.ts), не
// рантайм-фетч игрового источника — §4.11 не нарушается. Прогрессия БП: игрок лутает в рейде «документы»
// (валюта, 8 типов) и тратит их на разблокировку наград. Трекер считает, сколько ещё нужно налутать.
//
// СВЯЗЬ С КАТАЛОГОМ: id документов — из BP_SEASON_1_DOC_IDS (eft-season-items.ts, канон json.tarkov.dev).
// id наград, у которых есть инвентарный предмет (пушки/броня/рюкзаки/нож/шлем/TarCoin), зарезолвлены по
// public/images/items/eft/items_database.json — иконка тянется через itemIconUrl(id). Косметика (позы,
// голоса, стили убежища, плакаты, жетоны-уровни) инвентарём не является → рисуется глифом-категорией.

/** 8 типов документации-валюты БП. Порядок — как в MD-спеке (раздел «Где найти»). */
export type BpDocType =
  | 'finance'
  | 'personal'
  | 'project'
  | 'scheme'
  | 'testing'
  | 'user'
  | 'medicine'
  | 'operating';

export const BP_DOC_ORDER: readonly BpDocType[] = [
  'finance',
  'personal',
  'project',
  'scheme',
  'testing',
  'user',
  'medicine',
  'operating',
] as const;

export interface BpDoc {
  type: BpDocType;
  /** Полное имя (1:1 с игрой/спекой). */
  name: string;
  /** Короткая метка для чипов/узких колонок. */
  short: string;
  /** BSG id в каталоге → иконка через itemIconUrl(id). */
  itemId: string;
  /** Карты, где документ лутается (RU-имена, из MD-спеки). */
  maps: readonly string[];
}

/** Словарь документов. id — из BP_SEASON_1_DOC_IDS (eft-season-items.ts). */
export const BP_DOCS: Readonly<Record<BpDocType, BpDoc>> = {
  finance: {
    type: 'finance',
    name: 'Финансовая документация',
    short: 'Финансовая',
    itemId: '6a31807f17005505b70d5827',
    maps: ['Таможня', 'Улицы Таркова', 'Развязка'],
  },
  personal: {
    type: 'personal',
    name: 'Личные данные ЧВК',
    short: 'Личные ЧВК',
    itemId: '6a317b9692cfdcddcb02a58e',
    maps: ['Резерв', 'Маяк', 'Ледокол'],
  },
  project: {
    type: 'project',
    name: 'Проектная документация',
    short: 'Проектная',
    itemId: '6a3181f178450ec91c0ea1aa',
    maps: ['Завод', 'Резерв', 'Таможня'],
  },
  scheme: {
    type: 'scheme',
    name: 'Чертежи и тех. документация',
    short: 'Чертежи',
    itemId: '6a31824878450ec91c0ea1ae',
    maps: ['Развязка', 'Завод', 'Лабиринт'],
  },
  testing: {
    type: 'testing',
    name: 'Тестовая документация',
    short: 'Тестовая',
    itemId: '6a31828557705071410ca00e',
    maps: ['Берег', 'Лес', 'Ледокол'],
  },
  user: {
    type: 'user',
    name: 'Пользовательская документация',
    short: 'Пользоват.',
    itemId: '6a3182b72fd891345e047eef',
    maps: ['Эпицентр', 'Улицы Таркова', 'Лаборатория'],
  },
  medicine: {
    type: 'medicine',
    name: 'Медицинская документация',
    short: 'Медицинская',
    itemId: '6a3182dc6cd8de21cf0a3a7d',
    maps: ['Лаборатория', 'Эпицентр', 'Лабиринт'],
  },
  operating: {
    type: 'operating',
    name: 'Эксплуатационная документация',
    short: 'Эксплуат.',
    itemId: '6a31830dde69ceafd805afa0',
    maps: ['Берег', 'Лес', 'Маяк'],
  },
};

/** Все карты, где встречается хоть один документ (для матрицы «документ × карта»). */
export const BP_MAPS: readonly string[] = [
  'Завод',
  'Таможня',
  'Улицы Таркова',
  'Развязка',
  'Лес',
  'Берег',
  'Резерв',
  'Маяк',
  'Ледокол',
  'Лаборатория',
  'Эпицентр',
  'Лабиринт',
] as const;

/** Категория награды — определяет глиф-фолбэк, когда инвентарной иконки нет. */
export type BpRewardKind =
  | 'weapon'
  | 'gear'
  | 'clothing'
  | 'currency'
  | 'container'
  | 'poster'
  | 'hideout'
  | 'pose'
  | 'voice'
  | 'dogtag'
  | 'decor';

/** Стоимость награды в документах (только ненулевые типы). */
export type BpCost = Partial<Record<BpDocType, number>>;

export interface BpReward {
  /** Стабильный id: `p{страница}-{slug}`. Ключ localStorage-прогресса. */
  id: string;
  /** Имя награды (1:1 со спекой). */
  name: string;
  page: number;
  kind: BpRewardKind;
  cost: BpCost;
  /** BSG id инвентарного предмета (если матчится) → реальная иконка. */
  itemId?: string;
  /** Помечена к сверке (расхождение источников в спеке). */
  verify?: boolean;
}

export interface BpPage {
  page: number;
  /** Требование разблокировки: получить `count` наград с предыдущей страницы. */
  requires?: { fromPage: number; count: number };
  rewards: BpReward[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 12 страниц БП. Транскрипция MD-спеки. Дубли одного типа в одной награде — суммированы.
// ─────────────────────────────────────────────────────────────────────────────
export const BP_PAGES: readonly BpPage[] = [
  {
    page: 1,
    rewards: [
      { id: 'p1-dogtag-1', name: 'Армейский жетон с отметками (1 уровень)', page: 1, kind: 'dogtag', cost: { finance: 1 } },
      { id: 'p1-tarcoin-50', name: 'Tarcoin (x50)', page: 1, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { project: 2, scheme: 1 } },
      { id: 'p1-poster-burn', name: 'Плакат BURN', page: 1, kind: 'poster', cost: { testing: 2, user: 1 } },
      { id: 'p1-bd-crate', name: 'Ящик со снаряжением Black Division', page: 1, kind: 'container', cost: { scheme: 2, finance: 1 } },
      { id: 'p1-hideout-ceiling', name: 'Стиль убежища «Потолок „Чёрное дерево"»', page: 1, kind: 'hideout', cost: { user: 2, project: 2, medicine: 1 } },
    ],
  },
  {
    page: 2,
    requires: { fromPage: 1, count: 4 },
    rewards: [
      { id: 'p2-sotr', name: 'Респиратор Gentex Ops-Core «SOTR»', page: 2, kind: 'gear', itemId: '689b404db49f27df1c0873f6', cost: { medicine: 2, scheme: 2 } },
      { id: 'p2-shirt-red', name: 'Красная гавайская рубашка', page: 2, kind: 'clothing', cost: { project: 3, finance: 3, medicine: 1 } },
      { id: 'p2-bd-crate', name: 'Ящик со снаряжением Black Division', page: 2, kind: 'container', cost: { testing: 3 } },
      { id: 'p2-target-scorpion', name: 'Охотничья мишень со скорпионом', page: 2, kind: 'decor', cost: { user: 1, personal: 1, operating: 1 } },
      { id: 'p2-tarcoin-50', name: 'Tarcoin (x50)', page: 2, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { testing: 2, project: 1 } },
    ],
  },
  {
    page: 3,
    requires: { fromPage: 2, count: 4 },
    rewards: [
      { id: 'p3-nice-frame', name: 'Грузовая рама Mystery Ranch «NICE Frame Load Sling» с защитным кейсом', page: 3, kind: 'gear', itemId: '68947ad3e4bf255d1b0ca75c', cost: { user: 2, personal: 1, operating: 1 } },
      { id: 'p3-bd-crate', name: 'Ящик со снаряжением Black Division', page: 3, kind: 'container', cost: { personal: 2, testing: 2, user: 1 } },
      { id: 'p3-hideout-floor', name: 'Стиль убежища «Пол „Чёрная ёлочка"»', page: 3, kind: 'hideout', cost: { user: 2, scheme: 2, testing: 2, operating: 1 } },
      { id: 'p3-tarcoin-50', name: 'Tarcoin (x50)', page: 3, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { project: 2, finance: 2, testing: 1 } },
      { id: 'p3-pose-heart', name: 'Поза манекена «<3»', page: 3, kind: 'pose', cost: { medicine: 2, finance: 1, personal: 1 } },
    ],
  },
  {
    page: 4,
    requires: { fromPage: 3, count: 4 },
    rewards: [
      { id: 'p4-dogtag-2', name: 'Армейский жетон с отметками (2 уровень)', page: 4, kind: 'dogtag', cost: { project: 2, scheme: 2, testing: 1 } },
      { id: 'p4-jagdkommando', name: 'Нож Microtech Jagdkommando', page: 4, kind: 'weapon', itemId: '6a39358c658f5889ba050ef3', cost: { user: 4, scheme: 3, finance: 2, personal: 1 } },
      { id: 'p4-tarcoin-50', name: 'Tarcoin (x50)', page: 4, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { operating: 3, scheme: 2 } },
      { id: 'p4-poster-bear', name: 'Плакат Beware the Bear', page: 4, kind: 'poster', cost: { testing: 2, scheme: 2, project: 1 } },
      { id: 'p4-bd-crate', name: 'Ящик со снаряжением Black Division', page: 4, kind: 'container', cost: { project: 2, medicine: 2, personal: 1 } },
    ],
  },
  {
    page: 5,
    requires: { fromPage: 4, count: 4 },
    rewards: [
      { id: 'p5-shirt-orange', name: 'Оранжевая гавайская рубашка', page: 5, kind: 'clothing', cost: { finance: 3, operating: 2, medicine: 2, project: 2, testing: 1 } },
      { id: 'p5-tarcoin-50', name: 'Tarcoin (x50)', page: 5, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { scheme: 4, finance: 1, user: 1, medicine: 1 } },
      { id: 'p5-target-bd', name: 'Охотничья мишень с Black Division', page: 5, kind: 'decor', cost: { personal: 2, medicine: 2, user: 1 } },
      { id: 'p5-bd-crate', name: 'Ящик со снаряжением Black Division', page: 5, kind: 'container', cost: { testing: 3, operating: 2, medicine: 1 } },
      { id: 'p5-fcpc-v5', name: 'Чехол для бронеплит Ferro Concepts «FCPC V5» (Black Division)', page: 5, kind: 'gear', itemId: '689479cb47e5acd1e10be986', cost: { project: 3, scheme: 2, user: 2 } },
    ],
  },
  {
    page: 6,
    requires: { fromPage: 5, count: 4 },
    rewards: [
      { id: 'p6-knyazev', name: 'КНЯЗЕВ', page: 6, kind: 'decor', cost: { user: 4, operating: 4, medicine: 3, testing: 2 } },
      { id: 'p6-oconnor', name: 'О.КОННОР', page: 6, kind: 'decor', cost: { user: 4, scheme: 3, personal: 3, operating: 2 } },
      // MD дублирует «Пользовательская» (х2 + х1) → user: 3. Голосовой бриф называл «проектная х2» — расхождение, verify.
      { id: 'p6-howa-type-20', name: 'Штурмовая винтовка Howa Type 20 5.56x45', page: 6, kind: 'weapon', itemId: '6a3bffbebc377285900b85cf', cost: { operating: 6, user: 3, personal: 2 }, verify: true },
    ],
  },
  {
    page: 7,
    requires: { fromPage: 6, count: 2 },
    rewards: [
      { id: 'p7-dogtag-3', name: 'Армейский жетон с отметками (3 уровень)', page: 7, kind: 'dogtag', cost: { personal: 5, testing: 3, medicine: 2 } },
      { id: 'p7-tarcoin-50', name: 'Tarcoin (x50)', page: 7, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { project: 4, testing: 3, medicine: 2 } },
      { id: 'p7-top-scorpion', name: 'Верх «Scorpion»', page: 7, kind: 'clothing', cost: { medicine: 5, finance: 3, scheme: 3, operating: 2 } },
      { id: 'p7-bottom-scorpion', name: 'Низ «Scorpion»', page: 7, kind: 'clothing', cost: { scheme: 5, personal: 3, user: 3, project: 2 } },
    ],
  },
  {
    page: 8,
    requires: { fromPage: 7, count: 3 },
    rewards: [
      { id: 'p8-bd-crate', name: 'Ящик со снаряжением Black Division', page: 8, kind: 'container', cost: { operating: 2, testing: 2, scheme: 2 } },
      { id: 'p8-tarcoin-50', name: 'Tarcoin (x50)', page: 8, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { medicine: 5, finance: 4, scheme: 4, operating: 1 } },
      { id: 'p8-hideout-walls', name: 'Стены с белым акцентом', page: 8, kind: 'hideout', cost: { medicine: 6, personal: 3, operating: 2, user: 2 } },
      { id: 'p8-pose-arch', name: 'Поза манекена «Арка»', page: 8, kind: 'pose', cost: { personal: 3, medicine: 2, testing: 1 } },
      { id: 'p8-pose-dome', name: 'Поза манекена «Купол»', page: 8, kind: 'pose', cost: { personal: 1, scheme: 2, project: 1 } },
    ],
  },
  {
    page: 9,
    requires: { fromPage: 8, count: 4 },
    rewards: [
      { id: 'p9-lv119', name: 'Чехол для бронеплит Spiritus Systems «LV-119» (Black Division, Снаряженный)', page: 9, kind: 'gear', itemId: '689479eb30cc5ba7be00f5ff', cost: { medicine: 4, project: 4, scheme: 2, testing: 2 } },
      { id: 'p9-tarcoin-50', name: 'Tarcoin (x50)', page: 9, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { user: 3, medicine: 2, personal: 1 } },
      { id: 'p9-tt-pack', name: 'Рюкзак Tasmanian Tiger «Modular Pack 45 Plus» (MultiCam Black)', page: 9, kind: 'gear', itemId: '68947a8ce4bf255d1b0ca759', cost: { operating: 5, finance: 2, project: 2 } },
      { id: 'p9-bd-crate', name: 'Ящик со снаряжением Black Division', page: 9, kind: 'container', cost: { project: 2, scheme: 2, personal: 1 } },
      { id: 'p9-hideout-server', name: 'Стиль убежища «Серверная»', page: 9, kind: 'hideout', cost: { operating: 6, personal: 4, testing: 4, user: 2, finance: 2 } },
    ],
  },
  {
    page: 10,
    requires: { fromPage: 9, count: 4 },
    rewards: [
      { id: 'p10-voice-bear-anton', name: 'Голос BEAR «Антон»', page: 10, kind: 'voice', cost: { project: 6, user: 5, personal: 5, medicine: 2, finance: 2 } },
      { id: 'p10-voice-usec-garret', name: 'Голос USEC «Гаррет»', page: 10, kind: 'voice', cost: { testing: 6, finance: 5, operating: 5, user: 2, project: 2 } },
      { id: 'p10-bd-crate', name: 'Ящик со снаряжением Black Division', page: 10, kind: 'container', cost: { finance: 3, user: 3, operating: 1 } },
      { id: 'p10-tarcoin-100', name: 'Tarcoin (x100)', page: 10, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { project: 5, finance: 4, scheme: 2, testing: 2 } },
    ],
  },
  {
    page: 11,
    requires: { fromPage: 10, count: 4 },
    rewards: [
      { id: 'p11-dogtag-4', name: 'Армейский жетон с отметками (4 уровень)', page: 11, kind: 'dogtag', cost: { project: 4, personal: 3, scheme: 2, finance: 2 } },
      { id: 'p11-tarcoin-150', name: 'Tarcoin (x150)', page: 11, kind: 'currency', itemId: '69dd0de23dfe95d9e70b5ebb', cost: { scheme: 5, user: 5, operating: 3, finance: 3 } },
      { id: 'p11-knyazev-after', name: 'КНЯЗЕВ ПОСЛЕ БОЯ', page: 11, kind: 'decor', cost: { project: 5, medicine: 5, finance: 3, personal: 3, operating: 3 } },
      { id: 'p11-oconnor-after', name: 'О.КОННОР ПОСЛЕ БОЯ', page: 11, kind: 'decor', cost: { user: 5, testing: 5, finance: 3, operating: 3, personal: 3 } },
    ],
  },
  {
    page: 12,
    requires: { fromPage: 11, count: 4 },
    rewards: [
      { id: 'p12-qbz-191', name: 'Штурмовая винтовка Norinco QBZ-191 5.8x42мм', page: 12, kind: 'weapon', cost: { operating: 7, finance: 6, user: 6, scheme: 5, testing: 5 } },
      { id: 'p12-top-night', name: 'Верх «Ночь»', page: 12, kind: 'clothing', cost: { scheme: 6, medicine: 5, user: 5, operating: 4, project: 3, testing: 1, personal: 1 } },
      { id: 'p12-bottom-night', name: 'Низ «Ночь»', page: 12, kind: 'clothing', cost: { operating: 6, user: 5, scheme: 5, finance: 4, project: 3 } },
    ],
  },
] as const;

/** Дневной лимит добычи документов по режимам (патч 14.08.2026). Свой таймер-сутки на режим. */
export interface BpDailyLimit {
  mode: string;
  limit: number;
  hint: string;
}

export const BP_DAILY_LIMITS: readonly BpDailyLimit[] = [
  { mode: 'Season PvP', limit: 30, hint: 'Сезонный PvP — самый щедрый режим добычи.' },
  { mode: 'PvP', limit: 20, hint: 'Обычный PvP.' },
  { mode: 'PvE', limit: 15, hint: 'PvE-режим.' },
] as const;

/** Справочно: «Секретные данные» — донатный джокер, заменяет любой документ. Не лутается → вне трекера. */
export const BP_SECRET_DATA_NOTE =
  'Секретные данные — универсальная валюта БП (покупается за реальные деньги): заменяет любой тип документа. ' +
  'Не лутается в рейде, поэтому в подсчёте остатка не участвует.';

/** Все награды одним списком (для расчётов). */
export const BP_ALL_REWARDS: readonly BpReward[] = BP_PAGES.flatMap((p) => p.rewards);
