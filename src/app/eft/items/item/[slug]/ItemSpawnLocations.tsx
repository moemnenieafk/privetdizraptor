import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { SectionRule } from '@/components/ui/SectionRule';
import { LOOT_CONTAINER_KINDS } from '@/data/loot-containers';
import type { ItemLocations, MapCount, ContainerLocation } from '@/db/item-locations';

// Секция «Где найти предмет» (серверная, только Links). Спина — live-`markers`; контейнерное
// членство — container-loot.json. Кнопка «на карту» = предмет-первым (?item) + категория одним
// тапом (&loot). Чип контейнера → слой этого типа (&container). Решение: where-to-find-item.md (C/D/G).

interface Props {
  locations: ItemLocations;
  itemId: string;
  itemName: string;
}

const mapHref = (mapId: string, params: Record<string, string>): string =>
  `/eft/maps/${mapId}?${new URLSearchParams(params).toString()}`;

export function ItemSpawnLocations({ locations, itemId }: Props) {
  const { looseMaps, containers, category } = locations;
  if (!locations.hasData) return null;

  const maxLoose = Math.max(1, ...looseMaps.map((m) => m.count));
  const bestLoose = looseMaps[0];
  // airdrop/special уже отфильтрован в ридере; группируем по виду (Контейнеры/Схроны/Трупы).
  const byKind = LOOT_CONTAINER_KINDS.map((k) => ({
    kind: k,
    items: containers.filter((c) => c.kind === k.id),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="flex flex-col gap-4">
      <SectionRule title="Где найти предмет" icon={<MapPin className="h-4 w-4" />} />

      {/* ── Карты с loose-точками предмета, «где выгоднее» сверху ── */}
      {looseMaps.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            На локациях · размеченных точек
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {looseMaps.map((m) => (
              <MapRow key={m.mapId} m={m} max={maxLoose} itemId={itemId} />
            ))}
          </div>
        </div>
      )}

      {/* ── Контейнеры по виду ── */}
      {byKind.map((g) => (
        <div key={g.kind.id} className="flex flex-col gap-2.5">
          <p className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            {g.kind.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {g.items.map((c) => (
              <ContainerChip key={c.slug} c={c} itemId={itemId} />
            ))}
          </div>
        </div>
      ))}

      {/* ── Кнопка на карту (предмет-первым) + категория одним тапом (C) ── */}
      {bestLoose && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Link
            href={mapHref(bestLoose.mapId, { item: itemId })}
            className="inline-flex h-9 items-center gap-2 rounded border border-(--primary) bg-primary/10 px-3 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-primary/20"
          >
            <MapPin className="h-3.5 w-3.5" />
            Показать на карте
          </Link>
          {category && (
            <Link
              href={mapHref(bestLoose.mapId, { item: itemId, loot: category.key })}
              className="inline-flex h-9 items-center gap-1.5 rounded border border-lines-hover bg-card-menu px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              <span className={`${category.icon} h-4 w-4 shrink-0 bg-text-secondary mask-contain mask-center mask-no-repeat`} />+ {category.label}
            </Link>
          )}
        </div>
      )}

      <p className="text-type-micro font-blender-book text-text-muted">
        Данные ≈ на текущий патч. Точки — из размеченных источников, список пополняется.
      </p>
    </section>
  );
}

function MapRow({ m, max, itemId }: { m: MapCount; max: number; itemId: string }) {
  const pct = Math.round((m.count / max) * 100);
  return (
    <Link
      href={mapHref(m.mapId, { item: itemId })}
      className="group flex items-center gap-3 rounded border border-lines-hover bg-card-menu px-3 py-2 transition-colors hover:border-(--primary)"
    >
      <span className="min-w-0 flex-1 truncate font-blender-medium text-sm text-text-primary group-hover:text-(--primary)">
        {m.mapName}
      </span>
      <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-lines-hover">
        <span className="block h-full rounded-full bg-(--primary)" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-8 shrink-0 text-right font-blender-medium text-xs tabular-nums text-text-secondary">
        {m.count}
      </span>
    </Link>
  );
}

function ContainerChip({ c, itemId }: { c: ContainerLocation; itemId: string }) {
  const best = c.maps[0];
  const inner = (
    <>
      <span className="font-blender-medium text-sm text-text-primary">{c.nameRu}</span>
      {c.total > 0 && (
        <span className="font-blender-medium text-xs tabular-nums text-text-secondary">{c.total}</span>
      )}
    </>
  );
  // Есть позиции → чип ведёт на лучшую карту со слоем этого контейнера (?container=file).
  return best ? (
    <Link
      href={mapHref(best.mapId, { item: itemId, container: c.file })}
      className="inline-flex items-center gap-2 rounded border border-lines-hover bg-card-menu px-2.5 py-1.5 transition-colors hover:border-(--primary)"
    >
      {inner}
    </Link>
  ) : (
    // Членство без позиций → инфо-чип без перехода.
    <span className="inline-flex items-center gap-2 rounded border border-lines-hover bg-card-menu/50 px-2.5 py-1.5 opacity-80">
      {inner}
    </span>
  );
}
