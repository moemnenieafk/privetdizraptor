'use client';
import type { QuestsHubNavTab } from '@/lib/quests-nav';
import { QuestNavTab } from './QuestNavTab';

export interface QuestsNavRow {
  label: string;
  tabs: QuestsHubNavTab[];
}

interface QuestsNavBarProps {
  rows: QuestsNavRow[];
  /** Явный active (для task/[id], где URL не совпадает с href таба-родителя). */
  activeHref?: string;
}

/**
 * Тонкая навигация-полоса для глубоких уровней «Заданий» (страница торговца/истории/квеста).
 * Только ряды-переключатели, без заголовка — крупный заголовок уже есть на самой странице.
 * Пустые ряды отбрасываются; если рядов нет — не рендерится.
 */
export function QuestsNavBar({ rows, activeHref }: QuestsNavBarProps) {
  const visible = rows.filter((r) => r.tabs.length > 0);
  if (visible.length === 0) return null;

  return (
    <nav className="w-full flex flex-col gap-3 mb-8">
      {visible.map((row) => (
        <div key={row.label} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="shrink-0 sm:w-28 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            {row.label}
          </span>
          <div className="flex flex-wrap gap-2">
            {row.tabs.map((tab) => (
              <QuestNavTab key={tab.id} tab={tab} activeHref={activeHref} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
