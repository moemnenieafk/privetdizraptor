"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getHeaderConfig } from "@/data/headerConfig";
import { SupportButton } from "@/components/ui/SupportButton";
import {
  STREAMERS,
  SOCIAL_LINKS,
  ADDITIONAL_LINKS,
  LEGAL_LINKS,
  COMLINK_ITEM,
  streamPlatformIcon,
  type Streamer,
} from "@/data/footerConfig";

const BUILD_VERSION = "v0.2.0-beta";

type PingState = "idle" | "ok" | "err";

export default function Footer() {
  const [ping, setPing] = useState<number | null>(null);
  const [pingState, setPingState] = useState<PingState>("idle");
  const [liveChannels, setLiveChannels] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  // Навигация — из ЕДИНОГО источника (headerConfig), game-aware, + футер-пункт «Связь».
  const { menuItems } = getHeaderConfig(pathname || "/");
  const navItems = [
    ...menuItems
      .filter((item) => item.path)
      .map((item) => ({ href: item.path as string, label: item.label, iconUrl: item.iconUrl })),
    { href: COMLINK_ITEM.href, label: COMLINK_ITEM.label, iconUrl: COMLINK_ITEM.iconUrl },
  ];

  // Live-статус Twitch-каналов (наш прокси, 30с-кэш).
  useEffect(() => {
    fetch("/api/twitch-status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { channels?: { login: string; isLive: boolean }[] }) => {
        if (d.channels) {
          setLiveChannels(Object.fromEntries(d.channels.map((c) => [c.login, c.isLive])));
        }
      })
      .catch(() => {});
  }, []);

  // Пинг НАШЕГО бэкенда — диагностика доступности CTA API.
  useEffect(() => {
    const t0 = performance.now();
    fetch("/api/eft/items?limit=1", { signal: AbortSignal.timeout(6000) })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        setPing(Math.round(performance.now() - t0));
        setPingState("ok");
      })
      .catch(() => setPingState("err"));
  }, []);

  const pingDot =
    pingState === "ok"  ? "bg-online" :
    pingState === "err" ? "bg-danger" :
                          "bg-text-muted animate-pulse";
  const pingLabel =
    pingState === "ok"  && ping !== null ? `${ping}ms` :
    pingState === "err" ? "ERR" :
                          "···";
  const pingText =
    pingState === "ok"  ? "text-online" :
    pingState === "err" ? "text-danger" :
                          "text-text-muted";

  return (
    <footer className="mt-24 w-full bg-base">
      {/* Верхняя разделительная линия — цвет линий, 2px, в ширину контента 1100px */}
      <div className="max-w-275 mx-auto px-4 xl:px-0">
        <div className="h-0.5 w-full bg-lines-hover" />
      </div>

      <div className="max-w-275 mx-auto px-4 xl:px-0 pt-10 pb-9">
        <div className="flex flex-col items-center gap-10 xl:flex-row xl:items-start xl:justify-between xl:gap-6">

          {/* ── Left: logo + nav ── */}
          <div className="flex shrink-0 flex-col items-center gap-6 xl:w-44 xl:items-start">
            {/* Лого ЦТА (без таглайна), два состояния default/hover */}
            <Link href="/" aria-label="ЦТА" className="group relative block h-8 w-32">
              <span className="icon-mask icon-cta-logo-default absolute inset-0 text-text-secondary transition-opacity duration-200 group-hover:opacity-0" />
              <span className="icon-mask icon-cta-logo-hover absolute inset-0 text-(--primary) opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </Link>

            <nav className="flex flex-col gap-0.5">
              {navItems.map(({ href, label, iconUrl }) => (
                <Link
                  key={label}
                  href={href}
                  className="group flex items-center gap-3.5 rounded-xs px-2 py-1.5 transition-none"
                >
                  {iconUrl && (
                    <span
                      className="icon-mask size-4 shrink-0 text-text-muted transition-none group-hover:text-(--primary)"
                      style={{ maskImage: `url(${iconUrl})`, WebkitMaskImage: `url(${iconUrl})` }}
                    />
                  )}
                  <span className="font-blender-medium text-type-caption uppercase tracking-[0.14em] text-text-secondary transition-none group-hover:text-(--primary)">
                    {label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Center: streamer cards (макс 348px; в ряд с md, чтобы на узких не переполнять) ── */}
          <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-stretch md:justify-center xl:w-auto xl:gap-6">
            {STREAMERS.map((s) => (
              <StreamerCard key={s.id} streamer={s} live={liveChannels[s.twitchLogin]} />
            ))}
          </div>

          {/* ── Right: support + additional links + social ── */}
          <div className="flex shrink-0 flex-col items-center gap-5 xl:w-44 xl:items-start">
            <SupportButton />

            <div className="flex flex-col items-center gap-3.5 xl:items-start">
              {ADDITIONAL_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="font-blender-medium text-type-micro uppercase tracking-[0.1em] whitespace-nowrap text-text-secondary transition-none hover:text-(--primary)"
                >
                  {label}
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {SOCIAL_LINKS.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  title={label}
                  className="group/soc relative block size-12"
                >
                  {/* default — серая заливка; hover — брендовый цвет (готовые ассеты Figma) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon}
                    alt={label}
                    className="absolute inset-0 size-full transition-opacity duration-200 group-hover/soc:opacity-0"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={icon.replace(".svg", "-hover.svg")}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 size-full opacity-0 transition-opacity duration-200 group-hover/soc:opacity-100"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom band ── */}
      <div className="w-full bg-darkbase">
        <div className="max-w-275 mx-auto flex flex-col gap-3.5 px-4 py-6 xl:px-0">

          {/* Copyright + diagnostics */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-blender-medium text-type-caption uppercase text-text-secondary">
              © 2026 ЦТА · ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ · ВСЕ ПРАВА ЗАЩИЩЕНЫ
            </span>
            <div className="flex items-center gap-7">
              <div className="flex items-center gap-2">
                <span className={`shrink-0 size-1 ${pingDot}`} />
                <span className="font-blender-medium text-type-caption text-text-secondary">CTA API</span>
                <span className={`font-blender-medium text-type-caption tabular-nums ${pingText}`}>{pingLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 size-1 bg-tactical-amber" />
                <span className="font-blender-medium text-type-caption text-text-secondary">CTA RUNTIME-BUILD</span>
                <span className="font-blender-medium text-type-caption uppercase text-tactical-amber">{BUILD_VERSION}</span>
              </div>
            </div>
          </div>

          {/* Disclaimer + legal */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-7">
            <p className="max-w-134 font-blender-medium text-type-caption leading-5 text-text-muted">
              Игровой контент и материалы являются товарными знаками и собственностью игровых разработчиков и её лицензиаров.
            </p>
            <p className="font-blender-medium text-type-caption leading-5 text-text-muted sm:text-right">
              {LEGAL_LINKS.map(({ label, href }, i) => (
                <span key={href}>
                  {i > 0 && <span className="mx-1">·</span>}
                  <Link href={href} className="underline transition-none hover:text-text-secondary">
                    {label}
                  </Link>
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Стример-карточка: аватар + имя + LIVE/OFFLINE + платформы + превью-арт ──
function StreamerCard({ streamer, live }: { streamer: Streamer; live: boolean | undefined }) {
  const loaded = live !== undefined;
  return (
    <div className="flex w-full min-w-0 max-w-87 flex-col gap-4 md:flex-1 xl:flex-none">
      {/* Header row */}
      <div className="flex items-center gap-3.5">
        <span className="relative block size-9 shrink-0 overflow-hidden rounded-full border border-lines-hover">
          <Image src={streamer.avatar} alt={streamer.name} fill className="object-cover" />
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <Image
            src={streamer.wordmark}
            alt={streamer.name}
            width={streamer.wordmarkWidth}
            height={streamer.wordmarkHeight}
            className="shrink-0"
          />
          {live ? (
            <span className="flex h-4 items-center justify-center gap-1 rounded-xs border-[0.5px] border-danger bg-danger/25 px-1">
              <span className="size-1 rounded-full bg-danger" />
              <span className="font-blender-medium text-type-micro uppercase tracking-[0.14em] text-white">live</span>
            </span>
          ) : (
            <span className="flex h-4 items-center justify-center rounded-xs border-[0.5px] border-text-muted px-1">
              <span className={`font-blender-medium text-type-micro uppercase tracking-[0.14em] text-text-muted ${loaded ? "" : "animate-pulse"}`}>
                {loaded ? "offline" : "···"}
              </span>
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3.5">
          {streamer.platforms.map((p) => (
            <a
              key={p.kind}
              href={p.href}
              target="_blank"
              rel="noreferrer"
              aria-label={p.kind}
              className="group/plat relative block size-4 shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={streamPlatformIcon(p.kind)}
                alt=""
                className="absolute inset-0 size-full transition-opacity duration-200 group-hover/plat:opacity-0"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={streamPlatformIcon(p.kind, true)}
                alt=""
                className="absolute inset-0 size-full opacity-0 transition-opacity duration-200 group-hover/plat:opacity-100"
              />
            </a>
          ))}
        </div>
      </div>

      {/* Preview art (static) → канал */}
      <a
        href={streamer.channelUrl}
        target="_blank"
        rel="noreferrer"
        className="group relative block aspect-[348/196] w-full overflow-hidden rounded-sm border border-lines-hover bg-darkbase"
      >
        <Image
          src={streamer.thumb}
          alt={`${streamer.name} — стрим`}
          fill
          sizes="(max-width: 640px) 100vw, 348px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </a>
    </div>
  );
}
