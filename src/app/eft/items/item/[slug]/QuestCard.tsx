import Link from 'next/link';
import { traderImg, traderCssVar } from '@/lib/trader-utils';

export interface QuestCardData {
  id: string;
  name: string;
  taskImageLink?: string;
  trader: { name: string; normalizedName: string };
  minPlayerLevel?: number;
  kappaRequired?: boolean;
}

interface QuestCardProps {
  task: QuestCardData;
  /** Кол-во (нужно собрать / награда) */
  count: number;
  /** Подпись к количеству: «Собрать» | «Награда» */
  countLabel: string;
  /** Миниатюра предмета для строки count */
  itemImage?: string;
}

export function QuestCard({ task, count, countLabel, itemImage }: QuestCardProps) {
  const nn = task.trader.normalizedName;
  const traderColor = `var(${traderCssVar(nn)})`;

  return (
    <Link
      href="/eft/questmap"
      className="group relative overflow-hidden rounded-lg p-3 transition-all duration-150 hover:brightness-110"
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: traderColor,
        boxShadow: `0 0 12px color-mix(in srgb, ${traderColor} 25%, transparent)`,
        background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 12%, transparent), #000000)`,
      }}
    >
      <div className="relative z-10 flex gap-3">
        {/* Картинка квеста */}
        {task.taskImageLink && (
          <img
            src={task.taskImageLink}
            alt={task.name}
            className="h-14 w-14 shrink-0 rounded border border-lines-hover object-cover"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Шапка: торговец · уровень · каппа */}
          <div className="flex items-center gap-1.5">
            <img src={traderImg(nn)} alt={task.trader.name} width={18} height={18} className="shrink-0 rounded-xs" />
            <span className="truncate font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
              {task.trader.name}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {(task.minPlayerLevel ?? 0) > 0 && (
                <span className="font-blender-medium text-xs text-text-secondary">УР. {task.minPlayerLevel}+</span>
              )}
              {task.kappaRequired && (
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-xs"
                  style={{ background: 'color-mix(in srgb, var(--color-nvg-green) 10%, transparent)' }}
                  title="Нужен для Каппы"
                >
                  <span className="icon-bg icon-eft-profile-kappa h-3.5 w-3.5" />
                </span>
              )}
            </div>
          </div>

          {/* Название квеста */}
          <h3 className="font-blender-medium text-sm leading-tight text-text-primary line-clamp-2 transition-colors group-hover:text-(--primary)">
            {task.name}
          </h3>

          {/* Количество */}
          {count > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-xs border border-lines-hover bg-(--color-base)">
                {itemImage && (
                  <img src={itemImage} alt="" className="absolute inset-0 h-full w-full object-contain p-0.5" />
                )}
              </div>
              <span className="font-blender-medium text-xs text-text-secondary">
                {countLabel} ×{count}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
