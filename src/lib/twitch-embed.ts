// Загрузчик официального Twitch Player JS SDK (player.twitch.tv/js/embed/v1.js).
// Нужен ИМЕННО SDK (а не голый iframe) для StreamDock: только он даёт программный
// setMuted() — чтобы при сворачивании глушить звук, НЕ перезапуская трансляцию.
// Голый iframe так не умеет (muted применяется только на загрузке).

export interface TwitchPlayerOptions {
  channel: string;
  /** Домены, где встроен плеер. Обязателен для Twitch. Берём window.location.hostname. */
  parent: string[];
  width?: number | string;
  height?: number | string;
  muted?: boolean;
  autoplay?: boolean;
}

export interface TwitchPlayerInstance {
  setMuted(muted: boolean): void;
  getMuted(): boolean;
  pause(): void;
  play(): void;
  setChannel(channel: string): void;
  addEventListener(event: string, callback: () => void): void;
}

interface TwitchPlayerConstructor {
  new (el: string | HTMLElement, options: TwitchPlayerOptions): TwitchPlayerInstance;
  READY: string;
  PLAYING: string;
}

interface TwitchNamespace {
  Player: TwitchPlayerConstructor;
}

declare global {
  interface Window {
    Twitch?: TwitchNamespace;
  }
}

const EMBED_SRC = 'https://player.twitch.tv/js/embed/v1.js';

let loadPromise: Promise<TwitchNamespace> | null = null;

/** Инжектит embed-скрипт ОДИН раз (мемоизировано) и резолвит window.Twitch. */
export function loadTwitchEmbed(): Promise<TwitchNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('loadTwitchEmbed вызван на сервере'));
  }
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<TwitchNamespace>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = EMBED_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Twitch?.Player) resolve(window.Twitch);
      else reject(new Error('Twitch embed загружен, но Player недоступен'));
    };
    script.onerror = () => {
      loadPromise = null; // разрешаем повторную попытку
      reject(new Error('Не удалось загрузить Twitch embed'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
