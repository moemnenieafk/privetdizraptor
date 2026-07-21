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
  /** Короткое имя предмета — по макету в строке цели стоит оно, а не длинный текст цели */
  itemShortName?: string;
  /** Цель требует предмет, найденный в рейде */
  foundInRaid?: boolean;
}

export function QuestCard({
  task,
  count,
  countLabel,
  itemImage,
  itemShortName,
  foundInRaid = false,
}: QuestCardProps) {
  const nn = task.trader.normalizedName;
  const traderColor = `var(${traderCssVar(nn)})`;

  return (
    <Link
      href="/eft/questmap"
      className="group relative flex flex-col gap-2.5 overflow-hidden rounded p-3.5 transition-all duration-150 hover:brightness-110"
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: traderColor,
        background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${traderColor} 12%, transparent), #000000)`,
      }}
    >
      {/* 1 — торговец · уровень · каппа */}
      <div className="flex h-7 items-center gap-2">
        <img
          src={traderImg(nn)}
          alt={task.trader.name}
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 rounded-xs border border-black/50"
        />
        <span className="min-w-0 flex-1 truncate font-blender-medium text-xs uppercase tracking-widest text-text-primary">
          {task.trader.name}
        </span>
        {(task.minPlayerLevel ?? 0) > 0 && (
          <span className="shrink-0 font-blender-medium text-xs text-text-secondary">
            ур. {task.minPlayerLevel}+
          </span>
        )}
        {task.kappaRequired && (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
            style={{ background: 'color-mix(in srgb, #bda550 10%, transparent)' }}
            title="Нужен для Каппы"
          >
            <span className="icon-bg icon-eft-profile-kappa h-4 w-4" />
          </span>
        )}
      </div>

      {/* 2 — баннер задания · название */}
      <div className="flex items-center gap-3.5">
        {task.taskImageLink && (
          <img
            src={task.taskImageLink}
            alt=""
            className="h-14 w-25 shrink-0 rounded-xs border border-black/50 object-cover"
          />
        )}
        <h3 className="m-0 min-w-0 flex-1 font-blender-medium text-base leading-tight uppercase text-text-primary transition-colors group-hover:text-(--primary)">
          {task.name}
        </h3>
      </div>

      {/* 3 — предмет: иконка · короткое имя · метка FiR · количество */}
      {count > 0 && (
        <div className="flex items-center gap-3.5">
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xs border-[0.5px] border-lines-hover bg-(--color-base)">
            {itemImage && (
              <img src={itemImage} alt="" className="absolute inset-0 h-full w-full object-contain" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-blender-book text-base leading-none text-text-primary">
              {itemShortName ?? countLabel}
            </span>
            {foundInRaid && (
              <span className="font-blender-medium text-[10px] leading-none tracking-[4px] text-tactical-amber">
                найдено в рейде
              </span>
            )}
          </span>
          <span className="shrink-0 font-blender-book text-base leading-none text-text-primary">
            0/{count}
          </span>
        </div>
      )}

      {/* 4 — отметка выполнения */}
      <div className="flex h-7 items-center gap-2.5">
        <span
          className="flex h-7 min-w-0 flex-1 items-center rounded-xs px-2.5 font-blender-medium text-sm text-tactical-amber"
          style={{ background: 'color-mix(in srgb, var(--color-tactical-amber) 10%, transparent)' }}
        >
          Выполнено?
        </span>
        <span className="h-7 w-7 shrink-0 rounded-sm border border-lines-hover" />
      </div>
    </Link>
  );
}
