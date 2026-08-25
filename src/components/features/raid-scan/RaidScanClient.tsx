'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ScanSearch, Upload, RotateCcw, AlertTriangle } from 'lucide-react';
import { useRaidScanStore } from '@/store/raid-scan-store';
import type {
  GridGeometry,
  GridRect,
  RecognizedSlot,
  ScanFailure,
} from '@/lib/vision/types';
import {
  displayPrice,
  formatRub,
  type RaidScanPriceMap,
} from './raid-scan-prices';

interface RaidScanClientProps {
  prices: RaidScanPriceMap;
}

/** Цвет обводки слота по типу распознавания (NIGHTFALL-токены). */
const KIND_STROKE: Record<RecognizedSlot['kind'], string> = {
  phash: 'var(--color-nvg-green)', // уверенное совпадение — «успех»
  vision: 'var(--color-mode-pve)', // подтверждено vision — «инфо»
  unknown: 'var(--color-tactical-amber)', // требует ручного выбора — «warning»
};

const KIND_LABEL: Record<RecognizedSlot['kind'], string> = {
  phash: 'Точное совпадение',
  vision: 'Распознано ИИ',
  unknown: 'Не распознано',
};

/** Пиксельный прямоугольник слота из геометрии сетки и rect в ячейках. */
function rectToPx(geometry: GridGeometry, rect: GridRect) {
  return {
    x: geometry.originX + rect.x * geometry.pitch,
    y: geometry.originY + rect.y * geometry.pitch,
    w: rect.w * geometry.pitch,
    h: rect.h * geometry.pitch,
  };
}

/** Понятное сообщение по типу отказа API. */
function failureCopy(failure: ScanFailure): { title: string; hint: string } {
  switch (failure.error) {
    case 'unsupported_media':
      return { title: 'Неподдерживаемый файл', hint: failure.message };
    case 'too_large':
      return { title: 'Файл слишком большой', hint: failure.message };
    case 'grid_not_found':
      return {
        title: 'Сетка инвентаря не найдена',
        hint: 'Загрузи чистый скриншот с видимой сеткой схрона или контейнера — без наложений интерфейса.',
      };
    case 'rate_limited': {
      const sec = Math.ceil(failure.retryAfterMs / 1000);
      return {
        title: 'Слишком часто',
        hint: `Разбор доступен снова через ${sec} с — скан идёт через платный ИИ, поэтому лимитирован.`,
      };
    }
    case 'upstream':
      // API отдаёт 'upstream' + «Требуется вход» для неавторизованных (см. route.ts).
      return failure.message === 'Требуется вход'
        ? {
            title: 'Нужен вход',
            hint: 'Разбор рейда доступен только авторизованным игрокам — войди в аккаунт и попробуй снова.',
          }
        : {
            title: 'Сервис распознавания недоступен',
            hint: failure.message || 'Попробуй позже.',
          };
  }
}

export function RaidScanClient({ prices }: RaidScanClientProps) {
  const scan = useRaidScanStore((s) => s.scan);
  const selectedSlot = useRaidScanStore((s) => s.selectedSlot);
  const runScan = useRaidScanStore((s) => s.runScan);
  const selectSlot = useRaidScanStore((s) => s.selectSlot);
  const reset = useRaidScanStore((s) => s.reset);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  // Ручной выбор игрока для нераспознанных слотов: индекс слота → itemId кандидата.
  const [manualPicks, setManualPicks] = useState<Record<number, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Живём с URL.createObjectURL — освобождаем прошлый, чтобы не течь памятью.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function accept(file: File | undefined | null) {
    if (!file) return;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setNatural(null);
    setManualPicks({});
    void runScan(file);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragActive(false);
    accept(e.dataTransfer.files?.[0]);
  }

  function onReset() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setNatural(null);
    setManualPicks({});
    if (inputRef.current) inputRef.current.value = '';
    reset();
  }

  const isScanning = scan.status === 'scanning';
  const result = scan.status === 'ready' ? scan.result : null;

  const recognizedRows = useMemo(() => {
    if (!result) return [];
    return result.slots.map((slot, index) => {
      const manualId = manualPicks[index];
      let itemId: string | null = null;
      let name = 'Не распознано';
      if (slot.kind === 'unknown') {
        if (manualId) {
          const c = slot.candidates.find((cand) => cand.itemId === manualId);
          if (c) {
            itemId = c.itemId;
            name = c.name;
          }
        }
      } else {
        itemId = slot.itemId;
        name = slot.name;
      }
      const price = itemId ? prices[itemId] : undefined;
      return { index, slot, name, price: displayPrice(price) };
    });
  }, [result, manualPicks, prices]);

  const total = useMemo(
    () => recognizedRows.reduce((sum, r) => sum + (r.price ?? 0), 0),
    [recognizedRows],
  );

  return (
    <div className="flex flex-col gap-7">
      {/* Дропзона — показываем, пока нет активного превью */}
      {!previewUrl && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`group flex min-h-64 cursor-pointer flex-col items-center justify-center gap-4 rounded-md border border-dashed p-8 text-center transition-colors ${
            dragActive
              ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
              : 'border-lines-hover bg-card-menu hover:border-(--primary)'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => accept(e.target.files?.[0])}
          />
          <ScanSearch className="h-10 w-10 text-text-muted transition-colors group-hover:text-(--primary)" />
          <div className="flex flex-col gap-1">
            <span className="font-blender-medium uppercase tracking-widest text-text-primary">
              Перетащи скриншот инвентаря
            </span>
            <span className="text-sm text-text-secondary font-blender-book">
              или нажми, чтобы выбрать файл (PNG, JPEG, WEBP · до 8 МБ)
            </span>
          </div>
          <span className="inline-flex items-center gap-2 rounded border border-lines-hover bg-(--color-base) px-4 py-2 text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
            <Upload className="h-3.5 w-3.5" />
            Выбрать файл
          </span>
        </label>
      )}

      {/* Панель управления при активном превью */}
      {previewUrl && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            {isScanning ? 'Идёт разбор рейда…' : 'Результат разбора'}
          </span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded border border-lines-hover bg-card-menu px-4 py-2 text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Новый скрин
          </button>
        </div>
      )}

      {/* Скелетон сетки во время скана (форма будущего контента, не спиннер) */}
      {isScanning && (
        <div className="grid grid-cols-8 gap-1 rounded-md border border-lines-hover bg-card-menu p-3">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xs bg-lines-hover animate-pulse"
              style={{ animationDelay: `${(i % 8) * 60}ms` }}
            />
          ))}
        </div>
      )}

      {/* Ошибка */}
      {scan.status === 'failed' && (
        <FailureCard failure={scan.failure} />
      )}

      {/* Превью + SVG-оверлей сетки */}
      {previewUrl && result && (
        <div className="relative w-full overflow-hidden rounded-md border border-lines-hover bg-(--color-base)">
          {/* eslint-disable-next-line @next/next/no-img-element -- локальный object-URL пользователя, next/image неприменим */}
          <img
            src={previewUrl}
            alt="Скриншот инвентаря"
            className="block w-full"
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />
          {natural && (
            <svg
              viewBox={`0 0 ${natural.w} ${natural.h}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {result.slots.map((slot, index) => {
                const px = rectToPx(result.geometry, slot.rect);
                const isSelected = selectedSlot === index;
                return (
                  <rect
                    key={index}
                    x={px.x}
                    y={px.y}
                    width={px.w}
                    height={px.h}
                    fill="transparent"
                    stroke={KIND_STROKE[slot.kind]}
                    strokeWidth={isSelected ? 5 : 3}
                    className="pointer-events-auto cursor-pointer"
                    style={{ opacity: isSelected ? 1 : 0.85 }}
                    onClick={() => selectSlot(isSelected ? null : index)}
                  />
                );
              })}
            </svg>
          )}
        </div>
      )}

      {/* Поповер ручного выбора для выбранного нераспознанного слота */}
      {result && selectedSlot !== null && result.slots[selectedSlot]?.kind === 'unknown' && (
        <ManualPickPanel
          candidates={
            (result.slots[selectedSlot] as Extract<RecognizedSlot, { kind: 'unknown' }>).candidates
          }
          currentId={manualPicks[selectedSlot]}
          onPick={(itemId) =>
            setManualPicks((prev) => ({ ...prev, [selectedSlot]: itemId }))
          }
          onClose={() => selectSlot(null)}
        />
      )}

      {/* Список распознанных предметов + цены */}
      {result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              Найдено предметов · {result.slots.length}
            </span>
            <div className="h-px flex-1 bg-lines-hover" />
            <span className="shrink-0 font-blender-medium text-xs text-text-primary">
              Итого {formatRub(total)}
            </span>
          </div>

          <ul className="flex flex-col divide-y divide-lines-hover overflow-hidden rounded-md border border-lines-hover bg-card-menu">
            {recognizedRows.map((row) => (
              <li
                key={row.index}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                  selectedSlot === row.index ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: KIND_STROKE[row.slot.kind] }}
                />
                <button
                  type="button"
                  onClick={() => selectSlot(selectedSlot === row.index ? null : row.index)}
                  className="flex-1 truncate text-left font-blender-book text-text-primary hover:text-(--primary)"
                >
                  {row.name}
                </button>
                <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                  {KIND_LABEL[row.slot.kind]}
                </span>
                <span className="w-28 shrink-0 text-right font-blender-medium text-xs text-text-secondary">
                  {formatRub(row.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FailureCard({ failure }: { failure: ScanFailure }) {
  const { title, hint } = failureCopy(failure);
  return (
    <div className="flex items-start gap-4 rounded-md border border-danger-dim bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-5">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
      <div className="flex flex-col gap-1">
        <span className="font-blender-medium uppercase tracking-widest text-text-primary">
          {title}
        </span>
        <span className="text-sm text-text-secondary font-blender-book">{hint}</span>
      </div>
    </div>
  );
}

interface ManualPickPanelProps {
  candidates: Extract<RecognizedSlot, { kind: 'unknown' }>['candidates'];
  currentId: string | undefined;
  onPick: (itemId: string) => void;
  onClose: () => void;
}

function ManualPickPanel({ candidates, currentId, onPick, onClose }: ManualPickPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-tactical-amber bg-card-menu p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-tactical-amber">
          Выбери предмет вручную
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
        >
          Закрыть
        </button>
      </div>
      {candidates.length === 0 ? (
        <span className="text-sm text-text-secondary font-blender-book">
          Кандидатов нет — предмет не удалось сопоставить с базой.
        </span>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {candidates.map((c) => {
            const active = c.itemId === currentId;
            return (
              <li key={c.itemId}>
                <button
                  type="button"
                  onClick={() => onPick(c.itemId)}
                  className={`rounded border px-3 py-1.5 font-blender-book transition-colors ${
                    active
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-text-primary'
                      : 'border-lines-hover bg-(--color-base) text-text-secondary hover:border-(--primary) hover:text-text-primary'
                  }`}
                >
                  {c.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
