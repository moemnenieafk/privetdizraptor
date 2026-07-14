import type { EftEvent, EftEventCategory, EftEventOrder } from '@/types/eft-events';

/** Форматтер дат ивентов: «24 декабря 2025». */
const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const SHORT_FORMATTER = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

export function formatEventDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

export function formatEventDateShort(iso: string): string {
  return SHORT_FORMATTER.format(new Date(`${iso}T00:00:00Z`)).replace('.', '');
}

/** Диапазон дат: «24 дек — 8 янв 2026», если известна дата завершения. */
export function formatEventRange(event: EftEvent): string {
  if (!event.endDate) return formatEventDate(event.date);
  return `${formatEventDateShort(event.date)} — ${formatEventDate(event.endDate)}`;
}

export function getEventYear(event: EftEvent): number {
  return Number(event.date.slice(0, 4));
}

export interface EventsQuery {
  search: string;
  categories: EftEventCategory[];
  year: number | null;
  order: EftEventOrder;
}

export const EMPTY_EVENTS_QUERY: EventsQuery = {
  search: '',
  categories: [],
  year: null,
  order: 'desc',
};

function matchesSearch(event: EftEvent, needle: string): boolean {
  const haystack = [event.title, event.titleEn ?? '', event.summary, ...event.changes]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterEvents(events: EftEvent[], query: EventsQuery): EftEvent[] {
  const needle = query.search.trim().toLowerCase();

  const filtered = events.filter((event) => {
    if (query.year !== null && getEventYear(event) !== query.year) return false;
    if (query.categories.length > 0 && !query.categories.includes(event.category)) return false;
    if (needle.length > 0 && !matchesSearch(event, needle)) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    const diff = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    return query.order === 'desc' ? -diff : diff;
  });
}

export interface EventYearGroup {
  year: number;
  events: EftEvent[];
}

/** Группировка отфильтрованного (уже отсортированного) списка по годам. */
export function groupEventsByYear(events: EftEvent[]): EventYearGroup[] {
  const groups: EventYearGroup[] = [];
  for (const event of events) {
    const year = getEventYear(event);
    const last = groups.at(-1);
    if (last && last.year === year) last.events.push(event);
    else groups.push({ year, events: [event] });
  }
  return groups;
}
