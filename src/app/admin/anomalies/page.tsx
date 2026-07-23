// Очередь аномалий companion-цен на ревью (admin/moderator). Companion — внутренний
// источник: цены со слишком большим отклонением от tarkov.dev идут сюда, не игроку.
import { notFound } from "next/navigation";
import { getCmsUser } from "@/lib/auth/admin";
import { canModerate } from "@/lib/auth/roles";
import { getPendingAnomalies } from "@/db/companion-anomalies";
import { AnomalyQueueClient } from "@/components/features/companion/AnomalyQueueClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Аномалии цен | Модерация ЦТА" };

export default async function AdminAnomaliesPage() {
  const user = await getCmsUser();
  if (!user || !canModerate(user.role)) notFound();

  const items = await getPendingAnomalies();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary">Аномалии цен</h1>
      <p className="mt-2 font-blender-book text-sm text-text-secondary">
        Companion-цены с отклонением от tarkov.dev сверх порога (&gt;40% или &gt;100К ₽). Принять — сделать
        источником правды; отклонить — сбросить; бан — zero-tolerance к скаму/автоматике.
      </p>
      <AnomalyQueueClient initial={items} />
    </main>
  );
}
