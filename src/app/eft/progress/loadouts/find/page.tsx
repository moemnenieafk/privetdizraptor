import { notFound } from 'next/navigation';
import { getGunsmithList } from '@/db/gunsmith-list';
import { getPresetList } from '@/db/preset-list';
import { FindLoadoutsClient } from '@/components/features/loadouts/FindLoadoutsClient';
import { requireTier, serverEntitlementsSnapshot } from '@/lib/gating/resolve';
import { SectionPaywall } from '@/components/features/subscription/SectionPaywall';

// Каталог сборок. Четыре источника, четыре вкладки:
//   Оружейник  — 30 квестовых спек с порогами (наш козырь: конкуренты дают либо
//                билдер, либо трекер квестов, но не связку)
//   Пресеты    — 463 готовых пресета игры с ОТРЕНДЕРЕННЫМИ картинками
//   Мета       — считается солвером, не парсится с тир-листов (те противоречат
//                друг другу и протухают каждый патч)
//   Сообщество — weapon_builds.is_public
//
// Данные тянет сервер и отдаёт клиенту целиком: 30 + 463 записи это меньше 100 КБ,
// а взамен получаем мгновенные фильтры и поиск без единого запроса.
//
// revalidate НЕ ставим: серверный гейт раздела (requireTier) читает cookies/сессию →
// ответ user-специфичен, статический revalidate вводил бы в заблуждение (кэша ответа нет).
// Данные раздела (gunsmith/preset) сами кешируются в своём слое (getGunsmithList/getPresetList).

// Рендер в рантайме: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function FindLoadoutsPage() {
  // Серверный гейт раздела (демо, R09i). Пока free — ok=true, ниже обычный контент.
  const gate = await requireTier('sec:eft:/eft/progress/loadouts/find', { game: 'eft' });
  if (!gate.ok) {
    if (gate.behavior === 'hide') notFound();
    const { tiers } = await serverEntitlementsSnapshot('eft');
    return <SectionPaywall need={gate.need} needTier={tiers.find((t) => t.slug === gate.need)} />;
  }

  const [gunsmith, presets] = await Promise.all([getGunsmithList(), getPresetList()]);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">

        <FindLoadoutsClient gunsmith={gunsmith} presets={presets} />
      </div>
    </main>
  );
}
