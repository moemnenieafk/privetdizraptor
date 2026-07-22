import { PackageOpen } from 'lucide-react';
import { SectionRule } from '@/components/ui/SectionRule';
import { QuestCard } from './QuestCard';
import type { RewardTask } from './page';

interface LootSourcesProps {
  tasks: RewardTask[];
  itemId: string;
  itemImage?: string;
  /** Имя награды = сам просматриваемый предмет (в строке цели пишем его, а не «Награда»). */
  itemName?: string;
  itemBackground?: string;
}

export function LootSources({ tasks, itemId, itemImage, itemName, itemBackground }: LootSourcesProps) {
  if (tasks.length === 0) return null;

  return (
    <section className="flex flex-col gap-3.5">
      <SectionRule title="Вознаграждения в заданиях" icon={<PackageOpen className="h-4 w-4" />} />
      <div className="grid grid-cols-1 gap-3.5">
        {tasks.map((task) => {
          const reward = (task.finishRewards?.items ?? [])
            .filter((r) => r.item?.id === itemId)
            .reduce((sum, r) => sum + (r.count ?? 0), 0);

          return (
            <QuestCard key={task.id} task={task} count={reward} countLabel="Награда" itemShortName={itemName} itemImage={itemImage} itemBackground={itemBackground} />
          );
        })}
      </div>
    </section>
  );
}
