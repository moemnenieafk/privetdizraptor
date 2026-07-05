// Конфиг футера (эпик E12 — редизайн). Единая точка правды для стримеров,
// соц-сетей, доп-ссылок и юр-ссылок. Навигация НЕ здесь — она берётся из
// общего headerConfig (game-aware) прямо в компоненте.
//
// TODO(V4DYA): заполнить реальные URL там, где стоит "#".

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
    channelUrl: "https://twitch.tv/fullkamen",
    avatar: "/images/footer/fullkamen-avatar.png",
    wordmark: "/images/footer/fullkamen-wordmark.svg",
    wordmarkWidth: 156,
    wordmarkHeight: 21,
    thumb: "/images/footer/fullkamen-thumb.png",
    platforms: [
      { kind: "youtube", href: "#" }, // TODO youtube-канал Фуллкамень
      { kind: "twitch", href: "https://twitch.tv/fullkamen" },
    ],
  },
  {
    id: "v4dya",
    name: "V4DYA",
    twitchLogin: "v4dyatv",
    channelUrl: "https://twitch.tv/v4dyatv",
    avatar: "/images/footer/v4dya-avatar.png",
    wordmark: "/images/footer/v4dya-wordmark.svg",
    wordmarkWidth: 108,
    wordmarkHeight: 14,
    thumb: "/images/footer/v4dya-thumb.png",
    platforms: [
      { kind: "vklive", href: "#" },  // TODO VK Live V4DYA
      { kind: "youtube", href: "#" }, // TODO youtube-канал V4DYA
      { kind: "twitch", href: "https://twitch.tv/v4dyatv" },
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
  { label: "Discord",  href: "#", icon: "/images/footer/social/discord.svg" }, // TODO Discord-инвайт
  { label: "VK",       href: "#", icon: "/images/footer/social/vk.svg"      }, // TODO VK-сообщество
  { label: "Boosty",   href: "#", icon: "/images/footer/social/boosty.svg"  }, // TODO Boosty
  { label: "X",        href: "#", icon: "/images/footer/social/xcom.svg"    }, // TODO X (Twitter)
  { label: "Reddit",   href: "#", icon: "/images/footer/social/reddit.svg"  }, // TODO Reddit
];

// ── Кнопка «Поддержка» (Boosty) ─────────────────────────────────────
export const SUPPORT_LINK = { label: "Поддержка", href: "#" }; // TODO Boosty-донат

// ── Доп-ссылки (правая колонка) ─────────────────────────────────────
export interface FooterLink {
  label: string;
  href: string;
}

export const ADDITIONAL_LINKS: FooterLink[] = [
  { label: "Партнёрская программа", href: "#" }, // TODO
  { label: "Интеграции",            href: "#" }, // TODO
  { label: "Экосистема ЦТА",        href: "#" }, // TODO
];

// ── Юр-ссылки (нижний бар). Страницы создаются отдельной задачей. ────
export const LEGAL_LINKS: FooterLink[] = [
  { label: "Оферта",                      href: "/legal/offer"    },
  { label: "Условия использования",       href: "/legal/terms"    },
  { label: "Политика конфиденциальности", href: "/legal/privacy"  },
  { label: "Пользовательское соглашение", href: "/legal/eula"     },
];

// Пункт навигации «Связь» — добавляется к game-nav из headerConfig.
export const COMLINK_ITEM = {
  label: "Связь",
  href: "#", // TODO страница/модалка контактов
  iconUrl: "/icons/eft/00-nav/comlink-icon.svg",
};
