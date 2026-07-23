'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Radar, Send, FolderOpen } from 'lucide-react';
import { useCompanionStore } from '@/store/useCompanionStore';
import {
  ensureReadPermission,
  loadDirHandle,
  readNewestScreenshot,
  saveDirHandle,
} from '@/lib/eft-screenshot';
import { buildMatcher, type CatalogEntry, type MatchResult } from '@/lib/companion/match';

const POLL_MS = 1500;

interface DirWithFile {
  getFileHandle(name: string): Promise<FileSystemFileHandle>;
}

export function CompanionReader({ initialKarma }: { initialKarma?: number }) {
  const { active, status, gameMode, offers, contributed, karma, setActive, setStatus, setGameMode, addOffers, clearOffers, addContributed, setKarma, markSubmitted } =
    useCompanionStore();

  // Начальная репутация с сервера (один раз).
  useEffect(() => {
    if (initialKarma != null) setKarma(initialKarma);
  }, [initialKarma, setKarma]);

  const [lastGain, setLastGain] = useState(0); // сколько кармы дала последняя выгрузка

  const intervalRef = useRef<number | null>(null);
  const lastNameRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const matchRef = useRef<((t: string) => MatchResult | null) | null>(null);

  const ensureMatcher = useCallback(async () => {
    if (matchRef.current) return;
    const res = await fetch('/api/companion/catalog');
    if (!res.ok) throw new Error('каталог недоступен');
    const { items } = (await res.json()) as { items: CatalogEntry[] };
    matchRef.current = buildMatcher(items);
  }, []);

  const scan = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      if (busyRef.current) return;
      const shot = await readNewestScreenshot(handle);
      if (!shot || shot.name === lastNameRef.current) return;
      lastNameRef.current = shot.name;
      busyRef.current = true;
      setStatus({ kind: 'scanning' });
      try {
        const fileHandle = await (handle as unknown as DirWithFile).getFileHandle(shot.name);
        const file = await fileHandle.getFile();
        const { parseFleaScreenshot } = await import('@/lib/companion/ocr');
        const found = await parseFleaScreenshot(file, matchRef.current ?? (() => null));
        addOffers(found); // накапливаем: скрин за скрином складываются в общий список
      } catch (e) {
        setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Ошибка распознавания' });
        return;
      } finally {
        busyRef.current = false;
      }
      setStatus({ kind: 'watching' });
    },
    [addOffers, setStatus],
  );

  const start = useCallback(async () => {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      setStatus({ kind: 'unsupported' });
      return;
    }
    setStatus({ kind: 'requesting' });
    try {
      await ensureMatcher();
      let handle = await loadDirHandle();
      if (handle && !(await ensureReadPermission(handle))) handle = null;
      if (!handle) {
        const picker = window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> };
        handle = await picker.showDirectoryPicker();
        await ensureReadPermission(handle);
        await saveDirHandle(handle);
      }
      const h = handle;
      setActive(true);
      setStatus({ kind: 'watching' });
      void scan(h);
      intervalRef.current = window.setInterval(() => void scan(h), POLL_MS);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setStatus({ kind: 'idle' });
        return;
      }
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Не удалось подключить папку' });
    }
  }, [ensureMatcher, scan, setActive, setStatus]);

  const stop = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastNameRef.current = null;
    setActive(false);
    setStatus({ kind: 'idle' });
    clearOffers();
    void import('@/lib/companion/ocr').then((m) => m.disposeOcr());
  }, [setActive, setStatus, clearOffers]);

  const submit = useCallback(async () => {
    if (offers.length === 0) return;
    setStatus({ kind: 'submitting' });
    try {
      const res = await fetch('/api/companion/flea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameMode, offers: offers.map((o) => ({ inGameId: o.inGameId, price: o.price })) }),
      });
      if (res.status === 401) {
        setStatus({ kind: 'error', message: 'Войдите, чтобы отправлять цены' });
        return;
      }
      if (!res.ok) {
        setStatus({ kind: 'error', message: 'Сервер отклонил отправку' });
        return;
      }
      const { accepted, karma: newKarma, gained } = (await res.json()) as { accepted: number; karma?: number; gained?: number };
      addContributed(accepted);
      if (typeof newKarma === 'number') setKarma(newKarma);
      if (typeof gained === 'number') setLastGain(gained);
      if (accepted > 0) markSubmitted([...new Set(offers.map((o) => o.inGameId))]); // worklist уберёт эти предметы
      clearOffers();
      setStatus({ kind: active ? 'watching' : 'idle' });
    } catch {
      setStatus({ kind: 'error', message: 'Сеть недоступна' });
    }
  }, [offers, gameMode, active, addContributed, clearOffers, setStatus, setKarma, markSubmitted]);

  useEffect(
    () => () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    },
    [],
  );

  const statusText: Record<CompanionStatusKind, string> = {
    idle: 'Не подключено',
    requesting: 'Выбор папки…',
    watching: 'Слежу за скриншотами',
    scanning: 'Распознаю…',
    submitting: 'Отправка…',
    unsupported: 'Нужен Chrome/Edge на ПК',
    error: status.kind === 'error' ? status.message : '',
  };

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-lines-hover bg-(--color-base)/60 p-5">
      {/* статус + подключение */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Radar className={`h-4 w-4 ${status.kind === 'scanning' ? 'animate-pulse text-(--primary)' : 'text-text-secondary'}`} />
          <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary">
            {statusText[status.kind]}
          </span>
        </div>
        <button
          type="button"
          onClick={active ? stop : () => void start()}
          className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest transition-colors ${
            active
              ? 'border-(--primary) bg-(--primary) text-(--color-base)'
              : 'border-lines-hover bg-(--color-base)/80 text-text-secondary hover:text-(--primary)'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {active ? 'Остановить' : 'Подключить папку'}
        </button>
      </div>

      {/* режим игры */}
      <div className="flex items-center gap-2">
        {(['regular', 'pve'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setGameMode(m)}
            className={`rounded-xs border px-2.5 py-1 font-blender-medium text-type-micro uppercase tracking-widest transition-colors ${
              gameMode === m
                ? 'border-(--primary) text-(--primary)'
                : 'border-lines-hover text-text-muted hover:text-text-secondary'
            }`}
          >
            {m === 'regular' ? 'PvP' : 'PvE'}
          </button>
        ))}
        <span className="ml-auto font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          репутация: <span className="text-(--primary)">{karma.toFixed(2)}</span>
          {lastGain > 0 && <span className="text-(--color-success)"> +{lastGain.toFixed(3)}</span>}
          {contributed > 0 && ` · +${contributed} за сессию`}
        </span>
      </div>

      {/* превью накопленных офферов (складываются со всех скриншотов сессии) */}
      {offers.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              {offers.length} предложений · {new Set(offers.map((o) => o.inGameId)).size} предметов
            </span>
            <button
              type="button"
              onClick={clearOffers}
              className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
            >
              Очистить
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xs border border-lines">
            {offers.map((o, i) => (
              <div
                key={`${o.inGameId}-${o.price}-${i}`}
                className="flex items-center justify-between border-b border-lines px-3 py-1.5 last:border-b-0"
              >
                <span className="truncate font-blender-book text-type-caption text-text-secondary">{o.name}</span>
                <span className="font-blender-medium text-xs text-text-primary">{o.price.toLocaleString('ru-RU')} ₽</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={status.kind === 'submitting'}
            className="flex items-center justify-center gap-1.5 rounded-sm border border-(--primary) bg-(--primary) px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Отправить {offers.length} предложений
          </button>
        </div>
      )}
    </div>
  );
}

type CompanionStatusKind = ReturnType<typeof useCompanionStore.getState>['status']['kind'];
