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
import { selectContinueIds, useVideoStore } from '@/store/useVideoStore';
import { VideoCard } from './VideoCard';
import { VideoFilterBar } from './VideoFilterBar';

/**
 * Клиентская витрина архива: получает ПОЛНЫЙ каталог категории с сервера
 * (RSC-проп) и всю фильтрацию делает в памяти — без round-trip на каждый чипс.
 * Каталог одной категории — сотни объектов, это дёшево и мгновенно на телефоне.
 *
 * Источник истины фильтра — URL (?q=&map=&topic=&sort=), см. VideoFilterBar.
 * Ряд «Продолжить просмотр» — персонализация из localStorage (useVideoStore),
 * рендерится только после гидрации, поэтому SSR/CSR-разметка не расходится.
 */

interface VideoArchiveProps {
  videos: Video[];
  /** Мягкая деградация платформ: ошибки YouTube/Twitch показываем баннером. */
  errors?: string[];
  /** Показывать ли ряд «Продолжить просмотр» (на хабе — да, внутри категории — да). */
  showContinue?: boolean;
}

export function VideoArchive({ videos, errors = [], showContinue = true }: VideoArchiveProps) {
  const params = useSearchParams();
  const view = useVideoStore((s) => s.view);
  const continueIds = useVideoStore(selectContinueIds);

  /* Разбор URL → VideoQuery. Мультизначные оси читаем через getAll. */
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
     Фильтр не влияет — это отдельный контекстный ряд, а не часть выдачи. */
  const continueVideos = useMemo(() => {
    if (!showContinue) return [];
    const byId = new Map(videos.map((v) => [v.id, v]));
    return continueIds
      .map((id) => byId.get(id))
      .filter((v): v is Video => v !== undefined)
      .slice(0, 6);
  }, [showContinue, continueIds, videos]);

  const gridClass =
    view === 'table'
      ? 'flex flex-col gap-2'
      : 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Баннер деградации: часть архива не подгрузилась — но что есть, показываем */}
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

      {/* ─── Продолжить просмотр ─── */}
      {continueVideos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <History className="size-4 shrink-0 text-(--primary)" />
            <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              Продолжить просмотр
            </span>
            <div className="h-px flex-1 bg-lines-hover" />
          </div>

          {/* Горизонтальная карусель: не жрёт вертикаль на телефоне */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] xl:mx-0 xl:px-0">
            {continueVideos.map((video, i) => (
              <div key={video.id} className="w-64 shrink-0 snap-start sm:w-72">
                <VideoCard video={video} view="grid" index={i} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Фильтры ─── */}
      <VideoFilterBar query={query} available={available} resultCount={result.length} />

      {/* ─── Выдача ─── */}
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