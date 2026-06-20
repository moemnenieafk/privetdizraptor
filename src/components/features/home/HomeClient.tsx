"use client";

import { useState, useEffect } from "react";
import { GameCard } from "@/components/ui/GameCard";
import { GAMES_DATA } from "@/data/games";
import { Carousel } from "@/components/ui/Carousel";
import { CommsHub } from "./CommsHub";
import { fetchLatestYouTubeVideos, type YouTubeVideo } from "@/actions/youtube";

const FALLBACK_VIDEOS: YouTubeVideo[] = [
  { id: "I-sHMRuEBAg", url: "https://www.youtube.com/embed/I-sHMRuEBAg", title: "Tarkov Arena", publishedAt: "" },
  { id: "9Bv_3J2wVUE", url: "https://www.youtube.com/embed/9Bv_3J2wVUE", title: "Tarkov Guide", publishedAt: "" },
  { id: "qL1zO_N9lCg", url: "https://www.youtube.com/embed/qL1zO_N9lCg", title: "BSG Update", publishedAt: "" },
  { id: "yO8vW-H1R2Y", url: "https://www.youtube.com/embed/yO8vW-H1R2Y", title: "Fullkamen Stream", publishedAt: "" },
  { id: "5F_IeCq5_8o", url: "https://www.youtube.com/embed/5F_IeCq5_8o", title: "Tarkov Patch", publishedAt: "" },
];

export function HomeClient() {
  const [videos, setVideos] = useState<YouTubeVideo[]>(FALLBACK_VIDEOS);

  useEffect(() => {
    fetchLatestYouTubeVideos().then((fetched) => {
      if (fetched.length > 0) setVideos(fetched);
    });
  }, []);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden animate-[fade-in_0.5s_ease-out_both]">

      {/* ─── GAME CAROUSEL ─────────────────────────────────────────── */}
      <section className="w-full pt-7 pb-16">
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

      {/* ─── COMMS HUB ─────────────────────────────────────────────── */}
      <CommsHub videos={videos} />
    </div>
  );
}
