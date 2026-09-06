import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";
import "./globals.css";
import { GatingBoundary } from "@/components/features/subscription/GatingBoundary";
import { PricingFooterLink } from "@/components/layout/PricingFooterLink";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ProgressSync } from "@/components/providers/ProgressSync";
import { AchievementSync } from "@/components/providers/AchievementSync";
import { PlayerProfileSync } from "@/components/providers/PlayerProfileSync";
import { BattlePassSync } from "@/components/providers/BattlePassSync";
import { RoleAutoWire } from "@/components/providers/RoleAutoWire";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { RestockDock } from "@/components/features/traders/restock/RestockDock";
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
        url: "/og.png?v=d18459a2",
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
    images: ["/og.png?v=d18459a2"],
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
            <BattlePassSync />
            <RoleAutoWire />
            <FeedbackProvider>
              {/* Ссылка «Тарифы» — серверный слот под Suspense, а НЕ await в теле
                  корневого layout: любое ожидание здесь ломает пререндер страниц
                  (ловили на /eft/quests/side-quests) и тормозит каждый рендер портала. */}
              <ConditionalLayout
                pricingLink={
                  <Suspense fallback={null}>
                    <PricingFooterLink />
                  </Suspense>
                }
              >
                <Suspense fallback={<ViewTransition>{children}</ViewTransition>}>
                  <GatingBoundary>
                    <ViewTransition>{children}</ViewTransition>
                  </GatingBoundary>
                </Suspense>
              </ConditionalLayout>
            </FeedbackProvider>
            <ScrollToTop />
            <RestockDock />
            <StreamDockLayer />
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}