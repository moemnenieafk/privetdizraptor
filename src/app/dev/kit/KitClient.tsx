'use client';

// Конструктор NIGHTFALL: живая витрина реальных компонентов проекта, сгруппированных
// по слоям (Токены → Атомы → Ячейки трекинга → Сетки). Импортирует боевые компоненты,
// ничего не перерисовывает. Сердце — TrackCell (канон-ячейка трекинга) с живым ЛКМ/ПКМ
// и мобильными тап-зонами. Расширяется добавлением новых секций по мере надобности.
import { useState } from 'react';
import Link from 'next/link';
import {
  Blocks,
  Boxes,
  Check,
  ChevronDown,
  FileText,
  Gauge,
  Grid3x3,
  LayoutDashboard,
  Loader2,
  Minus,
  Navigation,
  Palette,
  PanelRight,
  Plus,
  RotateCcw,
  Search,
  Shapes,
  SlidersHorizontal,
  SquareStack,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge, MetricCard, ProgressBar, SectionPanel, TrackCell } from '@/components/ui/kit';
import { FillMedia } from '@/components/ui/FillMedia';
import { QtyControl } from '@/components/ui/QtyControl';
import { ItemGridSize } from '@/components/ui/ItemGridSize';
import { DataViewToggle, type ViewMode } from '@/components/ui/DataViewToggle';
import { HubCard } from '@/components/ui/HubCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { SectionNavTab } from '@/components/features/navigation/SectionNavTab';
import { EftItemTile, type EftItemData } from '@/components/features/items/EftItemTile';
import { DocCostCells } from '@/components/features/seasons/battlepassVisual';
import { BP_DOCS, type BpCost, type BpDocType } from '@/data/eft-battlepass';
import { itemIconUrl } from '@/lib/item-icon';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { BodyMannequin } from '@/components/ui/BodyMannequin';
import type { BodyPartLabel } from '@/components/features/bosses/body-mannequin.config';
import { Badge as ItemBadge } from '@/components/features/items/Badge';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { Carousel } from '@/components/ui/Carousel';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { HEADER_DICTIONARY, type MenuItem } from '@/data/headerConfig';

/** Демо-предметы витрины (реальные id → реальные иконки; при 404 TrackCell даёт глиф). */
const DEMO_ITEMS = [
  { id: '57347ca924597744596b4e71', name: 'Видеокарта', short: 'GPU', need: 4 },
  { id: '59faff1d86f7746c51718c9c', name: 'Физический биткоин', short: 'BTC', need: 3 },
  { id: '5c0530ee86f774697952d952', name: 'LEDX', short: 'LEDX', need: 1 },
  { id: '544fb45d4bdc2dee738b4568', name: 'Salewa', short: 'Salewa', need: 5 },
  { id: '5c05308086f7746b2101e90b', name: 'Плата GPHONE', short: 'GPU board', need: 2 },
  { id: '5c0d591486f7744c505b416f', name: 'Анализатор газа', short: 'Gas', need: 6 },
] as const;

/** Демо-предметы для витрины карточки EftItemTile (валидные EftItemData). */
const TILE_ITEMS: EftItemData[] = [
  {
    id: '57347ca924597744596b4e71',
    normalizedName: 'graphics-card',
    name: 'Видеокарта',
    shortName: 'GPU',
    width: 1,
    height: 2,
    image512pxLink: itemIconUrl('57347ca924597744596b4e71'),
    topStat: { kind: 'hidden' },
    questCount: 2,
    pricing: {
      fleaBuy: { price: 402000, priceRUB: 402000, currency: 'RUB', vendor: { name: 'Барахолка', normalizedName: 'flea-market' } },
      fleaSell: { price: 395000, priceRUB: 395000, currency: 'RUB', vendor: { name: 'Барахолка', normalizedName: 'flea-market' } },
      traderSell: { price: 180000, priceRUB: 180000, currency: 'RUB', vendor: { name: 'Механик', normalizedName: 'mechanic' } },
    },
  },
  {
    id: '544fb45d4bdc2dee738b4568',
    normalizedName: 'salewa-first-aid-kit',
    name: 'Salewa',
    shortName: 'Salewa',
    width: 1,
    height: 2,
    image512pxLink: itemIconUrl('544fb45d4bdc2dee738b4568'),
    topStat: { kind: 'uses', value: 20 },
    pricing: {
      traderBuy: {
        price: 25000,
        priceRUB: 25000,
        currency: 'RUB',
        vendor: { name: 'Терапевт', normalizedName: 'therapist' },
        loyaltyLevel: 2,
      },
      fleaSell: { price: 31000, priceRUB: 31000, currency: 'RUB', vendor: { name: 'Барахолка', normalizedName: 'flea-market' } },
    },
  },
  {
    id: '5c0530ee86f774697952d952',
    normalizedName: 'ledx-skin-transilluminator',
    name: 'LEDX',
    shortName: 'LEDX',
    width: 1,
    height: 1,
    image512pxLink: itemIconUrl('5c0530ee86f774697952d952'),
    topStat: { kind: 'hidden' },
    questCount: 3,
    pricing: {
      fleaBuy: { price: 1150000, priceRUB: 1150000, currency: 'RUB', vendor: { name: 'Барахолка', normalizedName: 'flea-market' } },
      fleaSell: { price: 1100000, priceRUB: 1100000, currency: 'RUB', vendor: { name: 'Барахолка', normalizedName: 'flea-market' } },
    },
  },
];

/** Демо-стоимость набора документов Терра Групп (как в карточке награды Battlepass). */
const DOC_COST: BpCost = { finance: 3, personal: 2, project: 4, scheme: 1, testing: 5 };

/** Демо-рейл «Трекер документации TERRAGROUP»: типы + сколько нужно на весь пропуск. */
const DOC_TRACK_TYPES: readonly BpDocType[] = ['finance', 'personal', 'project', 'scheme'];
const DOC_TRACK_NEEDS: Partial<Record<BpDocType, number>> = { finance: 60, personal: 50, project: 44, scheme: 30 };

/** Демо-табы навигации (SectionNavTab; активность форсим через activeHref). */
const NAV_TABS = [
  { id: 'items', label: 'Предметы', href: '/eft/items' },
  { id: 'quests', label: 'Квесты', href: '/eft/quests' },
  { id: 'maps', label: 'Карты', href: '/eft/maps' },
  { id: 'hideout', label: 'Убежище', href: '/eft/progress/hideout' },
];

const MICRO_LABEL = 'font-blender-medium text-type-micro uppercase tracking-widest text-text-muted';

interface ColorSwatch {
  name: string;
  hex: string;
  /** CSS-переменная токена (напр. '--color-base', '--trader-prapor'). Задаёт живой цвет квадрата.
   *  Если не задана — цвет берётся из hex (для акцентов игр, где токен = --primary по теме). */
  token?: string;
  note?: string;
}

/** Свотч токена цвета: квадрат 56×56 слева, название + HEX справа. Клик — копирует HEX. */
function Swatch({ token, hex, name, note }: ColorSwatch) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`Копировать ${hex}`}
      className="group flex items-center gap-3 text-left"
    >
      <span
        className="h-14 w-14 shrink-0 rounded-xs border border-lines-hover transition-transform group-hover:scale-105 group-active:scale-95"
        style={{ backgroundColor: token ? `var(${token})` : hex }}
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-blender-medium text-type-caption uppercase tracking-wide text-text-primary">{name}</span>
        <span
          className={`font-blender-medium text-type-micro tabular-nums transition-colors ${
            copied ? 'text-success' : 'text-text-secondary group-hover:text-(--primary)'
          }`}
        >
          {copied ? 'Скопировано ✓' : hex}
        </span>
        {note && <span className="text-type-micro text-text-muted">{note}</span>}
      </span>
    </button>
  );
}

/** Полный реестр цветовых токенов проекта (globals.css). Квадрат красится живой CSS-переменной. */
const COLOR_GROUPS: { title: string; swatches: ColorSwatch[] }[] = [
  {
    title: 'Фоны и рамки',
    swatches: [
      { name: 'base', token: '--color-base', hex: '#141416', note: 'подложка сайта' },
      { name: 'darkbase', token: '--color-darkbase', hex: '#0D0D0E', note: 'слот предмета' },
      { name: 'card-menu', token: '--color-card-menu', hex: '#242426', note: 'карточки / модалки' },
      { name: 'lines-hover', token: '--color-lines-hover', hex: '#313135', note: 'рамки / линии' },
    ],
  },
  {
    title: 'Текст',
    swatches: [
      { name: 'text-primary', token: '--color-text-primary', hex: '#F2F2F2', note: 'данные / имена' },
      { name: 'text-secondary', token: '--color-text-secondary', hex: '#9696A1', note: 'описания' },
      { name: 'text-muted', token: '--color-text-muted', hex: '#54545C', note: 'плейсхолдеры' },
    ],
  },
  {
    title: 'Акценты игр (--primary по теме)',
    swatches: [
      { name: 'eft', hex: '#E68E25', note: 'Escape from Tarkov' },
      { name: 'frago', hex: '#00CDAB', note: 'accent-frago' },
      { name: 'abi', hex: '#A34132', note: 'Arena Breakout' },
      { name: 'gzw', hex: '#5FCAFF', note: 'Gray Zone Warfare' },
      { name: 'arcraiders', hex: '#8A86FF', note: 'ARC Raiders' },
      { name: 'marathon', hex: '#C0FE04', note: 'Marathon' },
      { name: 'activematter', hex: '#FFA800', note: 'Active Matter' },
      { name: 'wardogs', hex: '#E3BD74', note: 'War Dogs' },
    ],
  },
  {
    title: 'Статусы',
    swatches: [
      { name: 'success', token: '--color-success', hex: '#8DE736', note: 'собрано / готово' },
      { name: 'nvg-green', token: '--color-nvg-green', hex: '#689963', note: 'доход / крафты' },
      { name: 'online', token: '--color-online', hex: '#6B9963', note: 'онлайн-статус' },
      { name: 'tactical-amber', token: '--color-tactical-amber', hex: '#E68E25', note: 'в наборе' },
      { name: 'moderate', token: '--color-moderate', hex: '#FF7724', note: 'среднее / внимание' },
      { name: 'failure', token: '--color-failure', hex: '#E3433F', note: 'провал' },
      { name: 'danger', token: '--color-danger', hex: '#C24339', note: 'ошибка / лимит' },
      { name: 'danger-dim', token: '--color-danger-dim', hex: '#7E2C25', note: 'приглушённый danger' },
    ],
  },
  {
    title: 'Режимы игры',
    swatches: [
      { name: 'mode-pvp', token: '--color-mode-pvp', hex: '#9A8866', note: 'PvP' },
      { name: 'mode-pve', token: '--color-mode-pve', hex: '#0095E2', note: 'PvE' },
    ],
  },
  {
    title: 'Редкость лута',
    swatches: [
      { name: 'common', token: '--color-text-secondary', hex: '#9696A1', note: '= text-secondary' },
      { name: 'rarity-rare', token: '--color-rarity-rare', hex: '#4C2A55', note: 'подложка ячейки' },
      { name: 'rarity-rare-badge', token: '--color-rarity-rare-badge', hex: '#A069AF', note: 'бейдж / текст' },
      { name: 'rarity-legendary', token: '--color-rarity-legendary', hex: '#BDA550', note: 'Каппа' },
    ],
  },
  {
    title: 'Сезон и спец',
    swatches: [
      { name: 'season-01', token: '--color-season-01', hex: '#5FD5C0', note: 'KORD BREACH' },
      { name: 'kappa', token: '--color-kappa', hex: '#BDA550', note: 'Каппа-контейнер' },
      { name: 'lightkeeper', token: '--color-lightkeeper', hex: '#2ED399', note: 'Смотритель' },
      { name: 'twitch', token: '--color-twitch', hex: '#9146FF', note: 'бренд Twitch' },
    ],
  },
  {
    title: 'Издания (editions)',
    swatches: [
      { name: 'edition-tue', token: '--color-edition-tue', hex: '#51C6DB', note: 'The Unheard' },
      { name: 'edition-eod', token: '--color-edition-eod', hex: '#CB8A00', note: 'Edge of Darkness' },
      { name: 'edition-pfe', token: '--color-edition-pfe', hex: '#9A8866', note: 'Prepare for Escape' },
      { name: 'edition-lb', token: '--color-edition-lb', hex: '#9CA3AF', note: 'Left Behind' },
      { name: 'edition-std', token: '--color-edition-std', hex: '#52525B', note: 'Standard' },
    ],
  },
  {
    title: 'Торговцы (--trader-*)',
    swatches: [
      { name: 'prapor', token: '--trader-prapor', hex: '#4B5320' },
      { name: 'therapist', token: '--trader-therapist', hex: '#45998B' },
      { name: 'fence', token: '--trader-fence', hex: '#66527E' },
      { name: 'skier', token: '--trader-skier', hex: '#AA7F43' },
      { name: 'peacekeeper', token: '--trader-peacekeeper', hex: '#588AC4' },
      { name: 'mechanic', token: '--trader-mechanic', hex: '#5F9EA0' },
      { name: 'ragman', token: '--trader-ragman', hex: '#6B9963' },
      { name: 'jaeger', token: '--trader-jaeger', hex: '#CC5500' },
      { name: 'ref', token: '--trader-ref', hex: '#B49634' },
      { name: 'lightkeeper', token: '--trader-lightkeeper', hex: '#2ED399' },
      { name: 'btrdriver', token: '--trader-btrdriver', hex: '#5F6345' },
      { name: 'boreas', token: '--trader-boreas', hex: '#80ACBF', note: 'сюжетные карты' },
    ],
  },
];

/** Разделы страницы для плавающей навигации (иконка 22×22 + подпись на ховере). */
const SECTION_NAV: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: 'tokens', label: 'Токены', Icon: Palette },
  { id: 'type', label: 'Типографика', Icon: Type },
  { id: 'icons', label: 'Иконки меню', Icon: Shapes },
  { id: 'atoms', label: 'Атомы', Icon: Blocks },
  { id: 'cells', label: 'Ячейки трекинга', Icon: SquareStack },
  { id: 'docs', label: 'Документы', Icon: FileText },
  { id: 'grids', label: 'Сетки', Icon: Grid3x3 },
  { id: 'item-tile', label: 'Карточка предмета', Icon: Boxes },
  { id: 'forms', label: 'Формы', Icon: SlidersHorizontal },
  { id: 'indicators', label: 'Индикаторы', Icon: Gauge },
  { id: 'overlays', label: 'Оверлеи', Icon: PanelRight },
  { id: 'nav', label: 'Навигация', Icon: Navigation },
  { id: 'hubs', label: 'Хабы и карты', Icon: LayoutDashboard },
  { id: 'states', label: 'Состояния', Icon: Loader2 },
];

/**
 * Плавающий вертикальный рейл разделов у левого края экрана (fixed, 14px от края,
 * по центру по высоте). Кнопка 36×36 с иконкой 22×22; при наведении справа выезжает
 * подпись 10px. На узких вьюпортах скрыт (нет бокового поля — перекрыл бы контент).
 */
function FloatingNav() {
  return (
    <nav className="fixed left-3.5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1.5 xl:flex">
      {SECTION_NAV.map(({ id, label, Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          title={label}
          className="group relative flex h-9 w-9 items-center justify-center rounded-xs border border-lines-hover bg-card-menu/80 text-text-muted backdrop-blur transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Icon className="h-5.5 w-5.5" aria-hidden />
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-xs border border-lines-hover bg-card-menu px-2 py-1 font-blender-medium text-type-micro uppercase tracking-widest text-text-primary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            {label}
          </span>
        </a>
      ))}
    </nav>
  );
}

/** Чип-сводка рейла документов (реплика StatChip из BattlePassDocuments). */
function DocStat({
  label,
  value,
  iconClass,
  tint,
  textClass,
  sub,
}: {
  label: string;
  value: string;
  iconClass: string;
  tint: string;
  textClass: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className={`font-blender-medium text-type-micro uppercase tracking-widest ${textClass}`}>{label}</span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className={`${iconClass} h-4 w-4 ${tint} mask-contain mask-center mask-no-repeat`} />
        <span className={`font-blender-medium text-base ${textClass}`}>{value}</span>
      </span>
      {sub && <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">{sub}</span>}
    </div>
  );
}

/** Строка-документ рейла (реплика DocRailRow из BattlePassDocuments 1:1). */
function DocTrackRow({
  name,
  itemId,
  maps,
  needed,
  found,
  collected,
  expanded,
  onToggle,
  onInc,
}: {
  name: string;
  itemId: string;
  maps: readonly string[];
  needed: number;
  found: number;
  collected: number;
  expanded: boolean;
  onToggle: () => void;
  onInc: (delta: number) => void;
}) {
  const remaining = Math.max(0, needed - found);
  const pct = needed > 0 ? Math.min(100, Math.round((found / needed) * 100)) : 0;
  const done = needed > 0 && found >= needed;
  const docBg = 'color-mix(in srgb, var(--color-rarity-rare) 30%, transparent)';

  return (
    <div className="relative flex flex-col overflow-hidden rounded-sm bg-card-menu">
      {/* Горизонтальный прогресс по фону строки: собрано/нужно, nvg-green */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-nvg-green/30 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center gap-3 p-2">
        <FillMedia
          imageSrc={itemIconUrl(itemId)}
          alt={name}
          sizeClass="h-14 w-14"
          bgColor={docBg}
          pct={0}
          done={done}
          onTap={() => onInc(1)}
          tapTitle={`${name} — клик: +1`}
          imgLoading="lazy"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className="line-clamp-2 font-blender-medium text-xs uppercase leading-tight tracking-wide text-text-primary"
            title={name}
          >
            {name}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 font-blender-medium text-type-micro uppercase tracking-wide">
            <span className="text-nvg-green">найдено {found}</span>
            <span className="text-text-muted">исп. 0</span>
            <span className={collected > 0 ? 'text-text-primary' : 'text-text-muted'}>своб. {collected}</span>
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className={`self-start font-blender-medium text-type-micro uppercase tracking-widest transition-colors ${
              expanded ? 'text-(--primary)' : 'text-text-muted hover:text-(--primary)'
            }`}
          >
            {expanded ? 'Скрыть подробности' : 'Где найти документы?'}
          </button>
        </div>

        <span
          className={`font-blender-medium text-xl ${done ? 'text-nvg-green' : 'text-text-primary'}`}
          title="Осталось налутать до полного пропуска"
        >
          {remaining}
        </span>

        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            aria-label="Прибавить"
            onClick={() => onInc(1)}
            className="flex h-6 w-6 items-center justify-center rounded-xs bg-lines-hover text-text-muted transition-colors hover:text-(--primary)"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Убавить"
            onClick={() => onInc(-1)}
            disabled={collected <= 0}
            className="flex h-6 w-6 items-center justify-center rounded-xs bg-lines-hover text-text-muted transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="relative flex flex-wrap items-center gap-1.5 border-t border-nvg-green/20 px-2 py-2">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">Где искать:</span>
          {maps.map((m) => (
            <span
              key={m}
              className="rounded-xs border border-lines-hover bg-(--color-darkbase) px-1.5 py-px font-blender-medium text-type-micro uppercase tracking-wide text-text-secondary"
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Свитч (тогл) — канон NIGHTFALL (готового компонента в проекте нет). */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2">
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-(--primary) bg-(--primary)/25' : 'border-lines-hover bg-card-menu'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${checked ? 'left-5 bg-(--primary)' : 'left-0.5 bg-text-muted'}`}
        />
      </span>
      <span className="font-blender-book text-type-caption text-text-secondary">{label}</span>
    </button>
  );
}

/** Сегментед-контрол — канон NIGHTFALL. */
function Segmented({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded border border-lines-hover bg-(--color-base) p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`rounded-xs px-3 py-1 font-blender-medium text-type-caption uppercase tracking-wider transition-colors ${
            value === o.id ? 'bg-(--primary)/15 text-(--primary)' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Демо-модалка (паттерн NIGHTFALL §5.7). */
function KitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex w-87 max-w-full flex-col overflow-hidden rounded shadow-2xl">
        <div className="relative flex h-7 items-center px-2">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary">Демо-модалка</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute right-1 flex h-5 w-5 items-center justify-center rounded-xs bg-danger-dim text-text-primary transition-[filter] hover:brightness-110"
          >
            <X className="h-3 w-3" />
          </button>
          <span aria-hidden className="absolute inset-0 -z-10 rounded-t bg-lines-hover" />
        </div>
        <div className="flex flex-col gap-3 rounded-b border border-lines-hover bg-card-menu p-5">
          <p className="font-blender-book text-type-caption text-text-secondary text-pretty">
            Паттерн модального окна NIGHTFALL (§5.7): тактическая шапка + бордовая кнопка закрытия,
            тело на card-menu, оверлей bg-black/60 backdrop-blur.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded border border-lines-hover px-3 font-blender-medium text-type-caption uppercase tracking-wider text-text-secondary transition-colors hover:text-text-primary"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded border border-(--primary) bg-(--primary) px-3 font-blender-medium text-type-caption uppercase tracking-wider text-(--color-base) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)]"
            >
              Ок
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Демо-drawer справа (паттерн QuestDrawer/CompareDrawer). */
function KitDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={`fixed right-0 top-0 z-[95] flex h-full w-80 max-w-full flex-col border-l border-lines-hover bg-card-menu shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-lines-hover px-4 py-3">
        <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">Демо-drawer</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="flex h-6 w-6 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-(--primary)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="font-blender-book text-type-caption text-text-secondary text-pretty">
          Боковая панель справа: выезжает по translate-x, край с border-l, шапка + контент со скроллом.
          На таком паттерне живут QuestDrawer и CompareDrawer.
        </p>
      </div>
    </div>
  );
}

/**
 * Иконка пункта меню. Логика маска-vs-картинка 1:1 с боевым меню (HeaderNavigation.isColoredIcon):
 *  - `.webp`/`coloredIcon` и иконки под `/gun-modes/` — со СВОИМ фоном-заливкой → `<img>` как есть (НЕ маска);
 *  - остальные SVG — монохромная перекрашиваемая маска (в акцент на ховере).
 * Клик копирует `.class` (если задан iconClass) либо путь иконки (iconUrl).
 */
function MenuIcon({ item }: { item: MenuItem }) {
  const [copied, setCopied] = useState(false);
  const url = item.iconUrl;
  const colored = !!item.coloredIcon || (url ? /\.(webp|png|jpe?g)$/i.test(url) || url.includes('/gun-modes/') : false);
  const copyText = item.iconClass ? `.${item.iconClass}` : (url ?? '');

  const copy = () => {
    if (!copyText) return;
    void navigator.clipboard?.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copyText ? `Копировать ${copyText}` : item.label}
      className="group flex w-18 flex-col items-center gap-1.5 text-center"
    >
      {item.iconClass ? (
        <span
          aria-hidden
          className={`${item.iconClass} h-6 w-6 bg-text-secondary transition-colors group-hover:bg-(--primary) mask-contain mask-center mask-no-repeat`}
        />
      ) : colored && url ? (
        <img src={url} alt="" loading="lazy" className="h-6 w-6 object-contain" />
      ) : url ? (
        <span
          aria-hidden
          className="h-6 w-6 bg-text-secondary transition-colors group-hover:bg-(--primary) mask-contain mask-center mask-no-repeat"
          style={{ maskImage: `url(${url})`, WebkitMaskImage: `url(${url})` }}
        />
      ) : (
        <span aria-hidden className="h-6 w-6 rounded-xs border border-lines-hover" />
      )}
      <span
        className={`line-clamp-2 font-blender-medium text-type-micro uppercase leading-tight tracking-wide transition-colors ${
          copied ? 'text-success' : 'text-text-muted group-hover:text-text-secondary'
        }`}
      >
        {copied ? 'скопировано ✓' : item.label}
      </span>
    </button>
  );
}

/** Плоский список всех пунктов ветки меню, у которых есть иконка (для витрины иконок). */
function collectMenuIcons(item: MenuItem): MenuItem[] {
  const kids = [...(item.children ?? []), ...(item.subItems ?? [])];
  const self = item.iconUrl || item.iconClass ? [item] : [];
  return [...self, ...kids.flatMap(collectMenuIcons)];
}

/** Топ-категории меню EFT (для группировки иконок в ките). */
const MENU_TOP: MenuItem[] = HEADER_DICTIONARY.eft?.menuItems ?? [];

/** HP частей тела для демо BodyMannequin. */
const BODY_HP: Record<BodyPartLabel, number> = {
  Голова: 35,
  Грудь: 85,
  Живот: 70,
  'Левая рука': 60,
  'Правая рука': 65,
  'Левая нога': 65,
  'Правая нога': 65,
};

export function KitClient() {
  // Прогресс демо-ячеек трекинга (общий стейт витрины, не персистится).
  const [counts, setCounts] = useState<Record<string, number>>({});
  const bump = (id: string, delta: number, need: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min((c[id] ?? 0) + delta, need)) }));

  const [revealZones, setRevealZones] = useState(false);
  const [fill, setFill] = useState(40);
  const [qtySm, setQtySm] = useState(120);
  const [qtyMd, setQtyMd] = useState(2);
  const [view, setView] = useState<ViewMode>('grid');
  const [docCollected, setDocCollected] = useState<Partial<Record<BpDocType, number>>>({});
  const [docOpen, setDocOpen] = useState<BpDocType | null>(null);

  // Формы.
  const [sw1, setSw1] = useState(true);
  const [sw2, setSw2] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({ fir: true, hide: false });
  const [radio, setRadio] = useState('progress');
  const [seg, setSeg] = useState('all');
  const [range, setRange] = useState(60);
  const [search, setSearch] = useState('');
  const [selectVal, setSelectVal] = useState('prapor');
  // Индикаторы / оверлеи.
  const [bodyActive, setBodyActive] = useState<BodyPartLabel | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const incDoc = (t: BpDocType, d: number) =>
    setDocCollected((c) => ({ ...c, [t]: Math.max(0, (c[t] ?? 0) + d) }));

  // Сводка рейла документов.
  const docTotalNeeded = DOC_TRACK_TYPES.reduce((n, t) => n + (DOC_TRACK_NEEDS[t] ?? 0), 0);
  const docFoundTotal = DOC_TRACK_TYPES.reduce((n, t) => n + (docCollected[t] ?? 0), 0);
  const docRemainingTotal = DOC_TRACK_TYPES.reduce(
    (n, t) => n + Math.max(0, (DOC_TRACK_NEEDS[t] ?? 0) - (docCollected[t] ?? 0)),
    0,
  );

  return (
    <div className="flex flex-col gap-7">
      <FloatingNav />

      {/* ── Заголовок ─────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 border-b border-lines-hover pb-5">
        <div className="flex items-center gap-2">
          <Blocks className="h-6 w-6 text-(--primary)" aria-hidden />
          <h1 className="font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
            UI-Кит · Конструктор
          </h1>
          <Badge variant="warning">dev · noindex</Badge>
        </div>
        <p className="max-w-2xl font-blender-book text-type-body text-text-secondary text-pretty">
          Живая витрина компонентов NIGHTFALL. Собирай новые страницы «как конструктор»: смотри
          сюда, указывай узлы. Все элементы — боевые компоненты проекта, не макеты. Ядро сейчас
          (токены, атомы, ячейки/сетки трекинга); растёт добавлением секций.
        </p>
      </header>

      {/* ── Токены: цвет ──────────────────────────────────────── */}
      <section id="tokens" className="scroll-mt-24">
        <SectionPanel title="Токены · Цвет" icon={<Palette className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-6">
            <p className="font-blender-book text-type-caption text-text-muted text-pretty">
              Полный реестр цветовых токенов проекта (globals.css). Квадрат красится живой
              CSS-переменной — клик копирует HEX. Синтаксис в коде: <code className="text-text-secondary">bg-(--color-…)</code>,
              никогда не литеральный HEX (NIGHTFALL §3).
            </p>
            {COLOR_GROUPS.map((g) => (
              <div key={g.title}>
                <p className={`${MICRO_LABEL} mb-2`}>{g.title}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {g.swatches.map((s) => (
                    <Swatch key={`${g.title}-${s.name}`} {...s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </section>

      {/* ── Токены: типографика ───────────────────────────────── */}
      <section id="type" className="scroll-mt-24">
        <SectionPanel title="Токены · Типографика" icon={<Type className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className={MICRO_LABEL}>Заголовки — font-blender-medium uppercase tracking-widest</p>
              <span className="text-type-h1 font-blender-medium uppercase tracking-widest text-text-primary">
                Заголовок H1
              </span>
              <span className="text-type-h3 font-blender-medium uppercase tracking-widest text-text-primary">
                Заголовок H3
              </span>
              <Link
                href="/eft/styleguide"
                className="mt-1 w-fit font-blender-book text-type-caption text-(--primary) underline-offset-2 hover:underline"
              >
                → Полная шкала типографики и сетки: /eft/styleguide
              </Link>
            </div>
            <div className="flex flex-col gap-2 border-t border-lines-hover pt-4">
              <p className={MICRO_LABEL}>Тело — font-blender-book</p>
              <p className="font-blender-book text-type-body text-text-secondary text-pretty">
                Игрок часто ищет информацию во время рейда на втором мониторе или телефоне —
                данные должны считываться за доли секунды.
              </p>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-lines-hover pt-4">
              <div className="flex flex-col">
                <span className="font-blender-medium text-xs tabular-nums text-text-primary">128 500 ₽</span>
                <span className="text-type-micro text-text-muted">Числа/цены · text-xs</span>
              </div>
              <div className="flex flex-col">
                <span className={MICRO_LABEL}>МЕТКА БЛОКА</span>
                <span className="text-type-micro text-text-muted">micro-label · 10px</span>
              </div>
              <div className="flex flex-col">
                <span className="font-blender-book text-type-caption text-text-secondary">caption</span>
                <span className="text-type-micro text-text-muted">подписи, чипы</span>
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Иконки меню ───────────────────────────────────────── */}
      <section id="icons" className="scroll-mt-24">
        <SectionPanel title="Иконки меню" icon={<Shapes className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-6">
            <p className="font-blender-book text-type-caption text-text-muted text-pretty">
              SVG-иконки категорий меню из <code className="text-text-secondary">HEADER_DICTIONARY</code>.
              Монохромные — маска, перекрашивается в акцент (наведи). Иконки{' '}
              <code className="text-text-secondary">/gun-modes/</code> и портреты торговцев{' '}
              <code className="text-text-secondary">.webp</code> — со своим фоном-заливкой, без маски.
              Клик по иконке — копирует <code className="text-text-secondary">.class</code> (или путь иконки).
            </p>
            {MENU_TOP.map((top) => {
              const icons = collectMenuIcons(top);
              if (icons.length === 0) return null;
              return (
                <div key={top.id}>
                  <p className={`${MICRO_LABEL} mb-2`}>{top.label}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-4">
                    {icons.map((it, i) => (
                      <MenuIcon key={`${top.id}-${it.id}-${i}`} item={it} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionPanel>
      </section>

      {/* ── Атомы ─────────────────────────────────────────────── */}
      <section id="atoms" className="scroll-mt-24">
        <SectionPanel title="Атомы" icon={<Blocks className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-6">
            <div>
              <p className={`${MICRO_LABEL} mb-2`}>Badge · ui/kit</p>
              <div className="flex flex-wrap gap-2">
                <Badge>default</Badge>
                <Badge variant="primary">primary</Badge>
                <Badge variant="success">success</Badge>
                <Badge variant="warning">warning</Badge>
                <Badge variant="danger">danger</Badge>
                <Badge variant="info">info</Badge>
              </div>
            </div>

            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-2`}>MetricCard · сводка счётчиков</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard label="Всего" value={42} />
                <MetricCard label="Собрано" value={17} accent="success" />
                <MetricCard label="Осталось" value={25} accent="primary" />
                <MetricCard label="Просрочено" value={3} accent="danger" subtext="дневной лимит" />
              </div>
            </div>

            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-2`}>ProgressBar · ui/kit</p>
              <div className="flex max-w-md flex-col gap-3">
                <ProgressBar label="Прогресс сбора" value={17} max={42} colorClass="bg-(--primary)" />
                <ProgressBar label="Отдача" value={72} max={100} inverse suffix="%" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-8 border-t border-lines-hover pt-4">
              <div>
                <p className={`${MICRO_LABEL} mb-2`}>ItemGridSize</p>
                <div className="flex items-center gap-4">
                  <ItemGridSize width={2} height={2} />
                  <ItemGridSize width={4} height={1} variant="container" />
                </div>
              </div>
              <div>
                <p className={`${MICRO_LABEL} mb-2`}>DataViewToggle</p>
                <DataViewToggle view={view} onChange={setView} />
              </div>
            </div>

            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-2`}>Кнопки · канон NIGHTFALL</p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="h-9 rounded border border-(--primary) bg-(--primary) px-4 font-blender-medium text-type-caption uppercase tracking-wider text-(--color-base) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)]"
                >
                  Основная
                </button>
                <button
                  type="button"
                  className="h-9 rounded border border-lines-hover px-4 font-blender-medium text-type-caption uppercase tracking-wider text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                >
                  Призрачная
                </button>
                <button
                  type="button"
                  className="h-9 rounded border border-danger/40 px-4 font-blender-medium text-type-caption uppercase tracking-wider text-danger transition-colors hover:bg-danger/10"
                >
                  Опасная
                </button>
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Ячейки трекинга (сердце) ──────────────────────────── */}
      <section id="cells" className="scroll-mt-24">
        <SectionPanel
          title="Ячейки трекинга"
          icon={<SquareStack className="h-4 w-4" />}
          bare
          action={
            <label className="flex cursor-pointer items-center gap-2 text-type-caption text-text-secondary">
              <input
                type="checkbox"
                checked={revealZones}
                onChange={(e) => setRevealZones(e.target.checked)}
                className="accent-(--primary)"
              />
              Показать тап-зоны
            </label>
          }
        >
          <div className="flex flex-col gap-6">
            <div className="border-l-2 border-(--primary)/40 pl-3">
              <p className="font-blender-book text-type-caption text-text-secondary text-pretty">
                <span className="font-blender-medium text-(--primary)">TrackCell</span> — канон-ячейка
                (эталон Battlepass). Боль «куда девать +/−» решена без кнопок:{' '}
                <span className="text-text-primary">Десктоп</span> — ЛКМ +1, ПКМ −1;{' '}
                <span className="text-text-primary">Мобайл</span> — тап по левой половине −1, по
                правой +1 (невидимые зоны, включаются на touch). Тумблер справа подсвечивает зоны.
              </p>
            </div>

            {/* Живой ряд ячеек */}
            <div className="flex flex-wrap gap-3">
              {DEMO_ITEMS.map((it) => (
                <TrackCell
                  key={it.id}
                  iconSrc={itemIconUrl(it.id)}
                  alt={it.name}
                  have={counts[it.id] ?? 0}
                  need={it.need}
                  onInc={(d) => bump(it.id, d, it.need)}
                  revealZones={revealZones}
                />
              ))}
            </div>

            {/* Сравнение трёх механик ввода */}
            <div className="grid gap-4 border-t border-lines-hover pt-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>TrackCell — быстрый набор</p>
                <div className="flex items-center gap-3">
                  <TrackCell
                    iconSrc={itemIconUrl(DEMO_ITEMS[0].id)}
                    alt={DEMO_ITEMS[0].name}
                    have={counts['solo'] ?? 1}
                    need={4}
                    onInc={(d) => bump('solo', d, 4)}
                    revealZones={revealZones}
                  />
                  <span className="font-blender-book text-type-caption text-text-muted text-pretty">
                    Клик/тап по слоту. Для целей 1–10 шт.
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>FillMedia — индикация + тап</p>
                <div className="flex items-center gap-3">
                  <FillMedia
                    imageSrc={itemIconUrl(DEMO_ITEMS[3].id)}
                    alt={DEMO_ITEMS[3].name}
                    pct={fill}
                    done={fill >= 100}
                    sizeClass="h-14 w-14"
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fill}
                    onChange={(e) => setFill(Number(e.target.value))}
                    className="w-24 accent-(--primary)"
                    aria-label="Заливка FillMedia"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>QtyControl — точный ввод</p>
                <div className="flex flex-col gap-2">
                  <QtyControl value={qtySm} max={4500} onChange={setQtySm} size="sm" />
                  <QtyControl value={qtyMd} max={6} onChange={setQtyMd} size="md" showMax showClear />
                  <span className="font-blender-book text-type-caption text-text-muted text-pretty">
                    Для больших чисел (×4500 патронов): ввод + удержание + Макс/Сброс.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Документы Терра Групп (Battlepass) ────────────────── */}
      <section id="docs" className="scroll-mt-24">
        <SectionPanel title="Документы Терра Групп · Battlepass" icon={<FileText className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-4">
            <p className="font-blender-book text-type-caption text-text-secondary text-pretty">
              Рейл <span className="font-blender-medium text-(--primary)">«Трекер документации TERRAGROUP»</span>{' '}
              из BP-трекера: строка-документ = крупная ячейка-редкость с заливкой набора по фону, мета{' '}
              <span className="text-text-primary">найдено / исп. / своб.</span>, аккордеон «Где найти
              документы?», крупный остаток и <span className="text-text-primary">вертикальные +/−</span>{' '}
              справа. Клик по ячейке — тоже +1. Сверху 3 чипа-сводки.
            </p>

            {/* ── Рейл-трекер (без внешней рамки — строки сами карточки) ── */}
            <div className="flex flex-col gap-4">
              {/* Шапка */}
              <div className="flex items-center gap-2">
                <h3 className="flex-1 font-blender-medium text-sm uppercase tracking-widest text-text-primary">
                  Трекер документации TERRAGROUP
                </h3>
                <span className="font-blender-medium text-sm text-text-muted">{docTotalNeeded}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDocCollected({});
                    setDocOpen(null);
                  }}
                  title="Сбросить прогресс"
                  className="flex h-7 items-center gap-1 rounded-xs border border-lines-hover px-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:border-danger hover:text-danger"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden />
                </button>
              </div>

              {/* 3 чипа-сводки */}
              <div className="flex items-start gap-3">
                <DocStat label="Получено наград" value="0 / 53" iconClass="icon-eft-reward" tint="bg-season-01" textClass="text-season-01" />
                <DocStat
                  label="Найдено в рейде"
                  value={String(docFoundTotal)}
                  iconClass="icon-eft-battlepass-docs-coin"
                  tint="bg-nvg-green"
                  textClass="text-nvg-green"
                  sub="0 использовано"
                />
                <DocStat
                  label="Осталось собрать"
                  value={String(docRemainingTotal)}
                  iconClass="icon-eft-battlepass-docs-coin"
                  tint="bg-tactical-amber"
                  textClass="text-tactical-amber"
                />
              </div>

              {/* Строки-документы */}
              <div className="flex flex-col gap-2">
                {DOC_TRACK_TYPES.map((t) => {
                  const doc = BP_DOCS[t];
                  const needed = DOC_TRACK_NEEDS[t] ?? 0;
                  const found = docCollected[t] ?? 0;
                  return (
                    <DocTrackRow
                      key={t}
                      name={doc.name}
                      itemId={doc.itemId}
                      maps={doc.maps}
                      needed={needed}
                      found={found}
                      collected={found}
                      expanded={docOpen === t}
                      onToggle={() => setDocOpen((cur) => (cur === t ? null : t))}
                      onInc={(d) => incDoc(t, d)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Компактный вариант той же валюты — ячейки стоимости награды */}
            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-2`}>
                Ячейки стоимости награды (DocCostCells) — компактный грид той же валюты (ЛКМ +1 / ПКМ −1)
              </p>
              <DocCostCells cost={DOC_COST} collected={docCollected} onInc={incDoc} />
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Сетки трекинга ────────────────────────────────────── */}
      <section id="grids" className="scroll-mt-24">
        <SectionPanel
          title="Сетки трекинга"
          icon={<Grid3x3 className="h-4 w-4" />}
          bare
          action={<DataViewToggle view={view} onChange={setView} />}
        >
          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {DEMO_ITEMS.map((it) => {
                const have = counts[it.id] ?? 0;
                const done = have >= it.need;
                return (
                  <div
                    key={it.id}
                    className={`flex items-center gap-3 rounded-xs border p-3 ${
                      done ? 'border-success/30 bg-success/5' : 'border-lines-hover bg-card-menu'
                    }`}
                  >
                    <TrackCell
                      iconSrc={itemIconUrl(it.id)}
                      alt={it.name}
                      have={have}
                      need={it.need}
                      onInc={(d) => bump(it.id, d, it.need)}
                      revealZones={revealZones}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate font-blender-medium text-sm uppercase text-text-primary">
                        {it.name}
                      </span>
                      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                        {it.short}
                      </span>
                      <div className="mt-1">
                        <QtyControl
                          value={have}
                          max={it.need}
                          onChange={(v) => setCounts((c) => ({ ...c, [it.id]: v }))}
                          size="sm"
                          showMax
                          showClear
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-lines-hover overflow-hidden rounded-xs border border-lines-hover">
              {DEMO_ITEMS.map((it) => {
                const have = counts[it.id] ?? 0;
                const done = have >= it.need;
                return (
                  <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                    <FillMedia
                      imageSrc={itemIconUrl(it.id)}
                      alt={it.name}
                      pct={Math.round((have / it.need) * 100)}
                      done={done}
                      sizeClass="h-9 w-9"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-blender-medium text-sm text-text-primary">{it.name}</span>
                      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                        {it.short}
                      </span>
                    </div>
                    <QtyControl
                      value={have}
                      max={it.need}
                      onChange={(v) => setCounts((c) => ({ ...c, [it.id]: v }))}
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </SectionPanel>
      </section>

      {/* ── Карточка предмета (EftItemTile) ───────────────────── */}
      <section id="item-tile" className="scroll-mt-24">
        <SectionPanel title="Карточка предмета · EftItemTile" icon={<Boxes className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-4">
            <p className="font-blender-book text-type-caption text-text-secondary text-pretty">
              Центральная карточка каталога — compound-компонент{' '}
              <span className="font-blender-medium text-(--primary)">EftItemTile</span>: композиция из
              частей <code className="text-text-primary">.Root → .Header / .Media / .Name / .Pricing</code>.
              Клик ведёт на страницу предмета. Ниже — живые карточки (иконки, размер сетки, цены, бейдж
              квестов).
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {TILE_ITEMS.map((it) => (
                <EftItemTile.Root key={it.id} item={it}>
                  <EftItemTile.Header />
                  <EftItemTile.Media />
                  <EftItemTile.Name />
                  <EftItemTile.Pricing />
                </EftItemTile.Root>
              ))}
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Формы и контролы ──────────────────────────────────── */}
      <section id="forms" className="scroll-mt-24">
        <SectionPanel title="Формы и контролы" icon={<SlidersHorizontal className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>Switch</p>
                <Switch checked={sw1} onChange={setSw1} label="Найдено в рейде" />
                <Switch checked={sw2} onChange={setSw2} label="Скрыть готовые" />
              </div>
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>Checkbox</p>
                {[
                  { id: 'fir', label: 'Только FiR' },
                  { id: 'hide', label: 'Спрятать 100%' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checks[c.id]}
                    onClick={() => setChecks((s) => ({ ...s, [c.id]: !s[c.id] }))}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-xs border transition-colors ${
                        checks[c.id] ? 'border-(--primary) bg-(--primary)/20 text-(--primary)' : 'border-lines-hover text-transparent'
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="font-blender-book text-type-caption text-text-secondary">{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>Radio · сортировка</p>
                {[
                  { id: 'progress', label: 'По прогрессу' },
                  { id: 'name', label: 'По названию' },
                  { id: 'qty', label: 'По количеству' },
                ].map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={radio === o.id} onClick={() => setRadio(o.id)} className="flex items-center gap-2">
                    <span
                      className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        radio === o.id ? 'border-(--primary)' : 'border-lines-hover'
                      }`}
                    >
                      {radio === o.id && <span className="h-2 w-2 rounded-full bg-(--primary)" />}
                    </span>
                    <span className="font-blender-book text-type-caption text-text-secondary">{o.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-10 gap-y-6 border-t border-lines-hover pt-4">
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>Segmented</p>
                <Segmented
                  options={[
                    { id: 'all', label: 'Всё' },
                    { id: 'quests', label: 'Квесты' },
                    { id: 'hideout', label: 'Убежище' },
                  ]}
                  value={seg}
                  onChange={setSeg}
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>Слайдер диапазона</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={range}
                    onChange={(e) => setRange(Number(e.target.value))}
                    className="w-40 accent-(--primary)"
                    aria-label="Диапазон"
                  />
                  <span className="font-blender-medium text-type-caption tabular-nums text-text-secondary">{range}%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-t border-lines-hover pt-4">
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>Поиск</p>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Найти предмет…"
                    className="h-9 w-full rounded-xs border border-lines-hover bg-(--color-base) pl-8 pr-3 font-blender-book text-type-caption text-text-primary placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className={MICRO_LABEL}>Select</p>
                <div className="relative w-48">
                  <select
                    value={selectVal}
                    onChange={(e) => setSelectVal(e.target.value)}
                    className="h-9 w-full appearance-none rounded-xs border border-lines-hover bg-(--color-base) pl-3 pr-8 font-blender-book text-type-caption text-text-primary focus:border-(--primary) focus:outline-none"
                  >
                    <option value="prapor">Прапор</option>
                    <option value="therapist">Терапевт</option>
                    <option value="skier">Лыжник</option>
                    <option value="mechanic">Механик</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Индикаторы данных ─────────────────────────────────── */}
      <section id="indicators" className="scroll-mt-24">
        <SectionPanel title="Индикаторы" icon={<Gauge className="h-4 w-4" />} bare>
          <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
            <div className="flex flex-col gap-2">
              <p className={MICRO_LABEL}>ProgressRing</p>
              <ProgressRing percent={65} size={96} stroke={8}>
                <span className="flex flex-col items-center">
                  <span className="font-blender-medium text-lg tabular-nums text-text-primary">65%</span>
                  <span className="text-type-micro uppercase text-text-muted">прогресс</span>
                </span>
              </ProgressRing>
            </div>
            <div className="flex flex-col gap-2">
              <p className={MICRO_LABEL}>BodyMannequin · HP по частям</p>
              <BodyMannequin values={BODY_HP} max={100} active={bodyActive} onEnter={setBodyActive} onLeave={() => setBodyActive(null)} className="w-32" />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <p className={`${MICRO_LABEL} mb-2`}>Badge предметов · семантика</p>
                <div className="flex flex-wrap gap-2">
                  <ItemBadge color="blue" label="Броня 5" title="Класс брони" />
                  <ItemBadge color="red" label="45 урон" />
                  <ItemBadge color="purple" label="Пробитие 32" />
                  <ItemBadge color="emerald" label="Слух +12" />
                  <ItemBadge color="amber" label="Эргономика −4" />
                  <ItemBadge color="gray" label="Базовое" />
                </div>
              </div>
              <div>
                <p className={`${MICRO_LABEL} mb-2`}>VerifiedBadge</p>
                <div className="flex items-center gap-3">
                  <VerifiedBadge variant="icon" />
                  <VerifiedBadge variant="chip" />
                </div>
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Оверлеи и модалки ─────────────────────────────────── */}
      <section id="overlays" className="scroll-mt-24">
        <SectionPanel title="Оверлеи и модалки" icon={<PanelRight className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="h-9 rounded border border-(--primary) bg-(--primary) px-4 font-blender-medium text-type-caption uppercase tracking-wider text-(--color-base) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)]"
              >
                Открыть модалку
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="h-9 rounded border border-lines-hover px-4 font-blender-medium text-type-caption uppercase tracking-wider text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                Открыть drawer
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="h-9 rounded border border-lines-hover px-4 font-blender-medium text-type-caption uppercase tracking-wider text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                Открыть bottom-sheet
              </button>
            </div>
            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-6`}>Tooltip · 4 позиции (наведи)</p>
              <div className="flex flex-wrap gap-12 px-6">
                {(['top', 'bottom', 'left', 'right'] as const).map((pos) => (
                  <Tooltip key={pos} content={`Подсказка ${pos}`} position={pos}>
                    <span className="inline-flex h-9 items-center rounded border border-lines-hover px-3 font-blender-medium text-type-caption uppercase tracking-wider text-text-secondary">
                      {pos}
                    </span>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Навигация ─────────────────────────────────────────── */}
      <section id="nav" className="scroll-mt-24">
        <SectionPanel title="Навигация" icon={<Navigation className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-6">
            <div>
              <p className={`${MICRO_LABEL} mb-2`}>SectionNavTab · таб раздела (активность форсим)</p>
              <div className="flex flex-wrap gap-2">
                {NAV_TABS.map((t) => (
                  <SectionNavTab key={t.id} tab={t} activeHref="/eft/items" />
                ))}
              </div>
            </div>

            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-2`}>HubCard · карточки хабов (варианты)</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                <HubCard
                  gameId="eft"
                  id="achievements"
                  title="Достижения"
                  description="Трек ачивок и бейджей Каппы."
                  href="/eft/progress/achievements"
                  variant="rectangle"
                  index={0}
                />
                <HubCard
                  gameId="eft"
                  id="hideout"
                  title="Убежище"
                  description="Планирование модулей базы."
                  href="/eft/progress/hideout"
                  variant="rectangle"
                  index={1}
                />
                <HubCard gameId="eft" id="tracker" title="Трекер" href="/eft/progress/tracker" variant="mini" index={2} />
                <HubCard gameId="eft" id="needed" title="Важные" href="/eft/progress/needed" variant="mini" index={3} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 border-t border-lines-hover pt-4">
              <div>
                <p className={`${MICRO_LABEL} mb-2`}>Tooltip</p>
                <Tooltip content="Скопировать в буфер" position="top">
                  <button
                    type="button"
                    className="h-9 rounded border border-lines-hover px-4 font-blender-medium text-type-caption uppercase tracking-wider text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                  >
                    Наведи на меня
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Хабы и карты ──────────────────────────────────────── */}
      <section id="hubs" className="scroll-mt-24">
        <SectionPanel title="Хабы и карты" icon={<LayoutDashboard className="h-4 w-4" />} bare>
          <div className="flex flex-col gap-6">
            <div>
              <p className={`${MICRO_LABEL} mb-2`}>HubCard · square / tab</p>
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-48">
                  <HubCard gameId="eft" id="achievements" title="Достижения" description="Каппа-прогресс" href="/eft/progress/achievements" variant="square" index={0} />
                </div>
                <div className="flex flex-col gap-2">
                  <HubCard gameId="eft" id="tracker" title="Трекер" href="/eft/progress/tracker" variant="tab" isActive index={0} />
                  <HubCard gameId="eft" id="needed" title="Важные" href="/eft/progress/needed" variant="tab" index={1} />
                </div>
              </div>
            </div>

            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-2`}>Breadcrumbs · паттерн</p>
              <nav className="flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-wider text-text-muted">
                <span className="cursor-pointer hover:text-(--primary)">EFT</span>
                <span>/</span>
                <span className="cursor-pointer hover:text-(--primary)">Прогресс</span>
                <span>/</span>
                <span className="text-text-secondary">Важные предметы</span>
              </nav>
            </div>

            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-2`}>Carousel · Embla (тащи / свайп)</p>
              <Carousel slideClassName="flex-[0_0_220px] mr-4" viewportPadClassName="py-2">
                {DEMO_ITEMS.slice(0, 5).map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-xs border border-lines-hover bg-card-menu p-3">
                    <FillMedia imageSrc={itemIconUrl(it.id)} alt={it.name} pct={0} sizeClass="h-12 w-12" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-blender-medium text-sm text-text-primary">{it.name}</span>
                      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">{it.short}</span>
                    </div>
                  </div>
                ))}
              </Carousel>
            </div>

            <div className="border-t border-lines-hover pt-4">
              <p className={`${MICRO_LABEL} mb-2`}>SectionPlaceholder · «в разработке»</p>
              <SectionPlaceholder title="Демо-раздел" description="Заглушка для незаполненной секции." hideHeader />
            </div>

            <p className="font-blender-book text-type-micro text-text-muted text-pretty">
              GameCard (лендинг, видео-арт) и FavoritesStrip (каталог) — данные/ассет-тяжёлые, живут
              на своих реальных страницах; в кит не тянем во избежание битых ассетов.
            </p>
          </div>
        </SectionPanel>
      </section>

      {/* ── Состояния (загрузка / пусто) ──────────────────────── */}
      <section id="states" className="scroll-mt-24">
        <SectionPanel title="Состояния" icon={<Loader2 className="h-4 w-4" />} bare>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className={`${MICRO_LABEL} mb-2`}>Скелетон загрузки — форма будущего контента</p>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3"
                  >
                    <div className="h-24 w-full animate-pulse rounded-xs bg-(--color-darkbase)" />
                    <div className="h-4 w-3/4 animate-pulse rounded-xs bg-(--color-darkbase)" />
                    <div className="h-3 w-1/2 animate-pulse rounded-xs bg-(--color-darkbase)" />
                    <div className="mt-1 flex items-center justify-between border-t border-lines-hover pt-2">
                      <div className="h-3 w-16 animate-pulse rounded-xs bg-(--color-darkbase)" />
                      <div className="h-6 w-12 animate-pulse rounded-xs bg-(--color-darkbase)" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-blender-book text-type-micro text-text-muted">
                Скелетон, не спиннер: «вот что тут будет» (CLAUDE.md §4.8).
              </p>
            </div>

            <div>
              <p className={`${MICRO_LABEL} mb-2`}>Пустой стейт — ничего не найдено</p>
              <div className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-lines-hover bg-(--color-base) px-6 py-10 text-center">
                <SquareStack className="h-8 w-8 text-text-muted" aria-hidden />
                <span className="font-blender-medium text-sm uppercase tracking-wider text-text-secondary">
                  Ничего не найдено
                </span>
                <span className="font-blender-book text-type-caption text-text-muted text-pretty">
                  Измени фильтры или запрос. Для секций «в разработке» есть готовый{' '}
                  <code className="text-text-secondary">SectionPlaceholder</code>.
                </span>
              </div>
            </div>
          </div>
        </SectionPanel>
      </section>

      {/* ── Смонтированные оверлеи ── */}
      <KitModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <KitDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomSheet open={sheetOpen} title="Демо bottom-sheet" onClose={() => setSheetOpen(false)}>
        <p className="font-blender-book text-type-caption text-text-secondary text-pretty">
          Мобильный лист снизу (portal): опции карт, фильтры и т.п. Закрой крестиком.
        </p>
      </BottomSheet>
    </div>
  );
}
