'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Первый этап «Пути Новобранца»: петля рейда через выбор — заход → лут → выстрел →
// решение → эвакуация/смерть. Ноль риска, учим руками, а не текстом.

type Choice = { label: string; to: string };
interface SimNode {
  id: string;
  kind: 'step' | 'win' | 'lose';
  title: string;
  body: string;
  teach?: string;
  choices?: Choice[];
}

const NODES: Record<string, SimNode> = {
  start: {
    id: 'start',
    kind: 'step',
    title: 'Заход в рейд',
    body: 'Ты — ЧВК с базовым шмотом. Высадка на Таможне. Цель проста и жестока: выжить и дойти до эвакуации.',
    teach: 'Рейд — это забег с ценностями. Умер — потерял всё, что не в секур-контейнере. Вышел — забрал добычу с собой.',
    choices: [{ label: 'Осмотреться', to: 'loot' }],
  },
  loot: {
    id: 'loot',
    kind: 'step',
    title: 'Лут',
    body: 'В здании — ящик с лутом и труп Дикого. За окном тихо, но ты тут не один.',
    teach: 'Лут = деньги на новый шмот и квесты. Но каждая секунда над ящиком — риск словить пулю.',
    choices: [
      { label: 'Быстро лутнуть и уходить', to: 'shot' },
      { label: 'Обчистить всё подряд', to: 'shot' },
    ],
  },
  shot: {
    id: 'shot',
    kind: 'step',
    title: 'Выстрелы рядом',
    body: 'Совсем близко трещит очередь. Кто-то ведёт бой — или идёт за тобой.',
    teach: 'Звук в Таркове — это информация. Паника гонит на пулю; выдержка спасает.',
    choices: [
      { label: 'Укрыться и оценить', to: 'decide' },
      { label: 'Рвануть на звук', to: 'fight' },
    ],
  },
  decide: {
    id: 'decide',
    kind: 'step',
    title: 'Решение',
    body: 'Из укрытия видно: ЧВК с хорошим рюкзаком добивает кого-то. До выхода «Ж/Д» — рукой подать.',
    teach: 'Жадность убивает чаще пуль. Живой с малым лутом богаче мёртвого с полным рюкзаком.',
    choices: [
      { label: 'Тихо отойти к эваку', to: 'extract' },
      { label: 'Напасть ради его добра', to: 'fight' },
    ],
  },
  fight: {
    id: 'fight',
    kind: 'lose',
    title: 'Тебя убили',
    body: 'Обмен очередями. У него броня и хороший патрон, у тебя — базовый. Ты падаешь. Весь шмот, что не в секур-контейнере, остаётся врагу.',
    teach: 'Что выживает после смерти — только секур-контейнер. Патрон и броня решают бой чаще, чем «скилл». Это отдельные этапы Пути.',
  },
  extract: {
    id: 'extract',
    kind: 'win',
    title: 'Эвакуация',
    body: 'Ты на выходе «Ж/Д». Держишь кнопку — идёт таймер. Экран темнеет: «Вы выжили». Всё, что вынес, теперь твоё.',
    teach: 'Вот и вся петля: заход → лут/бой → эвакуация. Выход — это и есть победа. Отсюда растёт весь Тарков.',
  },
};

export function RaidSimClient() {
  const [nodeId, setNodeId] = useState('start');
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const node = NODES[nodeId];

  useEffect(() => {
    if (node.kind === 'win') complete('raid');
  }, [node.kind, complete]);

  const stepNo = useMemo(() => {
    const order = ['start', 'loot', 'shot', 'decide'];
    const i = order.indexOf(nodeId);
    return i >= 0 ? i + 1 : order.length;
  }, [nodeId]);

  const terminal = node.kind !== 'step';
  const accent =
    node.kind === 'win' ? 'text-(--primary)' : node.kind === 'lose' ? 'text-danger' : 'text-text-primary';

  return (
    <div className="flex flex-col gap-5">
      {/* Прогресс-полоса шагов */}
      <div className="flex items-center gap-1.5">
        {['start', 'loot', 'shot', 'decide'].map((id, i) => (
          <div
            key={id}
            className={`h-1 flex-1 rounded-xs transition-colors ${i < stepNo ? 'bg-(--primary)' : 'bg-lines-hover'}`}
          />
        ))}
      </div>

      {/* Карточка ситуации */}
      <div className="flex flex-col gap-3 rounded-xs border border-lines-hover bg-(--color-base) p-5">
        <h2 className={`text-sm font-blender-medium uppercase tracking-widest ${accent}`}>{node.title}</h2>
        <p className="text-sm font-blender-book leading-5 text-text-primary">{node.body}</p>
        {node.teach && (
          <p className="border-l-2 border-lines-hover pl-3 text-type-label font-blender-book leading-4 text-text-secondary">
            {node.teach}
          </p>
        )}
      </div>

      {/* Выбор / терминал */}
      {!terminal && node.choices && (
        <div className="flex flex-col gap-2">
          {node.choices.map((c) => (
            <button
              key={c.label}
              onClick={() => setNodeId(c.to)}
              className="flex h-11 items-center justify-start rounded-xs border border-lines-hover bg-(--color-base) px-4 font-blender-medium text-xs uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {terminal && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setNodeId('start')}
            className="flex h-11 items-center rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Пройти заново
          </button>
          <Link
            href="/eft/progress/rookie"
            className="flex h-11 items-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-opacity hover:opacity-80"
          >
            {node.kind === 'win' ? 'К Пути Новобранца' : 'Назад к Пути'}
          </Link>
        </div>
      )}
    </div>
  );
}
