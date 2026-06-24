"use client";

import { useEffect, useRef } from "react";

// Минимальный тип глобального turnstile (скрипт Cloudflare грузим сами).
type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  theme?: "dark" | "light" | "auto";
  size?: "normal" | "flexible" | "compact";
};
type TurnstileApi = {
  render: (el: HTMLElement, opts: TurnstileOptions) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Cloudflare Turnstile. Вызывает onToken(token) при прохождении и onToken("")
 * при истечении/ошибке. Для сброса (новый токен на повторную попытку) меняй `key`
 * у компонента в родителе — это ремаунтит виджет с новым челленджем.
 */
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    function render() {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        theme: "dark",
        size: "flexible",
        callback: (t) => cb.current(t),
        "expired-callback": () => cb.current(""),
        "error-callback": () => cb.current(""),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
        const s = document.createElement("script");
        s.src = SCRIPT_SRC;
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
      // Скрипт грузится асинхронно — поллим появление window.turnstile.
      poll = setInterval(() => {
        if (window.turnstile) {
          if (poll) clearInterval(poll);
          render();
        }
      }, 150);
      setTimeout(() => poll && clearInterval(poll), 8000);
    }

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
    };
  }, [siteKey]);

  return <div ref={ref} className="min-h-[65px]" />;
}
