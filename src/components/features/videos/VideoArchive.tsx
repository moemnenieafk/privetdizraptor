'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, History, SearchX } from 'lucide-react';
import type { Video } from '@/types/video';
import { isVideoSort } from '@/data/video-catalog';
import {
  EMPTY_QUERY,
  availableFacets,
  queryVideos,
  type VideoQuery,
} from '@/lib/video-utils';
import { getContinueIds, useVideoStore } from '@/store/useVideoStore';
import { VideoCard } from './VideoCard';
import { VideoFilterBar } from './VideoFilterBar';

/**
 * Клиентская витрина архива: получает ПОЛНЫЙ каталог категории с сервера (RSC-проп)
 * и всю фильтрацию делает в памяти — без round-trip на каждый чипс.
 *
 * Источник истины фильтра — URL (?q=&map=&topic=&sort=), см. VideoFilterBar.
 *
 * ВНИМАНИЕ при правках: из useVideoStore достаём ТОЛЬКО стабильные ссылки
 * (s.progress). Селектор, возвращающий новый массив/объект, роняет страницу
 * в бесконечный ре-рендер (zustand v5 + useSyncExternalStore).
 */

interface VideoArchiveProps {
  videos: Video[];
  errors?: string[];
  showContinue?: boolean;
}

export function VideoArchive({ videos, errors = [], showContinue = true }: VideoArchiveProps) {
  const params = useSearchParams();
  const view = useVideoStore((s) => s.view);
  const progress = useVideoStore((s) => s.progress); // стабильная ссылка

  const query = useMemo<VideoQuery>(() => {
    const sortRaw = params.get('sort') ?? '';
    return {
      search: params.get('q') ?? EMPTY_QUERY.search,
      maps: params.getAll('map'),
      topics: params.getAll('topic'),
      sort: isVideoSort(sortRaw) ? sortRaw : EMPTY_QUERY.sort,
    };
  }, [params]);

  const available = useMemo(() => availableFacets(videos), [videos]);
  const result = useMemo(() => queryVideos(videos, query), [videos, query]);

  /* «Продолжить»: начатые видео этой категории, свежие сверху.
     Массив выводим здесь, а не в селекторе стора — см. коммент выше. */
  const continueVideos = useMemo(() => {
    if (!showContinue) return [];
    const byId = new Map(videos.map((v) => [v.id, v]));
    return getContinueIds(progress)
      .map((id) => byId.get(id))
      .filter((v): v is Video => v !== undefined)
      .slice(0, 6);
  }, [showContinue, progress, videos]);

  const gridClass =
    view === 'table'
      ? 'flex flex-col gap-2'
      : 'grid grid-cols-1 gap-3 @lg/videoarchive:grid-cols-2 @3xl/videoarchive:grid-cols-3 @5xl/videoarchive:grid-cols-4';

  return (
    <div className="@container/videoarchive flex w-full flex-col gap-6">
      {errors.length > 0 && (
        <div className="flex items-start gap-3 rounded-sm border border-moderate/40 bg-[color-mix(in_srgb,var(--color-moderate)_10%,transparent)] p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-moderate" />
          <div className="flex flex-col gap-1">
            <span className="font-blender-medium text-xs uppercase tracking-widest text-moderate">
              Архив загружен частично
            </span>
            {errors.map((err) => (
              <span key={err} className="font-blender-book text-xs text-text-secondary">
                {err}
              </span>
            ))}
          </div>
        </div>
      )}

      {continueVideos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <History className="size-4 shrink-0 text-(--primary)" />
            <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              Продолжить просмотр
            </span>
            <div className="h-px flex-1 bg-lines-hover" />
          </div>

          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] @5xl/videoarchive:mx-0 @5xl/videoarchive:px-0">
            {continueVideos.map((video, i) => (
              <div key={video.id} className="w-64 shrink-0 snap-start @lg/videoarchive:w-72">
                <VideoCard video={video} view="grid" index={i} />
              </div>
            ))}
          </div>
        </section>
      )}

      <VideoFilterBar query={query} available={available} resultCount={result.length} />

      {result.length > 0 ? (
        <div className={gridClass}>
          {result.map((video, i) => (
            <VideoCard key={video.id} video={video} view={view} index={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-lines-hover bg-card-menu/40 px-4 py-12 text-center">
          <SearchX className="size-8 text-text-muted" />
          <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            {videos.length === 0 ? 'Архив пуст' : 'Ничего не найдено'}
          </span>
          <p className="max-w-xs font-blender-book text-xs text-text-secondary">
            {videos.length === 0
              ? 'Видео этой категории пока не опубликованы. Загляните позже.'
              : 'Попробуйте снять часть фильтров или изменить поисковый запрос.'}
          </p>
        </div>
      )}
    </div>
  );
}