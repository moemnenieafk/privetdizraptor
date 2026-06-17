"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GameCard } from "@/components/ui/GameCard";
import { GAMES_DATA } from "@/data/games";
import { Carousel } from "@/components/ui/Carousel";
import { TerminalBoot } from "./TerminalBoot";
import { CommsHub } from "./CommsHub";
import { fetchLatestYouTubeVideos, type YouTubeVideo } from "@/actions/youtube";

const FALLBACK_VIDEOS: YouTubeVideo[] = [
  { id: "I-sHMRuEBAg", url: "https://www.youtube.com/embed/I-sHMRuEBAg", title: "Tarkov Arena", publishedAt: "" },
  { id: "9Bv_3J2wVUE", url: "https://www.youtube.com/embed/9Bv_3J2wVUE", title: "Tarkov Guide", publishedAt: "" },
  { id: "qL1zO_N9lCg", url: "https://www.youtube.com/embed/qL1zO_N9lCg", title: "BSG Update", publishedAt: "" },
  { id: "yO8vW-H1R2Y", url: "https://www.youtube.com/embed/yO8vW-H1R2Y", title: "Fullkamen Stream", publishedAt: "" },
  { id: "5F_IeCq5_8o", url: "https://www.youtube.com/embed/5F_IeCq5_8o", title: "Tarkov Patch", publishedAt: "" },
];

interface HomeClientProps {
  supplySection?: React.ReactNode;
  tacticalSection?: React.ReactNode;
}

export function HomeClient({ supplySection, tacticalSection }: HomeClientProps) {
  const [isBooting, setIsBooting] = useState(true);
  const [videos, setVideos] = useState<YouTubeVideo[]>(FALLBACK_VIDEOS);

  useEffect(() => {
    fetchLatestYouTubeVideos().then((fetched) => {
      if (fetched.length > 0) setVideos(fetched);
    });
  }, []);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden animate-[fade-in_0.5s_ease-out_both]">
      {isBooting && <TerminalBoot onComplete={() => setIsBooting(false)} />}

      {/* ─── HERO SECTION ──────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] w-full px-4 text-center">
        <div className="flex flex-col items-center gap-5">
          <div className="w-px h-10 bg-(--primary) opacity-30" />

          <p className="font-blender-medium text-[10px] tracking-[0.45em] uppercase text-text-muted">
            ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ
          </p>

          <h1 className="font-blender-medium text-4xl sm:text-5xl lg:text-[56px] uppercase tracking-widest text-text-primary leading-none">
            ЦТА ХАБ
          </h1>

          <p className="font-blender-medium text-[10px] tracking-[0.3em] uppercase text-text-secondary max-w-sm">
            // АГРЕГАЦИЯ РАЗВЕДДАННЫХ. ЭКОНОМИЧЕСКИЙ АНАЛИЗ. МАРШРУТИЗАЦИЯ
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-3">
            <Link
              href="/eft"
              className="border border-(--primary) px-7 py-2.5 font-blender-medium text-[11px] tracking-[0.3em] uppercase text-(--primary) hover:bg-(--primary) hover:text-base transition-none"
            >
              [ БАЗА ДАННЫХ / EFT ]
            </Link>
            <Link
              href="/account"
              className="border border-lines-hover px-7 py-2.5 font-blender-medium text-[11px] tracking-[0.3em] uppercase text-text-secondary hover:border-(--primary) hover:text-(--primary) transition-none"
            >
              [ АВТОРИЗАЦИЯ УЗЛА ]
            </Link>
          </div>

          <div className="w-px h-10 bg-(--primary) opacity-30" />
        </div>
      </section>

      {/* ─── SUPPLY GRID ───────────────────────────────────────────────────── */}
      {supplySection}

      {/* ─── TACTICAL CARTOGRAPHY ──────────────────────────────────────────── */}
      {tacticalSection}

      {/* ─── GAME CAROUSEL ─────────────────────────────────────────────────── */}
      <section className="w-full pb-16">
        <div className="text-center px-4 mb-[clamp(10px,1vw,14px)] flex flex-col items-center w-full">
          <div className="flex items-center justify-center w-full gap-4 lg:gap-7 mb-2 sm:mb-2.5 md:mb-3 lg:mb-3.5">
            <div className="hidden md:block h-px w-40 lg:w-87 bg-linear-to-l from-lines-hover to-transparent shrink-0" />
            <h3 className="hub-heading text-text-primary tracking-widest font-blender-medium uppercase shrink-0">
              ВЫБЕРИ ВСЕЛЕННУЮ
            </h3>
            <div className="hidden md:block h-px w-40 lg:w-87 bg-linear-to-r from-lines-hover to-transparent shrink-0" />
          </div>
          <p className="hub-description text-text-secondary mx-auto leading-relaxed">
            Минимум шансов на ошибку. Максимальная тактическая готовность в любых условиях.
          </p>
        </div>

        <div className="w-full z-10 justify-start min-h-0">
          <Carousel>
            {GAMES_DATA.map((game, index) => (
              <GameCard key={game.id} game={game} isLoading={false} index={index} />
            ))}
          </Carousel>
        </div>
      </section>

      {/* ─── COMMS HUB ─────────────────────────────────────────────────────── */}
      <CommsHub videos={videos} />
    </div>
  );
}
