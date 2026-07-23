import Link from 'next/link';
import { Plus, ArrowRight, Minus, Radio } from 'lucide-react';
import type { SilentPull, SilentEntry } from '@/db/silent-changes';
import {
  CLASS_LABEL,
  asSilentClass,
  keyContext,
  keyLabel,
  fmtPulled,
} from '@/lib/silent-changes-format';

// «Тихие изменения» — зеркало Tarkov Silent Changes: серверные/клиентские конфиги BSG,
// что меняют молча между версиями (курсы, цены, флаги). Две колонки по нашей сетке:
// слева — что добавлено (зелёный) и изменено (жёлтый), справа — что убрано (danger).

function titleOf(e: SilentEntry): string {
  return e.itemName?.trim() || keyLabel(e.keyPath);
}

function ValueText({ text, tone }: { text: string | null; tone: string }) {
  if (text === null) return null;
  const clean = text.trim() || '∅';
  return (
    <span className={`line-clamp-2 font-blender-medium text-xs ${tone}`} title={text}>
      {clean}
    </span>
  );
}

function ClassTag({ klass }: { klass: string }) {
  const k = asSilentClass(klass);
  const tone =
    k === 'economy'
      ? 'border-(--primary)/40 text-(--primary)'
      : k === 'locale'
        ? 'border-lines-hover text-text-muted'
        : 'border-lines-hover text-text-secondary';
  return (
    <span
      className={`shrink-0 rounded-xs border px-1.5 font-blender-medium text-type-micro uppercase tracking-widest ${tone}`}
    >
      {CLASS_LABEL[k]}
    </span>
  );
}

// Ссылка на карточку предмета, если изменение привязано к предмету нашего каталога.
function EntryTitle({ e, tone }: { e: SilentEntry; tone: string }) {
  const label = titleOf(e);
  const ctx = keyContext(e.keyPath);
  const body = (
    <span className="flex flex-col gap-0.5">
      <span className={`font-blender-book text-sm ${tone}`}>{label}</span>
      {ctx && (
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          {ctx}
        </span>
      )}
    </span>
  );
  return e.inGameId ? (
    <Link href={`/eft/items/item/${e.inGameId}`} className="transition-colors hover:text-(--primary)">
      {body}
    </Link>
  ) : (
    body
  );
}

function EntryRow({ e }: { e: SilentEntry }) {
  const removed = e.kind === 'removed';
  const added = e.kind === 'added';
  const accent = added ? 'text-nvg-green' : removed ? 'text-danger' : 'text-tactical-amber';
  const Icon = added ? Plus : removed ? Minus : ArrowRight;

  return (
    <div className="flex flex-col gap-1 rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${accent}`} aria-hidden="true" />
          <EntryTitle e={e} tone={removed ? 'text-text-secondary line-through' : 'text-text-primary'} />
        </div>
        <ClassTag klass={e.klass} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-5.5">
        {e.kind === 'field' ? (
          <>
            <ValueText text={e.oldValue} tone="text-text-muted line-through" />
            <ArrowRight className="h-3 w-3 shrink-0 text-tactical-amber" aria-hidden="true" />
            <ValueText text={e.newValue} tone="text-tactical-amber" />
          </>
        ) : added ? (
          <ValueText text={e.newValue} tone="text-nvg-green" />
        ) : (
          <ValueText text={e.oldValue} tone="text-danger line-through" />
        )}
      </div>
    </div>
  );
}

function Column({
  title,
  count,
  tone,
  entries,
  empty,
}: {
  title: string;
  count: number;
  tone: string;
  entries: SilentEntry[];
  empty: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 border-b border-lines-hover pb-1.5">
        <span className={`font-blender-medium text-xs uppercase tracking-widest ${tone}`}>{title}</span>
        <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          {count}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="py-2 font-blender-book text-xs text-text-muted">{empty}</p>
      ) : (
        entries.map((e, i) => <EntryRow key={`${e.filePath}-${e.keyPath}-${i}`} e={e} />)
      )}
    </div>
  );
}

export function SilentChangesPanel({ pulls }: { pulls: SilentPull[] }) {
  if (pulls.length === 0) return null;

  return (
    <section className="mb-8 rounded-sm border border-lines-hover bg-(--color-base) p-5">
      <div className="mb-2 flex items-center gap-2.5">
        <Radio className="h-5 w-5 text-(--primary)" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Тихие изменения
        </h2>
      </div>
      <p className="mb-5 max-w-2xl font-blender-book text-sm text-text-secondary">
        Правки серверных настроек BSG между версиями — курсы, цены, флаги — которые меняют
        молча, без патчноута. Слева — что добавили и изменили, справа — что убрали.
      </p>

      <div className="flex flex-col gap-6">
        {pulls.map((pull) => {
          const left = pull.changes.filter((c) => c.kind !== 'removed');
          const right = pull.changes.filter((c) => c.kind === 'removed');
          return (
            <div key={pull.pullId} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-blender-medium text-xs uppercase tracking-widest text-text-primary">
                  {fmtPulled(pull.pulledAt)}
                </span>
                <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                  {pull.eftVersion}
                </span>
                <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
                  {pull.changes.length} изм.
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Column
                  title="Изменено и добавлено"
                  count={left.length}
                  tone="text-nvg-green"
                  entries={left}
                  empty="Без добавлений и правок."
                />
                <Column
                  title="Убрано"
                  count={right.length}
                  tone="text-danger"
                  entries={right}
                  empty="Ничего не убрано."
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
