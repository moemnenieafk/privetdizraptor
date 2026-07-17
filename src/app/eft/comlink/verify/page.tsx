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
        <header className="mb-8">
          <h1 className="mb-2 font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
            Подтверждение профилей
          </h1>
          <p className="max-w-xl font-blender-book text-sm text-text-secondary">
            Сверь ник на скриншоте с заявленным и убедись, что выданный код виден в кадре
            (защита от чужих/старых скринов). Подтверждение ставит игроку галочку в анкете.
          </p>
        </header>

        <VerificationQueueClient />
      </div>
    </main>
  );
}
