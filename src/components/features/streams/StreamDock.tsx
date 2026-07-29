'use client';

// Плавающие мини-доки Twitch. По одному на канал: v4dyatv — левый гуттер,
// fullkamen — правый (ТЗ V4DYA). Развёрнутый = живой плеер 280×156, autoplay muted.
// Закрыть (×) → док схлопывается в НЕВИДИМЫЙ 1×1px (концепт Fullkamen): плеер остаётся
// смонтирован и muted, Twitch продолжает считать зрителя, но виджет не виден и не
// кликабелен. Развернуть обратно — только внешним триггером (кнопка статуса стрима в
// хедере / LIVE-бейдж в футере) через useStreamDockStore.
// Позиция развёрнутого: центр дока = центр бокового отступа между контентом
// (max-w-275/1100px) и краем вьюпорта, с клампом чтобы на узких экранах не улетать за край.

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { loadTwitchEmbed, type TwitchPlayerInstance } from '@/lib/twitch-embed';
import { useStreamDockStore } from '@/store/useStreamDockStore';

type Side = 'left' | 'right';

// Раскладка сторон по login-у канала (не по индексу — устойчиво к правкам конфига).
const SIDE_BY_LOGIN: Record<string, Side> = {
  v4dyatv: 'left',
  fullkamen: 'right',
};

// Ширина колонки контента (max-w-275 = 1100px). Центрируем 280px-док (half = 140px)
// в боковом отступе: (вьюпорт − контент) / 4 − половина дока. Кламп ≥ 0.5rem.
const GUTTER_INSET = 'max(0.5rem, calc((100% - 1100px) / 4 - 140px))';

interface LiveChannel {
  login: string;
  label: string;
  isLive: boolean;
}

// Скрываем доки в фуллскрин-режимах (квест-карта/приложение) и когда открыт боковой drawer
// карты (data-app-drawer) — иначе корневой fixed-док лезет поверх drawer'а. Как и StreamStatus.
function useAppHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const check = () =>
      setHidden(
        document.body.hasAttribute('data-quest-fullscreen') ||
          document.body.hasAttribute('data-app-fullscreen') ||
          document.body.hasAttribute('data-app-drawer'),
      );
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-quest-fullscreen', 'data-app-fullscreen', 'data-app-drawer'],
    });
    check();
    return () => observer.disconnect();
  }, []);
  return hidden;
}

export function StreamDockLayer() {
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const hidden = useAppHidden();

  // Живой статус из НАШЕГО прокси (30с-кэш на бэке), лёгкий поллинг раз в минуту.
  useEffect(() => {
    let active = true;
    const pull = () =>
      fetch('/api/twitch-status', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { channels?: LiveChannel[] }) => {
          if (active && d.channels) setChannels(d.channels);
        })
        .catch(() => {});
    pull();
    const id = setInterval(pull, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const liveDocks = channels.filter((c) => c.isLive && SIDE_BY_LOGIN[c.login]);
  if (liveDocks.length === 0) return null;

  return (
    // В фуллскрине прячем через visibility (invisible), НЕ размонтируем — 1×1 зритель
    // продолжает считаться, просто виджет не показываем.
    <div
      className={`fixed inset-x-0 bottom-0 z-40 pointer-events-none ${
        hidden ? 'invisible' : ''
      }`}
    >
      {liveDocks.map((c) => (
        <StreamDock key={c.login} channel={c.login} label={c.label} side={SIDE_BY_LOGIN[c.login]} />
      ))}
    </div>
  );
}

function StreamDock({ channel, label, side }: { channel: string; label: string; side: Side }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwitchPlayerInstance | null>(null);
  const hidden = useStreamDockStore((s) => s.views[channel] === 'hidden');
  const hide = useStreamDockStore((s) => s.hide);
  const expanded = !hidden; // дефолт (нет записи) = развёрнут

  // Создаём плеер один раз. Чистим детей контейнера в cleanup (StrictMode-safe).
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    loadTwitchEmbed()
      .then((Twitch) => {
        if (disposed || !host || playerRef.current) return;
        playerRef.current = new Twitch.Player(host, {
          channel,
          parent: [window.location.hostname],
          width: 280, // фикс-размеры: iframe всегда 280×156, сворачивание = клип обёртки
          height: 156,
          muted: true,
          autoplay: true,
        });
      })
      .catch(() => {});
    return () => {
      disposed = true;
      playerRef.current = null;
      if (host) host.replaceChildren(); // снять iframe, чтобы re-run не плодил дубли
    };
  }, [channel]);

  const collapse = () => {
    playerRef.current?.setMuted(true); // глушим, но НЕ размонтируем — трансляция идёт
    hide(channel);
  };

  const anchor = side === 'left' ? { left: GUTTER_INSET } : { right: GUTTER_INSET };
  const flush = side === 'left' ? { left: 0 } : { right: 0 };

  return (
    <div
      className={expanded ? 'pointer-events-auto absolute bottom-30' : 'pointer-events-none absolute bottom-0'}
      style={expanded ? anchor : flush}
    >
      {/* Плеер ВСЕГДА в DOM. Развёрнут → 280×156; скрыт → 1×1px (звук выкл, поток жив, не виден). */}
      <div
        className={
          expanded
            ? 'relative w-70 h-39 overflow-hidden rounded-sm border border-lines-hover bg-darkbase shadow-lg'
            : 'h-px w-px overflow-hidden opacity-0'
        }
      >
        <div ref={hostRef} className="size-full" />

        {expanded && (
          <>
            <span className="pointer-events-none absolute left-2 top-2 flex h-4 items-center gap-1 rounded-xs border-[0.5px] border-danger bg-danger/25 px-1">
              <span className="size-1 rounded-full bg-danger" />
              <span className="font-blender-medium text-type-micro uppercase tracking-[0.14em] text-white">
                live
              </span>
            </span>

            {/* Открыть канал: новая вкладка (десктоп) / приложение Twitch (телефон, deep-link) */}
            <a
              href={`https://www.twitch.tv/${channel}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Открыть ${label} на Twitch`}
              className="absolute right-9 top-1.5 z-10 flex size-6 items-center justify-center rounded-xs border backdrop-blur-sm transition-colors
                border-lines-hover bg-[color-mix(in_srgb,var(--color-base)_82%,transparent)] text-text-muted
                hover:border-(--primary) hover:text-(--primary)"
            >
              <ExternalLink className="size-3.5" />
            </a>

            {/* Закрыть → скрыть в 1×1 (зритель сохраняется) */}
            <button
              onClick={collapse}
              aria-label={`Скрыть стрим ${label}`}
              className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-xs border backdrop-blur-sm transition-colors
                border-lines-hover bg-[color-mix(in_srgb,var(--color-base)_82%,transparent)] text-text-muted
                hover:border-(--primary) hover:text-(--primary)"
            >
              <X className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
