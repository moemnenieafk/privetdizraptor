'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 07 «Квесты»: цепочка заданий. Каждое открывает следующее и даёт награду. Учим,
// что квесты — двигатель прогресса и идут по зависимостям, часть гейтится уровнем/FiR.

interface Quest {
  id: string;
  trader: string;
  name: string;
  req?: string;
  reward: string;
}

const CHAIN: Quest[] = [
  { id: 'q1', trader: 'Прапор', name: 'Знакомство', reward: '+репутация, открыт СКС' },
  { id: 'q2', trader: 'Прапор', name: 'Дебют', req: 'нужен уровень 2', reward: '+опыт, патрон получше' },
  { id: 'q3', trader: 'Терапевт', name: 'Осмотр', req: '⛏ сдать 2 медблока', reward: 'открыт новый торговец' },
  { id: 'q4', trader: 'Механик', name: 'Оружейник', req: 'собрать сборку по ТЗ', reward: 'доступ к модулям оружия' },
  { id: 'q5', trader: 'Смотритель', name: 'Первый шаг', req: 'выполнить цепочку выше', reward: 'путь к эндгейму (Маяк)' },
];

export function QuestsClient() {
  const [doneCount, setDoneCount] = useState(0);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const allDone = doneCount >= CHAIN.length;

  const advance = () => {
    const next = doneCount + 1;
    setDoneCount(next);
    if (next >= CHAIN.length) complete('quests');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {CHAIN.map((q, i) => {
          const isDone = i < doneCount;
          const isActive = i === doneCount;
          const locked = i > doneCount;
          return (
            <div
              key={q.id}
              className={`flex items-center gap-3 rounded-xs border p-3 transition-colors ${
                isActive ? 'border-(--primary) bg-(--color-base)' : 'border-lines-hover bg-(--color-base)'
              } ${locked ? 'opacity-40' : ''}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xs font-blender-medium text-xs ${
                  isDone ? 'bg-(--primary) text-(--color-base)' : 'bg-lines-hover text-text-secondary'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-blender-medium text-xs uppercase tracking-wide text-text-primary">
                  {q.trader}: {q.name}
                </span>
                <span className="truncate text-type-label font-blender-book text-text-secondary">
                  {isDone ? q.reward : q.req ?? 'доступно сразу'}
                </span>
              </div>
              {isActive && (
                <span className="shrink-0 text-type-label font-blender-medium uppercase tracking-wide text-(--primary)">
                  сейчас
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!allDone ? (
        <button
          onClick={advance}
          className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
        >
          Выполнить «{CHAIN[doneCount].name}»
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="border-l-2 border-(--primary) pl-3 text-sm font-blender-book leading-5 text-text-primary">
            Квесты — это рельсы прогресса: репутация торговцев, доступ к шмоту, новые локации и путь к эндгейму. Идут
            цепочками с зависимостями — часть гейтится уровнем или требует ⛏ предметы. Планируй цепочку заранее.
          </p>
          <Link
            href="/eft/progress/rookie"
            className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-opacity hover:opacity-80"
          >
            К Пути Новобранца
          </Link>
        </div>
      )}
    </div>
  );
}
