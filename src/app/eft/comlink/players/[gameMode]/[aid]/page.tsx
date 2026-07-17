import { notFound, redirect } from "next/navigation";
import { isGameMode } from "@/types/eft-player";

// Профильная стата закрыта Turnstile апстрима на /account/ (токен привязан к их
// хостнейму — с нашей стороны не выпустить). Поэтому профиль честно уводим на
// tarkov.dev, где их капча проходит нативно. Поиск (/name/) остаётся у нас.
interface Props {
  params: Promise<{ gameMode: string; aid: string }>;
}

const AID_RE = /^\d{1,20}$/;

export default async function PlayerProfileRedirect({ params }: Props) {
  const { gameMode, aid } = await params;
  if (!isGameMode(gameMode) || !AID_RE.test(aid)) notFound();
  redirect(`https://tarkov.dev/players/${gameMode}/${aid}`);
}
