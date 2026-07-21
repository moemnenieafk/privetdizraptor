import { ClipboardList } from 'lucide-react';
import { SectionRule } from '@/components/ui/SectionRule';
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
    <section className="flex flex-col gap-3.5">
      <SectionRule title="Требуется в заданиях" icon={<ClipboardList className="h-4 w-4" />} />
      <div className="grid grid-cols-1 gap-3.5">
        {tasks.map((task) => {
          // Показываем только цели по ЭТОМУ предмету: остальные цели задания
          // к карточке предмета отношения не имеют.
          const own = task.objectives.filter((o) => o.item?.id === itemId);
          const needed = own.reduce((sum, o) => sum + (o.count ?? 0), 0);

          return (
            <QuestCard
              key={task.id}
              task={task}
              count={needed}
              countLabel="Собрать"
              itemImage={itemImage}
              itemId={itemId}
              interactive
              itemShortName={own[0]?.item?.shortName}
              foundInRaid={own.some((o) => o.foundInRaid)}
            />
          );
        })}
      </div>
    </section>
  );
}
