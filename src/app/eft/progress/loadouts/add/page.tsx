import { notFound } from 'next/navigation';
import { getBuildContext, getWeaponBaseList } from '@/db/weapons';
import { getBuildPriceMap } from '@/db/build-prices';
import { BaseSelector } from '@/components/features/loadouts/BaseSelector';
import { WeaponBuilder } from '@/components/features/loadouts/WeaponBuilder';
import type { BuildItemDef } from '@/lib/weapon-build';
import type { BuildPrice } from '@/lib/build-price';

// Конструктор сборок. Один маршрут, два состояния — рулит ?base=<itemId>:
//   без base → выбор ствола (168 баз)
//   с base   → конструктор (дерево слотов + статы + уклон + цена + пикер)
//
// Почему searchParam, а не отдельный роут: контекст сборки (индекс допустимых модулей)
// тяжёлый и зависит ТОЛЬКО от базы — пусть его считает сервер на RSC, а не клиент
// через API. Смена ствола = навигация, кэш Next делает остальное.
//
// Цены тянем сразу на весь индекс: иначе клиент дёргал бы API на каждую установку
// модуля, а цена сборки должна пересчитываться мгновенно.
//
// BuildItemIndex — это Map, через RSC-границу не сериализуется. Поэтому в клиент
// уезжает МАССИВ определений, а Map собирается там в useMemo.

interface Props {
  searchParams: Promise<{ base?: string }>;
}

export const revalidate = 3600; // час: оружейный слой статичен, но цены живут своей жизнью

export default async function AddLoadoutPage({ searchParams }: Props) {
  const { base } = await searchParams;

  if (!base) {
    const bases = await getWeaponBaseList();
    return (
      <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
        <div className="w-full max-w-275 px-4 xl:px-0">

          <BaseSelector bases={bases} />
        </div>
      </main>
    );
  }

  const ctx = await getBuildContext(base);
  if (!ctx) notFound();

  const priceMap = await getBuildPriceMap([...ctx.index.keys()]);

  // Map → массив/объект: через RSC-границу Map не переживает сериализацию.
  const defs: BuildItemDef[] = [...ctx.index.values()];
  const prices: Record<string, BuildPrice> = Object.fromEntries(priceMap);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <WeaponBuilder
          baseItemId={ctx.base.id}
          baseName={ctx.base.name}
          defs={defs}
          presets={ctx.presets}
          names={ctx.names}
          prices={prices}
        />
      </div>
    </main>
  );
}
