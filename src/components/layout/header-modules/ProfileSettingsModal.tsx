'use client';

import { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { ProfileResetModal } from './ProfileResetModal';
import type { ProfileOcrResult } from '@/types/profile-ocr';

export type EditionType = 'Standard' | 'LB' | 'PFE' | 'EOD' | 'TUE';

export const EDITIONS: Record<EditionType, { id: EditionType, name: string, sub: string, color: string, border: string, bgAlpha: string, icon: string, placeholder: string }> = {
  TUE: { id: 'TUE', name: 'The Unheard', sub: 'ultimate edition', color: 'text-edition-tue', border: 'border-edition-tue', bgAlpha: 'bg-edition-tue/10', icon: 'icon-eft-profile-tue', placeholder: 'placeholder:text-edition-tue/50' },
  EOD: { id: 'EOD', name: 'Edge of Darkness', sub: 'limited edition', color: 'text-edition-eod', border: 'border-edition-eod', bgAlpha: 'bg-edition-eod/10', icon: 'icon-eft-profile-eod', placeholder: 'placeholder:text-edition-eod/50' },
  PFE: { id: 'PFE', name: 'Prepare for Escape', sub: 'extended edition', color: 'text-edition-pfe', border: 'border-edition-pfe', bgAlpha: 'bg-edition-pfe/10', icon: 'icon-eft-profile-pfe', placeholder: 'placeholder:text-edition-pfe/50' },
  LB: { id: 'LB', name: 'Left Behind', sub: 'early access edition', color: 'text-edition-lb', border: 'border-edition-lb', bgAlpha: 'bg-edition-lb/10', icon: 'icon-eft-profile-lb', placeholder: 'placeholder:text-edition-lb/50' },
  Standard: { id: 'Standard', name: 'Standard', sub: 'basic edition', color: 'text-edition-std', border: 'border-edition-std', bgAlpha: 'bg-edition-std/10', icon: 'icon-eft-profile-s', placeholder: 'placeholder:text-edition-std/50' }
};

// Общие пропсы формы профиля ЧВК (значения + сеттеры — байндятся на usePlayerStore снаружи).
export interface ProfileSettingsFields {
  edition: EditionType;
  setEdition: (val: EditionType) => void;
  faction: 'USEC' | 'BEAR';
  setFaction: (val: 'USEC' | 'BEAR') => void;
  mode: 'PVP' | 'PVE';
  setMode: (val: 'PVP' | 'PVE') => void;
  nickname: string;
  setNickname: (val: string) => void;
  level: string;
  setLevel: (val: string) => void;
  prestige: string;
  setPrestige: (val: string) => void;
  traderLevels: Record<string, number>;
  setTraderLevels: (val: Record<string, number>) => void;
  hoursPlayed?: number | null;
  setHoursPlayed?: (val: number | null) => void;
  raids?: number | null;
  setRaids?: (val: number | null) => void;
  survivalRate?: number | null;
  setSurvivalRate?: (val: number | null) => void;
}

interface ProfileSettingsModalProps extends ProfileSettingsFields {
  isOpen: boolean;
  onClose: () => void;
}

// Конфигурация списка торговцев в правильном порядке
const TRADERS = [
  { id: 'prapor', name: 'Прапор', icon: 'icon-eft-quests-prapor' },
  { id: 'therapist', name: 'Терапевт', icon: 'icon-eft-quests-therapist' },
  { id: 'fence', name: 'Скупщик', icon: 'icon-eft-quests-fence' },
  { id: 'skier', name: 'Лыжник', icon: 'icon-eft-quests-skier' },
  { id: 'peacekeeper', name: 'Миротворец', icon: 'icon-eft-quests-peacekeeper' },
  { id: 'mechanic', name: 'Механик', icon: 'icon-eft-quests-mechanic' },
  { id: 'ragman', name: 'Барахольщик', icon: 'icon-eft-quests-ragman' },
  { id: 'jaeger', name: 'Егерь', icon: 'icon-eft-quests-jaeger' },
  { id: 'ref', name: 'Реф', icon: 'icon-eft-quests-ref' },
];

// Хелпер для иконки уровня (из PlayerTelemetry)
const getLevelGroup = (level: number) => {
  if (level < 5) return 1;
  return Math.min(16, Math.floor(level / 5) + 1);
};

/**
 * ФОРМА настроек профиля ЧВК — весь функционал (ник/уровень/престиж/издание/фракция/
 * режим/торговцы/OCR/сброс) без модальной обвязки. Используется:
 *  - в модалке хедера (ProfileSettingsModal ниже);
 *  - инлайн в табе «Профиль ЧВК» вкладки «Трекинг» (Аккаунт Центр).
 * onNestedModalToggle — сигнал родителю, что открыта вложенная модалка сброса
 * (модалка-хост по нему отключает свой click-outside).
 */
export function ProfileSettingsForm({
  edition, setEdition, faction, setFaction, mode, setMode,
  nickname, setNickname, level, setLevel, prestige, setPrestige,
  traderLevels, setTraderLevels,
  hoursPlayed, setHoursPlayed,
  raids, setRaids,
  survivalRate, setSurvivalRate,
  onNestedModalToggle,
}: ProfileSettingsFields & { onNestedModalToggle?: (open: boolean) => void }) {
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpenRaw] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setIsResetModalOpen = (open: boolean) => {
    setIsResetModalOpenRaw(open);
    onNestedModalToggle?.(open);
  };

  // Обработчики изменения уровня (1-99)
  const handleLevelChange = (delta: number) => {
    const current = level === '' ? 1 : Number(level);
    const next = Math.max(1, Math.min(99, current + delta));
    setLevel(next.toString());
  };
  const handleLevelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); handleLevelChange(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleLevelChange(-1); }
  };

  // Обработчики изменения престижа (0-6)
  const handlePrestigeChange = (delta: number) => {
    const current = prestige === '' ? 0 : Number(prestige);
    const next = Math.max(0, Math.min(6, current + delta));
    setPrestige(next.toString());
  };
  const handlePrestigeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); handlePrestigeChange(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); handlePrestigeChange(-1); }
  };

  // Автоопределение профиля по скриншоту (Gemini Vision).
  // Каркас: распознавание лишь ПРЕД-ЗАПОЛНЯЕТ форму — пользователь проверяет и правит.
  // Реальные вызовы включаются заданием GEMINI_API_KEY на сервере (см. /api/profile-ocr).
  const handleAutoDetect = () => {
    if (isAutoDetecting) return;
    setOcrError(null);
    fileInputRef.current?.click();
  };

  const runOcr = async (dataUrl: string, mimeType: string) => {
    setOcrError(null);
    setIsAutoDetecting(true);
    try {
      const res = await fetch('/api/profile-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mimeType }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOcrError(typeof json?.error === 'string' ? json.error : 'Не удалось распознать');
        return;
      }
      const d = json.data as ProfileOcrResult;
      // Применяем только распознанные поля (null — оставляем как есть).
      if (d.nickname) setNickname(d.nickname.slice(0, 15));
      if (d.level != null) setLevel(String(Math.max(1, Math.min(99, d.level))));
      if (d.prestige != null) setPrestige(String(Math.max(0, Math.min(6, d.prestige))));
      if (d.edition) setEdition(d.edition);
      if (d.faction) setFaction(d.faction);
      if (d.mode) setMode(d.mode);
      if (d.hoursPlayed != null && setHoursPlayed) setHoursPlayed(d.hoursPlayed);
      if (d.raids != null && setRaids) setRaids(d.raids);
      if (d.survivalRate != null && setSurvivalRate) setSurvivalRate(d.survivalRate);
    } catch {
      setOcrError('Сеть недоступна');
    } finally {
      setIsAutoDetecting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволяем выбрать тот же файл повторно
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { void runOcr(reader.result as string, file.type || 'image/png'); };
    reader.onerror = () => setOcrError('Не удалось прочитать файл');
    reader.readAsDataURL(file);
  };

  const activeEd = EDITIONS[edition];
  // PRO-статус из подписки. Биллинга нет — берём ту же логику, что и Аккаунт-центр
  // (премиум-издания TUE/EOD = активная PRO-подписка).
  const isPro = edition === 'TUE' || edition === 'EOD';

  return (
    <div className="flex w-full flex-col items-center justify-center gap-7">

      {/* ИМЯ ЧВК */}
      <div className="flex w-full flex-col items-start justify-start gap-2">
        <div className="text-base font-blender-medium uppercase leading-4 text-text-secondary">Имя ЧВК</div>
        <div className={`flex h-10 w-full items-center justify-start gap-2 rounded border bg-(--color-base) px-2 py-3.5 transition-all duration-300 ${nickname.length >= 15 ? 'border-danger shadow-[0_0_12px_rgba(194,67,57,0.3)]' : 'border-lines-hover'}`}>
          <div className="flex w-6 items-center justify-center">
            <div className={`h-4 w-4 icon-mask ${activeEd.icon} ${activeEd.color}`} />
          </div>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          maxLength={15}
            className={`flex-1 w-full bg-transparent text-xl font-blender-medium leading-5 ${activeEd.color} outline-none ${activeEd.placeholder}`}
            spellCheck={false}
          />
          {isPro && (
            <div
              className="flex shrink-0 items-center gap-1 rounded-xs bg-tactical-amber/10 px-1.5 py-1"
              title="PRO-статус — активная подписка (Аккаунт-центр)"
            >
              <div className="h-3.5 w-3.5 icon-mask icon-account_prostatus_icon bg-tactical-amber" />
              <span className="text-type-micro font-blender-medium leading-none tracking-wider text-tactical-amber">
                PRO
              </span>
            </div>
          )}
        </div>
      </div>

      {/* УРОВЕНЬ И ПРЕСТИЖ */}
      <div className="flex w-full items-start justify-start gap-7">
        <div className="flex flex-1 flex-col items-start justify-start gap-2">
          <div className="text-base font-blender-medium uppercase leading-4 text-text-secondary">Уровень ЧВК</div>
          <div className="flex h-10 w-full items-center justify-between rounded border border-lines-hover bg-(--color-base) px-2 py-1">
            <img className="h-7 w-7 object-contain" src={`/icons/eft/lvl-icons/player-level-group-${getLevelGroup(Number(level) || 1)}.webp`} alt={`Level ${level}`} />
            <input
              type="text"
              value={level}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '').slice(0, 2);
                if (val === '0' || val === '00') val = '';
                else if (val.length === 2 && val.startsWith('0')) val = val[1];
                setLevel(val);
              }}
              onKeyDown={handleLevelKeyDown}
              className="flex-1 w-full bg-transparent px-1 text-center text-2xl font-blender-medium leading-6 text-zinc-100 outline-none placeholder:text-zinc-100/30"
              placeholder="1"
            />
            <div className="flex flex-col items-center justify-center gap-0.5">
              <button onClick={() => handleLevelChange(1)} className="flex h-3 w-4 items-center justify-center text-text-muted hover:text-(--primary) transition-colors focus:outline-none">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button onClick={() => handleLevelChange(-1)} className="flex h-3 w-4 items-center justify-center text-text-muted hover:text-(--primary) transition-colors focus:outline-none">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-start justify-start gap-2">
          <div className="text-base font-blender-medium uppercase leading-4 text-text-secondary">Престиж</div>
          <div className="flex h-10 w-full items-center justify-between rounded border border-lines-hover bg-(--color-base) px-2 py-1">
            {!prestige || prestige === '0' ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                <div className="h-4 w-4 icon-mask icon-eft-prog-prestige text-lines-hover" />
              </div>
            ) : (
              <img className="h-7 w-7 shrink-0 object-contain" src={`/icons/eft/prestige/prestige-${prestige}.webp`} alt={`Prestige ${prestige}`} />
            )}
            <input
              type="text"
              value={prestige === '0' ? '' : prestige}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '').slice(0, 1);
                if (Number(val) > 6) val = '6';
                setPrestige(val);
              }}
              onKeyDown={handlePrestigeKeyDown}
              className="flex-1 w-full bg-transparent px-1 text-center text-2xl font-blender-medium leading-6 text-zinc-100 outline-none placeholder:text-type-caption placeholder:tracking-tight placeholder:text-zinc-100/40"
              placeholder="НЕТ ПРЕСТИЖА"
            />
            <div className="flex flex-col items-center justify-center gap-0.5">
              <button onClick={() => handlePrestigeChange(1)} className="flex h-3 w-4 items-center justify-center text-text-muted hover:text-(--primary) transition-colors focus:outline-none">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button onClick={() => handlePrestigeChange(-1)} className="flex h-3 w-4 items-center justify-center text-text-muted hover:text-(--primary) transition-colors focus:outline-none">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {(setHoursPlayed || setRaids || setSurvivalRate) && (
        // Три стата в один ряд: Часов · Рейдов · Выживаемость (равные колонки; подписи
        // фикс-высоты min-h-8, чтобы длинные названия при переносе не разъезжали инпуты).
        <div className="flex w-full items-start gap-2">
          {setHoursPlayed && (
            <div className="flex min-w-0 flex-1 flex-col items-start justify-start gap-2">
              <div className="w-full truncate text-type-micro font-blender-medium uppercase leading-4 text-text-secondary">Часов в игре</div>
              <div className="flex h-10 w-full min-w-0 items-center rounded border border-lines-hover bg-(--color-base) px-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={hoursPlayed != null ? String(hoursPlayed) : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setHoursPlayed?.(digits === '' ? null : Number(digits));
                  }}
                  className="min-w-0 flex-1 bg-transparent text-lg font-blender-medium leading-5 text-zinc-100 outline-none placeholder:text-type-caption placeholder:text-zinc-100/40"
                  placeholder="—"
                  spellCheck={false}
                />
                <span className="text-type-label font-blender-medium uppercase text-text-secondary">ч</span>
              </div>
            </div>
          )}
          {setRaids && (
            <div className="flex min-w-0 flex-1 flex-col items-start justify-start gap-2">
              <div className="w-full truncate text-type-micro font-blender-medium uppercase leading-4 text-text-secondary">Рейдов</div>
              <div className="flex h-10 w-full min-w-0 items-center rounded border border-lines-hover bg-(--color-base) px-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={raids != null ? String(raids) : ''}
                  onChange={(e) => setRaids?.(e.target.value.replace(/\D/g, '').slice(0, 5) === '' ? null : Number(e.target.value.replace(/\D/g, '').slice(0, 5)))}
                  className="min-w-0 flex-1 bg-transparent text-lg font-blender-medium leading-5 text-zinc-100 outline-none placeholder:text-type-caption placeholder:text-zinc-100/40"
                  placeholder="—"
                  spellCheck={false}
                />
              </div>
            </div>
          )}
          {setSurvivalRate && (
            <div className="flex min-w-0 flex-1 flex-col items-start justify-start gap-2">
              <div className="w-full truncate text-type-micro font-blender-medium uppercase leading-4 text-text-secondary">Выживаемость</div>
              <div className="flex h-10 w-full min-w-0 items-center rounded border border-lines-hover bg-(--color-base) px-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={survivalRate != null ? String(survivalRate) : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setSurvivalRate?.(digits === '' ? null : Math.min(100, Number(digits)));
                  }}
                  className="min-w-0 flex-1 bg-transparent text-lg font-blender-medium leading-5 text-zinc-100 outline-none placeholder:text-type-caption placeholder:text-zinc-100/40"
                  placeholder="—"
                  spellCheck={false}
                />
                <span className="text-type-label font-blender-medium uppercase text-text-secondary">%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ИЗДАНИЕ */}
      <div className="flex w-full flex-col items-start justify-start gap-2">
        <div className="flex w-full items-start justify-start gap-2">
          <div className="flex-1 text-base font-blender-medium uppercase leading-4 text-text-secondary">Издание</div>
          <div className="flex flex-col items-end justify-start">
            <div className={`text-lg font-blender-medium leading-4 ${activeEd.color}`}>{activeEd.name}</div>
            <div className={`text-type-caption font-blender-medium leading-2.5 ${activeEd.color}`}>{activeEd.sub}</div>
          </div>
        </div>

        {/* Кнопки изданий */}
        <div className="flex w-full items-start justify-between">
          {(['Standard', 'LB', 'PFE', 'EOD', 'TUE'] as EditionType[]).map((key) => {
            const ed = EDITIONS[key];
            const isActive = edition === ed.id;
            return (
              <button
                key={ed.id}
                onClick={() => setEdition(ed.id)}
                className={`flex h-10 w-12 items-center justify-center rounded border transition-colors ${
                  isActive ? `${ed.border} ${ed.bgAlpha}` : 'border-transparent bg-lines-hover hover:border-text-secondary'
                }`}
              >
                <div className={`h-4 w-6 icon-mask ${ed.icon} ${isActive ? ed.color : 'text-text-secondary opacity-50'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ФРАКЦИИ И РЕЖИМЫ (В один ряд) */}
      <div className="flex w-full items-start justify-between gap-2">
        {/* Фракции */}
        <div className="flex flex-1 gap-1">
          <button onClick={() => setFaction('USEC')} className={`flex flex-1 flex-col items-center justify-center rounded border h-14 transition-all ${faction === 'USEC' ? 'border-sky-500 bg-linear-to-t from-sky-500/20 to-transparent' : 'border-lines-hover bg-(--color-base) hover:border-sky-500/50'}`}>
            <img src="/icons/eft/profile-pannel/USEC-logo-sign.svg" alt="USEC" className={`h-10 w-10 object-contain transition-opacity ${faction === 'USEC' ? 'opacity-100' : 'opacity-40'}`} />
          </button>
          <button onClick={() => setFaction('BEAR')} className={`flex flex-1 flex-col items-center justify-center rounded border h-14 transition-all ${faction === 'BEAR' ? 'border-orange-700 bg-linear-to-t from-orange-700/20 to-transparent' : 'border-lines-hover bg-(--color-base) hover:border-orange-700/50'}`}>
            <img src="/icons/eft/profile-pannel/BEAR-logo-sign.svg" alt="BEAR" className={`h-10 w-10 object-contain transition-opacity ${faction === 'BEAR' ? 'opacity-100' : 'opacity-40'}`} />
          </button>
        </div>
        {/* Режимы */}
        <div className="flex flex-1 gap-1">
          <button onClick={() => setMode('PVP')} className={`flex flex-1 items-center justify-center gap-1.5 rounded border h-14 transition-all ${mode === 'PVP' ? 'border-edition-pfe bg-edition-pfe/10' : 'border-lines-hover bg-(--color-base) hover:border-edition-pfe/50'}`}>
            <div className={`w-5 h-5 icon-bg icon-eft-profile-pvp transition-opacity ${mode === 'PVP' ? 'opacity-100' : 'opacity-40'}`} />
            <div className={`text-sm font-blender-medium leading-none ${mode === 'PVP' ? 'text-edition-pfe' : 'text-text-secondary opacity-40'}`}>PvP</div>
          </button>
          <button onClick={() => setMode('PVE')} className={`flex flex-1 items-center justify-center gap-1.5 rounded border h-14 transition-all ${mode === 'PVE' ? 'border-edition-tue bg-edition-tue/10' : 'border-lines-hover bg-(--color-base) hover:border-edition-tue/50'}`}>
            <div className={`w-5 h-5 icon-bg icon-eft-profile-pve transition-opacity ${mode === 'PVE' ? 'opacity-100' : 'opacity-40'}`} />
            <div className={`text-sm font-blender-medium leading-none ${mode === 'PVE' ? 'text-edition-tue' : 'text-text-secondary opacity-40'}`}>PvE</div>
          </button>
        </div>
      </div>

      {/* УРОВНИ ТОРГОВЦЕВ (Grid) */}
      <div className="flex w-full flex-col items-start justify-start gap-2">
        <div className="text-base font-blender-medium uppercase leading-4 text-text-secondary">Уровни торговцев</div>
        <div className="grid w-full grid-cols-9 gap-1.25">

          {/* Аватарки торговцев */}
          {TRADERS.map((t) => (
            <div key={`avatar-${t.id}`} className="group/avatar relative flex h-6 w-full items-center justify-center rounded-xs cursor-help">
              <div className={`w-6 h-6 icon-bg ${t.icon}`} />
              {/* Всплывающая подсказка */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-(--color-base) border border-lines-hover rounded shadow-lg text-type-caption font-blender-medium uppercase whitespace-nowrap text-text-secondary opacity-0 group-hover/avatar:opacity-100 pointer-events-none transition-opacity z-50">
                {t.name}
              </div>
            </div>
          ))}

          {/* Уровень КОРОНА (IV) */}
          {TRADERS.map((t) => (
            <button key={`rep-4-${t.id}`} onClick={() => setTraderLevels({ ...traderLevels, [t.id]: 4 })} className="w-full focus:outline-none group/btn">
              <div className={`h-5 w-full icon-mask icon-eft-profile-rep-4 transition-colors ${traderLevels[t.id] >= 4 ? 'text-(--primary)' : 'text-lines-hover group-hover/btn:text-(--primary)/50'}`} />
            </button>
          ))}

          {/* Уровень III */}
          {TRADERS.map((t) =>
            t.id === 'fence' ? (
              <div key={`rep-3-${t.id}`} className="w-full h-5" />
            ) : (
              <button key={`rep-3-${t.id}`} onClick={() => setTraderLevels({ ...traderLevels, [t.id]: 3 })} className="w-full focus:outline-none group/btn">
                <div className={`h-5 w-full icon-mask icon-eft-profile-rep-3 transition-colors ${traderLevels[t.id] >= 3 ? 'text-zinc-100' : 'text-lines-hover group-hover/btn:text-text-muted'}`} />
              </button>
            )
          )}

          {/* Уровень II */}
          {TRADERS.map((t) =>
            t.id === 'fence' ? (
              <div key={`rep-2-${t.id}`} className="w-full h-5" />
            ) : (
              <button key={`rep-2-${t.id}`} onClick={() => setTraderLevels({ ...traderLevels, [t.id]: 2 })} className="w-full focus:outline-none group/btn">
                <div className={`h-5 w-full icon-mask icon-eft-profile-rep-2 transition-colors ${traderLevels[t.id] >= 2 ? 'text-zinc-100' : 'text-lines-hover group-hover/btn:text-text-muted'}`} />
              </button>
            )
          )}

          {/* Уровень I */}
          {TRADERS.map((t) => (
            <button key={`rep-1-${t.id}`} onClick={() => setTraderLevels({ ...traderLevels, [t.id]: 1 })} className="w-full focus:outline-none group/btn">
              <div className={`h-5 w-full icon-mask icon-eft-profile-rep-1 transition-colors ${traderLevels[t.id] >= 1 ? 'text-zinc-100' : 'text-lines-hover group-hover/btn:text-text-muted'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* АВТООПРЕДЕЛЕНИЕ ПРОФИЛЯ ПО СКРИНШОТУ (Gemini OCR) */}
      <div className="flex w-full flex-col gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={handleAutoDetect}
          disabled={isAutoDetecting}
          className="group relative flex h-8 w-full cursor-pointer items-center justify-center overflow-hidden rounded border border-lines-hover bg-(--color-base) transition-colors hover:border-(--primary) disabled:opacity-50 disabled:cursor-wait"
        >
          <div className="absolute left-0 top-0 h-full w-2 opacity-50 transition-colors bg-[repeating-linear-gradient(-45deg,#52525B,#52525B_3px,transparent_3px,transparent_6px)] group-hover:bg-[repeating-linear-gradient(-45deg,var(--primary),var(--primary)_3px,transparent_3px,transparent_6px)]" />
          <div className="absolute right-0 top-0 h-full w-2 opacity-50 transition-colors bg-[repeating-linear-gradient(-45deg,#52525B,#52525B_3px,transparent_3px,transparent_6px)] group-hover:bg-[repeating-linear-gradient(-45deg,var(--primary),var(--primary)_3px,transparent_3px,transparent_6px)]" />

          {isAutoDetecting ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-(--primary)" />
              <span className="text-type-caption font-blender-medium uppercase tracking-wide text-(--primary)">Распознаю скриншот...</span>
            </div>
          ) : (
            <span className="text-type-micro font-blender-medium uppercase tracking-wide text-text-secondary transition-colors group-hover:text-(--primary)">Загрузить скриншот профиля для распознавания</span>
          )}
        </button>
        {ocrError && (
          <span className="text-type-micro font-blender-medium uppercase tracking-wide text-danger">
            {ocrError}
          </span>
        )}
      </div>

      {/* КНОПКА СБРОСА ПРОГРЕССА */}
      <div className="flex w-full items-start justify-center gap-2 opacity-60 transition-opacity hover:opacity-100">
        <button onClick={() => setIsResetModalOpen(true)} className="flex h-7 flex-1 items-center justify-center gap-2 rounded border border-danger bg-danger/10 transition-colors hover:bg-danger/20 focus:outline-none">
          <div className="h-3 w-3 icon-mask icon-eft-profile-reset text-danger" />
          <span className="text-xs font-blender-medium leading-3 text-danger">СБРОС ПРОГРЕССА</span>
        </button>
        <div className="flex-1 text-type-micro font-blender-medium leading-2.25 text-danger">
          Внимание! После нажатия данной кнопки будет произведен полный сброс прогресса вашего ЧВК в игре!
        </div>
      </div>

      {/* Модальное окно подтверждения сброса */}
      <ProfileResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          setNickname('TarkovCitizen');
          setLevel('1');
          setPrestige('0');
          setEdition('Standard');
          setFaction('USEC');
          setMode('PVE');
          setTraderLevels({ prapor: 1, therapist: 1, fence: 1, skier: 1, peacekeeper: 1, mechanic: 1, ragman: 1, jaeger: 1, ref: 1 });
          setIsResetModalOpen(false);
        }}
      />
    </div>
  );
}

export function ProfileSettingsModal({ isOpen, onClose, ...fields }: ProfileSettingsModalProps) {

  // Состояния для анимации модального окна
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [isNestedOpen, setIsNestedOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне модалки, если не открыто вложенное окно сброса
  useClickOutside(modalRef, onClose, isVisible && !isNestedOpen);

  // Эффект задержки для плавного появления/исчезновения
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Закрытие по клавише Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  return (
    // Оверлей модального окна
    <div
      className={`fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >

      {/* Контейнер модалки (348px) */}
      <div
        ref={modalRef}
        className={`flex w-87 flex-col items-start justify-start shadow-2xl transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
      >

        {/* ШАПКА */}
        <div className="relative flex h-7 w-full items-center justify-start gap-1 rounded-t bg-lines-hover">
          <div className="flex h-7 w-7 items-center justify-center p-1.5">
            <div className="h-full w-full icon-mask icon-eft-profile-settings text-text-secondary" />
          </div>
          <div className="text-sm font-blender-medium leading-4 text-zinc-100">Настройки профиля ЧВК</div>

          {/* Кнопка закрытия */}
          <button onClick={onClose} className="absolute right-0 top-0 h-7 w-7 flex items-center justify-center transition-opacity hover:opacity-80">
            <div className="flex h-3 w-4 items-center justify-center rounded-xs bg-danger-dim">
              <div className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
            </div>
          </button>
        </div>

        {/* ТЕЛО МОДАЛКИ */}
        <div className="flex w-full flex-col overflow-hidden rounded-b border border-lines-hover bg-card-menu p-7">
          <ProfileSettingsForm {...fields} onNestedModalToggle={setIsNestedOpen} />
        </div>
      </div>
    </div>
  );
}
