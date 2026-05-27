import { notFound } from "next/navigation";
import { GAMES_DATA } from "@/data/games";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import type { Metadata } from "next";
// Импортируем компонент существующего хаба EFT
import EftHub from "@/app/eft/page";

// Динамическая генерация метаданных для каждой игры
export function generateMetadata({ params }: { params: { gameId: string } }): Metadata {
  const game = GAMES_DATA.find((g) => g.id === params.gameId);
  if (!game) return { title: "Не найдено | ЦТА" };
  return { title: `${game.title} Хаб | ЦТА` };
}

export default function GameHubPage({ params }: { params: { gameId: string } }) {
  const game = GAMES_DATA.find((g) => g.id === params.gameId);

  // Если игры нет в конфиге, отдаем страницу 404
  if (!game) {
    notFound();
  }

  // Если это EFT — рендерим его тяжелый специфичный хаб
  if (game.id === "eft") {
    return <EftHub />;
  }

  // Вычисляем правильный URL для логотипа в зависимости от его типа в конфиге
  const logoSrc = typeof game.logo === 'string' 
    ? game.logo 
    : (game.logo.type === 'mask' ? game.logo.src : game.logo.default);

  // Для всех остальных игр рендерим универсальную заглушку
  return (
    <PlaceholderPage
      themeClass={game.themeClass}
      logoSrc={logoSrc}
      logoAlt={`${game.title} Logo`}
      description={game.subtitle}
      bgImage={game.bgHover}
      bgVideo={game.videoMp4}
    />
  );
}