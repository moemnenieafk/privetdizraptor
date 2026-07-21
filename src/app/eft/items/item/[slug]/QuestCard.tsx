"use client";

import Link from 'next/link';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useQuestReserveStore, freeForQuest } from '@/store/useQuestReserveStore';

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
  /** id предмета — по нему берётся счётчик схрона и резерв под задание */
  itemId?: string;
  /** Можно ли закреплять предмет за заданием. Для наград — нет, там нечего резервировать. */
  interactive?: boolean;
}

export function QuestCard({
  task,
  count,
  countLabel,
  itemImage,
  itemShortName,
  foundInRaid = false,
  itemId,
  interactive = false,
}: QuestCardProps) {
  const nn = task.trader.normalizedName;
  const traderColor = `var(${traderCssVar(nn)})`;

  // Прогресс берём из счётчика «В схроне» — того же, что стоит в шапке карточки
  // предмета. Примитив в селекторе, а не объект: в Zustand v5 объект из селектора
  // даёт бесконечный ре-рендер.
  const owned = useInventoryStore((s) => (itemId ? (s.ownedItems[itemId] ?? 0) : 0));
  const reservedHere = useQuestReserveStore((s) => (itemId ? (s.reserved[task.id]?.[itemId] ?? 0) : 0));
  const totalReserved = useQuestReserveStore((s) => {
    if (!itemId) return 0;
    let total = 0;
    for (const perItem of Object.values(s.reserved)) total += perItem[itemId] ?? 0;
    return total;
  });
  const setReserved = useQuestReserveStore((s) => s.setReserved);

  const free = freeForQuest(owned, totalReserved, reservedHere);
  const done = count > 0 && reservedHere >= count;

  // Клик закрепляет за заданием столько, сколько свободно, но не больше нужного.
  // Повторный клик по закрытой цели снимает резерв — иначе его нечем отменить.
  const toggleReserve = () => {
    if (!itemId || !interactive) return;
    setReserved(task.id, itemId, done ? 0 : Math.min(count, free));
  };

  return (
    <article
      className="group relative flex flex-col gap-2.5 overflow-hidden rounded p-3.5 transition-all duration-150"
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

      {/* 2 — баннер задания · название. Ссылка только здесь: клик по строке
          предмета закрепляет его за заданием и уводить со страницы не должен. */}
      <Link href="/eft/questmap" className="flex items-center gap-3.5 hover:brightness-110">
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
      </Link>

      {/* 3 — предмет: иконка · короткое имя · метка FiR · количество */}
      {count > 0 && (
        <button
          type="button"
          onClick={toggleReserve}
          disabled={!interactive || (!done && free === 0)}
          title={
            !interactive
              ? undefined
              : done
                ? 'Снять с задания'
                : free === 0
                  ? 'В схроне нет свободных — они закреплены за другими заданиями'
                  : 'Закрепить за этим заданием'
          }
          className="flex w-full items-center gap-3.5 rounded-xs text-left transition-colors enabled:hover:bg-white/4 disabled:cursor-default"
        >
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
          <span
            className={`shrink-0 font-blender-book text-base leading-none ${done ? 'text-nvg-green' : 'text-text-primary'}`}
          >
            {reservedHere}/{count}
          </span>
        </button>
      )}

    </article>
  );
}
