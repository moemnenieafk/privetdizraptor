// Раздел «Связь» (COMLINK) — сообщество ЦТА.
// Единый источник правды для роутов /eft/comlink/* и табов внутри раздела.
//
// Живые подразделы (свои статические роуты, перебивают [section]):
//   find-partner    — мои рейды: заявки, подтверждения, оценки
//   candidates      — анкеты игроков (фундамент раздела)
//   sherpa-exchange — биржа наставников
//   discussions     — форум
// Заглушки (пока через [section]): masterclasses, blog, game-updates.

export const COMLINK_BASE = "/eft/comlink";
// TODO: свои иконки подпунктов (пока общий comlink-icon как плейсхолдер).
export const COMLINK_ICON = "/icons/eft/00-nav/comlink-icon.svg";

export interface ComlinkSection {
  slug: string;
  label: string;
  description: string;
}

export const COMLINK_SECTIONS: ComlinkSection[] = [
  { slug: "find-partner", label: "Поиск напарника", description: "Заявки на совместные рейды, подтверждения и оценки напарников." },
  { slug: "candidates", label: "Кандидаты", description: "Анкеты игроков, ищущих команду или сокомандников." },
  { slug: "sherpa-exchange", label: "Биржа шерпов", description: "Опытные игроки-наставники помогают новичкам освоиться." },
  { slug: "discussions", label: "Обсуждения", description: "Темы по игре: мета, споты, механики. У каждого автора виден уровень доверия." },
  { slug: "masterclasses", label: "Мастер-классы", description: "Разборы, обучающие сессии и гайды от профи." },
  { slug: "blog", label: "Новостной блог", description: "Новости проекта ЦТА, статьи и объявления." },
  { slug: "game-updates", label: "Обновления игры", description: "Патчи, вайпы и ключевые изменения игры." },
];

// Табы «навигация по разделу» для SectionPlaceholder.
export const COMLINK_TABS = COMLINK_SECTIONS.map((s) => ({
  id: s.slug,
  label: s.label,
  href: `${COMLINK_BASE}/${s.slug}`,
  iconUrl: COMLINK_ICON,
}));
