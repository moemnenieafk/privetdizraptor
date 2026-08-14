'use client';

// Презентационные атомы трекера БП: иконка награды, иконка документа, чипы стоимости.
// Иконки — реальные из каталога через itemIconUrl(id) (как EftItemTile/Media). onError
// уводит в глиф-категорию (lucide), чтобы отсутствующая на R2 иконка не била битой картинкой.
import { useState } from 'react';
import {
  AudioLines,
  Coins,
  Crosshair,
  FileText,
  Home,
  Image as ImageIcon,
  Package,
  PersonStanding,
  Shield,
  Shirt,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import {
  BP_DOC_ORDER,
  BP_DOCS,
  bpRewardImageUrl,
  type BpCost,
  type BpDoc,
  type BpDocType,
  type BpRewardKind,
} from '@/data/eft-battlepass';

export const KIND_META: Record<BpRewardKind, { icon: LucideIcon; label: string }> = {
  weapon: { icon: Crosshair, label: 'Оружие' },
  gear: { icon: Shield, label: 'Снаряжение' },
  clothing: { icon: Shirt, label: 'Одежда' },
  currency: { icon: Coins, label: 'Валюта' },
  container: { icon: Package, label: 'Контейнер' },
  poster: { icon: ImageIcon, label: 'Плакат' },
  hideout: { icon: Home, label: 'Убежище' },
  pose: { icon: PersonStanding, label: 'Поза' },
  voice: { icon: AudioLines, label: 'Голос' },
  dogtag: { icon: Tag, label: 'Жетон' },
  decor: { icon: Sparkles, label: 'Косметика' },
};

/**
 * Иконка награды с каскадом источников: арт из файлов игры (`img`, кэш БП) → инвентарная
 * иконка каталога (`itemId`) → глиф категории. onError сдвигает на следующий источник,
 * так что отсутствующая картинка не бьёт битым изображением.
 */
export function RewardMedia({
  img,
  itemId,
  kind,
  name,
  className = 'h-14 w-14',
}: {
  img?: string;
  itemId?: string;
  kind: BpRewardKind;
  name: string;
  className?: string;
}) {
  const sources: string[] = [];
  if (img) sources.push(bpRewardImageUrl(img));
  if (itemId) sources.push(itemIconUrl(itemId));

  const [idx, setIdx] = useState(0);
  const Glyph = KIND_META[kind].icon;

  if (idx < sources.length) {
    return (
      <img
        key={sources[idx]}
        src={sources[idx]}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setIdx((i) => i + 1)}
        className={`object-contain ${className}`}
      />
    );
  }
  return <Glyph aria-hidden strokeWidth={1.5} className={`text-text-muted ${className}`} />;
}

/** Иконка документа (валюты БП). Реальная из каталога, фолбэк — глиф файла. */
export function DocIcon({ doc, className = 'h-5 w-5' }: { doc: BpDoc; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <FileText aria-hidden strokeWidth={1.5} className={`text-text-muted ${className}`} />;
  }
  return (
    <img
      src={itemIconUrl(doc.itemId)}
      alt={doc.name}
      title={doc.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}

/**
 * Чипы стоимости награды: иконка документа + количество, в каноническом порядке типов.
 * • `collected` — показывает «собрано/нужно» (как в игре 0/4) и зеленеет при наборе.
 * • `onInc` — делает чип КЛИКАБЕЛЬНЫМ трекером набора: ЛКМ +1, ПКМ −1 (без кнопок),
 *   фон-заливка по собрано/нужно. Клик гасит всплытие (карточка-родитель не тогглит получение).
 */
export function DocCostChips({
  cost,
  collected,
  onInc,
}: {
  cost: BpCost;
  collected?: Partial<Record<string, number>>;
  onInc?: (type: BpDocType, delta: number) => void;
}) {
  const types = BP_DOC_ORDER.filter((t) => (cost[t] ?? 0) > 0);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {types.map((t) => {
        const doc = BP_DOCS[t];
        const need = cost[t] ?? 0;
        const have = collected ? Math.min(collected[t] ?? 0, need) : undefined;
        const met = have !== undefined && have >= need;
        const label = have !== undefined ? `${have}/${need}` : `×${need}`;
        const pct = have !== undefined && need > 0 ? Math.round((have / need) * 100) : 0;

        const inner = (
          <>
            {onInc && (
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 transition-[width] duration-200 ${met ? 'bg-nvg-green/25' : 'bg-(--primary)/25'}`}
                style={{ width: `${pct}%` }}
              />
            )}
            <DocIcon doc={doc} className={`relative ${onInc ? 'h-6 w-6' : 'h-4 w-4'}`} />
            <span className={`relative font-blender-medium ${onInc ? 'text-type-caption' : 'text-type-micro'} ${met ? 'text-nvg-green' : 'text-text-secondary'}`}>
              {label}
            </span>
          </>
        );

        const cls = `relative inline-flex items-center gap-1 overflow-hidden rounded-xs border ${onInc ? 'px-2 py-1' : 'px-1.5 py-0.5'} ${
          met ? 'border-nvg-green/60 bg-nvg-green/10' : 'border-lines-hover bg-(--color-base)'
        }`;

        if (!onInc) {
          return (
            <span key={t} title={`${doc.name} ${label}`} className={cls}>
              {inner}
            </span>
          );
        }
        return (
          <button
            key={t}
            type="button"
            title={`${doc.name} — ЛКМ +1 · ПКМ −1  (${label})`}
            onClick={(e) => {
              e.stopPropagation();
              onInc(t, 1);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInc(t, -1);
            }}
            className={`${cls} cursor-pointer select-none transition-colors hover:border-(--primary)`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
