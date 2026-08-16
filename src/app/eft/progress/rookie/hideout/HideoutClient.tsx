'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRookieStore } from '@/store/useRookieStore';

// Этап 08 «Убежище»: собери нужные предметы под станцию → улучшай. Учим needed-items и порядок.

interface Station {
  id: string;
  name: string;
  items: string[];
  bonus: string;
}

const STATIONS: Station[] = [
  { id: 'generator', name: 'Генератор', items: ['Топливо', 'Провода', 'Аккумулятор'], bonus: 'питание для других станций' },
  { id: 'workbench', name: 'Верстак', items: ['⛏ Отвёртка', 'Гайки', 'Изолента'], bonus: 'крафт патронов и гранат' },
];

export function HideoutClient() {
  const [stationIdx, setStationIdx] = useState(0);
  const [gathered, setGathered] = useState<Set<string>>(new Set());
  const [upgradedFirst, setUpgradedFirst] = useState(false);
  const [done, setDone] = useState(false);
  const complete = useRookieStore((s) => s.complete);

  useEffect(() => {
    void useRookieStore.persist.rehydrate();
  }, []);

  const station = STATIONS[stationIdx];
  const allGathered = station.items.every((it) => gathered.has(`${station.id}:${it}`));

  const toggle = (item: string) => {
    const key = `${station.id}:${item}`;
    setGathered((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const upgrade = () => {
    if (!allGathered) return;
    if (stationIdx + 1 >= STATIONS.length) {
      setDone(true);
      complete('hideout');
    } else {
      setUpgradedFirst(true);
      setStationIdx((i) => i + 1);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xs border border-(--primary) bg-(--color-base) p-5">
          <span className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
            Убежище растёт
          </span>
          <p className="text-sm font-blender-book leading-5 text-text-primary">
            Каждая станция требует свой набор предметов — и часто в определённом порядке (нет генератора — не поднять
            верстак). Держи список нужного под рукой и не выкидывай хлам: болты и отвёртки уходят в апгрейды.
          </p>
        </div>
        <Link
          href="/eft/progress/rookie/path"
          className="flex h-11 w-full items-center justify-center rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-wide text-(--primary) transition-opacity hover:opacity-80"
        >
          К Пути Новобранца
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Прогресс станций */}
      <div className="flex items-center gap-1.5">
        {STATIONS.map((s, i) => (
          <div key={s.id} className={`h-1 flex-1 rounded-xs ${i < stationIdx || (i === 0 && upgradedFirst) ? 'bg-(--primary)' : i === stationIdx ? 'bg-text-secondary' : 'bg-lines-hover'}`} />
        ))}
      </div>

      <div className="flex flex-col gap-1 rounded-xs border border-lines-hover bg-(--color-base) p-4">
        <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">{station.name}</span>
        <span className="text-type-label font-blender-book uppercase text-text-secondary">Даёт: {station.bonus}</span>
      </div>

      <p className="text-type-label font-blender-book uppercase text-text-secondary">
        Отметь собранные предметы:
      </p>

      <div className="flex flex-col gap-2">
        {station.items.map((it) => {
          const has = gathered.has(`${station.id}:${it}`);
          return (
            <button
              key={it}
              onClick={() => toggle(it)}
              className={`flex items-center gap-3 rounded-xs border bg-(--color-base) p-3 text-left transition-colors ${
                has ? 'border-(--primary)' : 'border-lines-hover hover:border-text-secondary'
              }`}
            >
              <div className={`h-4 w-4 shrink-0 rounded-xs border ${has ? 'border-(--primary) bg-(--primary)' : 'border-lines-hover'}`} />
              <span className="flex-1 font-blender-medium text-xs uppercase tracking-wide text-text-primary">{it}</span>
              <span className="text-type-label font-blender-book uppercase text-text-secondary">
                {has ? 'есть' : 'нужно'}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={upgrade}
        disabled={!allGathered}
        className={`flex h-11 items-center justify-center rounded-xs border px-4 font-blender-medium text-xs uppercase tracking-wide transition-colors ${
          allGathered
            ? 'border-(--primary) text-(--primary) hover:bg-(--primary) hover:text-(--color-base)'
            : 'cursor-not-allowed border-lines-hover text-text-secondary opacity-50'
        }`}
      >
        {allGathered ? `Улучшить: ${station.name}` : 'Собери все предметы'}
      </button>
    </div>
  );
}
