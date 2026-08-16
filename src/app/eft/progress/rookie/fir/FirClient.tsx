'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 04 «Найдено в рейде»: классификатор. Метка «⛏ Найдено в рейде» = купленное не примут.
// Игрок решает по каждой карточке: тащить самому или можно взять на барахолке.

interface FirCard {
  id: string;
  task: string;
  fir: boolean; // true — требуется статус «Найдено в рейде»
  why: string;
}

const CARDS: FirCard[] = [
  { id: 'c1', task: 'Квест: сдать 2× ⛏ Ключ от общаги', fir: true, why: 'Метка ⛏ — купленный ключ не примут, ищи в рейде.' },
  { id: 'c2', task: 'Барахолка: продать найденный LEDX', fir: false, why: 'Для продажи FiR не нужен (хотя FiR-версия дороже).' },
  { id: 'c3', task: 'Убежище: ⛏ Отвёртка ×2 на верстак', fir: true, why: 'Убежище часто требует «Найдено в рейде».' },
  { id: 'c4', task: 'Отдать Механику 50 000 ₽ по квесту', fir: false, why: 'Деньги статуса FiR не имеют — плати откуда угодно.' },
  { id: 'c5', task: 'Купить броню у Барахольщика в бой', fir: false, why: 'Экипировка для себя — бери у торговца или с барахолки.' },
  { id: 'c6', task: 'Квест: ⛏ Найти секретный планшет', fir: true, why: 'Явная метка ⛏ — только из рейда, барахолка не поможет.' },
];

export function FirClient() {
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const card = CARDS[idx];
  const answered = chosen !== null;
  const correct = answered && chosen === card.fir;

  const pick = (guess: boolean) => {
    if (answered) return;
    setChosen(guess);
    if (guess === card.fir) setScore((s) => s + 1);
  };

  const next = () => {
    if (idx + 1 >= CARDS.length) {
      setDone(true);
      complete('fir');
    } else {
      setIdx((i) => i + 1);
      setChosen(null);
    }
  };

  const restart = () => {
    setIdx(0);
    setChosen(null);
    setScore(0);
    setDone(false);
  };

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xs border border-(--primary) bg-(--color-base) p-5">
          <span className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
            Разобрался: {score} / {CARDS.length}
          </span>
          <p className="text-sm font-blender-book leading-5 text-text-primary">
            Правило простое: видишь метку <span className="text-(--primary)">⛏ Найдено в рейде</span> — тащи предмет сам,
            купленное не засчитают. Нет метки — бери где удобно. Не продавай квестовый лут раньше времени.
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
            href="/eft/progress/rookie/path"
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
      {/* Прогресс по карточкам */}
      <div className="flex items-center gap-1.5">
        {CARDS.map((c, i) => (
          <div key={c.id} className={`h-1 flex-1 rounded-xs ${i <= idx ? 'bg-(--primary)' : 'bg-lines-hover'}`} />
        ))}
      </div>

      {/* Карточка ситуации */}
      <div className="flex min-h-24 flex-col justify-center rounded-xs border border-lines-hover bg-(--color-base) p-5">
        <span className="text-type-label font-blender-medium uppercase tracking-widest text-text-secondary">
          Ситуация {idx + 1}
        </span>
        <p className="mt-1 text-sm font-blender-book leading-5 text-text-primary">{card.task}</p>
      </div>

      {/* Выбор */}
      {!answered ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => pick(true)}
            className="flex h-11 items-center justify-center rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Тащи из рейда сам
          </button>
          <button
            onClick={() => pick(false)}
            className="flex h-11 items-center justify-center rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Купи — сойдёт
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className={`flex flex-col gap-1 rounded-xs border p-4 ${correct ? 'border-(--primary)' : 'border-danger'}`}
          >
            <span
              className={`text-sm font-blender-medium uppercase tracking-widest ${correct ? 'text-(--primary)' : 'text-danger'}`}
            >
              {correct ? 'Верно' : 'Мимо'}
            </span>
            <span className="text-type-label font-blender-book leading-4 text-text-secondary">{card.why}</span>
          </div>
          <button
            onClick={next}
            className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
          >
            {idx + 1 >= CARDS.length ? 'Итог' : 'Дальше'}
          </button>
        </div>
      )}
    </div>
  );
}
