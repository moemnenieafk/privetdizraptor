'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Trash2, Download, Upload, RotateCcw, History } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';
import { useUser } from '@/hooks/useUser';
import { useQuestStore } from '@/store/useQuestStore';
import { listSlots, saveSlot, getSlot, clearSlot, AUTO_SLOT, type SlotMeta } from '@/lib/cta-api';

interface Props {
  onExport: () => void;
  onImport: (file: File) => void;
  onResetProgress: () => void;
}

const MANUAL_SLOTS = [1, 2, 3];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function snapshot() {
  const s = useQuestStore.getState();
  return { completedQuests: s.completedQuests, itemProgress: s.itemProgress, pinnedQuests: s.pinnedQuests, questNotes: s.questNotes };
}

function applyToStore(p: { completedQuests: string[]; itemProgress: Record<string, Record<string, number>>; pinnedQuests: string[]; questNotes: Record<string, string> }) {
  useQuestStore.getState().loadProgress(p.completedQuests, p.itemProgress);
  useQuestStore.setState({ pinnedQuests: p.pinnedQuests, questNotes: p.questNotes });
}

/**
 * Мобильный шит чекпоинтов (дискета нижнего дока) — 3 ручных слота + автослот, upsert по слоту.
 * Автослот пишется перед restore (страховка-undo). Внизу — офлайн-бэкап файлом + сброс.
 * Зеркалит десктопный QuestActionsDock, адаптировано под тач.
 */
export function QuestCheckpointsSheet({ onExport, onImport, onResetProgress }: Props) {
  const open = useQuestMapUiStore((s) => s.activeSheet === 'checkpoints');
  const closeSheet = useQuestMapUiStore((s) => s.closeSheet);
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');

  const refresh = useCallback(async () => { setSlots((await listSlots()) ?? []); }, []);
  useEffect(() => { if (open && user) void refresh(); }, [open, user, refresh]);

  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  const auto = bySlot.get(AUTO_SLOT);

  const handleSave = useCallback(async (slot: number) => {
    if (busy) return;
    setBusy(true);
    await saveSlot(slot, name.trim(), snapshot());
    setBusy(false); setName(''); void refresh();
  }, [busy, name, refresh]);

  const handleRestore = useCallback(async (slot: number) => {
    if (busy) return;
    setBusy(true);
    if (slot !== AUTO_SLOT) await saveSlot(AUTO_SLOT, 'Автосохранение', snapshot());
    const payload = await getSlot(slot);
    setBusy(false);
    if (payload) { applyToStore(payload); closeSheet(); }
  }, [busy, closeSheet]);

  const handleClear = useCallback(async (slot: number) => {
    if (busy) return;
    setBusy(true); await clearSlot(slot); setBusy(false); void refresh();
  }, [busy, refresh]);

  return (
    <BottomSheet open={open} title="Чекпоинты · 3 слота + авто" onClose={closeSheet}>
      <div className="flex flex-col gap-2 pb-2">
        {user ? (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Имя для сохранения"
              maxLength={60}
              className="h-11 w-full rounded-xs border border-lines-hover bg-(--color-base) px-3 font-blender-medium text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-(--primary)/40"
            />

            {MANUAL_SLOTS.map((n) => {
              const s = bySlot.get(n);
              return (
                <div key={n} className="flex items-center gap-2 rounded-xs border border-lines-hover bg-card-menu px-2.5 py-2">
                  {s ? (
                    <>
                      <button onClick={() => void handleRestore(n)} disabled={busy} className="flex min-w-0 flex-1 flex-col items-start text-left disabled:opacity-50">
                        <span className="w-full truncate font-blender-medium text-sm text-text-primary"><span className="text-text-muted">{n}. </span>{s.name}</span>
                        <span className="text-type-micro font-blender-book uppercase tracking-widest text-text-muted">{fmtDate(s.createdAt)} · {s.completedCount} кв.</span>
                      </button>
                      <button onClick={() => void handleSave(n)} disabled={busy} title="Перезаписать" className="flex size-9 shrink-0 items-center justify-center text-text-muted active:text-(--primary) disabled:opacity-50"><Save className="h-4 w-4" /></button>
                      <button onClick={() => void handleClear(n)} disabled={busy} title="Очистить" className="flex size-9 shrink-0 items-center justify-center text-text-muted active:text-danger disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-blender-medium text-sm text-text-muted"><span className="text-text-muted/60">{n}. </span>Пусто</span>
                      <button onClick={() => void handleSave(n)} disabled={busy} className="flex h-9 shrink-0 items-center gap-1.5 rounded border border-(--primary)/40 px-3 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) disabled:opacity-50">
                        <Save className="h-4 w-4" /> Сохранить
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            <div className="mt-1 flex items-center gap-2 rounded-xs border border-dashed border-lines-hover bg-card-menu/50 px-2.5 py-2">
              {auto ? (
                <button onClick={() => void handleRestore(AUTO_SLOT)} disabled={busy} className="flex min-w-0 flex-1 flex-col items-start text-left disabled:opacity-50">
                  <span className="flex items-center gap-1.5 font-blender-medium text-sm text-text-secondary"><History className="h-3.5 w-3.5 shrink-0" /> Автосохранение</span>
                  <span className="text-type-micro font-blender-book uppercase tracking-widest text-text-muted">{fmtDate(auto.createdAt)} · {auto.completedCount} кв.</span>
                </button>
              ) : (
                <span className="flex flex-1 items-center gap-1.5 font-blender-medium text-sm text-text-muted"><History className="h-3.5 w-3.5 shrink-0" /> Автослот пуст</span>
              )}
            </div>
          </>
        ) : (
          <p className="py-2 font-blender-book text-sm leading-relaxed text-text-muted">
            <a href="/login" className="text-(--primary)">Войдите</a>, чтобы сохранять чекпоинты и грузить их с любого устройства.
          </p>
        )}

        {/* Офлайн-бэкап файлом + сброс */}
        <div className="mt-1 flex items-center justify-center gap-4 border-t border-lines-hover pt-3">
          <button onClick={() => { onExport(); }} className="flex items-center gap-1.5 text-type-caption uppercase tracking-widest text-text-muted active:text-(--primary)"><Download className="h-4 w-4" /> Файл</button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-type-caption uppercase tracking-widest text-text-muted active:text-(--primary)"><Upload className="h-4 w-4" /> Импорт</button>
          <button onClick={() => { closeSheet(); onResetProgress(); }} className="flex items-center gap-1.5 text-type-caption uppercase tracking-widest text-danger/70 active:text-danger"><RotateCcw className="h-4 w-4" /> Сброс</button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) { onImport(f); e.currentTarget.value = ''; } }} />
    </BottomSheet>
  );
}
