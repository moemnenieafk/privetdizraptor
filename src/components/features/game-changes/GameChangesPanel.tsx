'use client';

import { Plus, Minus, ArrowRight, Activity } from 'lucide-react';
import { Paywall } from '@/components/features/subscription/Paywall';
import type { Changeset, GameChange } from '@/db/game-changes';

// «Что реально изменилось» — наш дифф игровых данных (статы, вес, базовая цена,
// появление/пропажа предметов) между синками. Саммари видят все (воронка + SEO),
// детальный список — за подпиской «Оперативник» (feature: game_changes).
// Гейт клиентский: страница game-updates — статический ISR, серверный per-user
// гейт закэшировался бы одинаково для всех.

const FIELD_LABEL: Record<string, string> = {
  weight: 'Вес',
  basePrice: 'Базовая цена',
  gridWidth: 'Ширина ячеек',
  gridHeight: 'Высота ячеек',
  penetrationPower: 'Пробитие',
  damage: 'Урон',
  armorDamage: 'Урон брони',
  fragmentationChance: 'Шанс фрагментации',
  initialSpeed: 'Начальная скорость',
  armorClass: 'Класс брони',
  durability: 'Прочность',
  bluntThroughput: 'Тупой урон',
  ergoPenalty: 'Штраф эргономики',
  speedPenalty: 'Штраф скорости',
  turnPenalty: 'Штраф поворота',
  ergonomics: 'Эргономика',
  recoilVertical: 'Отдача вертик.',
  recoilHorizontal: 'Отдача гориз.',
  fireRate: 'Скорострельность',
  capacity: 'Вместимость',
  useTime: 'Время использования',
  maxHpResource: 'Ресурс HP',
  hpResourceRate: 'Расход HP',
};

const fieldLabel = (f: string | null): string => (f ? FIELD_LABEL[f] ?? f : '');
const fmtDay = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function countKinds(cs: Changeset[]): { added: number; removed: number; field: number } {
  const acc = { added: 0, removed: 0, field: 0 };
  for (const set of cs) {
    for (const c of set.changes) acc[c.kind] += 1;
  }
  return acc;
}

function ChangeRow({ c }: { c: GameChange }) {
  const label = c.shortName?.trim() || c.name;
  if (c.kind === 'added') {
    return (
      <li className="flex items-center gap-2 py-1">
        <Plus className="h-3.5 w-3.5 shrink-0 text-nvg-green" aria-hidden="true" />
        <span className="font-blender-book text-sm text-text-primary">{label}</span>
        <span className="font-blender-medium text-xs uppercase tracking-widest text-nvg-green">новый</span>
      </li>
    );
  }
  if (c.kind === 'removed') {
    return (
      <li className="flex items-center gap-2 py-1">
        <Minus className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
        <span className="font-blender-book text-sm text-text-secondary line-through">{label}</span>
        <span className="font-blender-medium text-xs uppercase tracking-widest text-danger">убран</span>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1">
      <span className="font-blender-book text-sm text-text-primary">{label}</span>
      <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
        {fieldLabel(c.field)}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-blender-medium text-xs text-text-secondary">{c.oldValue ?? '—'}</span>
        <ArrowRight className="h-3 w-3 text-(--primary)" aria-hidden="true" />
        <span className="font-blender-medium text-xs text-(--primary)">{c.newValue ?? '—'}</span>
      </span>
    </li>
  );
}

function Details({ changesets }: { changesets: Changeset[] }) {
  return (
    <div className="flex flex-col gap-5">
      {changesets.map((set) => (
        <div key={set.date} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 border-b border-lines-hover pb-1.5">
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-primary">
              {fmtDay(set.date)}
            </span>
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
              {set.total} изм.
            </span>
          </div>
          <ul className="flex flex-col">
            {set.changes.map((c, i) => (
              <ChangeRow key={`${set.date}-${i}`} c={c} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function GameChangesPanel({ changesets }: { changesets: Changeset[] }) {
  if (changesets.length === 0) {
    // Idle: журнал пуст (только базлайн снят или патча ещё не было) — фича видна и активна.
    return (
      <section className="mb-8 rounded-sm border border-lines-hover bg-(--color-base) p-5">
        <div className="mb-2 flex items-center gap-2.5">
          <Activity className="h-5 w-5 text-(--primary)" aria-hidden="true" />
          <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
            Что реально изменилось
          </h2>
        </div>
        <p className="max-w-2xl font-blender-book text-sm text-text-secondary">
          Следим за игровыми данными — статы, вес, базовая цена, появление и пропажа предметов.
          С последнего среза правок не зафиксировано; изменения появятся здесь после ближайшего
          обновления игры.
        </p>
      </section>
    );
  }

  const { added, removed, field } = countKinds(changesets);
  const latest = changesets[0];

  return (
    <section className="mb-8 rounded-sm border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <Activity className="h-5 w-5 text-(--primary)" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Что реально изменилось
        </h2>
      </div>
      <p className="mb-4 max-w-2xl font-blender-book text-sm text-text-secondary">
        Наш дифф игровых данных — статы, вес, базовая цена, появление и пропажа предметов между
        обновлениями. То, что часто остаётся за скобками официального патчноута.
      </p>

      {/* Саммари — видно всем (воронка) */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 py-1 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          Свежий срез: {fmtDay(latest.date)}
        </span>
        {field > 0 && (
          <span className="flex items-center gap-1.5 rounded-xs border border-(--primary)/30 px-2.5 py-1 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
            {field} правок статов
          </span>
        )}
        {added > 0 && (
          <span className="flex items-center gap-1.5 rounded-xs border border-nvg-green/40 px-2.5 py-1 font-blender-medium text-xs uppercase tracking-widest text-nvg-green">
            +{added} новых
          </span>
        )}
        {removed > 0 && (
          <span className="flex items-center gap-1.5 rounded-xs border border-danger/40 px-2.5 py-1 font-blender-medium text-xs uppercase tracking-widest text-danger">
            −{removed} убрано
          </span>
        )}
      </div>

      {/* Детали — за подпиской */}
      <Paywall feature="game_changes">
        <Details changesets={changesets} />
      </Paywall>
    </section>
  );
}
