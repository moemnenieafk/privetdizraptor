"use client";

import { useState } from "react";
import type { YouTubeVideo } from "@/actions/youtube";

interface CommsHubProps {
  videos: YouTubeVideo[];
}

const SOCIAL_LINKS = [
  {
    label: "TELEGRAM",
    sub: "НОВОСТИ · АПДЕЙТЫ",
    href: "https://t.me/fullkamen",
  },
  {
    label: "TWITCH",
    sub: "ПРЯМОЙ ЭФИР",
    href: "https://www.twitch.tv/fullkamen",
  },
  {
    label: "DISCORD",
    sub: "БАЗА СООБЩЕСТВА",
    href: "https://discord.com/invite/rYc6hpfvez",
  },
  {
    label: "BOOSTY",
    sub: "ПОДДЕРЖАТЬ СТРИМЕРА",
    href: "https://boosty.to/fullkamen",
  },
] as const;

export function CommsHub({ videos }: CommsHubProps) {
  return (
    <section className="w-full px-4 md:px-8 pb-16">
      {/* Section heading */}
      <div className="flex items-center justify-center w-full gap-4 md:gap-7 mb-2">
        <div className="hidden md:block h-px flex-1 max-w-40 lg:max-w-87 bg-linear-to-l from-lines-hover to-transparent" />
        <h3 className="font-blender-medium uppercase tracking-widest text-text-primary shrink-0 text-xl sm:text-2xl md:text-3xl lg:text-[32px]">
          КОММУНИКАЦИОННЫЙ УЗЕЛ
        </h3>
        <div className="hidden md:block h-px flex-1 max-w-40 lg:max-w-87 bg-linear-to-r from-lines-hover to-transparent" />
      </div>
      <p className="text-center font-blender-medium text-[10px] tracking-[0.3em] uppercase text-text-muted mb-8">
        // УСТАНОВЛЕНО СОЕДИНЕНИЕ · ЧАСТОТА: ФИЛОСОФИЯ КАМЕНИЗМА
      </p>

      {/* Main container */}
      <div className="max-w-480 mx-auto border border-lines-hover">
        {/* Header bar */}
        <div className="border-b border-lines-hover px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-(--primary) animate-pulse" />
            <span className="font-blender-medium text-[9px] tracking-[0.3em] uppercase text-(--primary)">
              FULLKAMEN // СВОДКА С ПЕРЕДОВОЙ
            </span>
          </div>
          <span className="font-blender-medium text-[9px] tracking-[0.2em] uppercase text-text-muted">
            ВИДЕОАРХИВ
          </span>
        </div>

        {/* Video grid */}
        <div className="p-4 md:p-5">
          {videos.length === 0 ? (
            <SkeletonVideos />
          ) : (
            <div className="flex gap-4 overflow-x-auto touch-pan-x snap-x snap-mandatory pb-4 [&::-webkit-scrollbar]:hidden scrollbar-none">
              {videos.map((video, index) => (
                <VideoCard key={video.id} video={video} index={index} />
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-lines-hover mx-4" />

        {/* Social links */}
        <div className="p-4 md:p-5">
          <p className="font-blender-medium text-[9px] tracking-[0.3em] uppercase text-text-muted mb-3">
            УЗЛЫ СВЯЗИ
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-lines-hover border border-lines-hover">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="bg-base px-3 py-3 flex flex-col gap-0.5 hover:bg-(--primary)/5 hover:border-l hover:border-l-(--primary) transition-none group"
              >
                <span className="font-blender-medium text-[11px] uppercase tracking-widest text-text-secondary group-hover:text-(--primary) transition-none">
                  {link.label}
                </span>
                <span className="font-blender-medium text-[8px] tracking-[0.2em] uppercase text-text-muted">
                  {link.sub}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function VideoCard({ video, index }: { video: YouTubeVideo; index: number }) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      className="w-70 sm:w-80 lg:w-87 shrink-0 snap-center flex flex-col border border-lines-hover hover:border-(--primary)/40 transition-none group cursor-pointer"
      onClick={() => setIsPlaying(true)}
    >
      {/* Top bar */}
      <div className="px-2 py-1.5 border-b border-lines-hover flex items-center justify-between">
        <span className="font-blender-medium text-[8px] tracking-[0.25em] uppercase text-text-muted">
          // РАЗВЕДДАННЫЕ [{String(index + 1).padStart(2, "0")}]
        </span>
        {video.publishedAt && (
          <span className="font-blender-medium text-[8px] tabular-nums text-text-muted">
            {new Date(video.publishedAt).toLocaleDateString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Thumbnail / player */}
      <div className="relative w-full aspect-video overflow-hidden bg-black">
        {!isPlaying ? (
          <>
            <img
              src={`https://i.ytimg.com/vi/${video.id}/hqdefault.webp`}
              alt={video.title}
              className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-8 bg-red-600 flex items-center justify-center group-hover:bg-red-500 transition-none">
                <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-10 border-l-white ml-1" />
              </div>
            </div>
          </>
        ) : (
          <iframe
            width="100%"
            height="100%"
            src={`${video.url}?autoplay=1`}
            title={video.title}
            style={{ border: "none" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0"
          />
        )}
      </div>

      {/* Title bar */}
      <div className="px-2 py-2 border-t border-lines-hover">
        <p className="font-blender-medium text-[10px] uppercase tracking-wide text-text-secondary group-hover:text-text-primary transition-none line-clamp-1 leading-tight">
          {video.title}
        </p>
      </div>
    </div>
  );
}

function SkeletonVideos() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-70 sm:w-80 lg:w-87 shrink-0 border border-lines-hover">
          <div className="px-2 py-1.5 border-b border-lines-hover">
            <div className="h-2.5 bg-lines-hover animate-pulse w-20" />
          </div>
          <div className="aspect-video bg-lines-hover animate-pulse" />
          <div className="px-2 py-2 border-t border-lines-hover">
            <div className="h-2.5 bg-lines-hover animate-pulse w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}
