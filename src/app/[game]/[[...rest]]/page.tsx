import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GAMES_DATA } from '@/data/games';
import { PlaceholderPage } from '@/components/PlaceholderPage';

interface Props {
  params: Promise<{ game: string; rest?: string[] }>;
}

// Top-level optional catch-all: ловит другие игры (/frago, /gzw, /frago/sectors …).
// Статические сегменты (eft, login, account, admin, auth, api) имеют приоритет.
// Неизвестная игра → глобальный 404.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game: gameId } = await params;
  const game = GAMES_DATA.find((g) => g.id === gameId);
  if (!game || game.id === 'eft') return { title: 'Не найдено | ЦТА' };
  return { title: `${game.title} | ЦТА` };
}

export default async function GamePlaceholderPage({ params }: Props) {
  const { game: gameId } = await params;
  const game = GAMES_DATA.find((g) => g.id === gameId);

  // EFT обслуживается своим деревом /app/eft/*; всё неизвестное — 404.
  if (!game || game.id === 'eft') notFound();

  const logoSrc =
    typeof game.logo === 'string'
      ? game.logo
      : game.logo.type === 'mask'
        ? game.logo.src
        : game.logo.default;

  return (
    <PlaceholderPage
      themeClass={game.themeClass}
      logoSrc={logoSrc}
      logoAlt={`${game.title} Logo`}
      description={game.subtitle}
      bgImage={game.bgHover}
    />
  );
}
