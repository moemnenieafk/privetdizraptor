// Страница меченой/цветной комнаты: /eft/maps/<map>/rooms/<slug>.
// RSC — читает getMarkedRoomBySlug (комната + экономика ключа + лут-таблица + вердикт).
// Решение: docs/decisions/marked-rooms.md (Фаза 2). Макет: docs/mockups/marked-room/.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMarkedRoomBySlug, type MarkedRoomVerdict } from '@/db/marked-rooms';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';

interface Props {
  params: Promise<{ slug: string; roomSlug: string }>;
}

const fmt = (n: number): string => Math.round(n).toLocaleString('ru-RU');

const TRADER_RU: Record<string, string> = {
  prapor: 'Прапор', therapist: 'Терапевт', skier: 'Лыжник', peacekeeper: 'Миротворец',
  mechanic: 'Механик', ragman: 'Барахольщик', jaeger: 'Егерь', fence: 'Скупщик',
  ref: 'Реф', lightkeeper: 'Смотритель',
};
const traderRu = (nn: string): string => TRADER_RU[nn] ?? (nn.charAt(0).toUpperCase() + nn.slice(1));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, roomSlug } = await params;
  const view = await getMarkedRoomBySlug(slug, roomSlug);
  if (!view) return { title: 'Комната не найдена — ЦТА' };
  return {
    title: `${view.room.title} · ${view.mapName} — Меченые комнаты · ЦТА`,
    description: `Лут-таблица, экономика ключа и окупаемость меченой комнаты «${view.room.title}» на карте ${view.mapName}.`,
  };
}

/** Заголовок «оба вместе»: слово-вердикт от профита за срок ключа. */
function verdictHeadline(v: MarkedRoomVerdict): { label: string; cls: string } {
  if (v.lifetimeProfit == null) return { label: 'ОКУПАЕТСЯ, ДАЛЕЕ В ПЛЮС', cls: 'text-nvg-green' };
  if (v.lifetimeProfit > 0) return { label: 'ВЫГОДНО', cls: 'text-nvg-green' };
  return { label: 'НЕ ОКУПИТСЯ', cls: 'text-danger' };
}

export default async function MarkedRoomPage({ params }: Props) {
  const { slug, roomSlug } = await params;
  const view = await getMarkedRoomBySlug(slug, roomSlug);
  if (!view) notFound();

  const { room, mapName, key, loot, sumEv, verdict } = view;
  const acq = key?.acquisition ?? null;
  const acqLabel = acq
    ? acq.method === 'barter'
      ? `бартер · ${traderRu(acq.barter?.trader ?? '')}`
      : acq.method === 'flea'
        ? 'барахолка'
        : 'только в рейде'
    : '—';
  const headline = verdict ? verdictHeadline(verdict) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 font-blender-book text-text-secondary">
      {/* ── Шапка ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">
            {'// Меченые комнаты'}
</div>
          <div className="mt-1.5 font-blender-medium text-xs text-text-secondary">
            &gt; /eft/maps/{slug}/rooms/{roomSlug}
          </div>
        </div>
        <Link
          href={`/eft/maps/${slug}`}
          className="rounded border border-lines-hover px-4 py-2.5 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          [ ← на карту · {mapName} ]
        </Link>
      </div>

      <h1 className="mt-3.5 font-blender-medium text-4xl uppercase tracking-wide text-text-primary">
        {room.title}
      </h1>
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm">
        <span
          className="rounded border px-2.5 py-1 font-blender-medium text-xs uppercase tracking-widest text-(--primary)"
          style={{
            borderColor: 'color-mix(in srgb, var(--primary) 45%, transparent)',
            background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          }}
        >
          {room.kind === 'lab_color' ? 'Цветная комната' : 'Меченая комната'}
        </span>
        <span className="rounded border border-lines-hover px-2.5 py-1 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          {mapName}
        </span>
        {key && (
          <span className="text-text-muted">
            ключ:&nbsp;<span className="font-blender-medium text-text-primary">{key.name}</span>
          </span>
        )}
      </div>

      {/* ── Экономика + вердикт ── */}
      <section className="mt-10">
        <div className="mb-3.5 flex items-baseline justify-between gap-3 border-b border-lines-hover pb-2">
          <h2 className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">{'// Экономика открытия'}</h2>
          <span className="font-blender-medium text-xs text-text-muted">цены — из зеркала барахолки</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Ключ */}
          <div className="flex items-center gap-3.5 rounded border border-lines-hover bg-card-menu p-4">
            {key && (
              <div
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xs border border-lines-hover"
                style={{ backgroundColor: getTarkovBackgroundColor(undefined) }}
              >
                <div className="absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
                <img src={itemIconUrl(key.id)} alt={key.name} className="absolute inset-0 z-10 h-full w-full object-contain p-1" />
              </div>
            )}
            <div>
              <div className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Ключ</div>
              <div className="mt-1.5 text-sm text-text-secondary">{acqLabel}</div>
            </div>
          </div>

          {/* Цена ключа */}
          <div className="rounded border border-lines-hover bg-card-menu p-4">
            <div className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Цена ключа</div>
            <div className="mt-3.5 font-blender-medium text-3xl leading-none text-text-primary">
              {verdict ? `${fmt(verdict.keyCost)} ₽` : '—'}
            </div>
            <div className="mt-2 text-xs text-text-muted">{acqLabel}</div>
          </div>

          {/* Средняя добыча */}
          <div className="rounded border border-lines-hover bg-card-menu p-4">
            <div className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Добыча / открытие</div>
            <div className="mt-3.5 font-blender-medium text-3xl leading-none text-nvg-green">≈ {fmt(sumEv)} ₽</div>
            <div className="mt-2 text-xs text-text-muted">Σ EV по таблице лута</div>
          </div>

          {/* Вердикт «оба вместе» */}
          <div
            className="rounded border p-4"
            style={{
              borderColor: 'color-mix(in srgb, var(--color-nvg-green) 45%, transparent)',
              background: 'radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--color-nvg-green) 12%, transparent), var(--color-darkbase))',
            }}
          >
            <div className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Вердикт окупаемости</div>
            {verdict && headline ? (
              <>
                <div className={`mt-3 font-blender-medium text-2xl leading-none uppercase ${headline.cls}`}>{headline.label}</div>
                <div className="mt-2 text-xs text-text-secondary">
                  окупается за <span className="font-blender-medium text-text-primary">{verdict.breakeven ?? '—'}</span> откр.
                  {verdict.keyUses != null && <> · ключ {verdict.keyUses} исп.</>}
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  за срок ключа:{' '}
                  {verdict.lifetimeProfit == null ? (
                    <span className="font-blender-medium text-nvg-green">далее чистый профит</span>
                  ) : (
                    <span className={`font-blender-medium ${verdict.lifetimeProfit > 0 ? 'text-nvg-green' : 'text-danger'}`}>
                      {verdict.lifetimeProfit > 0 ? '+' : '−'}{fmt(Math.abs(verdict.lifetimeProfit))} ₽
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-3 font-blender-medium text-lg uppercase text-text-muted">цена ключа неизвестна</div>
            )}
          </div>
        </div>
      </section>

      {/* ── Таблица лута ── */}
      <section className="mt-10">
        <div className="mb-3.5 flex items-baseline justify-between gap-3 border-b border-lines-hover pb-2">
          <h2 className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">{'// Таблица лута'}</h2>
          <span className="font-blender-medium text-xs text-text-muted">Σ EV ≈ {fmt(sumEv)} ₽ · топ по матожиданию</span>
        </div>
        {loot.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {loot.map((it) => (
              <div key={it.itemId} className="flex items-center gap-3 rounded border border-lines-hover bg-card-menu p-2 pr-3">
                <div
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xs border border-lines-hover"
                  style={{ backgroundColor: getTarkovBackgroundColor(it.backgroundColor ?? undefined) }}
                >
                  <div className="absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
                  <img src={itemIconUrl(it.itemId)} alt={it.name} className="absolute inset-0 z-10 h-full w-full object-contain p-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-blender-medium text-sm text-text-primary">{it.name}</div>
                  <div className="text-xs text-text-muted">шанс {(it.chance * 100).toFixed(1)}%</div>
                </div>
                <div className="text-right">
                  <div className="font-blender-medium text-sm text-text-primary">{fmt(it.price)} ₽</div>
                  <div className="font-blender-medium text-xs text-(--primary)">EV {fmt(it.ev)} ₽</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Данных о луте нет (не задан якорь комнаты).</p>
        )}
        <p className="mt-2.5 text-xs text-text-muted">
          Шансы — базовые из зеркала SPT; уточняются «динамическим шансом» по мере накопления открытий.
        </p>
      </section>

      {/* ── Живой трекер (заглушка до первых открытий) ── */}
      <section className="mt-10">
        <div className="mb-3.5 flex items-baseline justify-between gap-3 border-b border-lines-hover pb-2">
          <h2 className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">{'// Живой трекер открытий'}</h2>
          <span className="font-blender-medium text-xs text-text-muted">на слово не верим — только пруф</span>
        </div>
        <div className="rounded border border-lines-hover bg-card-menu p-6 text-center">
          <p className="text-sm text-text-secondary">Пока нет подтверждённых открытий этой комнаты.</p>
          <p className="mt-1 text-xs text-text-muted">Добавляйте свои — с видео (YouTube) или скриншотом; после модерации попадут в статистику и пересчёт шансов.</p>
          <span
            className="mt-4 inline-block rounded border border-lines-hover px-4 py-2.5 font-blender-medium text-xs uppercase tracking-widest text-text-muted"
            aria-disabled="true"
          >
            [ + добавить открытие · скоро ]
          </span>
        </div>
      </section>
    </div>
  );
}
