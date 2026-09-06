import Link from "next/link";
import { isPricingPublished } from "@/lib/gating/showcase";

/**
 * Ссылка «Тарифы» в футере. Отдельный серверный компонент, а не проп из корневого layout:
 *
 * ⚠️ ГОЧА. Попытка сделать RootLayout асинхронным и прочитать флаг прямо в его теле ломает
 * пререндер (падало на /eft/quests/side-quests: «Element type is invalid … got: null»).
 * Ожидание в корневом layout затрагивает КАЖДУЮ страницу портала, поэтому чтение вынесено
 * сюда и оборачивается <Suspense fallback={null}> на месте вызова — шелл рендерится сразу,
 * ссылка подтягивается отдельно.
 *
 * Почему не useEntitlements(): футер живёт СНАРУЖИ <GatingBoundary> (тот оборачивает только
 * children), контекст гейтинга сюда не дотягивается.
 *
 * Пока витрина не опубликована — не рендерим ничего: ссылка вела бы в 404.
 */
export async function PricingFooterLink() {
  if (!(await isPricingPublished())) return null;

  return (
    <Link
      href="/pricing"
      className="font-blender-medium text-type-micro uppercase tracking-[0.1em] whitespace-nowrap text-text-secondary transition-none hover:text-(--primary)"
    >
      Тарифы
    </Link>
  );
}
