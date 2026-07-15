'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import { HEADER_DICTIONARY } from '@/data/headerConfig';
import { VIDEO_SORTS, VIDEO_TOPICS, isVideoSort } from '@/data/video-catalog';
import type { VideoFacets, VideoSort } from '@/types/video';
import type { VideoQuery } from '@/lib/video-utils';
import { useVideoStore } from '@/store/useVideoStore';

/**
 * Панель фильтров архива. Состояние живёт в URL (?q=&map=&topic=&sort=) —
 * фильтр шарится ссылкой и переживает back/forward. Это заменяет и локальный
 * стейт, и «сохранённые фильтры»: ссылка сама себе пресет.
 *
 * Mobile-first: чипсы в горизонтальном скролле (не переносятся в 4 ряда на 360px),
 * тач-таргеты 44px, сортировка — нативный <select> (родной пикер телефона
 * удобнее кастомной выпадашки и не требует портала).
 */

const MAP_LABELS = HEADER_DICTIONARY['eft'].breadcrumbNames ?? {};

function mapLabel(slug: string): string {
  const raw = MAP_LABELS[slug] ?? slug;
  // В словаре карты записаны капсом («ТАМОЖНЯ») — нормализуем, капс даст CSS.
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}

interface VideoFilterBarProps {
  query: VideoQuery;
  /** Только реально встречающиеся в выдаче фасеты — пустых чипсов не рисуем. */
  available: VideoFacets;
  /** Сколько видео нашлось с текущим фильтром (для счётчика и «Сбросить»). */
  resultCount: number;
}

export function VideoFilterBar({ query, available, resultCount }: VideoFilterBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const view = useVideoStore((s) => s.view);
  const setView = useVideoStore((s) => s.setView);

  /** Патчит URL, не трогая скролл (replace — не плодим историю на каждый чипс). */
  const patch = useCallback(
    (next: Record<string, string[] | string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        sp.delete(key);
        if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
        else if (value) sp.set(key, value);
      }
      const qs = sp.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [params, router],
  );

  const toggleIn = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const hasFilters =
    query.search.length > 0 || query.maps.length > 0 || query.topics.length > 0;

  const chipClass = (active: boolean) =>
    `flex h-9 shrink-0 items-center rounded px-3 font-blender-medium text-xs uppercase tracking-widest transition-[background-color,border-color,color] duration-200 ${
      active
        ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)'
        : 'border border-lines-hover bg-card-menu text-text-secondary hover:border-(--primary) hover:text-text-primary'
    }`;

  return (
    <div className="@container/videofilter flex w-full flex-col gap-3">
      {/* ─── Ряд 1: поиск + сортировка + вид ─── */}
      <div className="flex items-center gap-2">
        <div className="relative flex h-11 min-w-0 flex-1 items-center rounded border border-lines-hover bg-card-menu focus-within:border-(--primary)">
          <Search className="pointer-events-none absolute left-3 size-4 text-text-muted" />
          <input
            type="search"
            inputMode="search"
            value={query.search}
            onChange={(e) => patch({ q: e.target.value || null })}
            placeholder="Поиск по названию и главам…"
            aria-label="Поиск по архиву видео"
            className="size-full bg-transparent pl-9 pr-9 font-blender-book text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          {query.search && (
            <button
              type="button"
              onClick={() => patch({ q: null })}
              aria-label="Очистить поиск"
              className="absolute right-0 flex size-11 items-center justify-center text-text-muted hover:text-(--primary)"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Переключатель вида: плитка / плотный список (мобильный паттерн из глобального поиска) */}
        <div className="flex h-11 shrink-0 items-center rounded border border-lines-hover bg-card-menu p-1">
          {(['grid', 'table'] as const).map((mode) => {
            const Icon = mode === 'grid' ? LayoutGrid : List;
            const active = view === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-label={mode === 'grid' ? 'Плиткой' : 'Списком'}
                aria-pressed={active}
                className={`flex size-9 items-center justify-center rounded-xs transition-colors duration-200 ${
                  active
                    ? 'bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Ряд 2: темы (горизонтальный скролл на мобиле) ─── */}
      {available.topics.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] @5xl/videofilter:mx-0 @5xl/videofilter:flex-wrap @5xl/videofilter:px-0">
          {VIDEO_TOPICS.filter((t) => available.topics.includes(t.id)).map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => patch({ topic: toggleIn(query.topics, topic.id) })}
              aria-pressed={query.topics.includes(topic.id)}
              className={chipClass(query.topics.includes(topic.id))}
            >
              {topic.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── Ряд 3: карты ─── */}
      {available.maps.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] @5xl/videofilter:mx-0 @5xl/videofilter:flex-wrap @5xl/videofilter:px-0">
          {available.maps.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => patch({ map: toggleIn(query.maps, slug) })}
              aria-pressed={query.maps.includes(slug)}
              className={chipClass(query.maps.includes(slug))}
            >
              {mapLabel(slug)}
            </button>
          ))}
        </div>
      )}

      {/* ─── Ряд 4: счётчик + сортировка + сброс ─── */}
      <div className="flex items-center gap-3 border-t border-lines-hover pt-3">
        <span className="shrink-0 font-blender-medium text-xs uppercase tracking-widest text-text-muted">
          {resultCount} видео
        </span>

        {hasFilters && (
          <button
            type="button"
            onClick={() => patch({ q: null, map: null, topic: null })}
            className="flex h-8 shrink-0 items-center gap-1 font-blender-medium text-xs uppercase tracking-widest text-(--primary) hover:underline"
          >
            <X className="size-3 stroke-3" />
            Сбросить
          </button>
        )}

        <div className="flex-1" />

        <select
          value={query.sort}
          onChange={(e) => {
            const next = e.target.value;
            patch({ sort: isVideoSort(next) && next !== 'new' ? next : null });
          }}
          aria-label="Сортировка"
          className="h-9 shrink-0 rounded border border-lines-hover bg-card-menu px-2 font-blender-medium text-xs uppercase tracking-widest text-text-secondary outline-none focus:border-(--primary)"
        >
          {VIDEO_SORTS.map((s: { id: VideoSort; label: string }) => (
            <option key={s.id} value={s.id} className="bg-(--color-base)">
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}