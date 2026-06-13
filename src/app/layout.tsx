import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";

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
    <html lang="ru">
      <body className="antialiased min-h-screen flex flex-col bg-base">
        {/* Global dot matrix — fades from edges toward center */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(242,242,242,1) 1px, transparent 1px)',
            backgroundSize: '53px 53px',
            maskImage:
              'linear-gradient(to right, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.07) 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.07) 100%)',
          }}
        />
        <div className="relative z-10 flex min-h-screen flex-col">
          <ThemeProvider>
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}