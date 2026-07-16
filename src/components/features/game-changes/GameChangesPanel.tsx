'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, ArrowUp, ArrowDown, ArrowRight, Activity, Pencil, Loader2 } from 'lucide-react';
import { Paywall } from '@/components/features/subscription/Paywall';
import type { Changeset, GameChange } from '@/db/game-changes';

// «Что реально изменилось» — дифф игровых данных на понятном языке (авто-интерпретатор)
// + редакторский разбор ЦТА поверх (правится админом в Draft Mode). Саммари видят все
// (воронка + SEO), детальный список — за подпиской «Оперативник». Гейт клиентский.

export interface DigestView {
  noteRu: string;
  published: boolean;
}
export type DigestMap = Record<string, DigestView>;

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

// Направление «в плюс игроку»: +1 больше=лучше, −1 меньше=лучше, нет ключа — нейтрально.
const STAT_DIRECTION: Record<string, 1 | -1> = {
  penetrationPower: 1, damage: 1, armorDamage: 1, fragmentationChance: 1, armorClass: 1,
  durability: 1, ergonomics: 1, capacity: 1, initialSpeed: 1,
  recoilVertical: -1, recoilHorizontal: -1, bluntThroughput: -1, weight: -1,
  ergoPenalty: 1, speedPenalty: 1, turnPenalty: 1,
};

const fieldLabel = (f: string | null): string => (f ? FIELD_LABEL[f] ?? f : '');
const fmtDay = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

type Verdict = 'buff' | 'nerf' | null;

function verdict(field: string | null, oldV: string | null, newV: string | null): Verdict {
  if (!field || oldV === null || newV === null) return null;
  const dir = STAT_DIRECTION[field];
  if (!dir) return null;
  const a = Number(oldV);
  const b = Number(newV);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  return (b - a) * dir > 0 ? 'buff' : 'nerf';
}

function countKinds(cs: Changeset[]): { added: number; removed: number; field: number } {
  const acc = { added: 0, removed: 0, field: 0 };
  for (const set of cs) for (const c of set.changes) acc[c.kind] += 1;
  return acc;
}

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
    let g = map.get(c.name);
    if (!g) {
      g = { name: c.name, shortName: c.shortName, status: null, fields: [] };
      map.set(c.name, g);
      order.push(c.name);
    }
    if (c.kind === 'added') g.status = 'added';
    else if (c.kind === 'removed') g.status = 'removed';
    else g.fields.push(c);
  }
  return order.map((k) => map.get(k)).filter((g): g is ItemGroup => g !== undefined);
}

// Группировка изменений торговцев по торговцу (scope).
function groupByScope(changes: GameChange[]): Array<{ trader: string; changes: GameChange[] }> {
  const map = new Map<string, GameChange[]>();
  const order: string[] = [];
  for (const c of changes) {
    const key = c.scope ?? '—';
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
      order.push(key);
    }
    arr.push(c);
  }
  return order.map((trader) => ({ trader, changes: map.get(trader) ?? [] }));
}

// Авто-перевод среза в текст-черновик для редактора (кнопка «сгенерировать из диффа»).
function autoSummary(set: Changeset): string {
  const lines: string[] = [];
  const stat = set.changes.filter((c) => c.category === 'stat');
  const trader = set.changes.filter((c) => c.category === 'trader');

  for (const g of groupByItem(stat)) {
    const title = g.shortName?.trim() || g.name;
    if (g.status === 'added') { lines.push(`Новый предмет: ${title}`); continue; }
    if (g.status === 'removed') { lines.push(`Убран: ${title}`); continue; }
    const parts = g.fields.map((c) => {
      const v = verdict(c.field, c.oldValue, c.newValue);
      const tag = v === 'buff' ? ' (усилено)' : v === 'nerf' ? ' (ослаблено)' : '';
      return `${fieldLabel(c.field)} ${c.oldValue ?? '—'} → ${c.newValue ?? '—'}${tag}`;
    });
    if (parts.length > 0) lines.push(`${title}: ${parts.join('; ')}`);
  }

  for (const { trader: tr, changes } of groupByScope(trader)) {
    for (const g of groupByItem(changes)) {
      const title = g.shortName?.trim() || g.name;
      if (g.status === 'added') { lines.push(`${tr} — новый оффер: ${title}`); continue; }
      if (g.status === 'removed') { lines.push(`${tr} — убран оффер: ${title}`); continue; }
      const parts = g.fields.map((c) => `${fieldLabel(c.field)} ${c.oldValue ?? '—'} → ${c.newValue ?? '—'}`);
      if (parts.length > 0) lines.push(`${tr} — ${title}: ${parts.join('; ')}`);
    }
  }

  const craft = set.changes.filter((c) => c.category === 'craft');
  for (const { trader: area, changes } of groupByScope(craft)) {
    for (const g of groupByItem(changes)) {
      const title = g.shortName?.trim() || g.name;
      if (g.status === 'added') { lines.push(`Убежище (${area}) — новый крафт: ${title}`); continue; }
      if (g.status === 'removed') { lines.push(`Убежище — убран крафт: ${title}`); continue; }
      const parts = g.fields.map((c) => `${fieldLabel(c.field)} ${c.oldValue ?? '—'} → ${c.newValue ?? '—'}`);
      if (parts.length > 0) lines.push(`Крафт ${title} (${area}): ${parts.join('; ')}`);
    }
  }

  const quest = set.changes.filter((c) => c.category === 'quest');
  for (const { trader: tr, changes } of groupByScope(quest)) {
    for (const g of groupByItem(changes)) {
      const title = g.name;
      if (g.status === 'added') { lines.push(`Новый квест (${tr}): ${title}`); continue; }
      if (g.status === 'removed') { lines.push(`Убран квест: ${title}`); continue; }
      const parts = g.fields.map((c) => `${fieldLabel(c.field)} ${c.oldValue ?? '—'} → ${c.newValue ?? '—'}`);
      if (parts.length > 0) lines.push(`Квест «${title}» (${tr}): ${parts.join('; ')}`);
    }
  }
  return lines.join('\n');
}

function FieldLine({ c }: { c: GameChange }) {
  const v = verdict(c.field, c.oldValue, c.newValue);
  const tone = v === 'buff' ? 'text-nvg-green' : v === 'nerf' ? 'text-danger' : 'text-(--primary)';
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

// Редакторский разбор: показ опубликованного всем; инлайн-редактор — админу.
function DigestBlock({ set, digest, canEdit }: { set: Changeset; digest: DigestView | undefined; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(digest?.noteRu ?? '');
  const [published, setPublished] = useState(digest?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/change-digests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: set.date, noteRu: note, published }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Не удалось сохранить');
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError('Сеть недоступна');
    } finally {
      setBusy(false);
    }
  };

  const showNote = digest && (digest.published || canEdit) && digest.noteRu.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">
      {showNote && !editing && (
        <div className="rounded-xs border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] px-3 py-2">
          {!digest?.published && (
            <span className="mb-1 inline-block font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
              Черновик
            </span>
          )}
          <p className="whitespace-pre-wrap font-blender-book text-sm text-text-primary">{digest?.noteRu}</p>
        </div>
      )}

      {canEdit && !editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-8 w-fit items-center gap-1.5 rounded-xs border border-(--primary)/40 px-2.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {showNote ? 'Править разбор' : 'Добавить разбор'}
        </button>
      )}

      {canEdit && editing && (
        <div className="flex flex-col gap-2 rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
              Разбор ЦТА · {fmtDay(set.date)}
            </span>
            <button
              type="button"
              onClick={() => setNote(autoSummary(set))}
              className="h-7 rounded-xs border border-lines-hover px-2 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              Сгенерировать из диффа
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            placeholder="Разбор на понятном языке — что и почему изменилось для игрока…"
            className="w-full rounded-xs border border-lines-hover bg-(--color-base) px-3 py-2 font-blender-book text-sm text-text-primary outline-none focus:border-(--primary)"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
              Опубликовать
            </label>
            <div className="flex items-center gap-2">
              {error && <span className="font-blender-book text-xs text-danger">{error}</span>}
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-8 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="flex h-8 items-center gap-1.5 rounded-xs border border-(--primary) px-3 font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Details({ changesets, digests, canEdit }: { changesets: Changeset[]; digests: DigestMap; canEdit: boolean }) {
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
          <DigestBlock set={set} digest={digests[set.date]} canEdit={canEdit} />
          {(() => {
            const stat = set.changes.filter((c) => c.category === 'stat');
            const trader = set.changes.filter((c) => c.category === 'trader');
            const craft = set.changes.filter((c) => c.category === 'craft');
            const quest = set.changes.filter((c) => c.category === 'quest');
            return (
              <div className="flex flex-col gap-3">
                {stat.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
                      Статы предметов
                    </span>
                    {groupByItem(stat).map((g, i) => (
                      <ItemCard key={`${set.date}-stat-${g.name}-${i}`} g={g} />
                    ))}
                  </div>
                )}
                {groupByScope(trader).map(({ trader: tr, changes }) => (
                  <div key={`${set.date}-tr-${tr}`} className="flex flex-col gap-1.5">
                    <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
                      Торговец · {tr}
                    </span>
                    {groupByItem(changes).map((g, i) => (
                      <ItemCard key={`${set.date}-${tr}-${g.name}-${i}`} g={g} />
                    ))}
                  </div>
                ))}
                {groupByScope(craft).map(({ trader: area, changes }) => (
                  <div key={`${set.date}-cr-${area}`} className="flex flex-col gap-1.5">
                    <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
                      Убежище · {area}
                    </span>
                    {groupByItem(changes).map((g, i) => (
                      <ItemCard key={`${set.date}-${area}-${g.name}-${i}`} g={g} />
                    ))}
                  </div>
                ))}
                {groupByScope(quest).map(({ trader: tr, changes }) => (
                  <div key={`${set.date}-q-${tr}`} className="flex flex-col gap-1.5">
                    <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
                      Квесты · {tr}
                    </span>
                    {groupByItem(changes).map((g, i) => (
                      <ItemCard key={`${set.date}-q-${tr}-${g.name}-${i}`} g={g} />
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

interface PanelProps {
  changesets: Changeset[];
  digests?: DigestMap;
  canEdit?: boolean;
}

export function GameChangesPanel({ changesets, digests = {}, canEdit = false }: PanelProps) {
  if (changesets.length === 0) {
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

      <Paywall feature="game_changes">
        <Details changesets={changesets} digests={digests} canEdit={canEdit} />
      </Paywall>
    </section>
  );
}
