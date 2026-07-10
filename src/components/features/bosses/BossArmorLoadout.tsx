import Link from 'next/link';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { items } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';

interface ArmorRow {
  inGameId: string;
  slug: string | null;
  name: string;
  shortName: string | null;
  backgroundColor: string | null;
}

/**
 * Броня босса иконками из БД (таблица items) с линком на страницу предмета.
 * Async server component: тянет предметы по normalizedName, порядок сохраняет как в slugs.
 */
export async function BossArmorLoadout({ slugs, caption }: { slugs: string[]; caption?: string }) {
  if (slugs.length === 0) return null;

  const gameId = await eftGameId();
  const rows: ArmorRow[] = await db
    .select({
      inGameId: items.inGameId,
      slug: items.normalizedName,
      name: items.name,
      shortName: items.shortName,
      backgroundColor: items.backgroundColor,
    })
    .from(items)
    .where(and(eq(items.gameId, gameId), inArray(items.normalizedName, slugs)));

  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const ordered = slugs
    .map((s) => bySlug.get(s))
    .filter((r): r is ArmorRow => Boolean(r && r.slug));

  if (ordered.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {caption && (
        <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">{caption}</span>
      )}
      <ul className="flex flex-wrap gap-2">
        {ordered.map((it) => (
          <li key={it.inGameId}>
            <Link
              href={`/eft/items/item/${it.slug}`}
              className="group flex items-center gap-2.5 rounded-xs border border-lines-hover bg-card-menu p-2 pr-3 transition-colors hover:border-(--primary)"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-lines-hover"
                style={{ backgroundColor: getTarkovBackgroundColor(it.backgroundColor ?? undefined) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={itemIconUrl(it.inGameId)}
                  alt={it.shortName ?? it.name}
                  loading="lazy"
                  className="h-full w-full object-contain p-0.5"
                />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-blender-medium uppercase tracking-widest text-text-primary transition-colors group-hover:text-(--primary)">
                  {it.shortName ?? it.name}
                </span>
                <span className="truncate text-xs text-text-secondary font-blender-book">{it.name}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
