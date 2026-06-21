import { ClipboardList } from 'lucide-react';
import { SectionPanel } from '@/components/ui/kit';
import { QuestCard } from './QuestCard';
import type { UsedInTask } from './page';

interface ItemQuestBlockProps {
  tasks: UsedInTask[];
  itemId: string;
  itemImage?: string;
}

export function ItemQuestBlock({ tasks, itemId, itemImage }: ItemQuestBlockProps) {
  if (tasks.length === 0) return null;

  return (
    <SectionPanel title={`Нужен в квестах (${tasks.length})`} icon={<ClipboardList className="w-4 h-4" />} noDivider smallTitle bare>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {tasks.map((task) => {
          const needed = task.objectives
            .filter((o) => o.item?.id === itemId)
            .reduce((sum, o) => sum + (o.count ?? 0), 0);

          return (
            <QuestCard key={task.id} task={task} count={needed} countLabel="Собрать" itemImage={itemImage} />
          );
        })}
      </div>
    </SectionPanel>
  );
}
