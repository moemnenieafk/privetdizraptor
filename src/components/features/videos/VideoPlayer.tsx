'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, ExternalLink, ListVideo, RotateCcw } from 'lucide-react';
import type { Video } from '@/types/video';
import { useVideoStore } from '@/store/useVideoStore';
import { loadTwitchEmbed, type TwitchPlayerInstance } from '@/lib/twitch-embed';
import { formatAge, formatDuration, formatViews } from '@/lib/video-utils';

/**
 * Плеер страницы видео. Ключевая фича архива (то, чего нет в мобильном YouTube):
 * возобновление с сохранённого таймкода и МГНОВЕННЫЙ переход по главам.
 *
 * Реализация:
 *   • YouTube — IFrame Player API (window.YT), postMessage-контроль seekTo();
 *   • Twitch  — уже подключённый в проекте loadTwitchEmbed() (тот же, что StreamDock).
 * Оба грузятся только на клиенте — SSR не нужен, плеер тяжёлый.
 *
 * Прогресс пишем в useVideoStore раз в 5с (throttle) и на unmount — localStorage
 * не должен дёргаться на каждый tick.
 */

const SAVE_INTERVAL = 5000;

/* ─────────────── типы YouTube IFrame API (без any) ─────────────── */

interface YTPlayerInstance {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: { onReady?: () => void };
    },
  ) => YTPlayerInstance;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Грузит YT IFrame API один раз на страницу, резолвится когда namespace готов. */
let ytPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (ytPromise) return ytPromise;
  ytPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('YouTube IFrame API не загрузился'));
    window.onYouTubeIframeAPIReady = () => {
      if (window.YT) resolve(window.YT);
      else reject(new Error('YT namespace пуст'));
    };
    document.head.appendChild(script);
  });
  return ytPromise;
}

/* ─────────────────────────── компонент ─────────────────────────── */

interface VideoPlayerProps {
  video: Video;
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ytRef = useRef<YTPlayerInstance | null>(null);
  const twRef = useRef<TwitchPlayerInstance | null>(null);

  const [ready, setReady] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);

  // Стартовую позицию берём ОДИН раз (в ref), иначе стор триггерит пересоздание плеера.
  const saved = useVideoStore.getState().progress[video.id];
  const startAt = useRef<number>(saved && !saved.completed ? saved.position : 0);

  const setProgress = useVideoStore((s) => s.setProgress);
  const clearProgress = useVideoStore((s) => s.clearProgress);
  const isFavorite = useVideoStore((s) => s.favorites.includes(video.id));
  const toggleFavorite = useVideoStore((s) => s.toggleFavorite);

  /* ─── монтирование плеера ─── */
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    const begin = startAt.current;

    if (video.source === 'youtube') {
      loadYouTubeApi()
        .then((YT) => {
          if (disposed || !host) return;
          ytRef.current = new YT.Player(host, {
            videoId: video.id,
            playerVars: {
              start: Math.floor(begin),
              rel: 0,
              modestbranding: 1,
              playsinline: 1, // критично: iOS иначе уводит в нативный фуллскрин
            },
            events: { onReady: () => !disposed && setReady(true) },
          });
        })
        .catch(() => setReady(true)); // деградация: остаётся ссылка «Смотреть на платформе»
    } else {
      loadTwitchEmbed()
        .then((Twitch) => {
          if (disposed || !host) return;
          twRef.current = new Twitch.Player(host, {
            video: video.id,
            parent: [window.location.hostname],
            width: '100%',
            height: '100%',
            autoplay: false,
            time: `${Math.floor(begin / 60)}m${Math.floor(begin % 60)}s`,
          });
          setReady(true);
        })
        .catch(() => setReady(true));
    }

    return () => {
      disposed = true;
      ytRef.current?.destroy();
      ytRef.current = null;
      twRef.current = null;
      host.replaceChildren(); // снять iframe: StrictMode иначе плодит дубли
    };
  }, [video.id, video.source]);

  /* ─── текущая позиция (унифицировано по платформам) ─── */
  const currentTime = useCallback((): number => {
    if (ytRef.current) return ytRef.current.getCurrentTime();
    if (twRef.current) return twRef.current.getCurrentTime?.() ?? 0;
    return 0;
  }, []);

  /* ─── автосейв прогресса + подсветка активной главы ─── */
  useEffect(() => {
    if (!ready) return;

    const tick = () => {
      const pos = currentTime();
      if (pos <= 0) return;

      setProgress(video.id, pos, video.duration);

      if (video.chapters.length > 0) {
        const idx = video.chapters.findLastIndex((c) => c.start <= pos);
        setActiveChapter(idx < 0 ? 0 : idx);
      }
    };

    const id = setInterval(tick, SAVE_INTERVAL);
    return () => {
      tick(); // финальный сейв при уходе со страницы
      clearInterval(id);
    };
  }, [ready, currentTime, setProgress, video.id, video.duration, video.chapters]);

  /* ─── переход по главе ─── */
  const seek = (seconds: number) => {
    if (ytRef.current) {
      ytRef.current.seekTo(seconds, true);
      return;
    }
    twRef.current?.seek?.(seconds);
  };

  const resumeFrom = startAt.current;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* ─── Плеер 16:9. Скелетон под ним, пока грузится iframe. ─── */}
      <div className="relative aspect-video w-full overflow-hidden rounded-sm border border-lines-hover bg-(--color-darkbase)">
        {!ready && <div className="absolute inset-0 animate-pulse bg-card-menu" />}
        <div ref={hostRef} className="size-full [&>iframe]:size-full" />
      </div>

      {/* ─── Шапка: заголовок + мета + действия ─── */}
      <div className="flex flex-col gap-3">
        <h1 className="font-blender-medium text-xl leading-tight uppercase tracking-tight text-text-primary sm:text-2xl">
          {video.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-blender-medium text-xs text-text-muted">
          <span>{formatViews(video.viewCount)} просмотров</span>
          <span className="size-0.5 rounded-full bg-text-muted" />
          <span>{formatAge(video.publishedAt)}</span>
          <span className="size-0.5 rounded-full bg-text-muted" />
          <span>{formatDuration(video.duration)}</span>
          <span className="size-0.5 rounded-full bg-text-muted" />
          <span className="uppercase tracking-widest text-text-secondary">
            {video.source === 'twitch' ? 'Twitch' : 'YouTube'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Резюм: показываем ТОЛЬКО если реально было где продолжать */}
          {resumeFrom > 0 && (
            <button
              type="button"
              onClick={() => {
                clearProgress(video.id);
                seek(0);
              }}
              className="flex h-11 items-center gap-2 rounded border border-lines-hover bg-card-menu px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors duration-200 hover:border-(--primary) hover:text-(--primary)"
            >
              <RotateCcw className="size-3.5" />
              Смотреть сначала
              <span className="text-text-muted">· продолжено с {formatDuration(resumeFrom)}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => toggleFavorite(video.id)}
            aria-pressed={isFavorite}
            className={`flex h-11 items-center gap-2 rounded border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors duration-200 ${
              isFavorite
                ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)'
                : 'border-lines-hover bg-card-menu text-text-secondary hover:border-(--primary) hover:text-(--primary)'
            }`}
          >
            <Bookmark className={`size-3.5 ${isFavorite ? 'fill-current' : ''}`} />
            {isFavorite ? 'В избранном' : 'Смотреть позже'}
          </button>

          <a
            href={video.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center gap-2 rounded border border-lines-hover bg-card-menu px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors duration-200 hover:border-(--primary) hover:text-(--primary)"
          >
            <ExternalLink className="size-3.5" />
            Оригинал
          </a>
        </div>
      </div>

      {/* ─── Главы: тап = seek. Активная подсвечена, автоскроллить не нужно — список короткий. ─── */}
      {video.chapters.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <ListVideo className="size-4 shrink-0 text-(--primary)" />
            <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              Главы · {video.chapters.length}
            </span>
            <div className="h-px flex-1 bg-lines-hover" />
          </div>

          <ol className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {video.chapters.map((chapter, i) => {
              const active = i === activeChapter;
              return (
                <li key={chapter.start}>
                  <button
                    type="button"
                    onClick={() => seek(chapter.start)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-[background-color,border-color] duration-200 ${
                      active
                        ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]'
                        : 'border-transparent bg-card-menu hover:border-lines-hover'
                    }`}
                  >
                    <span
                      className={`shrink-0 font-blender-medium text-xs tabular-nums ${
                        active ? 'text-(--primary)' : 'text-text-muted'
                      }`}
                    >
                      {formatDuration(chapter.start)}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate font-blender-book text-sm ${
                        active ? 'text-text-primary' : 'text-text-secondary'
                      }`}
                    >
                      {chapter.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}