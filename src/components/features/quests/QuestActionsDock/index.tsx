'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, RotateCcw, Trash2, Download, Upload, History } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useQuestStore } from '@/store/useQuestStore';
import {
  listSlots,
  saveSlot,
  getSlot,
  clearSlot,
  AUTO_SLOT,
  type SlotMeta,
} from '@/lib/cta-api';

interface Props {
  onExport: () => void;
  onImport: (file: File) => void;
  onResetProgress: () => void;
}

const iconBtnCls = 'flex h-9 w-9 items-center justify-center rounded border bg-card-menu backdrop-blur-sm transition-colors';
const MANUAL_SLOTS = [1, 2, 3];

// dd.mm HH:MM — компактная метка времени слота.
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Снимок persisted-полей прогресса (та же форма, что шлёт ProgressSync).
function snapshot() {
  const s = useQuestStore.getState();
  return {
    completedQuests: s.completedQuests,
    itemProgress: s.itemProgress,
    pinnedQuests: s.pinnedQuests,
    questNotes: s.questNotes,
  };
}

// Применить снимок в стор → ProgressSync сам сохранит как живой стейт.
function applyToStore(p: { completedQuests: string[]; itemProgress: Record<string, Record<string, number>>; pinnedQuests: string[]; questNotes: Record<string, string> }) {
  useQuestStore.getState().loadProgress(p.completedQuests, p.itemProgress);
  useQuestStore.setState({ pinnedQuests: p.pinnedQuests, questNotes: p.questNotes });
}

/**
 * Плавающий док действий снизу-справа (десктоп): дискета «Чекпоинты» (панель слотов над ней)
 * · сброс прогресса. 3 ручных слота + 1 автослот; сохранение = снимок прогресса на сервер,
 * грузится с любого устройства (привязан к аккаунту). Автослот пишется перед restore/сбросом
 * (страховка-undo). Файловый экспорт/импорт — вторичный офлайн-бэкап.
 */
export function QuestActionsDock({ onExport, onImport, onResetProgress }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const refresh = useCallback(async () => {
    const s = await listSlots();
    setSlots(s ?? []);
  }, []);

  useEffect(() => { if (open && user) void refresh(); }, [open, user, refresh]);

  const bySlot = new Map(slots.map((s) => [s.slot, s]));

  const handleSave = useCallback(async (slot: number) => {
    if (busy) return;
    setBusy(true);
    await saveSlot(slot, name.trim(), snapshot());
    setBusy(false);
    setName('');
    void refresh();
  }, [busy, name, refresh]);

  const handleRestore = useCallback(async (slot: number) => {
    if (busy) return;
    setBusy(true);
    // Перед загрузкой ручного слота — страховка: текущий стейт в автослот (undo).
    if (slot !== AUTO_SLOT) await saveSlot(AUTO_SLOT, 'Автосохранение', snapshot());
    const payload = await getSlot(slot);
    setBusy(false);
    if (payload) { applyToStore(payload); setOpen(false); }
  }, [busy]);

  const handleClear = useCallback(async (slot: number) => {
    if (busy) return;
    setBusy(true);
    await clearSlot(slot);
    setBusy(false);
    void refresh();
  }, [busy, refresh]);

  // Сброс: сперва страховка в автослот (снимок текущего), затем штатный модал сброса.
  const handleReset = useCallback(() => {
    if (user) void saveSlot(AUTO_SLOT, 'Автосохранение', snapshot());
    onResetProgress();
  }, [user, onResetProgress]);

  const auto = bySlot.get(AUTO_SLOT);

  return (
    <div className="absolute bottom-3.5 right-3.5 z-20 hidden items-center gap-2 lg:flex">
      <div ref={rootRef} className="relative">
        {/* Панель слотов над дискетой */}
        <div
          className={`absolute bottom-full right-0 mb-2 w-72 rounded-lg border border-lines-hover bg-(--color-base)/95 p-3 shadow-lg backdrop-blur-md transition-[transform,opacity] duration-200 ${
            open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
          }`}
        >
          <p className="mb-2 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">Чекпоинты · 3 слота + авто</p>

          {user ? (
            <>
              {/* Имя для следующего сохранения */}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя для сохранения"
                maxLength={60}
                className="mb-2 h-8 w-full rounded-xs border border-lines-hover bg-(--color-base) px-2.5 font-blender-medium text-type-caption text-text-primary outline-none placeholder:text-text-muted focus:border-(--primary)/40"
              />

              {/* 3 ручных слота */}
              <div className="flex flex-col gap-1">
                {MANUAL_SLOTS.map((n) => {
                  const s = bySlot.get(n);
                  return (
                    <div key={n} className="group flex items-center gap-2 rounded-xs border border-lines-hover bg-card-menu px-2 py-1.5">
                      {s ? (
                        <>
                          <button onClick={() => void handleRestore(n)} disabled={busy} className="flex min-w-0 flex-1 flex-col items-start text-left disabled:opacity-50" title={`Загрузить слот ${n}`}>
                            <span className="w-full truncate font-blender-medium text-type-caption text-text-primary group-hover:text-(--primary)">
                              <span className="text-text-muted">{n}. </span>{s.name}
                            </span>
                            <span className="text-type-micro font-blender-book uppercase tracking-widest text-text-muted">{fmtDate(s.createdAt)} · {s.completedCount} кв.</span>
                          </button>
                          <button onClick={() => void handleSave(n)} disabled={busy} title="Перезаписать слот" className="shrink-0 text-text-muted transition-colors hover:text-(--primary) disabled:opacity-50"><Save className="h-3.5 w-3.5" /></button>
                          <button onClick={() => void handleClear(n)} disabled={busy} title="Очистить слот" className="shrink-0 text-text-muted transition-colors hover:text-danger disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 font-blender-medium text-type-caption text-text-muted"><span className="text-text-muted/60">{n}. </span>Пусто</span>
                          <button onClick={() => void handleSave(n)} disabled={busy} title={`Сохранить в слот ${n}`} className="flex shrink-0 items-center gap-1 text-type-micro font-blender-medium uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80 disabled:opacity-50">
                            <Save className="h-3.5 w-3.5" /> Сохранить
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Автослот */}
              <div className="mt-1.5 flex items-center gap-2 rounded-xs border border-dashed border-lines-hover bg-card-menu/50 px-2 py-1.5" title="Пишется автоматически перед загрузкой слота и сбросом — страховка">
                {auto ? (
                  <button onClick={() => void handleRestore(AUTO_SLOT)} disabled={busy} className="group flex min-w-0 flex-1 flex-col items-start text-left disabled:opacity-50" title="Откатить к автосохранению">
                    <span className="flex items-center gap-1 truncate font-blender-medium text-type-caption text-text-secondary group-hover:text-(--primary)"><History className="h-3 w-3 shrink-0" /> Автосохранение</span>
                    <span className="text-type-micro font-blender-book uppercase tracking-widest text-text-muted">{fmtDate(auto.createdAt)} · {auto.completedCount} кв.</span>
                  </button>
                ) : (
                  <span className="flex flex-1 items-center gap-1 font-blender-medium text-type-caption text-text-muted"><History className="h-3 w-3 shrink-0" /> Автослот пуст</span>
                )}
              </div>
            </>
          ) : (
            <p className="py-2 font-blender-book text-xs leading-relaxed text-text-muted">
              <a href="/login" className="text-(--primary) hover:underline">Войдите</a>, чтобы сохранять слоты и грузить их с любого устройства.
            </p>
          )}

          {/* Вторично: офлайн-бэкап файлом */}
          <div className="mt-2 flex items-center justify-center gap-3 border-t border-lines-hover pt-2 text-type-micro uppercase tracking-widest text-text-muted">
            <button onClick={onExport} className="flex items-center gap-1 transition-colors hover:text-(--primary)"><Download className="h-3 w-3" /> Файл</button>
            <span>·</span>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 transition-colors hover:text-(--primary)"><Upload className="h-3 w-3" /> Импорт</button>
          </div>
        </div>

        {/* Дискета «Чекпоинты» */}
        <button
          onClick={() => setOpen((v) => !v)}
          title="Чекпоинты прогресса"
          aria-expanded={open}
          className={`${iconBtnCls} ${open ? 'border-(--primary) text-(--primary)' : 'border-lines-hover text-text-secondary hover:border-(--primary)/40 hover:text-(--primary)'}`}
        >
          <Save className="h-4 w-4" />
        </button>
      </div>

      <button onClick={handleReset} title="Сбросить прогресс заданий" className={`${iconBtnCls} border-danger/60 text-danger/60 hover:border-danger hover:bg-danger/10 hover:text-danger`}>
        <RotateCcw className="h-4 w-4" />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) { onImport(f); e.currentTarget.value = ''; } }}
      />
    </div>
  );
}
