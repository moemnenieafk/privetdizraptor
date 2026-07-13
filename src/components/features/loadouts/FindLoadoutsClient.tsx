'use client';

// Каталог сборок: вкладки + поиск + фильтры. Клиентский, потому что данные уже
// целиком на руках (30 + 463 записи), и фильтрация не стоит ни одного запроса.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import type { GunsmithListItem } from '@/db/gunsmith-list';
import type { PresetListItem } from '@/db/preset-list';

type Tab = 'gunsmith' | 'presets' | 'meta' | 'community';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'gunsmith', label: 'Оружейник', icon: 'icon-eft-guns-parts-functional' },
  { key: 'presets', label: 'Пресеты', icon: 'icon-eft-guns-mods' },
  { key: 'meta', label: 'Мета', icon: 'icon-eft-guns-parts-sights' },
  { key: 'community', label: 'Сообщество', icon: 'icon-eft-guns-parts-mounts' },
];

interface Props {
  gunsmith: GunsmithListItem[];
  presets: PresetListItem[];
}

export function FindLoadoutsClient({ gunsmith, presets }: Props) {
  const [tab, setTab] = useState<Tab>('gunsmith');
  const [query, setQuery] = useState('');

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Вкладки — скроллятся на мобиле, 44px тач */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-xs border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
              tab === t.key
                ? 'border-(--primary) text-(--primary)'
                : 'border-lines-hover text-text-secondary hover:border-(--primary)'
            }`}
          >
            <i className={`${t.icon} text-base`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Поиск */}
      {(tab === 'gunsmith' || tab === 'presets') && (
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'gunsmith' ? 'Квест или ствол…' : 'Ствол или пресет…'}
            className="h-11 w-full rounded-sm border border-lines-hover bg-(--color-darkbase) pl-10 pr-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
          />
        </div>
      )}

      {tab === 'gunsmith' && <GunsmithTab items={gunsmith} query={query} />}
      {tab === 'presets' && <PresetsTab items={presets} query={query} />}
      {tab === 'meta' && <Soon text="Мета-сборки считаются солвером по текущим ценам и статам — не копируются с чужих тир-листов. Раздел собирается." />}
      {tab === 'community' && <Soon text="Сборки игроков появятся здесь, как только заработает публикация. Свои сборки уже можно сохранять в конструкторе." />}
    </div>
  );
}

/* ───────────────── Оружейник ───────────────── */

function GunsmithTab({ items, query }: { items: GunsmithListItem[]; query: string }) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.taskName.toLowerCase().includes(q) || i.baseName.toLowerCase().includes(q),
    );
  }, [items, query]);

  if (filtered.length === 0) return <Empty />;

  return (
    <>
      <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
        {filtered.length} квестов
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filtered.map((i) => (
          <Link
            key={i.objectiveId}
            href={`/eft/progress/loadouts/find/gunsmith/${i.objectiveId}`}
            className="group flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3 transition-colors hover:border-(--primary)"
          >
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xs bg-(--color-darkbase)">
                <img
                  src={itemIconUrl(i.imageItemId)}
                  alt={i.baseName}
                  loading="lazy"
                  className="h-full w-full object-contain p-1"
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary group-hover:text-(--primary)">
                  {i.taskName}
                </span>
                <span className="truncate font-blender-book text-sm text-text-secondary">
                  {i.baseName}
                </span>
                <div className="flex gap-3 font-blender-medium text-xs text-text-secondary">
                  {i.traderName && <span>{i.traderName}</span>}
                  {i.minPlayerLevel != null && <span>ур. {i.minPlayerLevel}+</span>}
                </div>
              </div>
            </div>

            {i.chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {i.chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-xs border border-lines-hover px-2 py-0.5 font-blender-medium text-xs text-text-secondary"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}

/* ───────────────── Пресеты ───────────────── */

function PresetsTab({ items, query }: { items: PresetListItem[]; query: string }) {
  const [onlyDefault, setOnlyDefault] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (onlyDefault && !i.isDefault) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || i.baseName.toLowerCase().includes(q);
    });
  }, [items, query, onlyDefault]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          {filtered.length} пресетов
        </p>
        <button
          type="button"
          onClick={() => setOnlyDefault((v) => !v)}
          className={`h-9 rounded-xs border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
            onlyDefault
              ? 'border-(--primary) text-(--primary)'
              : 'border-lines-hover text-text-secondary hover:border-(--primary)'
          }`}
        >
          Только стоковые
        </button>
      </div>

      {filtered.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((i) => (
            <Link
              key={i.id}
              href={`/eft/progress/loadouts/add?base=${i.baseItemId}&preset=${i.id}`}
              className="group flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3 transition-colors hover:border-(--primary)"
            >
              {/* Честный рендер собранного ствола — у пресета своя картинка */}
              <div className="relative h-28 w-full overflow-hidden rounded-xs bg-(--color-darkbase)">
                <img
                  src={itemIconUrl(i.id)}
                  alt={i.name}
                  loading="lazy"
                  className="h-full w-full object-contain p-2"
                />
                {i.isDefault && (
                  <span className="absolute left-2 top-2 rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
                    Сток
                  </span>
                )}
              </div>

              <span className="truncate font-blender-book text-sm text-text-primary group-hover:text-(--primary)">
                {i.name}
              </span>

              <div className="flex flex-wrap gap-3 font-blender-medium text-xs text-text-secondary">
                {i.ergonomics != null && <span>ЭРГО {i.ergonomics}</span>}
                {i.recoilSum != null && <span>ОТДАЧА {i.recoilSum}</span>}
                <span>{i.partCount} мод.</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ───────────────── заглушки ───────────────── */

function Soon({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-10 text-center">
      <i className="icon-eft-guns-mods text-4xl text-(--primary)" aria-hidden="true" />
      <p className="max-w-md font-blender-book text-sm text-text-secondary">{text}</p>
    </div>
  );
}

function Empty() {
  return (
    <p className="py-10 text-center font-blender-book text-sm text-text-secondary">
      Ничего не нашлось. Попробуйте другой запрос.
    </p>
  );
}