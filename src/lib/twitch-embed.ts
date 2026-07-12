// Загрузчик официального Twitch Player JS SDK (player.twitch.tv/js/embed/v1.js).
// Нужен ИМЕННО SDK (а не голый iframe) по двум причинам:
//   • StreamDock — программный setMuted() (глушим при сворачивании, не перезапуская поток);
//   • VideoPlayer (архив) — seek()/getCurrentTime() для глав и «продолжить с таймкода».
// Голый iframe ни то, ни другое не умеет.

/** Общая часть опций плеера — валидна и для лайва, и для VOD. */
interface TwitchPlayerBaseOptions {
  /** Домены, где встроен плеер. Обязателен для Twitch. Берём window.location.hostname. */
  parent: string[];
  width?: number | string;
  height?: number | string;
  muted?: boolean;
  autoplay?: boolean;
  controls?: boolean;
}

/** Лайв-трансляция канала (StreamDock). */
interface TwitchChannelOptions extends TwitchPlayerBaseOptions {
  channel: string;
  video?: never;
  time?: never;
}

/** Запись/VOD по id (VideoPlayer архива). `time` — стартовый таймкод: '1h2m3s'. */
interface TwitchVideoOptions extends TwitchPlayerBaseOptions {
  video: string;
  time?: string;
  channel?: never;
}

/**
 * Union: SDK принимает РОВНО ОДНО из channel/video. `never`-поля не дают
 * передать оба сразу — ошибка ловится на этапе tsc, а не в рантайме.
 */
export type TwitchPlayerOptions = TwitchChannelOptions | TwitchVideoOptions;

export interface TwitchPlayerInstance {
  /* — общее — */
  setMuted(muted: boolean): void;
  getMuted(): boolean;
  pause(): void;
  play(): void;
  addEventListener(event: string, callback: () => void): void;
  removeEventListener?(event: string, callback: () => void): void;

  /* — лайв — */
  setChannel(channel: string): void;

  /* — VOD: доступны только когда плеер создан с { video }. Помечены опциональными,
       чтобы StreamDock (лайв) не был обязан их предоставлять. — */
  seek?(timestampSeconds: number): void;
  getCurrentTime?(): number;
  getDuration?(): number;
  setVideo?(videoId: string, timestampSeconds: number): void;
}

interface TwitchPlayerConstructor {
  new (el: string | HTMLElement, options: TwitchPlayerOptions): TwitchPlayerInstance;
  READY: string;
  PLAYING: string;
  PAUSE: string;
  ENDED: string;
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