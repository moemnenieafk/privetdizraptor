import Image from 'next/image';
import type { ShowcaseTier } from '@/lib/gating/showcase';

/**
 * Плитка тарифа — «экран допуска», а не строка прайс-листа. Анатомия 1:1 с карточкой
 * сезона (src/app/eft/progress/seasons/page.tsx): свечение-подложка → микро-метка +
 * статус-пилюля → герой-блок → плитки цифр → CTA внизу. Так витрина читается как часть
 * портала, а не как приклеенный лендинг.
 *
 * ОДНА форма на три места: /pricing, экран смены тарифа в кабинете, апселл.
 * Состав тарифа здесь НЕ перечисляется — он живёт в общей матрице доступа (AccessMatrix),
 * решение V4DYA: три отдельных списка не давали прочитать «что я теряю».
 *
 * Хуков и серверных импортов нет (тип берётся `import type`, он стирается на компиляции),
 * поэтому компонент годится и в RSC, и в клиентском дереве.
 */

interface TierCardProps {
  tier: ShowcaseTier;
  /** Тариф пользователя прямо сейчас. */
  isCurrent?: boolean;
  /** Витрина цен опубликована. false → вместо цифры «скоро». */
  pricingPublished: boolean;
  /** ISO-дата окончания подписки — показывается только у текущего тарифа. */
  validUntil?: string | null;
  /** Кнопка под плиткой. По умолчанию нет: витрина не обещает того, чего не умеет. */
  action?: React.ReactNode;
}

// Арт кладётся в /public/images/pricing/<slug>.webp (пропорция ~2:1, ширина ~700px).
// Наличие файла проверяет сервер (showcase.ts → artUrl); сюда приходит готовый URL или null.

export function TierCard({
  tier,
  isCurrent = false,
  pricingPublished,
  validUntil,
  action,
}: TierCardProps) {
  const isPaid = tier.rank > 0;
  // Платный тир носит PRO-акцент портала (tactical-amber), бесплатный — нейтральный.
  const accent = isPaid ? 'var(--color-tactical-amber)' : 'var(--color-text-muted)';
  const until = validUntil ? new Date(validUntil).toLocaleDateString('ru-RU') : null;
  const unlocks = tier.features.length;

  return (
    <article
      className={`group relative flex flex-col gap-6 overflow-hidden rounded-lg border bg-card-menu p-6 transition-all duration-300 hover:border-(--primary)/50 hover:shadow-[0_8px_30px_color-mix(in_srgb,var(--primary)_15%,transparent)] ${
        isCurrent ? 'border-(--primary)/60' : 'border-lines-hover'
      }`}
    >
      {/* Свечение-подложка под шапкой — приём сезонной карточки. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-40"
        style={{
          background: `radial-gradient(circle at 50% -20%, color-mix(in srgb, ${accent} 16%, transparent), transparent 70%)`,
        }}
      />

      {/* Микро-метка слева, статус-пилюля справа. */}
      <div className="relative flex items-start justify-between gap-3">
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          {isPaid ? 'Уровень допуска' : 'Базовый доступ'}
        </span>
        {isCurrent ? (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1 font-blender-medium text-type-micro uppercase tracking-widest"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
              background: `color-mix(in srgb, ${accent} 10%, transparent)`,
              color: accent,
            }}
          >
            <span
              className="size-1.5 animate-pulse rounded-full"
              style={{ background: accent }}
              aria-hidden
            />
            Активен
          </span>
        ) : null}
      </div>

      {/* Герой-блок: арт тарифа, под ним имя. Нет файла — остаётся процедурный фон. */}
      <div className="relative flex min-h-36 flex-1 flex-col items-center justify-center gap-3 py-2">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg opacity-60"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 50% 50%, color-mix(in srgb, ${accent} 10%, transparent), transparent 75%)`,
          }}
        />
        {tier.artUrl ? (
          <Image
            src={tier.artUrl}
            alt=""
            width={700}
            height={350}
            aria-hidden
            className="relative h-24 w-auto object-contain"
          />
        ) : (
          // Файла под слаг нет (тир заведён в админке) — вместо битой картинки глиф допуска.
          // Бесплатному тиру PRO-глиф не положен: корона на «Бойце» обещала бы то, чего нет.
          <span
            aria-hidden
            className={`icon-mask relative h-14 w-14 ${
              isPaid ? 'icon-account_prostatus_icon' : 'icon-account_profile_icon'
            }`}
            style={{ backgroundColor: accent }}
          />
        )}
        <h3 className="relative font-blender-medium text-2xl uppercase tracking-widest text-text-primary">
          {tier.name}
        </h3>
      </div>

      {/* Плитки цифр — центр композиции. */}
      <div className="relative grid grid-cols-2 gap-2">
        <Stat
          label="Цена"
          value={!isPaid ? 'Бесплатно' : pricingPublished ? `${tier.price} ₽/мес` : 'Скоро'}
        />
        <Stat
          label={isCurrent && until ? 'Активен до' : 'Открывает'}
          value={
            isCurrent && until
              ? until
              : unlocks > 0
                ? `${unlocks} ${pluralFeatures(unlocks)}`
                : 'Ядро портала'
          }
        />
      </div>

      {/* Editorial-перки из админки — короткий смысловой довесок под цифрами. */}
      {tier.perks.length > 0 ? (
        <ul className="relative flex flex-col gap-1.5 font-blender-book text-xs leading-snug text-text-muted">
          {tier.perks.map((perk) => (
            <li key={perk} className="flex gap-2">
              <span
                className="mt-1.5 size-1 shrink-0 rounded-full"
                style={{ background: accent }}
                aria-hidden
              />
              <span>{perk}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {action ? <div className="relative mt-auto">{action}</div> : null}
    </article>
  );
}

/** Мини-плашка цифры — тот же силуэт, что Stat в карточке сезона. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-lines-hover bg-(--color-base) px-3 py-2.5">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className="font-blender-medium text-sm uppercase tracking-wide text-text-primary">
        {value}
      </span>
    </div>
  );
}

function pluralFeatures(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'возможность';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'возможности';
  return 'возможностей';
}

/**
 * Неактивная кнопка оплаты — честная заглушка до подключения платёжного провайдера.
 * Силуэт кнопки сезонной карточки (h-12, rounded-lg), чтобы ряды совпадали по ритму.
 */
export function TierCtaPending({ tierName }: { tierName: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        aria-disabled="true"
        className="flex h-12 items-center justify-center gap-2 rounded-lg border border-lines-hover bg-(--color-base) px-3 text-center font-blender-medium text-xs uppercase leading-tight tracking-widest text-text-muted opacity-60"
      >
        <span
          aria-hidden
          className="icon-mask icon-account_pro-subscribe-icon h-5 w-5 shrink-0 bg-text-muted"
        />
        Перейти на «{tierName}»
      </span>
      <p className="text-center font-blender-book text-type-micro text-text-muted">
        Оплата подключается. Тариф пока выдаётся вручную.
      </p>
    </div>
  );
}
