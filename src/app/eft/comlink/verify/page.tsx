import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMe } from "@/lib/auth/me";
import { canModerate } from "@/lib/auth/roles";
import { VerificationQueueClient } from "@/components/features/comlink/VerificationQueueClient";

// Очередь заявок на подтверждение ЧВК-профиля. Не в меню: страница для своих
// (ты, Дима, модераторы). Для всех остальных — 404, чтобы факт её существования
// не светился (паттерн /eft/comlink/reports).

export const metadata: Metadata = {
  title: "Подтверждение профилей · Связь · ЦТА",
  robots: { index: false, follow: false },
};

export default async function VerifyQueuePage() {
  const me = await getMe();
  if (!me || !canModerate(me.role)) notFound();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <VerificationQueueClient />
      </div>
    </main>
  );
}
