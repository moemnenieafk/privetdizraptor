'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 05 «Торговцы и репутация»: выполняешь задания Прапора → растёт уровень лояльности,
// открывается лучший шмот и падает комиссия. Учим, зачем гриндить трейдер-квесты.

interface LoyaltyLevel {
  ll: number;
  unlock: string;
  commission: string;
}

const LEVELS: LoyaltyLevel[] = [
  { ll: 1, unlock: 'Базовые пистолеты, дешёвый патрон', commission: 'комиссия высокая' },
  { ll: 2, unlock: 'Автоматы, патрон получше, гранаты', commission: 'комиссия ниже' },
  { ll: 3, unlock: 'Пробивной патрон, крупные стволы', commission: 'комиссия низкая' },
  { ll: 4, unlock: 'Топ-ассортимент и лучшие цены', commission: 'минимальная комиссия' },
];

const QUESTS_PER_LEVEL = 2;
const MAX_QUESTS = QUESTS_PER_LEVEL * (LEVELS.length - 1); // до ЛУ4

export function TradersClient() {
  const [quests, setQuests] = useState(0);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const currentLL = Math.min(LEVELS.length, 1 + Math.floor(quests / QUESTS_PER_LEVEL));
  const maxed = quests >= MAX_QUESTS;
  const inLevel = maxed ? QUESTS_PER_LEVEL : quests % QUESTS_PER_LEVEL;
  const fill = maxed ? 1 : inLevel / QUESTS_PER_LEVEL;

  const doQuest = () => {
    if (maxed) return;
    const nextQ = quests + 1;
    setQuests(nextQ);
    if (nextQ >= MAX_QUESTS) complete('traders');
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Шапка торговца + уровень лояльности */}
      <div className="flex items-center justify-between rounded-xs border border-lines-hover bg-(--color-base) p-4">
        <div className="flex flex-col">
          <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">Прапор</span>
          <span className="text-type-label font-blender-book uppercase text-text-secondary">Оружие и патроны</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-blender-medium text-sm uppercase tracking-widest text-(--primary)">ЛУ {currentLL}</span>
          <span className="text-type-label font-blender-book uppercase text-text-secondary">
            {LEVELS[currentLL - 1].commission}
          </span>
        </div>
      </div>

      {/* Прогресс до следующего уровня */}
      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 w-full overflow-hidden rounded-xs bg-lines-hover">
          <div
            className="h-full rounded-xs bg-(--primary) transition-all duration-300"
            style={{ width: `${fill * 100}%` }}
          />
        </div>
        <span className="text-type-label font-blender-book uppercase text-text-secondary">
          {maxed ? 'Максимальная лояльность' : `Заданий до ЛУ ${currentLL + 1}: ${QUESTS_PER_LEVEL - inLevel}`}
        </span>
      </div>

      {/* Ассортимент по уровням */}
      <div className="flex flex-col gap-2">
        {LEVELS.map((lvl) => {
          const open = lvl.ll <= currentLL;
          return (
            <div
              key={lvl.ll}
              className={`flex items-center gap-3 rounded-xs border p-3 transition-colors ${
                open ? 'border-lines-hover bg-(--color-base)' : 'border-lines-hover opacity-40'
              }`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xs font-blender-medium text-xs ${
                  open ? 'bg-(--primary) text-(--color-base)' : 'bg-lines-hover text-text-secondary'
                }`}
              >
                {lvl.ll}
              </div>
              <span className="flex-1 text-sm font-blender-book leading-4 text-text-primary">{lvl.unlock}</span>
              <span className="shrink-0 text-type-label font-blender-medium uppercase tracking-wide text-text-secondary">
                {open ? 'Открыто' : 'Закрыто'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Действие / итог */}
      {!maxed ? (
        <button
          onClick={doQuest}
          className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
        >
          Выполнить задание Прапора
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="border-l-2 border-(--primary) pl-3 text-sm font-blender-book leading-5 text-text-primary">
            Вот зачем квесты торговцев: лояльность растёт — открывается лучший шмот и патрон, а комиссия падает. Прокачанные
            трейдеры экономят миллионы и дают то, чего нет на барахолке.
          </p>
          <Link
            href="/eft/progress/rookie/path"
            className="flex h-11 items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-opacity hover:opacity-80"
          >
            К Пути Новобранца
          </Link>
        </div>
      )}
    </div>
  );
}
