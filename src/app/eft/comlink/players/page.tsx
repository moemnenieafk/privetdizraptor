import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { ProfileUpload } from "@/components/features/players/ProfileUpload";

export const metadata: Metadata = {
  title: "Статистика игрока | ЦТА",
  description:
    "Загрузи profile.json из Escape from Tarkov и посмотри всю статистику: рейды, K/D, выживаемость, навыки, мастерство, престиж.",
};

export default function PlayersPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pb-14">
      <div className="w-full max-w-3xl px-4 xl:px-0">
        <div className="mb-6 border-l-2 border-(--primary)/40 bg-card-menu px-4 py-3">
          <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Где взять файл</p>
          <p className="mt-1 font-blender-book text-xs leading-relaxed text-text-secondary">
            Открой свой профиль на{" "}
            <a
              href="https://tarkov.dev/players"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-(--primary) hover:underline"
            >
              tarkov.dev
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            и нажми кнопку скачивания JSON — получишь файл профиля, который можно загрузить сюда.
          </p>
        </div>

        <ProfileUpload />
      </div>
    </main>
  );
}
