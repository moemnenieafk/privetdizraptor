import Link from "next/link";
import { EyeOff, MapPin, Users, Swords, Map as MapIcon, ChevronRight } from "lucide-react";
import { type AchievementView, rarityMeta, sideLabel } from "@/lib/achievement-visuals";
import { achievementIconUrl } from "@/lib/achievement-icon";
import type { AchievementHint, HintKind, HintLink } from "@/lib/achievement-hints";

const KIND_ICON: Record<HintKind, typeof MapPin> = {
  boss: Swords,
  map: MapPin,
  trader: Users,
  quest: MapIcon,
};
const KIND_TAG: Record<HintKind, string> = {
  boss: "Босс",
  map: "Локация",
  trader: "Торговец",
  quest: "Задание",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-type-micro uppercase tracking-widest text-text-primary/50">{label}</span>
      <span className="font-blender-medium text-lg text-text-primary">{value}</span>
    </div>
  );
}

function BossLink({ link }: { link: HintLink }) {
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

function ChipLink({ link }: { link: HintLink }) {
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

export function AchievementDetail({ ach, hint }: { ach: AchievementView; hint: AchievementHint }) {
  const r = rarityMeta(ach.normalizedRarity);
  const bosses = hint.links.filter((l) => l.kind === "boss");
  const others = hint.links.filter((l) => l.kind !== "boss");
  const hasHint = hint.links.length > 0 || Boolean(hint.tip);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ── */}
      <div className={`relative overflow-hidden rounded-lg border bg-card-menu p-6 ${r.borderClass}`}>
        {r.tintClass && <div className={`pointer-events-none absolute inset-0 ${r.tintClass}`} />}

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row">
          <div className="mx-auto h-32 w-32 shrink-0 sm:mx-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={achievementIconUrl(ach.id)} alt={ach.name} className="h-full w-full object-contain" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-xs px-2 py-1 text-type-micro uppercase tracking-widest ${r.badgeClass}`}>
                {r.label}
              </span>
              <span className="rounded-xs border border-text-primary/25 px-2 py-1 text-type-micro uppercase tracking-widest text-text-primary/70">
                {sideLabel(ach.normalizedSide)}
              </span>
              {ach.hidden && (
                <span className="flex items-center gap-1.5 rounded-xs border border-lines-hover px-2 py-1 text-type-micro uppercase tracking-widest text-text-primary/50">
                  <EyeOff className="h-3 w-3" />
                  Скрытое
                </span>
              )}
            </div>

            <h1 className="mb-3 font-blender-medium text-2xl uppercase leading-tight tracking-wide text-text-primary">
              {ach.name}
            </h1>
            <p className="text-base text-text-secondary">{ach.description || "Описание отсутствует."}</p>

            <div className="mt-5 flex flex-wrap gap-8 border-t border-lines-hover pt-4">
              <Stat label="Выполнили игроков" value={`${ach.playersCompletedPercent.toFixed(2)}%`} />
              {ach.adjustedPlayersCompletedPercent > 0 && (
                <Stat label="С поправкой" value={`${ach.adjustedPlayersCompletedPercent.toFixed(2)}%`} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Как получить ── */}
      <section className="rounded-lg border border-lines-hover bg-card-menu p-6">
        <h2 className="mb-4 flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          <span className="h-px w-6 bg-lines-hover" />
          Как получить
        </h2>

        {hint.tip && <p className="mb-4 text-sm text-text-secondary">{hint.tip}</p>}

        {bosses.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {bosses.map((l) => (
              <BossLink key={l.href} link={l} />
            ))}
          </div>
        )}

        {others.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((l) => (
              <ChipLink key={l.href} link={l} />
            ))}
          </div>
        )}

        {!hasHint && (
          <p className="text-sm text-text-muted">
            Условие выполнения — в описании выше. Прямых привязок к боссам, локациям или торговцам не найдено.
          </p>
        )}
      </section>
    </div>
  );
}
