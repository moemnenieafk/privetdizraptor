'use client';

// Дерево слотов сборки. Рекурсия: слот базы → поставленный модуль → его слоты
// (планка → крышка → прицел). Вложенность рисуется отступом и линией слева.
//
// Пустой слот показывает иконку своей категории (дуло, магазин, прицел…), а не
// серый квадрат — как в игре. См. lib/slot-icons.
//
// Компонент «глупый»: в стор не пишет, только сообщает наверх «открой слот X по пути Y».
// Всё изменение состояния — в WeaponBuilder.
import { ChevronRight, Plus } from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import { slotIconClass } from '@/lib/slot-icons';
import type { BuildItemIndex, BuildNode, WeaponSlotDef } from '@/lib/weapon-build';
import type { OpenSlotTarget } from '@/components/features/loadouts/WeaponBuilder';

interface BuildCanvasProps {
  /** Узел, чьи слоты рисуем (корень = сама сборка). */
  node: BuildNode;
  index: BuildItemIndex;
  /** Путь до этого узла: цепочка slotNameId от корня. */
  path: string[];
  nameOf: (itemId: string) => string;
  onOpenSlot: (target: OpenSlotTarget) => void;
  /** Глубина вложенности — для отступа. */
  depth?: number;
}

/** Слоты узла: у оружия и у модуля они лежат в разных местах union'а. */
function slotsOf(node: BuildNode, index: BuildItemIndex): WeaponSlotDef[] {
  const def = index.get(node.itemId);
  if (!def) return [];
  if (def.kind === 'weapon' || def.kind === 'mod') return def.slots;
  return []; // патрон слотов не имеет
}

export function BuildCanvas({
  node,
  index,
  path,
  nameOf,
  onOpenSlot,
  depth = 0,
}: BuildCanvasProps) {
  const slots = slotsOf(node, index);
  if (slots.length === 0) return null;

  return (
    <div
      className={
        depth === 0
          ? 'flex w-full flex-col gap-2'
          : 'mt-2 flex flex-col gap-2 border-l border-lines-hover pl-3'
      }
    >
      {depth === 0 && (
        <h2 className="mb-1 font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Слоты
        </h2>
      )}

      {slots.map((slot) => {
        const child = node.mods[slot.nameId];
        const installed = child ? index.get(child.itemId) : undefined;
        const empty = child == null;

        return (
          <div key={slot.slotId} className="flex flex-col">
            <button
              type="button"
              onClick={() =>
                onOpenSlot({
                  path,
                  slotNameId: slot.nameId,
                  slotName: slot.name,
                  allowedItemIds: slot.allowedItemIds,
                  currentItemId: child?.itemId ?? null,
                })
              }
              disabled={slot.allowedItemIds.length === 0}
              className={`flex min-h-14 w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                empty
                  ? 'border-dashed border-lines-hover bg-(--color-darkbase) hover:border-(--primary)'
                  : 'border-lines-hover bg-(--color-base) hover:border-(--primary)'
              }`}
            >
              {/* Иконка: картинка модуля, если стоит; иконка категории, если пусто */}
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-(--color-darkbase)">
                {installed ? (
                  <img
                    src={itemIconUrl(installed.id)}
                    alt={installed.name}
                    loading="lazy"
                    className="h-full w-full object-contain p-0.5"
                  />
                ) : (
                  <i
                    className={`${slotIconClass(slot.nameId)} text-xl text-text-secondary`}
                    aria-hidden="true"
                  />
                )}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
                    {slot.name}
                  </span>
                  {slot.required && (
                    <span className="shrink-0 font-blender-medium text-xs text-(--primary)">
                      *
                    </span>
                  )}
                </span>

                <span
                  className={`truncate font-blender-book text-sm ${
                    installed ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {installed ? installed.name : 'Пусто'}
                </span>
              </span>

              {/* Дельта модуля: сразу видно, что он даёт */}
              {installed?.kind === 'mod' && (
                <span className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
                  {installed.ergonomics !== 0 && (
                    <span
                      className={`font-blender-medium text-xs ${
                        installed.ergonomics > 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {installed.ergonomics > 0 ? '+' : ''}
                      {installed.ergonomics} эрго
                    </span>
                  )}
                  {installed.recoilModifier !== 0 && (
                    <span
                      className={`font-blender-medium text-xs ${
                        installed.recoilModifier < 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {installed.recoilModifier > 0 ? '+' : ''}
                      {Math.round(installed.recoilModifier * 100)}% отдача
                    </span>
                  )}
                </span>
              )}

              <span className="flex h-8 w-8 shrink-0 items-center justify-center text-text-secondary">
                {empty ? (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
            </button>

            {/* Слоты самого модуля — рекурсия вглубь */}
            {child && (
              <BuildCanvas
                node={child}
                index={index}
                path={[...path, slot.nameId]}
                nameOf={nameOf}
                onOpenSlot={onOpenSlot}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}