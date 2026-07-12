import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';
import { CATEGORY_BY_SLUG, VIDEO_CATEGORIES, isVideoCategory } from '@/data/video-catalog';
import { getVideoCatalog } from '@/lib/twitch-vods';
import { VideoArchive } from '@/components/features/videos/VideoArchive';
import { VideoCardSkeleton } from '@/components/features/videos/VideoCard';

export const revalidate = 3600;

interface Props {
  params: Promise<{ category: string }>;
}

// Категории известны из каталога — пререндерим все 4 на билде.
export function generateStaticParams() {
  return VIDEO_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!isVideoCategory(category)) return {};
  const meta = CATEGORY_BY_SLUG[category];
  return { title: `${meta.title} — Видео | ЦТА`, description: meta.description };
}

export default async function VideoCategoryPage({ params }: Props) {
  const { category } = await params;
  if (!isVideoCategory(category)) notFound();

  const meta = CATEGORY_BY_SLUG[category];
  const { videos, errors } = await getVideoCatalog();
  const scoped = videos.filter((v) => v.category === category);

  return (
    <main className="flex w-full animate-[fade-in_0.5s_ease-out_both] flex-col items-center justify-start pb-14">
      {/* Навигация 1:1 как в «Заданиях»: ряд разделов из HEADER_DICTIONARY */}
      <SectionHubNav rootPath="/eft/videos" variant="bar" sectionsLabel="Видео" />

      <div className="mt-7 w-full max-w-275 px-4 xl:px-0">
        <PageHeader
          title={meta.title}
          description={meta.description}
          iconClass="icon-eft-videos"
          count={scoped.length}
        />

        <Suspense fallback={<ArchiveSkeleton />}>
          <VideoArchive videos={scoped} errors={errors} showContinue />
        </Suspense>
      </div>
    </main>
  );
}

function ArchiveSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}