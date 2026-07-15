'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 06 «Флиа-маркет»: выставляешь цену слайдером, не зная «справедливую». Учим не переплачивать.

interface Deal {
  id: string;
  name: string;
  hint: string;
  fair: number; // справедливая цена (скрыта от игрока)
  max: number; // верх слайдера
}

const DEALS: Deal[] = [
  { id: 'gpu', name: 'Графическая карта', hint: 'Ходовой предмет, спрос стабильный', fair: 120_000, max: 300_000 },
  { id: 'ledx', name: 'LEDX', hint: 'Дорогой мед, цена скачет', fair: 900_000, max: 2_000_000 },
  { id: 'bolts', name: 'Болты (пачка)', hint: 'Копеечный хлам для крафта', fair: 15_000, max: 60_000 },
];

const fmt = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

export function FleaClient() {
  const [idx, setIdx] = useState(0);
  const [offer, setOffer] = useState<number>(0);
  const [locked, setLocked] = useState(false);
  const [good, setGood] = useState(0);
  const [done, setDone] = useState(false);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const deal = DEALS[idx];

  useEffect(() => {
    setOffer(Math.round(deal.max / 2));
  }, [deal.max]);

  const ratio = offer / deal.fair;
  const verdict = ratio <= 1.1 ? 'good' : ratio <= 1.4 ? 'ok' : 'bad';
  const verdictMeta = {
    good: { label: 'Выгодно', cls: 'text-(--primary)', why: 'Взял по рынку или дешевле. Так и надо.' },
    ok: { label: 'Терпимо', cls: 'text-text-secondary', why: 'Чуть дороже рынка — бывает, если предмет нужен срочно.' },
    bad: { label: 'Переплата', cls: 'text-danger', why: 'Заметно выше рынка. На барахолке такое — минус к банку.' },
  }[verdict];

  const buy = () => {
    setLocked(true);
    if (verdict === 'good') setGood((g) => g + 1);
  };

  const next = () => {
    if (idx + 1 >= DEALS.length) {
      setDone(true);
      complete('flea');
    } else {
      setIdx((i) => i + 1);
      setLocked(false);
    }
  };

  const restart = () => {
    setIdx(0);
    setLocked(false);
    setGood(0);
    setDone(false);
  };

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xs border border-(--primary) bg-(--color-base) p-5">
          <span className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
            Выгодных сделок: {good} / {DEALS.length}
          </span>
          <p className="text-sm font-blender-book leading-5 text-text-primary">
            Барахолка — это рынок игроков. Перед покупкой сверяйся с ценой, не хватай по первой цифре. Переплата
            незаметно съедает банк, а знание рынка — главный навык барыги.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={restart}
            className="flex h-11 items-center rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Ещё раз
          </button>
          <Link
            href="/eft/progress/rookie"
            className="flex h-11 items-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-opacity hover:opacity-80"
          >
            К Пути Новобранца
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1.5">
        {DEALS.map((d, i) => (
          <div key={d.id} className={`h-1 flex-1 rounded-xs ${i <= idx ? 'bg-(--primary)' : 'bg-lines-hover'}`} />
        ))}
      </div>

      <div className="flex flex-col gap-1 rounded-xs border border-lines-hover bg-(--color-base) p-5">
        <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">{deal.name}</span>
        <span className="text-type-label font-blender-book uppercase text-text-secondary">{deal.hint}</span>
      </div>

      {/* Слайдер цены */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
            Твоя цена
          </span>
          <span className="font-blender-medium text-sm text-text-primary">{fmt(offer)}</span>
        </div>
        <input
          type="range"
          min={Math.round(deal.max * 0.05)}
          max={deal.max}
          step={Math.round(deal.max / 100)}
          value={offer}
          disabled={locked}
          onChange={(e) => setOffer(Number(e.target.value))}
          className="w-full accent-(--primary)"
        />
      </div>

      {!locked ? (
        <button
          onClick={buy}
          className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
        >
          Купить по этой цене
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className={`flex flex-col gap-1 rounded-xs border p-4 ${verdict === 'good' ? 'border-(--primary)' : verdict === 'bad' ? 'border-danger' : 'border-lines-hover'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-blender-medium uppercase tracking-widest ${verdictMeta.cls}`}>
                {verdictMeta.label}
              </span>
              <span className="text-type-label font-blender-book uppercase text-text-secondary">
                рынок ≈ {fmt(deal.fair)}
              </span>
            </div>
            <span className="text-type-label font-blender-book leading-4 text-text-secondary">{verdictMeta.why}</span>
          </div>
          <button
            onClick={next}
            className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
          >
            {idx + 1 >= DEALS.length ? 'Итог' : 'Следующий лот'}
          </button>
        </div>
      )}
    </div>
  );
}
