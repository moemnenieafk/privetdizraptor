import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { HubCard } from '@/components/ui/HubCard';
import { VIDEO_CATEGORIES } from '@/data/video-catalog';
import { getVideoCatalog } from '@/lib/twitch-vods';
import { VideoArchive } from '@/components/features/videos/VideoArchive';
import { VideoCardSkeleton } from '@/components/features/videos/VideoCard';

// Хаб раздела «Видео»: карточки категорий + сквозная выдача всего архива.
// ISR: страница пересобирается раз в час, каталог под ней кэширован тем же TTL.
export const revalidate = 3600;

export default async function VideosHubPage() {
  const { videos, errors } = await getVideoCatalog();

  const countBySlug = videos.reduce<Record<string, number>>((acc, v) => {
    acc[v.category] = (acc[v.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="flex w-full animate-[fade-in_0.5s_ease-out_both] flex-col items-center justify-start pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-videos" count={videos.length} />

        <div className="tactical-grid">
          {VIDEO_CATEGORIES.map((cat, index) => (
            <HubCard
              key={cat.slug}
              gameId="eft"
              id={cat.slug}
              title={cat.title}
              description={cat.description}
              href={`/eft/videos/${cat.slug}`}
              iconPath={cat.iconPath}
              badgeText={countBySlug[cat.slug] ? String(countBySlug[cat.slug]) : undefined}
              variant="rectangle"
              index={index}
            />
          ))}
        </div>

        {/* Весь архив одним потоком — «главная» видеоленты, фильтры общие */}
        <div className="mt-10">
          <Suspense fallback={<ArchiveSkeleton />}>
            <VideoArchive videos={videos} errors={errors} showContinue />
          </Suspense>
        </div>
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