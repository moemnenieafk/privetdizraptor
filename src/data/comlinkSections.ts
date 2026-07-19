// Раздел «Связь» (COMLINK) — сообщество ЦТА.
// Единый источник правды для роутов /eft/comlink/* и табов внутри раздела.
//
// Живые подразделы (свои статические роуты, перебивают [section]):
//   find-partner    — мои рейды: заявки, подтверждения, оценки
//   candidates      — анкеты игроков (фундамент раздела)
//   players         — статистика игрока по profile.json (загрузка + разбор)
//   sherpa-exchange — биржа наставников
//   discussions     — форум
// Заглушки (пока через [section]): masterclasses, blog, game-updates.

export const COMLINK_BASE = "/eft/comlink";
// Иконка раздела целиком (шапка индекса/заглушек). У подпунктов — свои иконки (поле icon ниже).
export const COMLINK_ICON = "/icons/eft/00-nav/comlink-icon.svg";

export interface ComlinkSection {
  slug: string;
  label: string;
  description: string;
  /** Иконка подраздела (плейсхолдер Lucide, до фирменной графики). */
  icon: string;
}

export const COMLINK_SECTIONS: ComlinkSection[] = [
  { slug: "find-partner", label: "Поиск напарника", description: "Заявки на совместные рейды, подтверждения и оценки напарников.", icon: "/icons/eft/07-comlink/find-partner.svg" },
  { slug: "candidates", label: "Кандидаты", description: "Анкеты игроков, ищущих команду или сокомандников.", icon: "/icons/eft/07-comlink/candidates.svg" },
  { slug: "players", label: "Статистика игрока", description: "Загрузи profile.json и посмотри полную стату: рейды, K/D, выживаемость, навыки, мастерство и престиж.", icon: "/icons/eft/07-comlink/player-stats.svg" },
  { slug: "sherpa-exchange", label: "Биржа шерпов", description: "Опытные игроки-наставники помогают новичкам освоиться.", icon: "/icons/eft/07-comlink/sherpa.svg" },
  { slug: "discussions", label: "Обсуждения", description: "Темы по игре: мета, споты, механики. У каждого автора виден уровень доверия.", icon: "/icons/eft/07-comlink/discussions.svg" },
  { slug: "masterclasses", label: "Мастер-классы", description: "Разборы, обучающие сессии и гайды от профи.", icon: "/icons/eft/07-comlink/masterclasses.svg" },
  { slug: "blog", label: "Новостной блог", description: "Новости проекта ЦТА, статьи и объявления.", icon: "/icons/eft/07-comlink/blog.svg" },
];

// Табы «навигация по разделу» для SectionPlaceholder.
export const COMLINK_TABS = COMLINK_SECTIONS.map((s) => ({
  id: s.slug,
  label: s.label,
  href: `${COMLINK_BASE}/${s.slug}`,
  iconUrl: s.icon,
}));
