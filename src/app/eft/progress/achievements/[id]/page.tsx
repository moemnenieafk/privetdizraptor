import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getEftAchievement, getEftMaps, getEftTraders } from "@/db/landing";
import { resolveAchievementHint } from "@/lib/achievement-hints";
import { AchievementDetail } from "./AchievementDetail";

// Достижения зеркалятся из tarkov.dev кроном; читаем нашу БД (рантайм без внешнего API).
export default async function AchievementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ach = await getEftAchievement(id);
  if (!ach) notFound();

  // Контекст для SMART-подсказки (наши зеркала карт/торговцев).
  const [maps, traders] = await Promise.all([getEftMaps(), getEftTraders()]);
  const hint = resolveAchievementHint(
    { id: ach.id, name: ach.name, description: ach.description },
    { maps, traders },
  );

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in-up_0.5s_ease-out_both]">
      <div className="mx-auto w-full max-w-275 px-4 xl:px-0">
        <div className="mb-6">
          <Link
            href="/eft/progress/achievements"
            className="inline-flex items-center gap-2 text-type-label uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
          >
            <ArrowLeft className="h-4 w-4" />
            Все достижения
          </Link>
        </div>

        <AchievementDetail ach={ach} hint={hint} />
      </div>
    </main>
  );
}
