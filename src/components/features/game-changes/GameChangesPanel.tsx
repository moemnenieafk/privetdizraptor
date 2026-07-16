'use client';

import { Plus, Minus, ArrowUp, ArrowDown, ArrowRight, Activity } from 'lucide-react';
import { Paywall } from '@/components/features/subscription/Paywall';
import type { Changeset, GameChange } from '@/db/game-changes';

// «Что реально изменилось» — наш дифф игровых данных, переведённый на понятный язык:
// группируем по предмету, статам даём человеческие имена и семантику усилено/ослаблено.
// Саммари видят все (воронка + SEO), детальный список — за подпиской «Оперативник».
// Гейт клиентский: страница game-updates — статический ISR.

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
  bluntThroughput: 'Пробитие тупым',
  ergoPenalty: 'Штраф эргономики',
  speedPenalty: 'Штраф скорости',
  turnPenalty: 'Штраф поворота',
  ergonomics: 'Эргономика',
  recoilVertical: 'Отдача вертик.',
  recoilHorizontal: 'Отдача гориз.',
  fireRate: 'Скорострельность',
  capacity: 'Вместимость',
};

// Направление «в плюс игроку»: +1 больше=лучше, −1 меньше=лучше, 0/нет — нейтрально.
const STAT_DIRECTION: Record<string, 1 | -1> = {
  penetrationPower: 1,
  damage: 1,
  armorDamage: 1,
  fragmentationChance: 1,
  armorClass: 1,
  durability: 1,
  ergonomics: 1,
  capacity: 1,
  initialSpeed: 1,
  recoilVertical: -1,
  recoilHorizontal: -1,
  bluntThroughput: -1,
  weight: -1,
  // штрафы хранятся отрицательными: рост значения (ближе к 0) = меньше штраф = лучше
  ergoPenalty: 1,
  speedPenalty: 1,
  turnPenalty: 1,
};

const fieldLabel = (f: string | null): string => (f ? FIELD_LABEL[f] ?? f : '');
const fmtDay = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

type Verdict = 'buff' | 'nerf' | null;

// Интерпретатор: усилено / ослаблено / нейтрально по знаку изменения и направлению стата.
function verdict(field: string | null, oldV: string | null, newV: string | null): Verdict {
  if (!field || oldV === null || newV === null) return null;
  const dir = STAT_DIRECTION[field];
  if (!dir) return null;
  const a = Number(oldV);
  const b = Number(newV);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  const delta = (b - a) * dir;
  return delta > 0 ? 'buff' : 'nerf';
}

function countKinds(cs: Changeset[]): { added: number; removed: number; field: number } {
  const acc = { added: 0, removed: 0, field: 0 };
  for (const set of cs) for (const c of set.changes) acc[c.kind] += 1;
  return acc;
}

// Группировка плоского списка изменений по предмету — чтобы читать «по предмету», а не по полю.
interface ItemGroup {
  name: string;
  shortName: string | null;
  status: 'added' | 'removed' | null;
  fields: GameChange[];
}

function groupByItem(changes: GameChange[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  const order: string[] = [];
  for (const c of changes) {
    const key = c.name;
    let g = map.get(key);
    if (!g) {
      g = { name: c.name, shortName: c.shortName, status: null, fields: [] };
      map.set(key, g);
      order.push(key);
    }
    if (c.kind === 'added') g.status = 'added';
    else if (c.kind === 'removed') g.status = 'removed';
    else g.fields.push(c);
  }
  return order.map((k) => map.get(k)).filter((g): g is ItemGroup => g !== undefined);
}

function FieldLine({ c }: { c: GameChange }) {
  const v = verdict(c.field, c.oldValue, c.newValue);
  const tone =
    v === 'buff' ? 'text-nvg-green' : v === 'nerf' ? 'text-danger' : 'text-(--primary)';
  const Icon = v === 'buff' ? ArrowUp : v === 'nerf' ? ArrowDown : ArrowRight;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
        {fieldLabel(c.field)}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-blender-medium text-xs text-text-secondary">{c.oldValue ?? '—'}</span>
        <Icon className={`h-3 w-3 ${tone}`} aria-hidden="true" />
        <span className={`font-blender-medium text-xs ${tone}`}>{c.newValue ?? '—'}</span>
      </span>
      {v && (
        <span className={`font-blender-medium text-xs uppercase tracking-widest ${tone}`}>
          {v === 'buff' ? 'усилено' : 'ослаблено'}
        </span>
      )}
    </div>
  );
}

function ItemCard({ g }: { g: ItemGroup }) {
  const title = g.shortName?.trim() || g.name;
  return (
    <div className="flex flex-col gap-1 rounded-xs border border-lines-hover bg-card-menu px-3 py-2">
      <div className="flex items-center gap-2">
        {g.status === 'added' && <Plus className="h-3.5 w-3.5 shrink-0 text-nvg-green" aria-hidden="true" />}
        {g.status === 'removed' && <Minus className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />}
        <span
          className={`font-blender-book text-sm ${g.status === 'removed' ? 'text-text-secondary line-through' : 'text-text-primary'}`}
        >
          {title}
        </span>
        {g.status === 'added' && (
          <span className="font-blender-medium text-xs uppercase tracking-widest text-nvg-green">новый</span>
        )}
        {g.status === 'removed' && (
          <span className="font-blender-medium text-xs uppercase tracking-widest text-danger">убран</span>
        )}
      </div>
      {g.fields.length > 0 && (
        <div className="flex flex-col gap-1 pl-1">
          {g.fields.map((c, i) => (
            <FieldLine key={`${c.field}-${i}`} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function Details({ changesets }: { changesets: Changeset[] }) {
  return (
    <div className="flex flex-col gap-5">
      {changesets.map((set) => (
        <div key={set.date} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 border-b border-lines-hover pb-1.5">
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-primary">
              {fmtDay(set.date)}
            </span>
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
              {set.total} изм.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {groupByItem(set.changes).map((g, i) => (
              <ItemCard key={`${set.date}-${g.name}-${i}`} g={g} />
            ))}
          </div>
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
        Наш дифф игровых данных на понятном языке — что усилили, что ослабили, что добавили или
        убрали. То, что часто остаётся за скобками официального патчноута.
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
