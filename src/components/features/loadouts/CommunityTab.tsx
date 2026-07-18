'use client';

// Витрина community-сборок: живая лента из weapon_builds.is_public. В отличие от
// вкладок «Оружейник»/«Пресеты» (статичный дамп с суточным revalidate), лента тянется
// клиентом — она растёт и персонализируется (likedByMe), а лайки должны быть свежими.
// Загрузка — скелетоны (animate-pulse), не спиннеры.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { TwitchIcon } from '@/components/ui/BrandIcons';
import { itemIconUrl } from '@/lib/item-icon';

type Sort = 'new' | 'popular';

interface CommunityStats {
  ergonomics: number;
  recoilSum: number;
  priceRub: number | null;
}

interface CommunityBuildDTO {
  slug: string;
  name: string;
  purpose: string;
  baseItemId: string;
  baseName: string;
  stats: CommunityStats;
  likes: number;
  createdAt: string;
  authorName: string;
  authorStreamer: boolean;
  likedByMe: boolean;
}

interface FeedResponse {
  items: CommunityBuildDTO[];
  nextOffset: number | null;
}

const SORTS: { key: Sort; label: string }[] = [
  { key: 'new', label: 'Свежие' },
  { key: 'popular', label: 'Популярные' },
];

export function CommunityTab({ query }: { query: string }) {
  const [sort, setSort] = useState<Sort>('new');
  const [items, setItems] = useState<CommunityBuildDTO[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'more' | 'ready' | 'error'>('loading');
  const [needLogin, setNeedLogin] = useState(false);

  const load = useCallback(
    async (nextSort: Sort, offset: number, signal?: AbortSignal) => {
      const first = offset === 0;
      setStatus(first ? 'loading' : 'more');
      try {
        const res = await fetch(
          `/api/eft/builds/community?sort=${nextSort}&offset=${offset}`,
          { signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as FeedResponse;
        setItems((prev) => (first ? data.items : [...prev, ...data.items]));
        setNextOffset(data.nextOffset);
        setStatus('ready');
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setStatus('error');
      }
    },
    [],
  );

  useEffect(() => {
    // Сброс списка не нужен: пока status==='loading' рендерится скелетон (не грид),
    // а первый ответ заменяет items целиком (offset=0 → first).
    const ctrl = new AbortController();
    void load(sort, 0, ctrl.signal);
    return () => ctrl.abort();
  }, [sort, load]);

  const toggleLike = useCallback(async (slug: string) => {
    // Оптимистично: сразу перекрашиваем, откатываем при ошибке.
    setItems((prev) =>
      prev.map((b) =>
        b.slug === slug
          ? { ...b, likedByMe: !b.likedByMe, likes: b.likes + (b.likedByMe ? -1 : 1) }
          : b,
      ),
    );
    try {
      const res = await fetch('/api/eft/builds/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (res.status === 401) {
        setNeedLogin(true);
        throw new Error('401');
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { liked: boolean; likes: number };
      setItems((prev) =>
        prev.map((b) => (b.slug === slug ? { ...b, likedByMe: data.liked, likes: data.likes } : b)),
      );
    } catch {
      // откат
      setItems((prev) =>
        prev.map((b) =>
          b.slug === slug
            ? { ...b, likedByMe: !b.likedByMe, likes: b.likes + (b.likedByMe ? -1 : 1) }
            : b,
        ),
      );
    }
  }, []);

  const q = query.trim().toLowerCase();
  const visible = q
    ? items.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.baseName.toLowerCase().includes(q) ||
          b.purpose.toLowerCase().includes(q) ||
          b.authorName.toLowerCase().includes(q),
      )
    : items;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Сорт + логин-подсказка */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`h-9 rounded-xs border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
                sort === s.key
                  ? 'border-(--primary) text-(--primary)'
                  : 'border-lines-hover text-text-secondary hover:border-(--primary)'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {needLogin && (
          <Link
            href="/login"
            className="font-blender-medium text-xs uppercase tracking-widest text-(--primary) hover:underline"
          >
            Войти, чтобы лайкать
          </Link>
        )}
      </div>

      {status === 'loading' && <SkeletonGrid />}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-10 text-center">
          <p className="font-blender-book text-sm text-text-secondary">
            Не удалось загрузить ленту.
          </p>
          <button
            type="button"
            onClick={() => void load(sort, 0)}
            className="h-9 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary)"
          >
            Повторить
          </button>
        </div>
      )}

      {status !== 'loading' && status !== 'error' && visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-10 text-center">
          <i className="icon-eft-guns-parts-mounts text-4xl text-(--primary)" aria-hidden="true" />
          <p className="max-w-md font-blender-book text-sm text-text-secondary">
            {q
              ? 'По запросу ничего не нашлось.'
              : 'Пока никто не опубликовал сборку. Собери свою в конструкторе и нажми «Опубликовать» — она появится здесь.'}
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((b) => (
            <BuildCard key={b.slug} build={b} onLike={() => void toggleLike(b.slug)} />
          ))}
        </div>
      )}

      {status !== 'loading' && nextOffset != null && !q && (
        <button
          type="button"
          onClick={() => void load(sort, nextOffset)}
          disabled={status === 'more'}
          className="mx-auto h-11 rounded-xs border border-lines-hover px-6 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-50"
        >
          {status === 'more' ? 'Загрузка…' : 'Показать ещё'}
        </button>
      )}
    </div>
  );
}

/* ───────────────── карточка ───────────────── */

function BuildCard({ build, onLike }: { build: CommunityBuildDTO; onLike: () => void }) {
  return (
    <div className="group flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3 transition-colors hover:border-(--primary)">
      <Link href={`/eft/progress/loadouts/b/${build.slug}`} className="flex flex-col gap-2">
        <div className="relative h-28 w-full overflow-hidden rounded-xs bg-(--color-darkbase)">
          <img
            src={itemIconUrl(build.baseItemId)}
            alt={build.baseName}
            loading="lazy"
            className="h-full w-full object-contain p-2"
          />
          {build.purpose && (
            <span className="absolute left-2 top-2 rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
              {build.purpose}
            </span>
          )}
        </div>

        <span className="truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary group-hover:text-(--primary)">
          {build.name}
        </span>
        <span className="truncate font-blender-book text-sm text-text-secondary">
          {build.baseName}
        </span>

        <div className="flex flex-wrap gap-3 font-blender-medium text-xs text-text-secondary">
          <span>ЭРГО {build.stats.ergonomics}</span>
          <span>ОТДАЧА {build.stats.recoilSum}</span>
          {build.stats.priceRub != null && (
            <span>{build.stats.priceRub.toLocaleString('ru-RU')} ₽</span>
          )}
        </div>
      </Link>

      <div className="mt-1 flex items-center justify-between border-t border-lines-hover pt-2">
        <span className="flex min-w-0 items-center gap-1 truncate font-blender-book text-xs text-text-secondary">
          {build.authorStreamer && (
            <TwitchIcon className="h-3.5 w-3.5 shrink-0 text-(--color-twitch)" size={14} />
          )}
          <span className="truncate">{build.authorName}</span>
        </span>

        <button
          type="button"
          onClick={onLike}
          aria-pressed={build.likedByMe}
          aria-label={build.likedByMe ? 'Убрать лайк' : 'Лайкнуть'}
          className={`flex h-8 shrink-0 items-center gap-1.5 rounded-xs border px-2.5 font-blender-medium text-xs transition-colors ${
            build.likedByMe
              ? 'border-(--primary) text-(--primary)'
              : 'border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)'
          }`}
        >
          <Heart
            className="h-3.5 w-3.5"
            fill={build.likedByMe ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
          {build.likes}
        </button>
      </div>
    </div>
  );
}

/* ───────────────── скелетон ───────────────── */

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3"
        >
          <div className="h-28 w-full animate-pulse rounded-xs bg-(--color-darkbase)" />
          <div className="h-4 w-3/4 animate-pulse rounded-xs bg-(--color-darkbase)" />
          <div className="h-3 w-1/2 animate-pulse rounded-xs bg-(--color-darkbase)" />
          <div className="mt-1 flex items-center justify-between border-t border-lines-hover pt-2">
            <div className="h-3 w-20 animate-pulse rounded-xs bg-(--color-darkbase)" />
            <div className="h-8 w-14 animate-pulse rounded-xs bg-(--color-darkbase)" />
          </div>
        </div>
      ))}
    </div>
  );
}
