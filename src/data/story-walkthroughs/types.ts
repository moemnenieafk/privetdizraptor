// Модель walkthrough-гайда сюжетной истории (новый дизайн, Figma story-boreas-step01/02/03;
// решение docs/decisions/quest-story-design.md). Общая для всех историй.

export type WalkthroughConditionKind = 'hideout' | 'item' | 'story';

export interface WalkthroughCondition {
  kind: WalkthroughConditionKind;
  /** Заголовок ноды условия («УБЕЖИЩЕ ЧВК», «БАРАХОЛКА / ПОИСК ПРЕДМЕТА», имя этапа). */
  label: string;
  /** hideout: станция (kebab normalizedName) + уровень — авто-чек из useHideoutStore. */
  station?: { normalizedName: string; name: string; level: number };
  /** item: BSG id (плитка + актуальная цена из зеркала) + сколько нужно. */
  item?: { id: string; name: string; count: number; fir?: boolean };
  /** story: иконка-маска (icon-eft-quests-*) + пояснение. */
  story?: { iconClass: string; note: string };
  /** Локация в шапке ноды (icon-eft-maps-*): условие привязано к карте («ЛЕС», «РАЗВЯЗКА»…). */
  mapIcon?: string;
  /** Торговец в шапке ноды (normalizedName): фото /images/traders/eft/<nn>.webp + фирменный цвет. */
  trader?: string;
}

export interface WalkthroughBlock {
  /** Буллеты-описание способа (оранжевый квадратик + текст; поддержка под-списка). */
  text?: string[];
  subList?: string[];
  /** Хвостовая строка с ценой предмета: подставляется актуальная цена из зеркала. */
  priceNote?: { itemId: string; template: string }; // template с «{price}»
  /** Предупреждение (⚠ оранжевый) — например фолбэк «если забыли прочитать в рейде». */
  warning?: string;
  condition?: WalkthroughCondition;
}

/** Медиа шага/под-шага/ветки: постер + галерея + (видео | заглушки). Общий тип для всех уровней. */
export interface StoryMedia {
  poster: string;
  /** Надписи постера (название истории + подпись). */
  posterTitle: string;
  posterSub: string;
  /** Есть видеоролик — рендерить Play-оверлей. */
  video?: boolean;
  /** Ссылка на видеогайд — Play становится кликабельным (новая вкладка). */
  videoUrl?: string;
  screenshots: string[];
  /** Заглушка «видео скоро» — приглушённый Play-плейсхолдер, пока нет video/videoUrl. */
  videoSoon?: boolean;
  /** Заглушка «скриншоты скоро» — плитки-плейсхолдеры, пока screenshots пуст. */
  screenshotsSoon?: boolean;
}

/** Под-шаг лестницы (вложенный уровень; id — стабильный суффикс ключей прогресса). */
export interface WalkthroughSubStep {
  id: string;
  title: string;
  intro?: string;
  /** Своё медиа под-этапа (видео+скрины именно этого под-шага); нет — наследует ветку/шаг. */
  media?: StoryMedia;
  blocks: WalkthroughBlock[];
}

/** Ветка развилки: игрок выбирает путь — под-шаги выбранной ветки раскрываются в лестнице. */
export interface WalkthroughBranch {
  id: string;
  /** «Кейс отдан Прапору» — заголовок варианта в селекторе пути. */
  title: string;
  /** Короткое пояснение выбора (под заголовком варианта). */
  note?: string;
  /** Своё медиа ветки-выбора (фолбэк для её под-шагов, если у них своего нет). */
  media?: StoryMedia;
  substeps: WalkthroughSubStep[];
}

export interface WalkthroughStep {
  n: number;
  title: string;
  /** Иконка торговца-квестодателя (фото /images/traders/eft/<x>.webp). */
  traderPhoto?: string;
  intro?: string;
  media?: StoryMedia;
  blocks: WalkthroughBlock[];
  /** Простая вложенность: под-шаги раскрываются в лестнице, когда шаг активен. */
  substeps?: WalkthroughSubStep[];
  /** Развилка: игрок выбирает путь, раскрывается только выбранная ветка (выбор можно сменить). */
  branches?: WalkthroughBranch[];
}

export interface StoryWalkthrough {
  slug: string;
  title: string;
  /** Иконка истории: svg для QuestsHubNav + класс-маска для заглушек (имена НЕ совпадают со slug). */
  iconUrl: string;
  iconClass: string;
  /** Hero-арт; не задан — рендерится стилизованная NIGHTFALL-заглушка (иконка + градиентный тайтл). */
  heroImage?: string;
  /** Декор постера-фолбэка: картинка слева от тайтла + цвет градиента тайтла (Борей: якорь + сталь). */
  posterDecor?: { image?: string; gradientTo: string };
  /** Шкала из 7 черепов: skulls = заполненные (danger). Лёгкая 2 · Средняя 4 · Сложная 5 · Экстрим 6. */
  difficulty: { skulls: number; label: string };
  /** Требование/активация истории (станция — опционально, только если есть авто-чек). */
  requirement?: {
    station?: { normalizedName: string; name: string; level: number };
    note: string[];
  };
  /** Версия игры, на которую сверен контент (футер актуальности). */
  verifiedAt: { date: string; time: string; gameVersion: string };
  /** Есть интерактивная карта истории (/eft/quests/<slug>/map) — рендерить кнопку «Карта квеста». */
  hasMap?: boolean;
  steps: WalkthroughStep[];
}
