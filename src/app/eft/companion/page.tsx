import type { Metadata } from 'next';
import Link from 'next/link';
import { CompanionReader } from '@/components/features/companion/CompanionReader';
import { getCompanionWorklist } from '@/db/companion-prices';

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

export default async function CompanionPage() {
  const worklist = await getCompanionWorklist(30);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary">Компаньон цен</h1>
        <p className="font-blender-book text-type-caption text-text-secondary">
          Пассивный сбор живых цен барахолки. Читаем только скриншоты, которые ты сам сделал — без
          автоматизации, без доступа к игре. BattlEye-safe. Данные идут в общую базу CTA.
        </p>
      </header>

      <CompanionReader />

      {worklist.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              Цены, которые стоит обновить
            </span>
            <span className="h-px flex-1 bg-lines" />
          </div>
          <ul className="flex flex-col divide-y divide-lines overflow-hidden rounded-sm border border-lines">
            {worklist.map((w) => (
              <li key={w.inGameId}>
                <Link
                  href={`/eft/items/item/${w.slug}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-(--color-base)/60"
                >
                  <span className="truncate font-blender-book text-type-caption text-text-secondary">{w.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                      {w.status === 'no-data' ? 'нет данных' : 'устарело'}
                    </span>
                    <span className="font-blender-medium text-xs text-text-secondary">
                      ~{w.value.toLocaleString('ru-RU')} ₽
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
