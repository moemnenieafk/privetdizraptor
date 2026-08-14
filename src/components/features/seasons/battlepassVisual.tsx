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
  type BpCost,
  type BpDoc,
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

/** Иконка награды: реальная (если есть itemId), иначе глиф категории. */
export function RewardMedia({
  itemId,
  kind,
  name,
  className = 'h-14 w-14',
}: {
  itemId?: string;
  kind: BpRewardKind;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const Glyph = KIND_META[kind].icon;

  if (itemId && !failed) {
    return (
      <img
        src={itemIconUrl(itemId)}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
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

/** Чипы стоимости награды: иконка документа + количество, в каноническом порядке типов. */
export function DocCostChips({ cost }: { cost: BpCost }) {
  const types = BP_DOC_ORDER.filter((t) => (cost[t] ?? 0) > 0);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {types.map((t) => {
        const doc = BP_DOCS[t];
        return (
          <span
            key={t}
            title={`${doc.name} ×${cost[t]}`}
            className="inline-flex items-center gap-1 rounded-xs border border-lines-hover bg-(--color-base) px-1.5 py-0.5"
          >
            <DocIcon doc={doc} className="h-4 w-4" />
            <span className="font-blender-medium text-type-micro text-text-secondary">×{cost[t]}</span>
          </span>
        );
      })}
    </div>
  );
}
