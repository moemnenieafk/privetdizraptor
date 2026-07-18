import type { Metadata } from "next";
import React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { HubCard } from "@/components/ui/HubCard";
import { COMLINK_BASE, COMLINK_SECTIONS } from "@/data/comlinkSections";

// Индекс раздела «Связь». Навигация по разделу карточками HubCard —
// как в «Прогрессе»/«Заданиях». Источник правды — COMLINK_SECTIONS.
export const metadata: Metadata = {
  title: "Связь · ЦТА",
  description: "Сообщество ЦТА: поиск напарников, шерпы, мастер-классы, блог и обновления игры.",
  robots: { index: false, follow: true },
};

const COMLINK_HUB_CARDS = COMLINK_SECTIONS.map((s) => ({
  id: s.slug,
  title: s.label,
  description: s.description,
  href: `${COMLINK_BASE}/${s.slug}`,
  iconPath: s.icon,
  variant: "rectangle" as const,
}));

export default function ComlinkIndexPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-comlink" />

        {/* Сетка HubCard — навигация по разделу */}
        <div className="tactical-grid">
          {COMLINK_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
