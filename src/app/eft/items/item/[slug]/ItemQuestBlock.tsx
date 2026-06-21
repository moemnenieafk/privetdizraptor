"use client";

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { SectionPanel } from '@/components/ui/kit';
import { useQuestStore } from '@/store/useQuestStore';
import { VendorImage } from './ItemImage';
import type { UsedInTask } from './page';

interface ItemQuestBlockProps {
  tasks: UsedInTask[];
  itemId: string;
}

export function ItemQuestBlock({ tasks, itemId }: ItemQuestBlockProps) {
  const completedQuests = useQuestStore((s) => s.completedQuests);

  const relevant = tasks.map((task) => {
    const needed = task.objectives
      .filter((o) => o.item?.id === itemId)
      .reduce((sum, o) => sum + (o.count ?? 0), 0);
    return { task, needed };
  });

  if (relevant.length === 0) return null;

  return (
    <SectionPanel title={`Нужен в квестах (${relevant.length})`} icon={<ClipboardList className="w-4 h-4" />}>
      <div className="flex flex-col gap-2">
        {relevant.map(({ task, needed }) => {
          const isDone = completedQuests.includes(task.id);
          return (
            <Link
              key={task.id}
              href="/eft/questmap"
              className="group flex items-center justify-between gap-3 rounded border border-lines-hover bg-card-menu p-3 transition-colors hover:border-(--primary)"
            >
              <div className="flex items-center gap-3 min-w-0">
                <VendorImage
                  normalizedName={task.trader.normalizedName}
                  name={task.trader.name}
                  className="h-9 w-9 shrink-0 rounded-full border border-lines-hover object-cover"
                />
                <div className="flex flex-col min-w-0">
                  <span
                    className={`truncate font-blender-medium text-sm leading-tight transition-colors group-hover:text-(--primary) ${
                      isDone ? 'text-(--text-muted) line-through' : 'text-text-primary'
                    }`}
                    title={task.name}
                  >
                    {task.name}
                  </span>
                  <span className="font-blender-book text-type-caption uppercase tracking-wider text-(--text-muted)">
                    {task.trader.name}
                  </span>
                </div>
              </div>

              {needed > 0 && (
                <span className="shrink-0 rounded border border-(--primary) bg-primary/10 px-2 py-0.5 font-blender-medium text-xs text-(--primary)">
                  ×{needed}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </SectionPanel>
  );
}
