// Клэй-карта в объёме: /eft/maps/<map>/3d. Веха 1 — район общаг Таможни.
// Спека: docs/decisions/3D/3d-clay-web-milestone1.md
// Геометрия лежит статикой в /public/clay/<map>/, собирается скриптом
// scripts/eft-map-layers/export-clay-web.py — БД страница не читает.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ClayMap3DLoader } from '@/components/features/maps/clay3d/ClayMap3DLoader';

interface Props {
  params: Promise<{ slug: string }>;
}

/** Пока собран один район одной карты — остальные слаги честно отдают 404. */
const READY = new Set(['customs']);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: '3D-карта — Таможня | ЦТА',
    description: `Объёмная клэй-карта локации ${slug}: этажи, лестницы, планировка.`,
  };
}

export default async function ClayMapPage({ params }: Props) {
  const { slug } = await params;
  if (!READY.has(slug)) notFound();

  return (
    <div className="flex h-[calc(100svh-var(--header-h,4rem))] flex-col">
      <div className="flex items-baseline justify-between px-6 py-4">
        <div>
          <h1 className="font-blender-medium text-xl uppercase tracking-widest">
            Таможня — объём
          </h1>
          <p className="font-blender-book text-sm text-text-muted">
            Район общаг. Этажи переключаются, верхние уровни просвечивают.
          </p>
        </div>
        <Link
          href={`/eft/maps/${slug}`}
          className="font-blender-medium text-xs uppercase tracking-widest text-text-muted hover:text-(--primary)"
        >
          ← к плоской карте
        </Link>
      </div>
      <div className="relative flex-1">
        <ClayMap3DLoader base={`/clay/${slug}`} />
      </div>
    </div>
  );
}
