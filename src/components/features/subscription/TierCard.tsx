import { Check, Lock } from 'lucide-react';
import type { ShowcaseTier } from '@/lib/gating/showcase';

/**
 * Карточка тарифа — ОДНА форма на три места: публичная витрина /pricing, экран смены
 * тарифа в кабинете и апселл. Хуков и серверных импортов нет (тип берётся `import type`,
 * он стирается на компиляции), поэтому компонент годится и в RSC, и в клиентском дереве.
 *
 * Состав тарифа приходит готовым из lib/gating/showcase.ts — здесь ничего не считается
 * (CLAUDE.md §4.7). Цена показывается только при `pricingPublished`.
 */

interface TierCardProps {
  tier: ShowcaseTier;
  /** Тариф пользователя прямо сейчас — карточка подсвечивается как текущая. */
  isCurrent?: boolean;
  /** Витрина цен опубликована. false → вместо цифры «цена — скоро». */
  pricingPublished: boolean;
  /**
   * Кнопка под карточкой. Оплата пока не подключена (адаптер провайдера — отдельная
   * задача), поэтому по умолчанию кнопки нет: витрина не обещает того, чего не умеет.
   */
  action?: React.ReactNode;
}

export function TierCard({ tier, isCurrent = false, pricingPublished, action }: TierCardProps) {
  const isPaid = tier.rank > 0;
  const hasBody = tier.features.length > 0 || tier.perks.length > 0 || tier.inheritsFrom;

  return (
    <div
      className={[
        'flex flex-col gap-5 rounded border px-6 py-6 transition-colors',
        isCurrent
          ? 'border-(--primary)/50 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]'
          : 'border-lines-hover bg-card-menu',
      ].join(' ')}
    >
      {/* Шапка: имя + цена */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
            {tier.name}
          </h3>
          {isCurrent ? (
            <span className="shrink-0 rounded-xs border border-(--primary)/40 px-2 py-0.5 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary)">
              Ваш тариф
            </span>
          ) : null}
        </div>

        {!isPaid ? (
          <span className="font-blender-medium text-sm text-text-secondary">Бесплатно</span>
        ) : pricingPublished ? (
          <span className="font-blender-medium text-sm text-text-primary">
            {tier.price} ₽<span className="text-text-muted">/мес</span>
          </span>
        ) : (
          <span className="font-blender-book text-sm text-text-muted">Цена — скоро</span>
        )}
      </div>

      {/* Состав */}
      {hasBody ? (
        <div className="flex flex-col gap-2 border-t border-lines-hover pt-4">
          {tier.inheritsFrom ? (
            <p className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              Всё из «{tier.inheritsFrom}», плюс:
            </p>
          ) : null}

          {/* Авто-состав из матрицы гейтов — источник правды, совпадает с пейволом. */}
          {tier.features.map((line) => (
            <Row key={line.key} label={line.label} />
          ))}

          {/* Editorial-буллеты из админки поверх авто-состава. */}
          {tier.perks.map((perk) => (
            <Row key={perk} label={perk} muted />
          ))}
        </div>
      ) : (
        <p className="border-t border-lines-hover pt-4 font-blender-book text-xs text-text-muted">
          Состав тарифа пока не заполнен.
        </p>
      )}

      {action ? <div className="mt-auto pt-2">{action}</div> : null}
    </div>
  );
}

function Row({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Check
        className={[
          'mt-0.5 h-3.5 w-3.5 shrink-0',
          muted ? 'text-text-muted' : 'text-(--primary)',
        ].join(' ')}
        aria-hidden="true"
      />
      <span className="font-blender-book text-sm leading-snug text-text-secondary">{label}</span>
    </div>
  );
}

/**
 * Неактивная кнопка оплаты — честная заглушка до подключения платёжного провайдера.
 * Верстается сейчас, чтобы на интеграции осталось заменить обработчик, а не рисовать экран.
 */
export function TierCtaPending({ tierName }: { tierName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="flex w-full items-center justify-center gap-2 rounded-xs border border-lines-hover px-4 py-2.5 font-blender-medium text-xs uppercase tracking-widest text-text-muted opacity-60"
      >
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Перейти на «{tierName}»
      </button>
      <p className="text-center font-blender-book text-type-micro text-text-muted">
        Оплата подключается. Тариф пока выдаётся вручную.
      </p>
    </div>
  );
}
