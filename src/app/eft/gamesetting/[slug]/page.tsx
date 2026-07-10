import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';
import { getSectionHubNav } from '@/lib/section-hub-nav';
import { getCodexArticle } from '@/data/codex';
import { CodexArticle } from '@/components/features/codex/CodexArticle';

interface Props {
  params: Promise<{ slug: string }>;
}

// Ветвление Кодекса: есть статья-лор → шаблон CodexArticle; иначе — умная заглушка.
export default async function CodexSlugPage({ params }: Props) {
  const { slug } = await params;

  const article = getCodexArticle(slug);
  if (article) return <CodexArticle article={article} />;

  const data = getSectionPlaceholder(`/eft/gamesetting/${slug}`);
  if (!data) notFound();
  // Шапка-переключатель по всем разделам «Кодекса» (единый ряд, как full-навигация индексов).
  const { sections } = getSectionHubNav('/eft/gamesetting', `/eft/gamesetting/${slug}`);
  return <SectionPlaceholder {...data} tabs={sections} />;
}
