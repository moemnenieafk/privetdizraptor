import { memo, forwardRef } from "react";
import Image from "next/image";
import { TarkovItem } from "@/types/tarkov-items";
import { Badge, getArmorClassColor } from "@/components/features/items/Badge";
import { getTarkovBackgroundColor } from "@/lib/tarkov-colors";
import { formatCompactNumber } from "@/lib/formatters";

interface ItemTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  item: TarkovItem & {
    eco?: {
      bestSell: { price: number; vendor?: { name: string; normalizedName?: string } };
      bestBuy?: { vendor?: { name: string; normalizedName?: string } };
      minPrice: number;
      vps: number;
    };
  };
}

const CATEGORY_MAP: Record<string, string> = {
  armor: "Броня",
  weapon: "Оружие",
  ammo: "Патроны",
  meds: "Медицина",
  container: "Контейнер",
  headset: "Гарнитура",
  common: "Предмет",
};

export const ItemTableRow = memo(forwardRef<HTMLTableRowElement, ItemTableRowProps>(function ItemTableRow({ item, ...props }, ref) {
  const effectivePrice = item.fleaPrice ?? 0;
  const buyPrice = item.eco?.minPrice ?? effectivePrice;
  const sellPrice = item.eco?.bestSell?.price ?? 0;
  const profitPerSlot = item.eco?.vps ?? Math.round(effectivePrice / ((item.gridWidth || 1) * (item.gridHeight || 1)));

  return (
    <tr ref={ref} {...props} className="group border-b border-lines-hover transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--color-card-menu)_30%,transparent)]">
      {/* Иконка и Название */}
      <td className="p-3">
        <div className="flex items-center gap-3">
          <div 
            className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-lines-hover transition-colors duration-300 group-hover:border-(--primary)"
            style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
          >
            <Image
              src={item.iconLink}
              alt={item.shortName}
              fill
              sizes="48px"
              className="object-contain p-1"
              loading="lazy"
            />
          </div>
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-[16px] font-blender-medium uppercase tracking-widest text-text-primary" title={item.name}>
              {item.shortName}
            </h3>
            <span className="truncate text-xs text-text-secondary font-blender-book" title={item.name}>
              {item.name}
            </span>
          </div>
        </div>
      </td>

      {/* Категория */}
      <td className="p-3 hidden md:table-cell">
        <span className="rounded border border-lines-hover bg-(--color-base) px-2 py-1 font-mono text-[10px] uppercase text-text-muted">
          {CATEGORY_MAP[item.category] || item.category}
        </span>
      </td>

      {/* Метрики (Открытые и Скрытые) */}
      <td className="p-3 hidden xl:table-cell">
        <div className="flex flex-wrap items-center gap-2">
          <ItemMetrics item={item} />
        </div>
      </td>

      {/* Покупка */}
      <td className="p-3 text-right">
        <span className="whitespace-nowrap font-mono text-xs text-text-primary">
          {buyPrice > 0 ? (
            <span title={`${buyPrice.toLocaleString("ru-RU")} ₽`} className="cursor-help border-b border-dotted border-text-muted/50">
              {formatCompactNumber(buyPrice)} ₽
            </span>
          ) : (
            <span className="text-text-muted">N/A</span>
          )}
        </span>
      </td>

      {/* Продажа */}
      <td className="p-3 text-right">
        <span className="whitespace-nowrap font-mono text-xs text-nvg-green">
          {sellPrice > 0 ? (
            <span title={`${sellPrice.toLocaleString("ru-RU")} ₽`} className="cursor-help border-b border-dotted border-nvg-green/30">
              {formatCompactNumber(sellPrice)} ₽
            </span>
          ) : (
            <span className="text-text-muted">N/A</span>
          )}
        </span>
      </td>

      {/* Выгода / Слот */}
      <td className="p-3 text-right">
        <span className="whitespace-nowrap font-mono text-xs text-text-primary transition-colors group-hover:text-(--primary)">
          {profitPerSlot > 0 ? (
            <span title={`${profitPerSlot.toLocaleString("ru-RU")} ₽`} className="cursor-help border-b border-dotted border-text-muted/50">
              {formatCompactNumber(profitPerSlot)} ₽
            </span>
          ) : (
            "N/A"
          )}
        </span>
      </td>
    </tr>
  );
}));

const ItemMetrics = ({ item }: { item: TarkovItem }) => {
  switch (item.category) {
    case "armor":
      return (
        <>
          <Badge 
            color={getArmorClassColor(item.armorClass!)} 
            label={`Класс ${item.armorClass}`} 
            iconClass={`icon-eft-armor-class-${item.armorClass}`} 
            iconSizeClass="w-5.5 h-5.5" 
          />
          <Badge color="gray" label={`Прочн: ${item.durability}/${item.maxDurability}`} title="Максимальная прочность" />
          {item.effectiveDurability && <Badge color="gray" label={`Эфф: ${item.effectiveDurability}`} title="Эффективная прочность" />}
          {item.repairability && <Badge color="gray" label={`Ремонт: ${item.repairability}`} title="Ремонтопригодность" />}
          {item.weight && <Badge color="gray" label={`${item.weight} кг`} title="Вес" />}
          {(item.speedPenalty && item.speedPenalty > 0) ? <Badge color="red" label={`Скор: -${item.speedPenalty}%`} title="Штраф скорости (Движение)" /> : null}
          {(item.turnPenalty && item.turnPenalty > 0) ? <Badge color="red" label={`Повор: -${item.turnPenalty}%`} title="Штраф поворота" /> : null}
          {(item.ergoPenalty && item.ergoPenalty > 0) ? <Badge color="red" label={`Эрго: -${item.ergoPenalty}`} title="Штраф эргономики" /> : null}
        </>
      );
    case "ammo": {
      const isFragBlocked = item.penetrationPower < 20;
      return (
        <>
          <Badge color="emerald" label={`Пробитие: ${item.penetrationPower}`} title="Бронепробиваемость" />
          <Badge color="red" label={`Урон: ${item.damage}`} title="Урон по телу" />
          <Badge 
            color={isFragBlocked ? "gray" : "amber"} 
            label={`Фрагм: ${isFragBlocked ? "Блок." : item.fragmentationChance + "%"}`} 
            title={isFragBlocked ? "Фрагментация невозможна из-за пробития < 20" : "Шанс фрагментации"} 
            isStrike={isFragBlocked}
          />
        </>
      );
    }
    case "weapon": {
      const controlIndex = Math.round(
        (item.convergence * 100) / ((item.verticalRecoil + item.horizontalRecoil) * 0.1 + item.recoilDispersion * 0.05)
      );
      return (
        <>
          <Badge color="gray" label={`Эрго: ${item.ergonomics}`} />
          <Badge color="gray" label={`Отдача: ${item.verticalRecoil}/${item.horizontalRecoil}`} />
          <Badge color="amber" label={`Индекс контроля: ${controlIndex}`} title={`Скрытые параметры: Конвергенция (${item.convergence}) / Дисперсия (${item.recoilDispersion})`} />
        </>
      );
    }
    case "headset":
      return (
        <>
          <Badge color="emerald" label={`Слух: +${Math.round((item.distanceModifier - 1) * 100)}%`} title="Множитель дистанции слуха" />
          <Badge color="gray" label={`Шум: ${item.ambientVolume}`} title="Громкость окружения (ветра/дождя)" />
        </>
      );
    default:
      return <span className="text-xs text-text-muted">—</span>;
  }
};