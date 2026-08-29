import type { Metadata } from 'next';
import { CompanionReader } from '@/components/features/companion/CompanionReader';
import { CompanionWorklist } from '@/components/features/companion/CompanionWorklist';
import { getCompanionWorklist, getCompanionKarma } from '@/db/companion-prices';
import { getMe } from '@/lib/auth/me';

export const metadata: Metadata = {
  title: 'Компаньон цен · CTA',
  description: 'Пассивный сбор живых цен барахолки со скриншотов — вклад сообщества в базу CTA.',
};

const STEPS = [
  'Подключи папку скриншотов EFT (Документы → Escape from Tarkov → Screenshots) — один раз.',
  'Играй как обычно. На барахолке жми клавишу скриншота (PrintScreen).',
  'Компаньон сам распознаёт цены и предлагает отправить их в базу.',
  'За принятые предложения капает вклад — ты держишь цены CTA живыми.',
];

// Рендер в рантайме: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function CompanionPage() {
  const me = await getMe();
  const [worklist, initialKarma] = await Promise.all([
    getCompanionWorklist(30),
    me ? getCompanionKarma(me.id) : Promise.resolve(0),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary">Компаньон цен</h1>
        <p className="font-blender-book text-type-caption text-text-secondary">
          Пассивный сбор живых цен барахолки. Читаем только скриншоты, которые ты сам сделал — без
          автоматизации, без доступа к игре. BattlEye-safe. Данные идут в общую базу CTA.
        </p>
      </header>

      <CompanionReader initialKarma={initialKarma} />

      <CompanionWorklist initial={worklist} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Как это работает
          </span>
          <span className="h-px flex-1 bg-lines" />
        </div>
        <ol className="flex flex-col gap-2">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-blender-medium text-xs text-(--primary)">{String(i + 1).padStart(2, '0')}</span>
              <span className="font-blender-book text-type-caption text-text-secondary">{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
