'use client';

// Гайд + инлайн-CMS поверх него. Кнопку «Править» рендерим, только если СЕРВЕР
// передал canEdit — клиент роль не проверяет.
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { StoryWalkthroughView } from '@/components/features/quests/StoryWalkthrough';
import { StoryEditor } from '@/components/features/quests/StoryEditor';
import type { StoryWalkthrough } from '@/data/story-walkthroughs/types';

interface Props {
  story: StoryWalkthrough;
  priceByItemId: Record<string, number | null>;
  published: boolean;
  fromStatic: boolean;
  canEdit: boolean;
}

export function StoryWalkthroughEditable({
  story,
  priceByItemId,
  published,
  fromStatic,
  canEdit,
}: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <StoryEditor
        story={story}
        published={published}
        fromStatic={fromStatic}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      {canEdit && (
        <div className="mb-4 flex items-center justify-end gap-3">
          {!published && (
            <span className="rounded-xs border border-tactical-amber/50 bg-tactical-amber/10 px-2 py-1 font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber">
              Черновик
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Править гайд
          </button>
        </div>
      )}

      <StoryWalkthroughView story={story} priceByItemId={priceByItemId} />
    </>
  );
}
