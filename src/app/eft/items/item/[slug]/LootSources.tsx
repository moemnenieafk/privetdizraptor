import Link from 'next/link';
import { PackageOpen } from 'lucide-react';
import { SectionPanel } from '@/components/ui/kit';
import { VendorImage } from './ItemImage';
import type { RewardTask } from './page';

interface LootSourcesProps {
  tasks: RewardTask[];
}

export function LootSources({ tasks }: LootSourcesProps) {
  if (tasks.length === 0) return null;

  return (
    <SectionPanel title="Откуда получить (награда за задания)" icon={<PackageOpen className="w-4 h-4" />}>
      <div className="flex flex-wrap gap-2">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href="/eft/questmap"
            className="group flex items-center gap-2.5 rounded border border-lines-hover bg-card-menu py-1.5 pl-1.5 pr-3 transition-colors hover:border-(--primary)"
            title={`${task.name} · ${task.trader.name}`}
          >
            <VendorImage
              normalizedName={task.trader.normalizedName}
              name={task.trader.name}
              className="h-8 w-8 shrink-0 rounded-full border border-lines-hover object-cover"
            />
            <div className="flex flex-col">
              <span className="font-blender-medium text-xs text-text-primary transition-colors group-hover:text-(--primary)">
                {task.name}
              </span>
              <span className="font-blender-book text-type-caption uppercase tracking-wider text-(--text-muted)">
                {task.trader.name}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </SectionPanel>
  );
}
