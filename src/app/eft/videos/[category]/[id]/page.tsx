import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SectionHubNav } from '@/components/features/navigation/SectionHubNav';
import { CATEGORY_BY_SLUG, isVideoCategory } from '@/data/video-catalog';
import { getRelatedVideos, getVideoById } from '@/lib/twitch-vods';
import { VideoPlayer } from '@/components/features/videos/VideoPlayer';
import { VideoCard } from '@/components/features/videos/VideoCard';

export const revalidate = 3600;

interface Props {
  params: Promise<{ category: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideoById(id);
  if (!video) return {};
  return {
    title: `${video.title} | ЦТА`,
    description: video.description.slice(0, 160),
    openGraph: { images: [video.thumbnail] },
  };
}

export default async function VideoPage({ params }: Props) {
  const { category, id } = await params;
  if (!isVideoCategory(category)) notFound();

  const video = await getVideoById(id);
  if (!video) notFound();

  const related = await getRelatedVideos(video);
  const meta = CATEGORY_BY_SLUG[category];

  return (
    <main className="flex w-full animate-[fade-in_0.5s_ease-out_both] flex-col items-center justify-start pb-14">
      <SectionHubNav rootPath="/eft/videos" variant="bar" sectionsLabel="Видео" />

      <div className="mt-7 flex w-full max-w-275 flex-col gap-10 px-4 xl:px-0">
        {/* Плеер + главы + действия. На мобиле — единая вертикаль, без сайдбара. */}
        <VideoPlayer video={video} />

        {/* Описание: свёрнуто в details — progressive disclosure вместо простыни */}
        {video.description.trim() && (
          <details className="group rounded-sm border border-lines-hover bg-card-menu">
            <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors duration-200 hover:text-(--primary)">
              Описание
              <span className="ml-auto text-text-muted transition-transform duration-200 group-open:rotate-180">
                ▾
              </span>
            </summary>
            <p className="whitespace-pre-line px-3 pb-3 font-blender-book text-sm leading-relaxed text-text-secondary">
              {video.description}
            </p>
          </details>
        )}

        {/* Похожие: та же категория, максимум общих фасетов (карта/тема) */}
        {related.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                Ещё в разделе «{meta.title}»
              </span>
              <div className="h-px flex-1 bg-lines-hover" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((v, i) => (
                <VideoCard key={v.id} video={v} view="grid" index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}