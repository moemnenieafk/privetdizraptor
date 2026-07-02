// Чипы-кросслинки SMART-подсказки достижения (босс/карта/торговец/квест).
// Общие для детальной страницы достижения (RSC) и вкладки «Трекинг» (client) —
// без "use client": чистые презентационные компоненты, работают в обоих мирах.
import Link from "next/link";
import { MapPin, Users, Swords, Map as MapIcon, ChevronRight } from "lucide-react";
import type { HintKind, HintLink } from "@/lib/achievement-hints";

export const KIND_ICON: Record<HintKind, typeof MapPin> = {
  boss: Swords,
  map: MapPin,
  trader: Users,
  quest: MapIcon,
};

export const KIND_TAG: Record<HintKind, string> = {
  boss: "Босс",
  map: "Локация",
  trader: "Торговец",
  quest: "Задание",
};

/** Карточка босса: портрет + имя + локация. */
export function BossLink({ link }: { link: HintLink }) {
  return (
    <Link
      href={link.href}
      className="group flex items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-3 transition-colors hover:border-(--primary)"
    >
      {link.portrait && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.portrait}
          alt=""
          className="h-12 w-12 shrink-0 rounded-sm border border-lines-hover object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Swords className="h-3.5 w-3.5 shrink-0 text-danger" />
          <span className="truncate font-blender-medium text-sm uppercase text-text-primary group-hover:text-(--primary)">
            {link.label}
          </span>
        </div>
        {link.sub && <p className="mt-0.5 truncate text-type-caption text-text-muted">{link.sub}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-(--primary)" />
    </Link>
  );
}

/** Компактный чип: локация / торговец / задание. */
export function ChipLink({ link }: { link: HintLink }) {
  const Icon = KIND_ICON[link.kind];
  return (
    <Link
      href={link.href}
      className="group flex items-center gap-2 rounded-lg border border-lines-hover bg-(--color-base) px-3 py-2.5 transition-colors hover:border-(--primary)"
    >
      <Icon className="h-4 w-4 shrink-0 text-text-muted group-hover:text-(--primary)" />
      <div className="min-w-0 flex-1">
        <span className="block text-type-micro uppercase tracking-widest text-text-muted">{KIND_TAG[link.kind]}</span>
        <span className="block truncate font-blender-medium text-sm text-text-primary group-hover:text-(--primary)">
          {link.label}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-(--primary)" />
    </Link>
  );
}

/** Мини-чип для вотчлиста: иконка + название одной строкой (компактнее ChipLink). */
export function MiniChip({ link }: { link: HintLink }) {
  const Icon = KIND_ICON[link.kind];
  return (
    <Link
      href={link.href}
      title={`${KIND_TAG[link.kind]}: ${link.label}`}
      className="group flex items-center gap-1.5 rounded-xs border border-lines-hover bg-(--color-base) px-2 py-1 transition-colors hover:border-(--primary)"
    >
      <Icon className={`h-3 w-3 shrink-0 ${link.kind === "boss" ? "text-danger" : "text-text-muted"} group-hover:text-(--primary)`} />
      <span className="max-w-40 truncate text-type-micro uppercase tracking-wider text-text-secondary group-hover:text-(--primary)">
        {link.label}
      </span>
    </Link>
  );
}
