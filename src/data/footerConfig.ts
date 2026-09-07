// Конфиг футера (эпик E12 — редизайн). Единая точка правды для стримеров,
// соц-сетей, доп-ссылок и юр-ссылок. Навигация НЕ здесь — она берётся из
// общего headerConfig (game-aware) прямо в компоненте.
//
// Правило: ссылка без реального URL в футер НЕ попадает (мёртвые "#" на паблике —
// признак недоделанного сайта). Появится URL — просто добавь запись в массив.

// ── Стример-карточки ────────────────────────────────────────────────
export type StreamPlatformKind = "twitch" | "youtube" | "vklive";

// Иконки платформ = самоцветные SVG с двумя состояниями (default серый / hover цветной).
// Файлы: /icons/streamingplatforms/btn-<kind>-{default,hover}.svg
export const streamPlatformIcon = (kind: StreamPlatformKind, hover = false) =>
  `/icons/streamingplatforms/btn-${kind}-${hover ? "hover" : "default"}.svg`;

export interface StreamPlatformLink {
  kind: StreamPlatformKind;
  href: string;
}

export interface Streamer {
  id: string;
  name: string;
  /** login на Twitch — сопоставляется с channels из /api/twitch-status */
  twitchLogin: string;
  /** основная ссылка карточки (клик по превью) */
  channelUrl: string;
  avatar: string;
  wordmark: string;
  wordmarkWidth: number;
  wordmarkHeight: number;
  thumb: string;
  platforms: StreamPlatformLink[];
}

export const STREAMERS: Streamer[] = [
  {
    id: "fullkamen",
    name: "Фуллкамень",
    twitchLogin: "fullkamen",
    channelUrl: "https://www.twitch.tv/fullkamen",
    avatar: "/images/footer/fullkamen-avatar.png",
    wordmark: "/images/footer/fullkamen-wordmark.svg",
    wordmarkWidth: 156,
    wordmarkHeight: 21,
    thumb: "/images/footer/fullkamen-thumb.png",
    platforms: [
      { kind: "youtube", href: "https://www.youtube.com/@fullkamen" },
      { kind: "twitch", href: "https://www.twitch.tv/fullkamen" },
    ],
  },
  {
    id: "v4dya",
    name: "V4DYA",
    twitchLogin: "v4dyatv",
    channelUrl: "https://www.twitch.tv/v4dyatv",
    avatar: "/images/footer/v4dya-avatar.png",
    wordmark: "/images/footer/v4dya-wordmark.svg",
    wordmarkWidth: 108,
    wordmarkHeight: 14,
    thumb: "/images/footer/v4dya-thumb.png",
    platforms: [
      { kind: "vklive", href: "https://live.vkvideo.ru/v4dya" },
      { kind: "youtube", href: "https://www.youtube.com/@v4dya-tv" },
      { kind: "twitch", href: "https://www.twitch.tv/v4dyatv" },
    ],
  },
];

// ── Соц-сетка 3×2 ───────────────────────────────────────────────────
// icon = готовый ассет кнопки из Figma (заливка + глиф запечены), 48×48.
export interface SocialLink {
  label: string;
  href: string;
  icon: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { label: "Telegram", href: "https://t.me/fullkamen", icon: "/images/footer/social/telegram.svg" },
  { label: "Discord",  href: "https://discord.gg/rYc6hpfvez", icon: "/images/footer/social/discord.svg" },
  { label: "Boosty",   href: "https://boosty.to/fullkamen", icon: "/images/footer/social/boosty.svg"  },
  // Скрыты до появления реальных площадок (ассеты на месте — вернуть строкой с href):
  //   VK     → /images/footer/social/vk.svg
  //   X      → /images/footer/social/xcom.svg
  //   Reddit → /images/footer/social/reddit.svg
];

// ── Кнопка «Поддержка» (Boosty) ─────────────────────────────────────
export const SUPPORT_LINK = { label: "Поддержка", href: "https://boosty.to/fullkamen" };

// ── Доп-ссылки (правая колонка) ─────────────────────────────────────
export interface FooterLink {
  label: string;
  href: string;
}

// Пусто до готовности разделов: «Партнёрская программа», «Интеграции», «Экосистема ЦТА»
// вернутся сюда с реальными путями. Пустой массив — колонка в футере не рендерится.
export const ADDITIONAL_LINKS: FooterLink[] = [];

// ── Юр-ссылки (нижний бар).
// «Документы» — хаб со всеми правовыми документами, «Реквизиты» — сведения о продавце.
// Реквизиты вынесены отдельной ссылкой намеренно: при подключении кассы проверяющие
// требуют, чтобы страница с реквизитами продавца была доступна с любой страницы сайта.
// Оферта и пользовательское соглашение — черновики, живут внутри хаба с пометкой.
export const LEGAL_LINKS: FooterLink[] = [
  { label: "Документы",                   href: "/legal"            },
  { label: "Реквизиты",                   href: "/legal/requisites" },
  { label: "Условия использования",       href: "/legal/terms"      },
  { label: "Политика конфиденциальности", href: "/legal/privacy"    },
];
