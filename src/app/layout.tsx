import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ProgressSync } from "@/components/providers/ProgressSync";
import { AchievementSync } from "@/components/providers/AchievementSync";
import { PlayerProfileSync } from "@/components/providers/PlayerProfileSync";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { FeedbackProvider } from "@/components/providers/FeedbackProvider";

export const metadata: Metadata = {
  title: "ЦТА Хаб",
  description: "Технический паспорт дизайн-системы и игровой хаб",
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
                {children}
              </ConditionalLayout>
            </FeedbackProvider>
            <ScrollToTop />
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}