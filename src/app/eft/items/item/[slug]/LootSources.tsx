import { PackageOpen } from 'lucide-react';
import { SectionPanel } from '@/components/ui/kit';
import { QuestCard } from './QuestCard';
import type { RewardTask } from './page';

interface LootSourcesProps {
  tasks: RewardTask[];
  itemId: string;
  itemImage?: string;
}

export function LootSources({ tasks, itemId, itemImage }: LootSourcesProps) {
  if (tasks.length === 0) return null;

  return (
    <SectionPanel title={`Откуда получить (${tasks.length})`} icon={<PackageOpen className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {tasks.map((task) => {
          const reward = (task.finishRewards?.items ?? [])
            .filter((r) => r.item?.id === itemId)
            .reduce((sum, r) => sum + (r.count ?? 0), 0);

          return (
            <QuestCard key={task.id} task={task} count={reward} countLabel="Награда" itemImage={itemImage} />
          );
        })}
      </div>
    </SectionPanel>
  );
}
