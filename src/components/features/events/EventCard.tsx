'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { EftEvent, EftEventContent, EftEventContentStatus } from '@/types/eft-events';
import { getCategoryMeta } from '@/data/eft-events';
import { formatEventRange } from '@/lib/eft-events-utils';
import { EventCategoryGlyph } from './EventCategoryGlyph';
import { useIsPve } from '@/hooks/useGameMode';

/** Лейблы статусов дублируем на клиенте: серверный резолвер в бандл не тянем. */
const STATUS_LABEL: Record<EftEventContentStatus, string> = {
  permanent: 'Контент остался в игре',
  seasonal: 'Возвращается вместе с ивентом',
  expired: 'Награды больше не выдаются',
  unknown: 'Статус наград уточняется',
};

/** Актуальные статусы подсвечиваем primary, потухшие — приглушаем. */
function statusChipClass(status: EftEventContentStatus): string {
  const base = 'rounded-xs px-1.5 py-0.5 font-blender-medium text-xs uppercase tracking-widest';
  if (status === 'permanent') {
    return `${base} border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary)`;
  }
  return `${base} border border-lines-hover text-text-muted`;
}

interface EventCardProps {
  event: EftEvent;
  /** Квесты, достижения и бартеры ивента, сверенные с базой (резолвятся на сервере). */
  content?: EftEventContent;
  /** Статус контента после окончания ивента (считается на сервере). */
  status: EftEventContentStatus;
  defaultOpen?: boolean;
}

/** Узел таймлайна: точка на рельсе, шапка-кнопка, раскрывающийся список изменений. */
export function EventCard({ event, content, status, defaultOpen = false }: EventCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isPve = useIsPve();
  const meta = getCategoryMeta(event.category);
  const panelId = `event-changes-${event.id}`;

  return (
    <li id={event.id} className="relative scroll-mt-24">
      {/* Точка на вертикальной рельсе */}
      <span
        aria-hidden="true"
        className={`absolute -left-[31px] top-6 h-3 w-3 rounded-full border-2 bg-(--color-base) ${
          event.active ? 'border-(--primary)' : 'border-lines-hover'
        }`}
      />

      <div
        className={`rounded border bg-card-menu transition-colors ${
          event.active ? 'border-(--primary)' : 'border-lines-hover hover:border-(--primary)'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-start gap-3 p-4 text-left"
        >
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xs bg-(--color-darkbase) text-(--primary)">
            <EventCategoryGlyph category={event.category} />
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
                {formatEventRange(event)}
              </span>
              {event.active && (
                <span className="rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] px-1.5 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
                  Идёт сейчас
                </span>
              )}
              {!event.active && status !== 'unknown' && (
                <span className={statusChipClass(status)}>{STATUS_LABEL[status]}</span>
              )}
              {event.pvpOnly && (
                <span className={`rounded-xs border px-1.5 py-0.5 font-blender-medium text-xs uppercase tracking-widest ${isPve ? 'border-edition-tue text-edition-tue' : 'border-lines-hover text-text-muted'}`}>
                  {isPve ? 'Не в PvE' : 'Только PvP'}
                </span>
              )}
              {event.patch && (
                <span className="rounded-xs border border-lines-hover px-1.5 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                  Патч {event.patch}
                </span>
              )}
            </span>

            <span className="font-blender-medium uppercase tracking-wide text-text-primary">
              {event.title}
            </span>

            <span className="font-blender-book text-sm leading-relaxed text-text-secondary">
              {event.summary}
            </span>

            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">
              {meta.label}
              {event.titleEn ? ` · ${event.titleEn}` : ''}
            </span>
          </span>

          <ChevronDown
            aria-hidden="true"
            className={`mt-2 size-4 shrink-0 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div id={panelId} className="border-t border-lines-hover px-4 py-4">
            <ul className="flex flex-col gap-2">
              {event.changes.map((change, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 font-blender-book text-sm leading-relaxed text-text-secondary"
                >
                  <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-(--primary)" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>

            {event.contentNote && (
              <p className="mt-4 border-t border-lines-hover pt-4 font-blender-book text-sm leading-relaxed text-text-muted">
                {event.contentNote}
              </p>
            )}

            {/* Задания ивента, оставшиеся в игре, — ссылки в базу квестов */}
            {content && content.quests.length > 0 && (
              <div className="mt-4 border-t border-lines-hover pt-4">
                <div className="mb-2.5 font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                  Задания ивента в игре
                </div>
                <div className="flex flex-wrap gap-2">
                  {content.quests.map((quest) => (
                    <Link
                      key={quest.id}
                      href={`/eft/quests/task/${quest.id}`}
                      className="rounded-xs border border-lines-hover bg-(--color-base) px-2 py-1 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                    >
                      {quest.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Достижения: статус курируется — наличие в базе ещё не значит, что его можно получить */}
            {content && content.achievements.length > 0 && (
              <div className="mt-4 border-t border-lines-hover pt-4">
                <div className="mb-2.5 font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                  Достижения ивента
                </div>
                <div className="flex flex-col gap-2">
                  {content.achievements.map((achievement) => (
                    <div key={achievement.name} className="flex flex-wrap items-center gap-2">
                      <span className="font-blender-book text-sm text-text-secondary">
                        {achievement.name}
                      </span>
                      <span className={statusChipClass(achievement.status)}>
                        {achievement.status === 'permanent' ? 'Можно получить' : 'Не выдаётся'}
                      </span>
                      {achievement.id === null && (
                        <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                          Нет в базе
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Бартеры: актуальность считается по живой базе, а не по ручному флажку */}
            {content && content.barters.length > 0 && (
              <div className="mt-4 border-t border-lines-hover pt-4">
                <div className="mb-2.5 font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                  Бартеры ивента
                </div>
                <div className="flex flex-col gap-2">
                  {content.barters.map((barter) => (
                    <div key={barter.label} className="flex flex-wrap items-center gap-2">
                      <span className="font-blender-book text-sm text-text-secondary">
                        {barter.label} · УЛ{barter.level}
                      </span>
                      <span className={statusChipClass(barter.live ? 'permanent' : 'expired')}>
                        {barter.live ? 'Актуален' : 'Свёрнут'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
