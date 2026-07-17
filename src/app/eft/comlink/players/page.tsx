import type { Metadata } from "next";
import { Users, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Поиск игроков | ЦТА",
  description: "Поиск игроков Escape from Tarkov и их статистика — на tarkov.dev.",
};

export default function PlayersLauncherPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-2xl px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="flex items-center gap-3 text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">
            <Users className="h-7 w-7 text-(--primary)" />
            Поиск игроков
          </h1>
        </header>

        <div className="flex flex-col items-start gap-5 border border-lines-hover bg-card-menu p-6">
          <p className="font-blender-book text-sm leading-relaxed text-text-secondary">
            Поиск игроков и их боевая статистика — рейды, выживаемость, K/D, серии, престиж, навыки —
            доступны на <span className="text-text-primary">tarkov.dev</span>. Профильный сервис защищён капчей на их
            стороне, поэтому открывается там напрямую.
          </p>
          <a
            href="https://tarkov.dev/players"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center gap-2 border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-6 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
          >
            Открыть поиск на tarkov.dev
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </main>
  );
}
