import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PlayerSearchForm } from "@/components/features/players/PlayerSearchForm";

export const metadata: Metadata = {
  title: "Поиск игроков | ЦТА",
  description: "Найдите профиль игрока Escape from Tarkov и посмотрите его статистику: рейды, K/D, выживаемость, престиж.",
};

export default function PlayersSearchPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-3xl px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="flex items-center gap-3 text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">
            <Users className="h-7 w-7 text-(--primary)" />
            Поиск игроков
          </h1>
          <p className="mt-2 font-blender-book text-sm text-text-secondary">
            Введите ник — портал найдёт профиль и покажет боевую статистику: рейды, выживаемость, K/D, серии и престиж.
            Данные берутся из публичного профиля игрока.
          </p>
        </header>
        <PlayerSearchForm />
      </div>
    </main>
  );
}
