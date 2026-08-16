'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, ExternalLink, Check, FileWarning } from 'lucide-react';
import { parseProfile, normalizeProfile } from '@/lib/tarkov/player-stats';
import { parseGameProfile } from '@/lib/parse-profile';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePmcStatsStore } from '@/store/usePmcStatsStore';
import { useIsPve } from '@/hooks/useGameMode';

const MAX_BYTES = 5 * 1024 * 1024; // профиль ~30–100 КБ; 5 МБ с запасом (как в ProfileUpload)

// Табы режима. В волне 1 — ВИЗУАЛЬНЫЕ: активный по useIsPve, Season неактивен, клик лишь
// подсвечивает (стату НЕ переключает). Волна 2 сделает их настоящим per-mode-селектором.
type ModeTab = 'season' | 'pvp' | 'pve';
const MODE_TABS: ReadonlyArray<{ id: ModeTab; label: string; enabled: boolean }> = [
  { id: 'season', label: 'Season', enabled: false },
  { id: 'pvp', label: 'PVP', enabled: true },
  { id: 'pve', label: 'PVE', enabled: true },
];

/**
 * Блок загрузки статистики (Figma 2865-2139, 208×160) — третий в верхнем ряду досье.
 * Точка входа для profile.json: парс/плуминг переиспользуют ту же логику, что ProfileUpload
 * (parseProfile → normalizeProfile → setView в usePmcStatsStore + флэт-апсерт в usePlayerStore).
 * Файл читается локально в браузере, наружу ничего не уходит (§4.11).
 */
export function DossierUploadBlock() {
  const pve = useIsPve();
  const setView = usePmcStatsStore((s) => s.setView);
  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const updateProfile = usePlayerStore((s) => s.updateProfile);

  // Подсвеченный таб: старт по режиму активного профиля (pve→pve, иначе pvp).
  const [activeTab, setActiveTab] = useState<ModeTab>(pve ? 'pve' : 'pvp');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setStatus(null);
      if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
        setStatus({ kind: 'err', text: 'Нужен .json-файл профиля.' });
        return;
      }
      if (file.size > MAX_BYTES) {
        setStatus({ kind: 'err', text: 'Файл слишком большой — это точно profile.json?' });
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        setStatus({ kind: 'err', text: 'Не удалось прочитать JSON — файл повреждён.' });
        return;
      }
      const profile = parseProfile(data);
      if (!profile) {
        setStatus({ kind: 'err', text: 'Не похоже на profile.json (нет aid/info/nickname).' });
        return;
      }
      // Рич-стата → отдельный стор (навыки/мастерство/рейды для секции досье).
      setView(normalizeProfile(profile));

      // Плуминг: плоский разбор → апсерт EFT-идентичности в активный профиль ЧВК
      // (пишем только достоверно прочитанное; null/отсутствующее не затирает — как в ProfileUpload).
      const parsed = parseGameProfile(data);
      const active = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
      if (parsed && active) {
        const faction: 'BEAR' | 'USEC' = parsed.side.toLowerCase() === 'usec' ? 'USEC' : 'BEAR';
        updateProfile(active.id, {
          nickname: parsed.nickname,
          faction,
          ...(parsed.experience != null ? { experience: parsed.experience } : {}),
          ...(parsed.level != null ? { level: String(parsed.level) } : {}),
          ...(parsed.prestige != null ? { prestige: String(parsed.prestige) } : {}),
          ...(parsed.memberCategory != null ? { memberCategory: parsed.memberCategory } : {}),
          ...(parsed.pmcStats.raids != null ? { raids: parsed.pmcStats.raids } : {}),
          ...(parsed.pmcStats.survivalRate != null ? { survivalRate: parsed.pmcStats.survivalRate } : {}),
          ...(parsed.pmcStats.hoursPlayed != null ? { hoursPlayed: parsed.pmcStats.hoursPlayed } : {}),
          ...(parsed.pmcStats.kills != null ? { kills: parsed.pmcStats.kills } : {}),
          ...(parsed.pmcStats.deaths != null ? { deaths: parsed.pmcStats.deaths } : {}),
          ...(parsed.pmcStats.killed != null ? { killed: parsed.pmcStats.killed } : {}),
          ...(parsed.pmcStats.survived != null ? { survived: parsed.pmcStats.survived } : {}),
          ...(parsed.pmcStats.kd != null ? { kd: parsed.pmcStats.kd } : {}),
        });
        setStatus({ kind: 'ok', text: `Загружено: «${parsed.nickname}»` });
      } else {
        setStatus({ kind: 'ok', text: 'Статистика загружена.' });
      }
    },
    [profiles, activeProfileId, updateProfile, setView],
  );

  return (
    <div className="flex h-40 w-52 shrink-0 flex-col gap-2 rounded-xs border border-lines-hover bg-card-menu p-3">
      {/* Лейбл «ВЫБОР РЕЖИМА» + линия */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Выбор режима
        </span>
        <div className="h-px flex-1 bg-lines-hover" />
      </div>

      {/* Табы Season / PVP / PVE (визуальные) */}
      <div className="flex gap-1">
        {MODE_TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!t.enabled}
              onClick={() => t.enabled && setActiveTab(t.id)}
              className={`flex-1 rounded-xs border px-1.5 py-1 text-type-micro font-blender-medium uppercase tracking-widest transition-colors ${
                active
                  ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)'
                  : t.enabled
                    ? 'border-lines-hover text-text-secondary hover:border-(--primary)'
                    : 'cursor-not-allowed border-lines-hover text-text-muted opacity-50'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Ссылка «где взять файл» */}
      <a
        href="https://tarkov.dev/players"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 text-type-micro font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
      >
        Скачай свой профиль тут
        <ExternalLink className="size-3" />
      </a>

      {/* Описание / статус (компактная строка): пока нет статуса — подсказка; после — итог */}
      {status ? (
        <p
          className={`flex items-start gap-1 text-type-caption font-blender-book leading-tight ${
            status.kind === 'ok' ? 'text-(--primary)' : 'text-(--color-danger)'
          }`}
        >
          {status.kind === 'ok' ? (
            <Check className="mt-px size-3 shrink-0" />
          ) : (
            <FileWarning className="mt-px size-3 shrink-0" />
          )}
          <span className="line-clamp-2">{status.text}</span>
        </p>
      ) : (
        <p className="text-type-caption font-blender-book leading-tight text-text-secondary">
          Выбери режим и загрузи его сюда для просмотра полной статистики.
        </p>
      )}

      {/* Кнопка загрузки — открывает файл-пикер */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-auto flex items-center justify-center gap-1.5 rounded-xs border border-lines-hover bg-(--color-base) px-2 py-1.5 text-type-caption font-blender-medium uppercase tracking-widest text-text-primary transition-colors hover:border-(--primary) hover:text-(--primary)"
      >
        <Upload className="size-3.5 shrink-0" />
        Загрузить статистику
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
