import type { Metadata } from "next";
import { ViewTransition } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ProgressSync } from "@/components/providers/ProgressSync";
import { AchievementSync } from "@/components/providers/AchievementSync";
import { PlayerProfileSync } from "@/components/providers/PlayerProfileSync";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { StreamDockLayer } from "@/components/features/streams/StreamDock";
import { FeedbackProvider } from "@/components/providers/FeedbackProvider";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ЦТА — портал по Escape from Tarkov",
    template: "%s · ЦТА",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Escape from Tarkov", "Тарков", "ЦТА", "цены барахолки", "карты Таркова",
    "трекер заданий", "убежище", "бартеры", "сборки оружия", "гайды",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: "ЦТА — портал по Escape from Tarkov",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ЦТА — Центр тактической адаптации, портал по Escape from Tarkov",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ЦТА — портал по Escape from Tarkov",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body className="antialiased min-h-screen flex flex-col bg-base">
        {/* BG Layer 1: primary colour ambient bloom from top — reacts to game theme */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: 'radial-gradient(ellipse 80% 38% at 50% 0%, var(--primary) 0%, transparent 100%)',
            opacity: 0.04,
          }}
        />

        {/* BG Layer 3: corner vignette — frames the display, deepens extreme edges */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background: 'radial-gradient(ellipse 145% 145% at 50% 50%, transparent 52%, rgba(0,0,0,0.42) 100%)',
          }}
        />
        <div className="relative z-10 flex min-h-screen flex-col">
          <ThemeProvider>
            <ProgressSync />
            <AchievementSync />
            <PlayerProfileSync />
            <FeedbackProvider>
              <ConditionalLayout>
                <ViewTransition>{children}</ViewTransition>
              </ConditionalLayout>
            </FeedbackProvider>
            <ScrollToTop />
            <StreamDockLayer />
          </ThemeProvider>
        </div>

        {/* BG Layer 4: film grain — субтильная тактическая текстура поверх всего (атмосфера).
            Статичный, pointer-events-none, не влияет на интерактив/раскладку.
            Плотность крутится через opacity-[…]; убрать = снести этот блок. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100] opacity-[0.05]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='cta-grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23cta-grain)'/%3E%3C/svg%3E\")",
            backgroundSize: "220px 220px",
          }}
        />
      </body>
    </html>
  );
}