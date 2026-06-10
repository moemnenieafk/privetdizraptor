"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { GameCard } from "@/components/ui/GameCard";
import { GAMES_DATA } from "../data/games";
import { Carousel } from "@/components/ui/Carousel";
import { fetchLatestYouTubeVideos, type YouTubeVideo } from "@/actions/youtube";

// Актуальные видео с каналов Fullkamen и Battlestate Games
const YOUTUBE_VIDEOS = [
  { id: "I-sHMRuEBAg", url: "https://www.youtube.com/embed/I-sHMRuEBAg", title: "Tarkov Arena" },
  { id: "9Bv_3J2wVUE", url: "https://www.youtube.com/embed/9Bv_3J2wVUE", title: "Tarkov Guide" },
  { id: "qL1zO_N9lCg", url: "https://www.youtube.com/embed/qL1zO_N9lCg", title: "BSG Update" },
  { id: "yO8vW-H1R2Y", url: "https://www.youtube.com/embed/yO8vW-H1R2Y", title: "Fullkamen Stream" },
  { id: "5F_IeCq5_8o", url: "https://www.youtube.com/embed/5F_IeCq5_8o", title: "Tarkov Patch" },
];

export default function HomePage() {
  // Состояние загрузки (прелоадера)
  const [isLoading, setIsLoading] = useState(true);
  // Состояние для видео (по умолчанию используем бэкап)
  const [videos, setVideos] = useState<YouTubeVideo[]>(
    YOUTUBE_VIDEOS.map(v => ({ id: v.id, url: v.url, title: v.title, publishedAt: "" }))
  );

  useEffect(() => {
    // Имитация загрузки и инициализации хаба (1.5 секунды)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    // Асинхронно подтягиваем свежие видео через наш серверный экшен
    fetchLatestYouTubeVideos().then((fetchedVideos) => {
      if (fetchedVideos.length > 0) {
        setVideos(fetchedVideos);
      }
    });

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-base">
      {/* Тактический экран предзагрузки */}
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-base transition-all duration-700 ease-in-out ${isLoading ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
        <div className="flex gap-3 mb-6">
          <div className="w-3 h-3 bg-[var(--primary)] animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 bg-[var(--primary)] animate-pulse" style={{ animationDelay: '200ms' }} />
          <div className="w-3 h-3 bg-[var(--primary)] animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>
        <div className="font-blender-medium text-text-secondary text-[12px] tracking-[0.4em] uppercase animate-pulse">
          Синхронизация
        </div>
      </div>

      {/* Уменьшен отступ сверху для телефонов (12px), чтобы оставить больше пространства */}
      <main className="flex flex-grow w-full flex-col items-center overflow-x-hidden sm:pt-[21px] md:pt-[32px] lg:pt-[42px] pt-[28px] pb-[56px]">
        
        {/* Текстовый блок между логотипом и каруселью */}
        {/* Отступ снизу (mb) сделан минимальным, так как карусель уже имеет свой внутренний отступ сверху (py-[42px]) для теней */}
        <div className="text-center z-10 px-4 mb-[clamp(10px,1vw,14px)] shrink-0 flex flex-col items-center w-full">
          {/* Обертка для заголовка и декоративных линий */}
          <div className="flex items-center justify-center w-full gap-[16px] lg:gap-[28px] mb-[8px] sm:mb-[10px] md:mb-[12px] lg:mb-[14px]">
            {/* Левая декоративная линия (ПК: 2 колонки 160px + gap 28px = 348px) */}
            <div className="hidden md:block h-[1px] w-[160px] lg:w-[348px] bg-gradient-to-l from-lines-hover to-transparent shrink-0" />
            
            <h3 className="hub-heading text-text-primary tracking-widest font-blender-medium uppercase shrink-0">
              ВЫБЕРИ ИГРУ
            </h3>
            
            {/* Правая декоративная линия */}
            <div className="hidden md:block h-[1px] w-[160px] lg:w-[348px] bg-gradient-to-r from-lines-hover to-transparent shrink-0" />
          </div>
          {/* Ограничиваем ширину на мобилках (max-w-[280px]), чтобы текст красиво переносился и не прилипал к краям экрана */}
          <p className="hub-description text-text-secondary mx-auto leading-relaxed">
            Минимум шансов на ошибку. Максимальная тактическая готовность в любых условиях.
          </p>
        </div>

        {/* Контейнер карусели */}
        <div className="w-full flex flex-col justify-start min-h-0">
          <Carousel>
            {GAMES_DATA.map((game, index) => (
              <GameCard key={game.id} game={game} isLoading={isLoading} index={index} />
            ))}
          </Carousel>
        </div>

        {/* Второй текстовый блок под каруселью */}
        <div className="text-center z-10 px-4 mt-12 lg:mt-[56px] mb-0 sm:mb-2 lg:mb-4 shrink-0 flex flex-col items-center w-full">
          {/* Обертка для заголовка и декоративных линий */}
          <div className="flex items-center justify-center w-full gap-[16px] lg:gap-[28px] mb-[8px] sm:mb-[10px] md:mb-[12px] lg:mb-[14px]">
            {/* Левая декоративная линия */}
            <div className="hidden md:block h-[1px] w-[160px] lg:w-[348px] bg-gradient-to-l from-lines-hover to-transparent shrink-0" />
            
            <h3 className="hub-heading text-text-primary tracking-widest font-blender-medium uppercase shrink-0">
              СМОТРИ ВИДЕО
            </h3>
            
            {/* Правая декоративная линия */}
            <div className="hidden md:block h-[1px] w-[160px] lg:w-[348px] bg-gradient-to-r from-lines-hover to-transparent shrink-0" />
          </div>
          <p className="hub-description text-text-secondary mx-auto leading-relaxed">
            Познавательные и интересные видео на тему многопользовательских боевых симуляторов в опасных условиях.
          </p>
        </div>

        {/* Контейнер карточек с видео */}
        <div className="w-full mt-6 md:mt-10 overflow-x-auto touch-pan-x snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex gap-[16px] lg:gap-[28px] w-max mx-auto px-4 lg:px-8 pb-12">
            {videos.map((video) => (
              <LiteYouTube key={video.id} video={video} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Оптимизированный компонент для загрузки видео с YouTube.
 * Изначально показывает только легкую картинку-превью, а тяжелый iframe
 * загружает только после клика пользователя.
 */
function LiteYouTube({ video }: { video: YouTubeVideo }) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      className="w-[280px] h-[158px] lg:w-[347px] lg:h-[196px] shrink-0 relative rounded-xl overflow-hidden border border-lines-hover bg-black transition-all duration-300 hover:border-primary/50 hover:shadow-[0_8px_30px_rgba(230,142,37,0.15)] snap-center group cursor-pointer"
      onClick={() => setIsPlaying(true)}
    >
      {!isPlaying ? (
        <>
          {/* Стандартный img здесь лучше, чем next/image, так как не требует настройки внешних доменов в next.config */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${video.id}/hqdefault.webp`}
            alt={video.title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            loading="lazy"
          />
          {/* Иконка Play по центру */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.5)] group-hover:scale-110 group-hover:bg-red-500 transition-all duration-300">
              <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[10px] border-l-white ml-1" />
            </div>
          </div>
        </>
      ) : (
        <iframe
          width="100%"
          height="100%"
          src={`${video.url}?autoplay=1`}
          title={video.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0"
        />
      )}
    </div>
  );
}