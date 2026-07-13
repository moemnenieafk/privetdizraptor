import { getGunsmithList } from '@/db/gunsmith-list';
import { getPresetList } from '@/db/preset-list';
import { FindLoadoutsClient } from '@/components/features/loadouts/FindLoadoutsClient';

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

export const revalidate = 86400; // сутки: меняется только синком

export default async function FindLoadoutsPage() {
  const [gunsmith, presets] = await Promise.all([getGunsmithList(), getPresetList()]);

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <i
              className="icon-eft-prog-find-loadout text-3xl text-(--primary)"
              aria-hidden="true"
            />
            <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
              Найти сборку
            </h1>
          </div>
          <p className="max-w-xl font-blender-book text-sm text-text-secondary">
            Сборки под квесты «Оружейник», готовые пресеты из игры и мета текущего патча.
            Любую можно открыть в конструкторе и доработать под себя.
          </p>
        </header>

        <FindLoadoutsClient gunsmith={gunsmith} presets={presets} />
      </div>
    </main>
  );
}