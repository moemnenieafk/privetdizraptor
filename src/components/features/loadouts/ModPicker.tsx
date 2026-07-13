'use client';

// Выбор модуля в слот. На мобиле — боттом-шит (лист снизу, тач-таргеты 44px),
// на десктопе — центрированное окно. Список — только допустимые для ЭТОГО слота
// предметы (allowedItemIds приходят из weapon_slots, фильтрация уже сделана).
//
// Сортировка по вкладу модуля: «лучшая отдача» / «лучшая эргономика» / «по имени».
// Конфликтующие модули не прячем, а помечаем — иначе непонятно, почему их нет.
//
// ВАЖНО про скролл: у листа max-h, а список внутри — flex-1 overflow-y-auto. Без
// min-h-0 флекс-ребёнок отказывается сжиматься ниже своего контента, и список
// обрезается вместо того, чтобы скроллиться (на мобиле это выглядело как «показывает
// не все детали»). min-h-0 обязателен.
import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, Search, Trash2, X } from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import { slotIconClass } from '@/lib/slot-icons';
import type { BuildItemDef, BuildItemIndex } from '@/lib/weapon-build';
import type { OpenSlotTarget } from '@/components/features/loadouts/WeaponBuilder';

type SortKey = 'recoil' | 'ergo' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recoil', label: 'Отдача' },
  { key: 'ergo', label: 'Эргономика' },
  { key: 'name', label: 'Название' },
];

interface ModPickerProps {
  target: OpenSlotTarget;
  index: BuildItemIndex;
  onClose: () => void;
  /** itemId=null → снять модуль из слота. */
  onPick: (itemId: string | null) => void;
}

export function ModPicker({ target, index, onClose, onPick }: ModPickerProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recoil');

  // Esc закрывает; фон под шитом не скроллится.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const options = useMemo(() => {
    const list: BuildItemDef[] = [];
    for (const id of target.allowedItemIds) {
      const def = index.get(id);
      if (def) list.push(def);
    }

    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (d) => d.name.toLowerCase().includes(q) || d.shortName.toLowerCase().includes(q),
        )
      : list;

    const ergoOf = (d: BuildItemDef): number => (d.kind === 'mod' ? d.ergonomics : 0);
    const recoilOf = (d: BuildItemDef): number =>
      d.kind === 'mod' || d.kind === 'ammo' ? d.recoilModifier : 0;

    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'ru');
      if (sort === 'ergo') return ergoOf(b) - ergoOf(a); // больше эрго — выше
      return recoilOf(a) - recoilOf(b); // сильнее минус к отдаче — выше
    });
  }, [target.allowedItemIds, index, query, sort]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Затемнение */}
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-xs"
      />

      {/* Лист. overflow-hidden + h-[85vh] на мобиле: фиксированная высота даёт
          предсказуемый скролл, «резиновая» max-h на iOS схлопывалась при появлении
          клавиатуры под поиском. */}
      <div className="relative flex h-[85vh] w-full flex-col overflow-hidden rounded-t-md border border-lines-hover bg-(--color-base) sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-md animate-[fade-in-up_0.25s_ease-out_both]">
        {/* Шапка — не сжимается */}
        <header className="flex shrink-0 items-center gap-3 border-b border-lines-hover p-4">
          <i
            className={`${slotIconClass(target.slotNameId)} text-2xl text-(--primary)`}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary">
              {target.slotName}
            </h2>
            <span className="font-blender-medium text-xs text-text-secondary">
              {options.length} вариантов
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {/* Поиск + сортировка — не сжимаются */}
        <div className="flex shrink-0 flex-col gap-2 border-b border-lines-hover p-4">
          <div className="relative w-full">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск модуля…"
              className="h-11 w-full rounded-sm border border-lines-hover bg-(--color-darkbase) pl-10 pr-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
            />
          </div>

          <div className="flex gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`h-9 flex-1 rounded-xs border font-blender-medium text-xs uppercase tracking-widest transition-colors ${
                  sort === s.key
                    ? 'border-(--primary) text-(--primary)'
                    : 'border-lines-hover text-text-secondary hover:border-(--primary)'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Список. min-h-0 — вот из-за его отсутствия список не разворачивался. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {/* Снять модуль */}
          {target.currentItemId && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="mb-3 flex min-h-14 w-full items-center gap-3 rounded-sm border border-dashed border-danger/50 px-3 py-2 text-left transition-colors hover:border-danger"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs bg-(--color-darkbase)">
                <Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />
              </span>
              <span className="font-blender-book text-sm text-danger">Снять модуль</span>
            </button>
          )}

          {options.length === 0 ? (
            <p className="py-10 text-center font-blender-book text-sm text-text-secondary">
              {query
                ? 'Ничего не нашлось по этому запросу.'
                : 'В этот слот в игре ничего не ставится.'}
            </p>
          ) : (
            <div className="flex flex-col gap-2 pb-4">
              {options.map((d) => (
                <ModRow
                  key={d.id}
                  def={d}
                  selected={d.id === target.currentItemId}
                  onPick={() => onPick(d.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────── строка модуля ───────────────── */

function ModRow({
  def,
  selected,
  onPick,
}: {
  def: BuildItemDef;
  selected: boolean;
  onPick: () => void;
}) {
  const isMod = def.kind === 'mod';
  const isAmmo = def.kind === 'ammo';

  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-colors ${
        selected
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
          : 'border-lines-hover bg-(--color-darkbase) hover:border-(--primary)'
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-(--color-base)">
        <img
          src={itemIconUrl(def.id)}
          alt={def.name}
          loading="lazy"
          className="h-full w-full object-contain p-0.5"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-blender-book text-sm text-text-primary">{def.name}</span>

        <span className="flex flex-wrap gap-2">
          {isMod && def.ergonomics !== 0 && (
            <Stat value={def.ergonomics} good={def.ergonomics > 0} suffix=" эрго" />
          )}
          {isMod && def.recoilModifier !== 0 && (
            <Stat
              value={Math.round(def.recoilModifier * 100)}
              good={def.recoilModifier < 0}
              suffix="% отдача"
            />
          )}
          {isMod && def.capacity != null && (
            <span className="font-blender-medium text-xs text-text-secondary">
              {def.capacity} патр.
            </span>
          )}
          {isAmmo && (
            <span className="font-blender-medium text-xs text-text-secondary">
              {def.damage} урон · {def.penetrationPower} проб.
            </span>
          )}
          {isMod && def.conflictingItemIds.length > 0 && (
            <span className="flex items-center gap-1 font-blender-medium text-xs text-text-secondary">
              <Ban className="h-3 w-3" aria-hidden="true" />
              {def.conflictingItemIds.length}
            </span>
          )}
        </span>
      </span>

      {selected && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--primary)">
          <Check className="h-3.5 w-3.5 text-(--color-base)" aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

function Stat({ value, good, suffix }: { value: number; good: boolean; suffix: string }) {
  return (
    <span className={`font-blender-medium text-xs ${good ? 'text-success' : 'text-danger'}`}>
      {value > 0 ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}