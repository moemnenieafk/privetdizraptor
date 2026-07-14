'use client';

import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Search, X } from 'lucide-react';
import type { EftEvent, EftEventCategory, EftEventQuestLink } from '@/types/eft-events';
import { EFT_EVENT_CATEGORIES, getEventYears } from '@/data/eft-events';
import {
  EMPTY_EVENTS_QUERY,
  filterEvents,
  groupEventsByYear,
  type EventsQuery,
} from '@/lib/eft-events-utils';
import { EventCard } from './EventCard';

interface EventsTimelineProps {
  events: EftEvent[];
  /** eventId → задания ивента из базы квестов (резолвятся на сервере). */
  questLinks?: Record<string, EftEventQuestLink[]>;
}

/**
 * Хронология внутриигровых событий. Состояние фильтров локальное:
 * данные статичные, страница серверная — URL-состояние здесь избыточно.
 * Вся математика фильтрации — в @/lib/eft-events-utils (UI остаётся чистым).
 */
export function EventsTimeline({ events, questLinks = {} }: EventsTimelineProps) {
  const [query, setQuery] = useState<EventsQuery>(EMPTY_EVENTS_QUERY);

  const years = useMemo(() => getEventYears(events), [events]);
  const groups = useMemo(() => groupEventsByYear(filterEvents(events, query)), [events, query]);
  const total = useMemo(() => groups.reduce((sum, g) => sum + g.events.length, 0), [groups]);

  const patch = (next: Partial<EventsQuery>) => setQuery((prev) => ({ ...prev, ...next }));

  const toggleCategory = (id: EftEventCategory) =>
    patch({
      categories: query.categories.includes(id)
        ? query.categories.filter((c) => c !== id)
        : [...query.categories, id],
    });

  const hasFilters =
    query.search.length > 0 || query.categories.length > 0 || query.year !== null;

  const chipClass = (active: boolean) =>
    `flex h-9 shrink-0 items-center rounded px-3 font-blender-medium text-xs uppercase tracking-widest transition-[background-color,border-color,color] duration-200 ${
      active
        ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)'
        : 'border border-lines-hover bg-card-menu text-text-secondary hover:border-(--primary) hover:text-text-primary'
    }`;

  const OrderIcon = query.order === 'desc' ? ArrowDownWideNarrow : ArrowUpWideNarrow;

  return (
    <div className="flex w-full flex-col gap-6">
      {/* ─── Фильтры ─── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex h-11 min-w-0 flex-1 items-center rounded border border-lines-hover bg-card-menu focus-within:border-(--primary)">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-text-muted" />
            <input
              type="search"
              inputMode="search"
              value={query.search}
              onChange={(e) => patch({ search: e.target.value })}
              placeholder="Поиск по событиям, квестам и механикам…"
              aria-label="Поиск по событиям"
              className="size-full bg-transparent pl-9 pr-9 font-blender-book text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            {query.search && (
              <button
                type="button"
                onClick={() => patch({ search: '' })}
                aria-label="Очистить поиск"
                className="absolute right-0 flex size-11 items-center justify-center text-text-muted hover:text-(--primary)"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => patch({ order: query.order === 'desc' ? 'asc' : 'desc' })}
            aria-label={query.order === 'desc' ? 'Сначала новые' : 'Сначала старые'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-lines-hover bg-card-menu text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <OrderIcon className="size-4" />
          </button>
        </div>

        {/* Категории */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] xl:mx-0 xl:flex-wrap xl:px-0">
          {EFT_EVENT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              aria-pressed={query.categories.includes(cat.id)}
              title={cat.hint}
              className={chipClass(query.categories.includes(cat.id))}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Годы */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] xl:mx-0 xl:flex-wrap xl:px-0">
          <button
            type="button"
            onClick={() => patch({ year: null })}
            aria-pressed={query.year === null}
            className={chipClass(query.year === null)}
          >
            Все годы
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => patch({ year: query.year === year ? null : year })}
              aria-pressed={query.year === year}
              className={chipClass(query.year === year)}
            >
              {year}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-lines-hover pt-3">
          <span className="shrink-0 font-blender-medium text-xs uppercase tracking-widest text-text-muted">
            {total} событий
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setQuery(EMPTY_EVENTS_QUERY)}
              className="flex h-8 shrink-0 items-center gap-1 font-blender-medium text-xs uppercase tracking-widest text-(--primary) hover:underline"
            >
              <X className="size-3 stroke-3" />
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* ─── Таймлайн ─── */}
      {total === 0 ? (
        <div className="rounded border border-lines-hover bg-card-menu p-8 text-center">
          <p className="font-blender-medium uppercase tracking-widest text-text-primary">
            Ничего не найдено
          </p>
          <p className="mt-2 font-blender-book text-sm text-text-secondary">
            Попробуйте изменить запрос или сбросить фильтры.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((group) => (
            <section key={group.year}>
              <div className="mb-5 flex items-center gap-3">
                <h2 className="shrink-0 font-blender-medium text-[28px] uppercase leading-none tracking-tighter text-text-primary">
                  {group.year}
                </h2>
                <span className="shrink-0 font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                  {group.events.length}
                </span>
                <div className="h-px flex-1 bg-lines-hover" />
              </div>

              <ol className="ml-3 flex flex-col gap-4 border-l border-lines-hover pl-6">
                {group.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    questLinks={questLinks[event.id]}
                    defaultOpen={event.active}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
