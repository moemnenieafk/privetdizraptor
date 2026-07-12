'use client';

import Link from 'next/link';
import { Bookmark, Check, Play } from 'lucide-react';
import type { Video } from '@/types/video';
import { useVideoStore } from '@/store/useVideoStore';
import {
  formatAge,
  formatDuration,
  formatViews,
  progressPercent,
} from '@/lib/video-utils';

/**
 * Карточка видео архива. Два режима под общий DataViewToggle:
 *   • grid  — превью 16:9 + мета под ним (дефолт, узнаваемо, thumb-friendly);
 *   • table — плотная строка: мини-превью 128px слева, текст справа (мобильный список).
 *
 * Персонализация (2026-паттерн «continue watching»): полоса прогресса поверх
 * превью и галка «просмотрено» — читаются из useVideoStore, без запросов к БД.
 * Клик по карточке ведёт на /eft/videos/[category]/[id]; если есть прогресс —
 * страница сама подхватит таймкод.
 */

/**
 * Глиф Twitch. lucide-react больше не поставляет бренд-иконки, поэтому
 * держим свой inline-SVG — ноль новых зависимостей, цвет наследуется.
 */
function TwitchGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M4.3 3 3 6.3v13.4h4.6V22h2.5l2.3-2.3h3.7L21 15.1V3H4.3Zm15 11.1-2.6 2.6h-3.7l-2.3 2.3v-2.3H7.4V4.6h11.9v9.5ZM15.6 7.7v4.6h-1.5V7.7h1.5Zm-4.1 0v4.6H10V7.7h1.5Z" />
    </svg>
  );
}

interface VideoCardProps {
  video: Video;
  view?: 'grid' | 'table';
  /** Каскадная анимация появления в сетке. */
  index?: number;
}

export function VideoCard({ video, view = 'grid', index = 0 }: VideoCardProps) {
  const progress = useVideoStore((s) => s.progress[video.id]);
  const isFavorite = useVideoStore((s) => s.favorites.includes(video.id));
  const toggleFavorite = useVideoStore((s) => s.toggleFavorite);

  const percent = progress ? progressPercent(progress.position, progress.duration) : 0;
  const watched = progress?.completed ?? false;
  const href = `/eft/videos/${video.category}/${video.id}`;
  const isTable = view === 'table';

  const onFavorite = (e: React.MouseEvent) => {
    e.preventDefault(); // карточка — Link, не даём уйти на страницу
    e.stopPropagation();
    toggleFavorite(video.id);
  };

  /* ─── превью: общий блок для обоих режимов ─── */
  const preview = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-sm bg-(--color-darkbase) ${
        isTable ? 'w-32 aspect-video sm:w-40' : 'w-full aspect-video'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- CDN-превью YouTube/Twitch, вне next/image loader */}
      <img
        src={video.thumbnail}
        alt=""
        loading="lazy"
        className={`size-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-105 ${
          watched ? 'opacity-45' : 'opacity-90 group-hover:opacity-100'
        }`}
      />

      {/* Play-оверлей: на тач-устройствах не по hover, а всегда мягко виден */}
      <div className="absolute inset-0 flex items-center justify-center bg-linear-to-t from-(--color-base)/70 to-transparent">
        <span
          className={`flex items-center justify-center rounded-full border border-(--primary)/70 bg-(--color-base)/60 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110 ${
            isTable ? 'size-7' : 'size-11'
          }`}
        >
          <Play
            className={
              isTable
                ? 'size-3 fill-current text-(--primary)'
                : 'size-4 fill-current text-(--primary)'
            }
          />
        </span>
      </div>

      {/* Длительность */}
      <span className="absolute bottom-1 right-1 rounded-xs bg-(--color-base)/85 px-1 font-blender-medium text-type-micro tracking-wider text-text-primary">
        {formatDuration(video.duration)}
      </span>

      {/* Источник: Twitch помечаем, YouTube — дефолт, не шумим */}
      {video.source === 'twitch' && !watched && (
        <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-xs bg-(--color-base)/85">
          <TwitchGlyph className="size-3 text-[#A970FF]" />
        </span>
      )}

      {/* Просмотрено */}
      {watched && (
        <span className="absolute left-1 top-1 flex h-5 items-center gap-1 rounded-xs border border-nvg-green/50 bg-(--color-base)/85 px-1">
          <Check className="size-3 stroke-3 text-nvg-green" />
          {!isTable && (
            <span className="font-blender-medium text-type-micro uppercase tracking-widest text-nvg-green">
              Просмотрено
            </span>
          )}
        </span>
      )}

      {/* Полоса прогресса — главный сигнал «продолжить» */}
      {percent > 0 && !watched && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-(--color-base)/70">
          <div className="h-full bg-(--primary)" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );

  /* ─── мета ─── */
  const meta = (
    <div className={`flex min-w-0 flex-1 flex-col ${isTable ? 'gap-1' : 'gap-1.5'}`}>
      <h3
        className={`line-clamp-2 font-blender-medium text-sm leading-tight uppercase tracking-wide transition-colors duration-200 group-hover:text-(--primary) ${
          watched ? 'text-text-secondary' : 'text-text-primary'
        }`}
      >
        {video.title}
      </h3>

      <div className="flex items-center gap-2 font-blender-medium text-xs text-text-muted">
        <span>{formatViews(video.viewCount)}</span>
        <span className="size-0.5 rounded-full bg-text-muted" />
        <span>{formatAge(video.publishedAt)}</span>
        {video.chapters.length > 0 && (
          <>
            <span className="size-0.5 rounded-full bg-text-muted" />
            <span className="text-(--primary)/80">{video.chapters.length} глав</span>
          </>
        )}
      </div>
    </div>
  );

  /* ─── избранное: 44px тач-таргет (правило мобильного аудита E8) ─── */
  const favoriteButton = (
    <button
      type="button"
      onClick={onFavorite}
      aria-label={isFavorite ? 'Убрать из «Смотреть позже»' : 'В «Смотреть позже»'}
      aria-pressed={isFavorite}
      className={`flex size-11 shrink-0 items-center justify-center rounded-sm transition-colors duration-200 ${
        isFavorite ? 'text-(--primary)' : 'text-text-muted hover:text-(--primary)'
      }`}
    >
      <Bookmark className={`size-4 ${isFavorite ? 'fill-current' : ''}`} />
    </button>
  );

  return (
    <Link
      href={href}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      className={`group flex animate-[fade-in_0.4s_ease-out_both] rounded-sm border border-lines-hover bg-card-menu outline-none transition-[border-color] duration-200 hover:border-(--primary)/60 focus-visible:border-(--primary) ${
        isTable ? 'items-center gap-3 p-2' : 'flex-col gap-3 p-2'
      }`}
    >
      {preview}
      <div className={`flex min-w-0 flex-1 items-start gap-1 ${isTable ? '' : 'px-1 pb-1'}`}>
        {meta}
        {favoriteButton}
      </div>
    </Link>
  );
}

/** Скелетон выдачи (правило проекта: никаких спиннеров). */
export function VideoCardSkeleton({ view = 'grid' }: { view?: 'grid' | 'table' }) {
  const isTable = view === 'table';
  return (
    <div
      className={`flex animate-pulse rounded-sm border border-lines-hover bg-card-menu p-2 ${
        isTable ? 'items-center gap-3' : 'flex-col gap-3'
      }`}
    >
      <div
        className={`shrink-0 rounded-sm bg-(--color-darkbase) ${
          isTable ? 'w-32 aspect-video sm:w-40' : 'w-full aspect-video'
        }`}
      />
      <div className="flex w-full flex-col gap-2 px-1 pb-1">
        <div className="h-3 w-full rounded-xs bg-(--color-darkbase)" />
        <div className="h-3 w-2/3 rounded-xs bg-(--color-darkbase)" />
        <div className="h-2 w-1/3 rounded-xs bg-(--color-darkbase)" />
      </div>
    </div>
  );
}