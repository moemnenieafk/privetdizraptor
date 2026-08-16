'use client';

import { useCallback, useRef, useState } from 'react';
import { FileUp, Check, FileWarning } from 'lucide-react';
import { parseProfile, normalizeProfile } from '@/lib/tarkov/player-stats';
import { parseGameProfile } from '@/lib/parse-profile';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePmcStatsStore } from '@/store/usePmcStatsStore';
import { useIsPve } from '@/hooks/useGameMode';

const MAX_BYTES = 5 * 1024 * 1024; // профиль ~30–100 КБ; 5 МБ с запасом (как в ProfileUpload)

// Табы режима. В волне 1 — ВИЗУАЛЬНЫЕ: активный по useIsPve, Season неактивен, клик лишь
// подсвечивает (стату НЕ переключает). Волна 2 сделает их настоящим per-mode-селектором.
type ModeTab = 'season' | 'pvp' | 'pve';
const MODE_TABS: ReadonlyArray<{ id: ModeTab; label: string; icon: string; enabled: boolean }> = [
  { id: 'season', label: 'Season', icon: 'seasons-icon', enabled: false },
  { id: 'pvp', label: 'PVP', icon: 'pvp-mode-icon', enabled: true },
  { id: 'pve', label: 'PVE', icon: 'pve-mode-icon', enabled: true },
];

const MODE_ICON_BASE = '/icons/eft/04-progression/seasons';

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
    <div className="flex h-40 w-52 shrink-0 flex-col items-start justify-between">
      {/* Верхняя группа: лейбл + табы режима */}
      <div className="flex w-full flex-col gap-2">
        {/* Лейбл «ВЫБОР РЕЖИМА» + линия */}
        <div className="flex w-full items-center gap-1.5">
          <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Выбор режима
          </span>
          <div className="h-px flex-1 bg-lines-hover" />
        </div>

        {/* Табы Season / PVP / PVE (визуальные; волна 2 — рабочий per-mode) */}
        <div className="flex w-full gap-2">
          {MODE_TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!t.enabled}
                onClick={() => t.enabled && setActiveTab(t.id)}
                className={`flex h-5 flex-1 items-center justify-center gap-1 rounded-xs border text-type-micro font-blender-medium uppercase transition-colors ${
                  active
                    ? 'border-tactical-amber bg-tactical-amber/10 text-tactical-amber'
                    : `border-lines-hover bg-card-menu text-text-secondary opacity-50 ${t.enabled ? 'hover:opacity-100' : 'cursor-not-allowed'}`
                }`}
              >
                <span
                  className={`icon-mask size-3 shrink-0 ${active ? 'bg-tactical-amber' : 'bg-text-secondary'}`}
                  style={{
                    WebkitMaskImage: `url(${MODE_ICON_BASE}/${t.icon}.svg)`,
                    maskImage: `url(${MODE_ICON_BASE}/${t.icon}.svg)`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                  }}
                  aria-hidden
                />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Центр: ссылка «где взять файл» + описание/статус (по центру, как в макете) */}
      <div className="flex w-full flex-col items-center gap-1 text-center">
        <a
          href="https://tarkov.dev/players"
          target="_blank"
          rel="noopener noreferrer"
          className="font-blender-book text-xs text-tactical-amber underline underline-offset-2 transition-opacity hover:opacity-80"
        >
          Скачай свой профиль тут
        </a>
        {status ? (
          <p
            className={`flex items-center justify-center gap-1 font-blender-book text-xs leading-tight ${
              status.kind === 'ok' ? 'text-tactical-amber' : 'text-(--color-danger)'
            }`}
          >
            {status.kind === 'ok' ? (
              <Check className="size-3 shrink-0" />
            ) : (
              <FileWarning className="size-3 shrink-0" />
            )}
            <span className="line-clamp-2">{status.text}</span>
          </p>
        ) : (
          <p className="font-blender-book text-xs leading-tight text-text-secondary">
            Выбери режим и загрузи его сюда для просмотра полной статистики.
          </p>
        )}
      </div>

      {/* Кнопка загрузки — на всю ширину, иконка file-up (открывает файл-пикер) */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-lines-hover bg-card-menu px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-tactical-amber hover:text-tactical-amber"
      >
        <FileUp className="size-4 shrink-0" />
        <span className="truncate">Загрузить статистику</span>
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
