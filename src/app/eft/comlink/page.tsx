import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/ui/SectionPlaceholder";
import { COMLINK_BASE, COMLINK_ICON, COMLINK_TABS } from "@/data/comlinkSections";

// Индекс раздела «Связь». Навигируемая заглушка (MVP) — реальный контент отдельным эпиком.
export const metadata: Metadata = {
  title: "Связь · ЦТА",
  description: "Сообщество ЦТА: поиск напарников, шерпы, мастер-классы, блог и обновления игры.",
  robots: { index: false, follow: true },
};

export default function ComlinkIndexPage() {
  return (
    <SectionPlaceholder
      title="Связь"
      description="Сообщество ЦТА: поиск напарников, биржа шерпов, мастер-классы, новостной блог и обновления игры."
      iconUrl={COMLINK_ICON}
      tabs={COMLINK_TABS}
      activeHref={COMLINK_BASE}
    />
  );
}
