import { notFound } from 'next/navigation';
import { getBuildContext, getWeaponBaseList } from '@/db/weapons';
import { BaseSelector } from '@/components/features/loadouts/BaseSelector';
import { WeaponBuilder } from '@/components/features/loadouts/WeaponBuilder';
import type { BuildItemDef } from '@/lib/weapon-build';

// Конструктор сборок. Один маршрут, два состояния — рулит ?base=<itemId>:
//   без base → выбор ствола (168 баз)
//   с base   → конструктор (дерево слотов + статы + пикер)
//
// Почему searchParam, а не отдельный роут: контекст сборки (индекс допустимых модулей)
// тяжёлый и зависит ТОЛЬКО от базы — пусть его считает сервер на RSC, а не клиент
// через API. Смена ствола = навигация, кэш Next делает остальное.
//
// BuildItemIndex — это Map, через RSC-границу не сериализуется. Поэтому в клиент
// уезжает МАССИВ определений, а Map собирается там в useMemo.

interface Props {
  searchParams: Promise<{ base?: string }>;
}

export const revalidate = 86400; // сутки: оружейный слой меняется только синком

export default async function AddLoadoutPage({ searchParams }: Props) {
  const { base } = await searchParams;

  if (!base) {
    const bases = await getWeaponBaseList();
    return (
      <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
        <div className="w-full max-w-275 px-4 xl:px-0">
          <header className="mb-8">
            <div className="mb-2 flex items-center gap-3">
              <i className="icon-eft-prog-gun-loadouts text-3xl text-(--primary)" aria-hidden="true" />
              <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
                Создать сборку
              </h1>
            </div>
            <p className="max-w-xl font-blender-book text-sm text-text-secondary">
              Выберите ствол — дальше конструктор сам покажет, что в него влезает,
              и пересчитает эргономику, отдачу и цену.
            </p>
          </header>

          <BaseSelector bases={bases} />
        </div>
      </main>
    );
  }

  const ctx = await getBuildContext(base);
  if (!ctx) notFound();

  // Map → массив: через RSC-границу Map не переживает сериализацию.
  const defs: BuildItemDef[] = [...ctx.index.values()];

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <WeaponBuilder
          baseItemId={ctx.base.id}
          baseName={ctx.base.name}
          defs={defs}
          presets={ctx.presets}
          names={ctx.names}
        />
      </div>
    </main>
  );
}