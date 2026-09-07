import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import {
  LEGAL_CONTACT,
  LEGAL_REQUISITES,
  requisitesFilled,
} from '@/data/legal-docs';
import { getTierShowcase, isPricingPublished } from '@/lib/gating/showcase';

/**
 * Публичная страница реквизитов продавца.
 *
 * Зачем отдельной страницей: при подключении ЮKassa/ЮMoney проверяющие требуют
 * доступный со всех страниц сайта раздел с реквизитами продавца, описанием услуги,
 * ценами, порядком оплаты и возврата, контактами. Без него кассу не подключают.
 *
 * Цены берутся из ЖИВОЙ витрины (та же матрица гейтов, что у пейвола), а не дублируются
 * текстом: иначе страница для кассы разъедется с реальными тарифами при первой правке.
 *
 * Статический сегмент `requisites` перекрывает `[doc]` — конфликта маршрутов нет.
 */

export const metadata: Metadata = {
  title: 'Реквизиты — ЦТА',
  description: 'Реквизиты продавца, порядок оплаты и возврата, контакты службы поддержки.',
  // Черновая (незаполненная) страница из индекса убирается — см. ниже.
  robots: requisitesFilled() ? undefined : { index: false, follow: false },
};

// Читаем витрину тарифов из БД → рантайм (§4.13).
export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="flex flex-col gap-1 border-b border-lines-hover py-4 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-6">
      <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted sm:w-64">
        {label}
      </span>
      <span className="font-blender-book text-type-body text-text-primary">{value}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5">
        <h2 className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          {title}
        </h2>
        <div className="h-px flex-1 bg-lines-hover" />
      </div>
      <div className="rounded border border-lines-hover bg-card-menu px-6">{children}</div>
    </section>
  );
}

export default async function RequisitesPage() {
  const filled = requisitesFilled();
  const r = LEGAL_REQUISITES;
  const [showcase, pricingPublished] = await Promise.all([
    getTierShowcase(),
    isPricingPublished(),
  ]);
  const paid = showcase.filter((t) => t.rank > 0);
  const bankFilled = r.bank.account.trim() !== '' && r.bank.bic.trim() !== '';

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <Link
          href="/legal"
          className="mb-8 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Все документы
        </Link>

        <h1 className="font-blender-medium text-type-h2 uppercase tracking-widest text-text-primary">
          Реквизиты
        </h1>
        <p className="mt-2 max-w-2xl font-blender-book text-type-body text-text-secondary">
          Сведения о продавце, состав и стоимость услуг, порядок оплаты и возврата.
        </p>

        {!filled && (
          <div className="mt-6 flex items-start gap-3 rounded-sm border-[0.5px] border-tactical-amber/50 bg-tactical-amber/10 px-4 py-3">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-tactical-amber" />
            <p className="font-blender-medium text-type-caption leading-relaxed text-tactical-amber">
              РЕКВИЗИТЫ НЕ ЗАПОЛНЕНЫ. Страница подготовлена, но сведения о продавце ещё не
              внесены — до этого приём платежей не запускается. Данные вносятся в
              <span className="uppercase"> LEGAL_REQUISITES</span> (src/data/legal-docs.ts).
            </p>
          </div>
        )}

        <div className="mt-10 flex flex-col gap-8">
          <Block title="Продавец">
            {filled ? (
              <>
                <Row label="Наименование" value={r.legalName} />
                <Row label="ИНН" value={r.inn} />
                <Row label="ОГРНИП" value={r.ogrnip} />
                <Row label="Адрес регистрации" value={r.address} />
                <Row label="Дата регистрации" value={r.registeredAt} />
              </>
            ) : (
              <p className="py-4 font-blender-book text-type-body text-text-muted">
                Наименование, ИНН, ОГРНИП и адрес регистрации будут опубликованы здесь.
              </p>
            )}
          </Block>

          {bankFilled && (
            <Block title="Банковские реквизиты">
              <Row label="Расчётный счёт" value={r.bank.account} />
              <Row label="Банк" value={r.bank.bankName} />
              <Row label="БИК" value={r.bank.bic} />
              <Row label="Корр. счёт" value={r.bank.corrAccount} />
            </Block>
          )}

          <Block title="Услуга и стоимость">
            <div className="flex flex-col gap-3 py-5">
              <p className="font-blender-book text-type-body text-text-secondary">
                Продаётся доступ к дополнительным возможностям портала «Центр тактической
                адаптации» — информационно-справочного сервиса для игроков. Базовый доступ
                к порталу бесплатный; оплата открывает уровень доступа с расширенными
                функциями. Услуга оказывается дистанционно, доступ предоставляется в
                электронном виде сразу после подтверждения оплаты. Материальные товары не
                продаются, доставка не осуществляется.
              </p>

              {paid.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-lines-hover pt-4">
                  {paid.map((t) => (
                    <div key={t.slug} className="flex items-baseline justify-between gap-4">
                      <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
                        {t.name}
                      </span>
                      <span className="font-blender-medium text-sm text-text-secondary">
                        {pricingPublished ? `${t.price} ₽ / месяц` : 'цена уточняется'}
                      </span>
                    </div>
                  ))}
                  <p className="font-blender-book text-type-caption text-text-muted">
                    Полный состав уровней доступа —{' '}
                    <Link href="/pricing" className="underline underline-offset-4 hover:text-(--primary)">
                      на странице «Тарифы»
                    </Link>
                    .
                  </p>
                </div>
              )}
            </div>
          </Block>

          <Block title="Оплата">
            <p className="py-5 font-blender-book text-type-body text-text-secondary">
              Оплата производится в рублях Российской Федерации банковской картой или через
              Систему быстрых платежей. Приём платежей осуществляется платёжным сервисом
              ЮKassa; реквизиты платёжных средств обрабатываются платёжным сервисом и
              продавцу не передаются. По факту оплаты покупателю направляется кассовый чек
              на указанный при оплате адрес электронной почты.
            </p>
          </Block>

          <Block title="Возврат">
            <p className="py-5 font-blender-book text-type-body text-text-secondary">
              Порядок и условия возврата денежных средств определяются{' '}
              <Link href="/legal/offer" className="underline underline-offset-4 hover:text-(--primary)">
                публичной офертой
              </Link>
              . Для обращения о возврате достаточно написать в службу поддержки с указанием
              адреса электронной почты, на который оформлялась подписка.
            </p>
          </Block>

          <Block title="Контакты">
            <Row label="Электронная почта" value={LEGAL_CONTACT.email} />
            <Row label="Телефон" value={r.phone} />
            <Row label="Сайт" value="https://cta.quest" />
          </Block>
        </div>
      </div>
    </main>
  );
}
