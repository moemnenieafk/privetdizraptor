'use client';

// Презентационные атомы трекера БП: иконка награды, иконка документа, ячейки стоимости,
// мета цветов режимов дневного лимита, принадлежность награды фракции. Иконки — реальные
// из каталога через itemIconUrl(id); onError уводит в глиф-категорию (lucide).
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
  type BpDailyMode,
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
 * Мета режимов дневного лимита (кнопки-режимы + монета красятся по режиму, грилл V4DYA 2026-08-15).
 * label — подпись в выбранном состоянии («Я ИГРАЮ В …»); iconClass — маска в icons.css.
 */
export const BP_MODE_META: Record<BpDailyMode, { label: string; colorVar: string; iconClass: string }> = {
  season: { label: 'SEASON PVP', colorVar: 'var(--color-season-01)', iconClass: 'icon-eft-seasons' },
  pvp: { label: 'PVP-РЕЖИМ', colorVar: 'var(--color-mode-pvp)', iconClass: 'icon-eft-pvp-mode' },
  pve: { label: 'PVE-РЕЖИМ', colorVar: 'var(--color-mode-pve)', iconClass: 'icon-eft-pve-mode' },
};

/**
 * Принадлежность награды фракции (иконка BEAR/USEC в углу карточки, grill V4DYA 2026-08-14).
 * Ключ — id награды; значение — фракции. Награды без фракции в мапе отсутствуют.
 */
export type Faction = 'bear' | 'usec';
export const BP_REWARD_FACTION: Record<string, readonly Faction[]> = {
  'p1-dogtag-1': ['bear', 'usec'],
  'p4-dogtag-2': ['bear', 'usec'],
  'p7-dogtag-3': ['bear', 'usec'],
  'p11-dogtag-4': ['bear', 'usec'],
  'p2-shirt-red': ['bear', 'usec'],
  'p3-nice-frame': ['bear', 'usec'],
  'p5-shirt-orange': ['bear', 'usec'],
  'p6-knyazev': ['bear'],
  'p6-oconnor': ['usec'],
  'p7-top-scorpion': ['bear', 'usec'],
  'p7-bottom-scorpion': ['bear', 'usec'],
  'p10-voice-bear-anton': ['bear'],
  'p10-voice-usec-garret': ['usec'],
  'p11-knyazev-after': ['bear'],
  'p11-oconnor-after': ['usec'],
  'p12-top-night': ['bear', 'usec'],
  'p12-bottom-night': ['bear', 'usec'],
};

/**
 * Аутентичный стиль ячейки предмета EFT (по инспектору Figma V4DYA): рарити-фон #4C2A55 @30% +
 * лёгкий линейный блик + внутренняя тень + тонкая тёмная обводка #0D0D0E. Держим тут одной
 * константой (TODO: канонизировать в дизайн-скилл и раскатать по всему сайту — отдельный заход).
 */
export const EFT_CELL_SHADOW = 'shadow-[inset_0_-2.33px_11.67px_5.83px_rgba(0,0,0,0.7)]';
export const EFT_CELL_BORDER = 'border border-(--color-darkbase)';

/** Иконка награды с каскадом источников: арт из игры → инвентарная иконка → глиф категории. */
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
 * Ячейки стоимости награды — аутентичная ячейка EFT на каждый нужный тип (56px, grill V4DYA):
 * рарити-фон #4C2A55@30% + документ + заливка снизу «собрано/нужно» + бейдж X/Y (10pt), цвет
 * которого динамический: `tactical-amber` — набор, `online` #6B9963 — готов к сдаче, `season-01`
 * — награда получена. Клик — трекер набора: ЛКМ +1, ПКМ −1 (гасит всплытие).
 */
type CostCellState = 'default' | 'tracked' | 'found' | 'done';
const COST_STATE: Record<Exclude<CostCellState, 'default'>, { fill: string; text: string }> = {
  tracked: { fill: 'bg-tactical-amber', text: 'text-tactical-amber' },
  found: { fill: 'bg-online', text: 'text-online' },
  done: { fill: 'bg-season-01', text: 'text-season-01' },
};

export function DocCostCells({
  cost,
  collected,
  claimed = false,
  onInc,
}: {
  cost: BpCost;
  collected?: Partial<Record<BpDocType, number>>;
  /** Награда получена → её документы считаются набранными (состояние done). */
  claimed?: boolean;
  onInc?: (type: BpDocType, delta: number) => void;
}) {
  const types = BP_DOC_ORDER.filter((t) => (cost[t] ?? 0) > 0);
  return (
    <div className="flex flex-wrap items-start gap-2">
      {types.map((t) => {
        const doc = BP_DOCS[t];
        const need = cost[t] ?? 0;
        const have = claimed ? need : Math.min(collected?.[t] ?? 0, need);
        const state: CostCellState = claimed ? 'done' : have >= need ? 'found' : have > 0 ? 'tracked' : 'default';
        const st = state === 'default' ? null : COST_STATE[state];
        const fillPct = state === 'tracked' ? Math.round((have / need) * 100) : state === 'default' ? 0 : 100;
        const interactive = !!onInc && !claimed;

        const inner = (
          <>
            {/* Аутентичная ячейка EFT: рарити-фон #4C2A55@30% + линейный блик */}
            <span aria-hidden className="absolute inset-0 bg-(--color-rarity-rare)/30" />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/6 to-transparent" />
            {st && fillPct > 0 && (
              <span
                aria-hidden
                className={`absolute inset-x-0 bottom-0 ${st.fill} transition-[height] duration-300`}
                style={{ height: `${fillPct}%` }}
              />
            )}
            <DocIcon doc={doc} className="absolute inset-0 z-10 h-full w-full p-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
            <span aria-hidden className={`pointer-events-none absolute inset-0 z-10 ${EFT_CELL_SHADOW}`} />
            <span
              className={`absolute bottom-0 right-0 z-20 rounded-tl-xs bg-(--color-darkbase)/90 px-1 py-0.5 font-blender-medium text-[10pt] leading-none ${st ? st.text : 'text-text-primary'}`}
            >
              {have}/{need}
            </span>
          </>
        );

        const cls = `relative flex h-14 w-14 shrink-0 overflow-hidden rounded-xs ${EFT_CELL_BORDER}`;

        if (!interactive) {
          return (
            <span key={t} title={`${doc.name} · ${have}/${need}`} className={cls}>
              {inner}
            </span>
          );
        }
        return (
          <button
            key={t}
            type="button"
            title={`${doc.name} — ЛКМ +1 · ПКМ −1  (${have}/${need})`}
            onClick={(e) => {
              e.stopPropagation();
              // Клик по документу на карточке засчитывается только до нужного этой награде кол-ва
              // (не набиваем сверх need). Больше — через рейл справа. Grill V4DYA.
              if (have < need) onInc?.(t, 1);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onInc?.(t, -1);
            }}
            className={`${cls} cursor-pointer select-none transition-[filter] hover:brightness-110`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
