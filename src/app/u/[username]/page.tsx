import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Gamepad2, Headphones, MicOff, ShieldCheck, Users, Wrench } from "lucide-react";
import { getPublicProfile, type PublicGameSection } from "@/db/public-profile";
import { ROLE_LABELS, isRole } from "@/lib/auth/roles";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { DiscordIcon, SteamIcon, TwitchIcon, YouTubeIcon } from "@/components/ui/BrandIcons";
import { socialUrl } from "@/lib/social-url";
import { GOAL_LABELS, MAP_NAMES, STYLE_LABELS, TIME_LABELS } from "@/data/comlink-labels";
import type { SocialPlatform } from "@/lib/auth/me";

interface Props {
  params: Promise<{ username: string }>;
}

export const revalidate = 120;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await getPublicProfile(username);
  if (!p) {
    return { title: "Профиль не найден", robots: { index: false, follow: false } };
  }
  const verified = p.verifiedAnywhere ? "✓ " : "";
  return {
    title: `${verified}${p.username} · Профиль`,
    description: `Публичный профиль ${p.username} на ЦТА: подтверждённые ЧВК-профили, анкеты «Связи» и статистика.`,
    robots: { index: true, follow: true },
  };
}

const TIER_CLASS: Record<string, string> = {
  legend: "border-(--primary) text-(--primary)",
  veteran: "border-success/60 text-success",
  fighter: "border-lines-hover text-text-primary",
  wild: "border-lines-hover text-text-secondary",
};

const SOCIAL_ICON: Record<SocialPlatform, typeof TwitchIcon> = {
  twitch: TwitchIcon,
  youtube: YouTubeIcon,
  discord: DiscordIcon,
  steam: SteamIcon,
};

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return `${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
};

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const p = await getPublicProfile(username);
  if (!p) notFound();

  const roleLabel = isRole(p.role) && p.role !== "user" ? ROLE_LABELS[p.role] : null;
  const socialEntries = (Object.entries(p.socials) as [SocialPlatform, string | null][]).filter(
    ([, handle]) => handle,
  );

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="flex w-full max-w-3xl flex-col gap-6 px-4 xl:px-0">
        {/* ─── Шапка (игро-независимая) ─── */}
        <header className="flex flex-col gap-4 rounded-sm border border-lines-hover bg-(--color-base) p-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-lines-hover bg-(--color-darkbase)">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Users className="h-9 w-9 text-text-secondary" aria-hidden="true" />
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
                {p.username}
              </h1>
              {p.verifiedAnywhere && <VerifiedBadge variant="chip" />}
              {roleLabel && (
                <span className="rounded-xs border border-(--primary)/40 px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
                  {roleLabel}
                </span>
              )}
            </div>

            {p.memberSince && (
              <span className="flex items-center gap-1.5 font-blender-book text-xs text-text-secondary">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                На ЦТА с {fmtDate(p.memberSince)}
              </span>
            )}

            {socialEntries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {socialEntries.map(([platform, handle]) => {
                  const Icon = SOCIAL_ICON[platform];
                  const url = socialUrl(platform, handle as string);
                  const inner = (
                    <>
                      <Icon className="h-4 w-4 text-text-secondary" size={16} />
                      <span className="font-blender-book text-xs text-text-primary">{handle}</span>
                    </>
                  );
                  return url ? (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xs border border-lines-hover px-2 py-1 transition-colors hover:border-(--primary)"
                    >
                      {inner}
                    </a>
                  ) : (
                    <span
                      key={platform}
                      className="flex items-center gap-1.5 rounded-xs border border-lines-hover px-2 py-1"
                    >
                      {inner}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* ─── Секции по играм ─── */}
        {p.sections.length === 0 ? (
          <div className="flex w-full flex-col items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) px-6 py-14 text-center">
            <Gamepad2 className="h-8 w-8 text-text-secondary" aria-hidden="true" />
            <p className="font-blender-book text-sm text-text-secondary">
              У бойца пока нет публичных данных по играм.
            </p>
          </div>
        ) : (
          p.sections.map((s) => <GameSection key={s.gameCode} s={s} />)
        )}
      </div>
    </main>
  );
}

/* ─────────────────── секция одной игры ─────────────────── */

function GameSection({ s }: { s: PublicGameSection }) {
  return (
    <section className="flex flex-col gap-4 rounded-sm border border-lines-hover bg-(--color-base) p-5">
      {/* Заголовок игры */}
      <div className="flex flex-wrap items-center gap-2 border-b border-lines-hover pb-3">
        <Gamepad2 className="h-5 w-5 text-(--primary)" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          {s.gameName}
        </h2>
        {s.verified && (
          <VerifiedBadge
            variant="chip"
            label={s.verifiedNickname ? `Подтверждён · ${s.verifiedNickname}` : "Подтверждён"}
            title={`ЧВК-профиль «${s.verifiedNickname ?? ""}» подтверждён модерацией ЦТА`}
          />
        )}
      </div>

      {/* Доверие: карма + рейды */}
      <div className="flex flex-wrap gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-xs border px-2 py-1 font-blender-medium text-xs uppercase tracking-widest ${TIER_CLASS[s.karma.tierId] ?? TIER_CLASS.wild}`}
          title={`Карма: ${s.karma.total}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {s.karma.tierLabel} · {s.karma.total}
        </span>
        {s.confirmedRaids > 0 && (
          <span className="flex items-center rounded-xs border border-lines-hover px-2 py-1 font-blender-medium text-xs text-text-secondary">
            Рейдов через ЦТА: <span className="ml-1 text-text-primary">{s.confirmedRaids}</span>
          </span>
        )}
      </div>

      {/* Снимок игрового профиля */}
      {s.snapshot && (
        <div className="flex flex-wrap gap-3 rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-medium text-xs text-text-secondary">
          <span>
            Ур. <span className="text-text-primary">{s.snapshot.level}</span>
          </span>
          <span className="text-text-primary">{s.snapshot.faction}</span>
          <span>{s.snapshot.mode}</span>
        </div>
      )}

      {/* Анкета «Связи» */}
      {s.anketa && (
        <div className="flex flex-col gap-3">
          <span className="w-fit rounded-xs border border-(--primary)/40 px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
            {GOAL_LABELS[s.anketa.goal]}
          </span>

          {s.anketa.about && (
            <p className="whitespace-pre-wrap font-blender-book text-sm text-text-secondary">
              {s.anketa.about}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 rounded-xs border border-lines-hover px-2 py-0.5 font-blender-medium text-xs text-text-secondary">
              {s.anketa.voice ? (
                <Headphones className="h-3 w-3" aria-hidden="true" />
              ) : (
                <MicOff className="h-3 w-3" aria-hidden="true" />
              )}
              {s.anketa.voice ? "Голос" : "Без голоса"}
            </span>
            {s.anketa.playStyle.map((x) => (
              <Tag key={`st-${x}`} label={STYLE_LABELS[x] ?? x} />
            ))}
            {s.anketa.playTime.map((x) => (
              <Tag key={`tm-${x}`} label={TIME_LABELS[x] ?? x} />
            ))}
            {s.anketa.maps.map((x) => (
              <Tag key={`mp-${x}`} label={MAP_NAMES[x] ?? x} />
            ))}
          </div>
        </div>
      )}

      {/* Билды — облачного хранения пока нет, ведём в конструктор */}
      {s.gameCode === "eft" && (
        <Link
          href="/eft/progress/loadouts"
          className="flex w-fit items-center gap-2 rounded-xs border border-lines-hover px-3 py-2 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          Публичные сборки — скоро · открыть конструктор
        </Link>
      )}
    </section>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-xs border border-lines-hover px-2 py-0.5 font-blender-medium text-xs text-text-secondary">
      {label}
    </span>
  );
}
