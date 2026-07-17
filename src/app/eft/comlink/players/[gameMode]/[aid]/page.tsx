import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerProfile } from "@/lib/tarkov/player-cache";
import { UpstreamError } from "@/lib/tarkov/player-source";
import { normalizeProfile } from "@/lib/tarkov/player-stats";
import { PlayerProfileView } from "@/components/features/players/PlayerProfileView";
import { isGameMode } from "@/types/eft-player";

interface Props {
  params: Promise<{ gameMode: string; aid: string }>;
}

const AID_RE = /^\d{1,20}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { aid, gameMode } = await params;
  if (!isGameMode(gameMode) || !AID_RE.test(aid)) return { title: "Профиль игрока | ЦТА" };
  try {
    const profile = await getPlayerProfile(aid, gameMode);
    const nick = profile.info?.nickname ?? "Игрок";
    return {
      title: `${nick} — профиль | ЦТА`,
      description: `Статистика игрока ${nick} в Escape from Tarkov: рейды, K/D, выживаемость, престиж.`,
    };
  } catch {
    return { title: "Профиль игрока | ЦТА" };
  }
}

export default async function PlayerProfilePage({ params }: Props) {
  const { gameMode, aid } = await params;
  if (!isGameMode(gameMode) || !AID_RE.test(aid)) notFound();

  let profile;
  try {
    profile = await getPlayerProfile(aid, gameMode);
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) notFound();
    return <ProfileError message={error instanceof UpstreamError ? error.message : "Не удалось загрузить профиль"} />;
  }

  const view = normalizeProfile(profile, gameMode);
  return <PlayerProfileView view={view} />;
}

function ProfileError({ message }: { message: string }) {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-20 pb-14">
      <div className="w-full max-w-md px-4 text-center">
        <p className="mb-4 font-blender-medium text-lg uppercase tracking-widest text-(--color-danger)">{message}</p>
        <Link
          href="/eft/comlink/players"
          className="inline-block border border-lines-hover px-5 py-2 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
        >
          Вернуться к поиску
        </Link>
      </div>
    </main>
  );
}
